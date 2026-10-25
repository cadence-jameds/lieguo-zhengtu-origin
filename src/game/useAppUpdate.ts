import {assertUpdateActive,updateDeadline,UpdateTimeoutError,UPDATE_LIMITS,UPDATE_PHASE_LABELS,type UpdatePhase} from './updateDeadline';
import {UpdateSafetyError} from './updateEligibility';
import {useCallback,useEffect,useRef,useState} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {RELEASE} from './release';

type UpdateMetadata={version?:unknown;commitSha?:unknown;contentSha?:unknown};
const validContent=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const live=(worker:ServiceWorker|null)=>!!worker&&worker.state!=='redundant';
const usable=(r:ServiceWorkerRegistration)=>[r.active,r.waiting,r.installing].some(w=>live(w));
/** At most two update attempts, one scope lookup and one same-scope registration. Never remove site data. */
export async function refreshRegistration(cached:ServiceWorkerRegistration|undefined,container:ServiceWorkerContainer,scriptURL:string,beforeRegister?:()=>Promise<void>,forceUpdate=false,signal?:AbortSignal,onStep?:(phase:UpdatePhase)=>void){
 const scope=new URL(import.meta.env.BASE_URL,window.location.href);
 const script=new URL(scriptURL,window.location.href);
 if(script.origin!==scope.origin||script.pathname!==scope.pathname+'sw.js')throw Error('Invalid update script');
 const own=(r:ServiceWorkerRegistration)=>r.scope===scope.href&&[r.active,r.waiting,r.installing].every(w=>!live(w)||w!.scriptURL===script.href);
 const refresh=async(r:ServiceWorkerRegistration)=>{assertUpdateActive(signal);if(forceUpdate||(!live(r.waiting)&&!live(r.installing))){onStep?.('downloading');await updateDeadline(r.update(),UPDATE_LIMITS.registration,'registration.update',signal);}return r;};
 let rejected:unknown;
 if(cached&&own(cached)&&usable(cached))try{return await refresh(cached);}catch(error){if(error instanceof UpdateTimeoutError||signal?.aborted)throw error;rejected=error;}
 assertUpdateActive(signal);onStep?.('preparing');let r=await updateDeadline(container.getRegistration(scope.href),UPDATE_LIMITS.registration,'getRegistration',signal);
 // Chromium versions also reject an unregistered reference with TypeError/"Not found".
 // Retry those only if lookup actually proves the registration was replaced/removed.
 const invalidState=!!rejected&&typeof rejected==='object'&&'name' in rejected&&rejected.name==='InvalidStateError';
 if(rejected&&!invalidState&&r===cached)throw rejected;
 if(!r||!own(r)||!usable(r)){
  // A new registration can activate immediately instead of waiting. Only an explicit,
  // durably saved update attempt may create it; discovery/background checks never do.
  if(!beforeRegister)throw Error('Update registration unavailable');
  await beforeRegister();assertUpdateActive(signal);onStep?.('downloading');
  r=await updateDeadline(container.register(script.href,{scope:scope.href,type:'classic',updateViaCache:'none'}),UPDATE_LIMITS.registration,'register',signal);
  if(!own(r))throw Error('Invalid update registration');
  return r; // register() may have just started the first installation; update() is invalid before a newest worker exists.
 }
 return refresh(r);
}
export function releaseUpdate(data:UpdateMetadata,loaded=RELEASE){
 if(typeof data.version!=='string'||!/^\d+\.\d+\.\d+$/.test(data.version))throw Error('Invalid release version');
 const a=data.version.split('.').map(Number),b=loaded.version.split('.').map(Number);
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];
 // commitSha traces a deployment; docs-only rebuilds retain contentSha.
 return validContent(data.contentSha)&&validContent(loaded.contentSha)&&data.contentSha!==loaded.contentSha;
}
/** Wait for the new cache to finish installing; a normal reload can still use the old cache. */
export function waitForWaiting(registration:ServiceWorkerRegistration,_recreatedContainer?:ServiceWorkerContainer,_priorController?:ServiceWorker|null,signal?:AbortSignal):Promise<ServiceWorker>{
 let dispose=()=>{};
 const operation=new Promise<ServiceWorker>((resolve,reject)=>{
  let watched:ServiceWorker|null=null;
  const inspect=(event?:Event,poll=false)=>{const pending=registration.installing;
   if(live(registration.waiting)&&(!live(pending)||registration.waiting===pending)){resolve(registration.waiting!);return;}
   if(pending?.state==='installed'&&(poll||event?.type==='statechange')){resolve(pending);return;}
   if(!live(pending)&&registration.active?.state==='activated'){resolve(registration.active);return;}
   if(pending!==watched){watched?.removeEventListener('statechange',inspect);watched=pending;watched?.addEventListener('statechange',inspect);}if(watched?.state==='redundant')reject(Error('新版下載失敗'));
  };
  const poll=setInterval(()=>inspect(undefined,true),250);registration.addEventListener('updatefound',inspect);_recreatedContainer?.addEventListener('controllerchange',inspect);document.addEventListener('visibilitychange',inspect);window.addEventListener('pageshow',inspect);
  dispose=()=>{clearInterval(poll);registration.removeEventListener('updatefound',inspect);_recreatedContainer?.removeEventListener('controllerchange',inspect);watched?.removeEventListener('statechange',inspect);document.removeEventListener('visibilitychange',inspect);window.removeEventListener('pageshow',inspect);};inspect();
 });
 return updateDeadline(operation,UPDATE_LIMITS.download,'installation',signal).finally(dispose);
}
/** A waiting docs-only worker can coexist with metadata for a later playable release.
 * Ask this worker for its own build identity, including when the network is offline. */
export function verifyWorkerRelease(worker:ServiceWorker,target?:UpdateMetadata,signal?:AbortSignal):Promise<UpdateMetadata>{
 let dispose=()=>{};
 const operation=new Promise<UpdateMetadata>((resolve,reject)=>{
  let settled=false;const channel=new MessageChannel();
  dispose=()=>{settled=true;channel.port1.close();channel.port2.close();};
  const finish=(data?:UpdateMetadata)=>{if(settled)return;dispose();data?resolve(data):reject(new Error('新版內容尚未核對完成，請稍後再試。'));};
  channel.port1.onmessage=event=>{
   try{const data=event.data;
   const matches=data&&validContent(data.contentSha)&&releaseUpdate(data)&&(!target||(data.version===target.version&&(!validContent(target.contentSha)||data.contentSha===target.contentSha)));
   finish(matches?data:undefined);}catch{finish();}
  };
  try{assertUpdateActive(signal);worker.postMessage({type:'GET_APP_RELEASE'},[channel.port2]);}catch{finish();}
 });
 return updateDeadline(operation,UPDATE_LIMITS.identity,'worker identity',signal).finally(dispose);
}
export function activateWaiting(worker:ServiceWorker,container:ServiceWorkerContainer,signal?:AbortSignal,identity?:UpdateMetadata):Promise<void>{
 assertUpdateActive(signal);
 if(container.controller===worker&&worker.state==='activated')return Promise.resolve();
 let dispose=()=>{};
 const operation=new Promise<void>((resolve,reject)=>{
  let validating:ServiceWorker|null=null;
  const inspect=(event?:Event)=>{const current=container.controller;
   if(current===worker&&(worker.state==='activated'||event?.type==='controllerchange')){resolve();return;}
   // Object identity alone is insufficient when a new registration/controller wrapper appears.
   // Verify the actual current controller's immutable content identity before navigation.
   if(identity&&current&&current!==worker&&current.state==='activated'&&current!==validating){validating=current;void verifyWorkerRelease(current,identity,signal).then(()=>{if(container.controller===current){assertUpdateActive(signal);resolve();}},()=>{}).catch(()=>{});}
  };
  const poll=setInterval(inspect,250);container.addEventListener('controllerchange',inspect);worker.addEventListener('statechange',inspect);document.addEventListener('visibilitychange',inspect);window.addEventListener('focus',inspect);window.addEventListener('pageshow',inspect);
  dispose=()=>{clearInterval(poll);container.removeEventListener('controllerchange',inspect);worker.removeEventListener('statechange',inspect);document.removeEventListener('visibilitychange',inspect);window.removeEventListener('focus',inspect);window.removeEventListener('pageshow',inspect);};
  try{if(worker.state!=='activated')worker.postMessage({type:'SKIP_WAITING'});inspect();}catch(error){reject(error);}
 });
 return updateDeadline(operation,UPDATE_LIMITS.activation,'activation',signal).finally(dispose);
}
function reloadPage(url:string,signal:AbortSignal){
 let dispose=()=>{};const navigation=new Promise<void>((resolve,reject)=>{const left=()=>resolve();window.addEventListener('pagehide',left,{once:true});dispose=()=>window.removeEventListener('pagehide',left);try{assertUpdateActive(signal);window.location.replace(url);}catch(error){reject(error);}});
 return updateDeadline(navigation,UPDATE_LIMITS.navigation,'navigation',signal).finally(dispose);
}
export function useAppUpdate(save:()=>Promise<void|'no-campaign'|'historical'>){
 const [phase,setPhase]=useState<UpdatePhase>('idle');
 const activeRun=useRef<AbortController|null>(null),background=useRef<AbortController|null>(null),pendingSave=useRef<Promise<void|'no-campaign'|'historical'>|null>(null);
 const [text,setText]=useState(''),[outcome,setOutcome]=useState(''),[version,setVersion]=useState(''),[ready,setReady]=useState(false),[updating,setUpdating]=useState(false);
 const registration=useRef<ServiceWorkerRegistration|undefined>(undefined),checking=useRef(false),loading=useRef(false),latest=useRef(''),waiting=useRef(false),currentContent=useRef(false);
 const attemptEpoch=useRef(0);
 const targetRelease=useRef<UpdateMetadata|undefined>(undefined);
 const scriptURL=useRef(import.meta.env.BASE_URL+'sw.js');
 const [reloadNotice]=useState(()=>{const q=new URL(window.location.href).searchParams,target=q.get('_appUpdate'),content=q.get('_appUpdateContent');if(!target)return '';const mismatch=(/^\d+\.\d+\.\d+$/.test(target)?target!==RELEASE.version:validContent(target)&&target!==RELEASE.contentSha)||(validContent(content)&&content!==RELEASE.contentSha);return mismatch?'重新載入後仍未取得預期新版；請先確認進度並匯出備份，再檢查更新。 ':'已載入預期新版 v'+RELEASE.version+'。 ';});
 const refresh=useCallback(async(beforeRegister?:()=>Promise<void>,forceUpdate=false,signal?:AbortSignal,onStep?:(phase:UpdatePhase)=>void)=>{if(!('serviceWorker' in navigator))return;const r=await refreshRegistration(registration.current,navigator.serviceWorker,scriptURL.current,beforeRegister,forceUpdate,signal,onStep);assertUpdateActive(signal);registration.current=r;waiting.current=live(r.waiting);return r;},[]);
 const embedded=!!window.__FORMAL_EMBEDDED_ASSETS;
 const check=useCallback(async(manual=true)=>{
  if(manual)setOutcome('');
  if(embedded){setText('目前為離線試玩包 v'+RELEASE.version+'。新版請使用新的試玩檔案。');return;}
  if(checking.current||loading.current)return;checking.current=true;const epoch=attemptEpoch.current,checkRun=new AbortController();background.current=checkRun;
  try{
   const url=new URL(import.meta.env.BASE_URL+'version.json',window.location.href);url.searchParams.set('_check',String(Date.now()));
   const data:UpdateMetadata=await updateDeadline((async()=>{const r=await fetch(url,{cache:'no-store',signal:checkRun.signal});if(!r.ok)throw new Error();return r.json();})(),UPDATE_LIMITS.metadata,'version metadata',checkRun.signal);
   if(loading.current||epoch!==attemptEpoch.current)return; // A check started before the click must not overwrite this attempt's save status.
   if(typeof data.version!=='string'||!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error();
   // Keep a successful same-content check across a later outage, including a SW that finishes installing afterward.
   const verified=data.version===RELEASE.version&&validContent(data.contentSha)&&data.contentSha===RELEASE.contentSha;
   if(releaseUpdate(data)){targetRelease.current={version:data.version,contentSha:data.contentSha};currentContent.current=false;latest.current=data.version===RELEASE.version&&validContent(data.contentSha)?data.contentSha:data.version;setVersion(data.version);setText((data.version===RELEASE.version?'可用更新建置 v':'可用新版 v')+data.version+'；可保存進度並更新。');}
   else if(verified){targetRelease.current=undefined;currentContent.current=true;latest.current='';setVersion('');setReady(false);}
   if(!latest.current){setReady(waiting.current&&!currentContent.current);setText(currentContent.current?'目前已載入 v'+RELEASE.version+'，已確認為最新版本。':waiting.current?'網站更新已下載完成，可保存進度並更新。':'目前已載入 v'+RELEASE.version+'；網站未提供可核對的內容識別，僅確認數字版本。');}
   // Metadata remains authoritative when a stale SW reference cannot be refreshed.
   try{if(registration.current)await refresh(undefined,true,checkRun.signal);}catch{if(loading.current||epoch!==attemptEpoch.current)return;registration.current=undefined;if(latest.current)setText('已發現新版，但更新元件尚未就緒；請按更新安全重試。本次尚未執行保存。');}
  }catch{if(loading.current||epoch!==attemptEpoch.current)return;if(waiting.current&&!currentContent.current){setReady(true);setText('更新已下載完成，可保存進度並更新；目前無法連線核對網站。');}else if(!latest.current){setReady(false);setText('目前無法確認更新；本機戰役仍可繼續。');}}
  finally{checkRun.abort();if(background.current===checkRun){background.current=null;checking.current=false;}}
 },[embedded,refresh]);
 useEffect(()=>{
  if(embedded){void check(false);return;}
  let disposed=false;
  registerSW({immediate:true,onNeedReload(){/* Activation never reloads before the explicit save below. */},onNeedRefresh(){if(!disposed){waiting.current=true;void check(false);}},onRegisteredSW(url,r){if(!disposed){scriptURL.current=url;if(!loading.current)registration.current=r;}},onRegisterError(){if(!disposed&&!loading.current)setText('更新元件尚未就緒；本機戰役可繼續，請稍後檢查更新。');}});
  void check(false);const visible=()=>{if(!document.hidden)void check(false);};const timer=setInterval(visible,60000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);window.addEventListener('online',visible);
  return()=>{disposed=true;activeRun.current?.abort();activeRun.current=null;loading.current=false;background.current?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);};
 },[check,embedded]);
 const update=async()=>{
  if(embedded||loading.current)return;
  attemptEpoch.current++;background.current?.abort();checking.current=false;loading.current=true;
  const run=new AbortController();activeRun.current=run;setOutcome('');setUpdating(true);
  let saved=false,noCampaign=false,historical=false,failedPhase:UpdatePhase='preparing';
  const preservation=()=>saved?'遊戲進度已成功保存（本次保存已確認）；':historical?'歷史資料原樣保留，未執行戰役保存；':noCampaign?'目前沒有開啟戰役；':'';
  const show=(next:UpdatePhase)=>{assertUpdateActive(run.signal);if(activeRun.current!==run)throw new DOMException('Stale update','AbortError');failedPhase=next;setPhase(next);setText((next==='saved'?'':preservation())+UPDATE_PHASE_LABELS[next]);};
  const confirmSave=async()=>{
   if(saved||noCampaign||historical)return;show('saving');
   // A timed-out native save may still commit. Never overlap it with a second save,
   // and never reuse its late ACK as proof of the current attempt's world state.
   if(pendingSave.current)await updateDeadline(pendingSave.current.catch(()=>{}),UPDATE_LIMITS.save,'previous save',run.signal);
   assertUpdateActive(run.signal);const operation=Promise.resolve().then(()=>{assertUpdateActive(run.signal);return save();});pendingSave.current=operation;
   void operation.then(()=>{if(pendingSave.current===operation)pendingSave.current=null;},()=>{if(pendingSave.current===operation)pendingSave.current=null;});
   const result=await updateDeadline(operation,UPDATE_LIMITS.save,'durable save',run.signal);
   noCampaign=result==='no-campaign';historical=result==='historical';saved=!noCampaign&&!historical;
   if(saved)show('saved');else{setText(preservation());}
  };
  const work=async()=>{
   show('preparing');let worker:ServiceWorker|undefined,selectedRegistration:ServiceWorkerRegistration|undefined,identity:UpdateMetadata|undefined;
   const target=targetRelease.current;
   if('serviceWorker' in navigator){
    const r=await refresh(confirmSave,false,run.signal,show);if(!r)throw Error('新版尚未備妥');selectedRegistration=r;
    show('downloading');worker=await waitForWaiting(r,navigator.serviceWorker,undefined,run.signal);
    show('verifying');identity=await verifyWorkerRelease(worker,target,run.signal);
   }
   await confirmSave();assertUpdateActive(run.signal);
   if(worker&&(!live(worker)||!((worker.state==='activated'&&selectedRegistration?.active===worker)||(worker.state==='installed'&&[selectedRegistration?.waiting,selectedRegistration?.installing].includes(worker)))))throw Error('新版元件已變更');
   show('activating');if(worker)await activateWaiting(worker,navigator.serviceWorker,run.signal,identity);
   assertUpdateActive(run.signal);show('reloading');
   const url=new URL(window.location.href);url.searchParams.set('_appUpdate',latest.current||String(identity?.contentSha??Date.now()));if(validContent(identity?.contentSha))url.searchParams.set('_appUpdateContent',identity.contentSha);
   await reloadPage(url.href,run.signal);
  };
  try{await updateDeadline(work(),UPDATE_LIMITS.total,'overall',run.signal);}
  catch(error){
   if(activeRun.current!==run)return;
   const stage=failedPhase as UpdatePhase,timeout=error instanceof UpdateTimeoutError;
   setPhase('failed');
   setOutcome(error instanceof UpdateSafetyError?'更新已暫停：'+error.message:stage==='saving'?'未取得保存完成確認，已停止載入新版；不能確認本次保存成功。請先手動保存或匯出備份後再重試。':stage==='activating'?preservation()+(timeout?'新版啟用等待逾時':'新版啟用失敗')+'，目前頁面保留，更新未完成；可安全重試。':stage==='reloading'?preservation()+'重新載入未完成，目前頁面保留；請安全重試。':(stage==='preparing'?'新版準備逾時或更新元件失效；':stage==='verifying'?'新版下載尚未完成，內容驗證未通過；':'新版下載尚未完成或更新元件失效；')+(preservation()||'本次尚未執行保存。')+'更新未完成，可安全重試；若仍失敗，請先手動保存並匯出備份，再一般重新整理。');
  }
  finally{run.abort();if(activeRun.current===run){activeRun.current=null;loading.current=false;setUpdating(false);}}
 };
 return{text:reloadNotice+(outcome||text),available:ready||!!version,updating,phase,label:UPDATE_PHASE_LABELS[phase],check,update};
}
