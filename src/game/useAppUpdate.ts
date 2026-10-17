import {useCallback,useEffect,useRef,useState} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {RELEASE} from './release';

type UpdateMetadata={version?:unknown;commitSha?:unknown;contentSha?:unknown};
const validContent=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const live=(worker:ServiceWorker|null)=>!!worker&&worker.state!=='redundant';
const usable=(r:ServiceWorkerRegistration)=>[r.active,r.waiting,r.installing].some(w=>live(w));
/** At most two update attempts, one scope lookup and one same-scope registration. Never remove site data. */
export async function refreshRegistration(cached:ServiceWorkerRegistration|undefined,container:ServiceWorkerContainer,scriptURL:string,beforeRegister?:()=>Promise<void>,forceUpdate=false){
 const scope=new URL(import.meta.env.BASE_URL,window.location.href);
 const script=new URL(scriptURL,window.location.href);
 if(script.origin!==scope.origin||script.pathname!==scope.pathname+'sw.js')throw Error('Invalid update script');
 const own=(r:ServiceWorkerRegistration)=>r.scope===scope.href&&[r.active,r.waiting,r.installing].every(w=>!live(w)||w!.scriptURL===script.href);
 const refresh=async(r:ServiceWorkerRegistration)=>{if(forceUpdate||(!live(r.waiting)&&!live(r.installing)))await r.update();return r;};
 let rejected:unknown;
 if(cached&&own(cached)&&usable(cached))try{return await refresh(cached);}catch(error){rejected=error;}
 let r=await container.getRegistration(scope.href);
 // Chromium versions also reject an unregistered reference with TypeError/"Not found".
 // Retry those only if lookup actually proves the registration was replaced/removed.
 const invalidState=!!rejected&&typeof rejected==='object'&&'name' in rejected&&rejected.name==='InvalidStateError';
 if(rejected&&!invalidState&&r===cached)throw rejected;
 if(!r||!own(r)||!usable(r)){
  // A new registration can activate immediately instead of waiting. Only an explicit,
  // durably saved update attempt may create it; discovery/background checks never do.
  if(!beforeRegister)throw Error('Update registration unavailable');
  await beforeRegister();
  r=await container.register(script.href,{scope:scope.href,type:'classic',updateViaCache:'none'});
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
export function waitForWaiting(registration:ServiceWorkerRegistration,recreatedContainer?:ServiceWorkerContainer,priorController?:ServiceWorker|null):Promise<ServiceWorker>{
 return new Promise((resolve,reject)=>{
  let watched:ServiceWorker|null=null,settled=false;
  const finish=(worker?:ServiceWorker)=>{if(settled)return;settled=true;clearTimeout(timer);registration.removeEventListener('updatefound',inspect);recreatedContainer?.removeEventListener('controllerchange',inspect);watched?.removeEventListener('statechange',inspect);worker?resolve(worker):reject(new Error('新版下載尚未完成，請稍後再試。'));};
  const inspect=()=>{if(live(registration.waiting)&&(!live(registration.installing)||registration.waiting===registration.installing)){finish(registration.waiting!);return;}if(recreatedContainer?.controller&&recreatedContainer.controller!==priorController&&registration.active===recreatedContainer.controller&&!live(registration.installing)){finish(registration.active);return;}const worker=registration.installing;if(worker!==watched){watched?.removeEventListener('statechange',inspect);watched=worker;watched?.addEventListener('statechange',inspect);}if(watched?.state==='redundant')finish();};
  const timer=setTimeout(()=>finish(),30000);registration.addEventListener('updatefound',inspect);recreatedContainer?.addEventListener('controllerchange',inspect);inspect();
 });
}
export function activateWaiting(worker:ServiceWorker,container:ServiceWorkerContainer):Promise<void>{
 if(container.controller===worker&&worker.state==='activated')return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const finish=(error?:Error)=>{clearTimeout(timer);container.removeEventListener('controllerchange',changed);error?reject(error):resolve();};
  const changed=()=>{if(container.controller===worker)finish();};
  const timer=setTimeout(()=>finish(new Error('新版啟用等待逾時，請稍後再試。')),15000);
  container.addEventListener('controllerchange',changed);
  try{worker.postMessage({type:'SKIP_WAITING'});}catch(error){finish(error instanceof Error?error:new Error('新版無法啟用。'));}
 });
}
export function useAppUpdate(save:()=>Promise<void|'no-campaign'>){
 const [text,setText]=useState(''),[version,setVersion]=useState(''),[ready,setReady]=useState(false),[updating,setUpdating]=useState(false);
 const registration=useRef<ServiceWorkerRegistration|undefined>(undefined),checking=useRef(false),loading=useRef(false),latest=useRef(''),waiting=useRef(false),currentContent=useRef(false);
 const scriptURL=useRef(import.meta.env.BASE_URL+'sw.js');
 const [reloadNotice]=useState(()=>{const target=new URL(window.location.href).searchParams.get('_appUpdate');return target&&(/^\d+\.\d+\.\d+$/.test(target)?releaseUpdate({version:target}):validContent(target)&&target!==RELEASE.contentSha)?'重新載入後仍未取得預期新版；請先確認進度並匯出備份，再檢查更新。 ':'';});
 const refresh=useCallback(async(beforeRegister?:()=>Promise<void>,forceUpdate=false)=>{if(!('serviceWorker' in navigator))return;const r=await refreshRegistration(registration.current,navigator.serviceWorker,scriptURL.current,beforeRegister,forceUpdate);registration.current=r;waiting.current=live(r.waiting);return r;},[]);
 const embedded=!!window.__FORMAL_EMBEDDED_ASSETS;
 const check=useCallback(async()=>{
  if(embedded){setText('目前為離線試玩包 v'+RELEASE.version+'。新版請使用新的試玩檔案。');return;}
  if(checking.current||loading.current)return;checking.current=true;
  try{
   const url=new URL(import.meta.env.BASE_URL+'version.json',window.location.href);url.searchParams.set('_check',String(Date.now()));
   const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();const data=await r.json();
   if(loading.current)return; // A check started before the click must not overwrite this attempt's save status.
   if(typeof data.version!=='string'||!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error();
   // Keep a successful same-content check across a later outage, including a SW that finishes installing afterward.
   const verified=data.version===RELEASE.version&&validContent(data.contentSha)&&data.contentSha===RELEASE.contentSha;
   if(releaseUpdate(data)){currentContent.current=false;latest.current=data.version===RELEASE.version?data.contentSha:data.version;setVersion(data.version);setText((data.version===RELEASE.version?'可用更新建置 v':'可用新版 v')+data.version+'；可保存進度並更新。');}
   else if(verified){currentContent.current=true;latest.current='';setVersion('');setReady(false);}
   if(!latest.current){setReady(waiting.current&&!currentContent.current);setText(currentContent.current?'目前已載入 v'+RELEASE.version+'，已確認為最新版本。':waiting.current?'網站更新已下載完成，可保存進度並更新。':'目前已載入 v'+RELEASE.version+'；網站未提供可核對的內容識別，僅確認數字版本。');}
   // Metadata remains authoritative when a stale SW reference cannot be refreshed.
   try{if(registration.current)await refresh(undefined,true);}catch{if(latest.current&&!loading.current)setText('已發現新版，但更新元件尚未就緒；請按更新安全重試。本次尚未執行保存。');}
  }catch{if(loading.current)return;if(waiting.current&&!currentContent.current){setReady(true);setText('更新已下載完成，可保存進度並更新；目前無法連線核對網站。');}else if(!latest.current){setReady(false);setText('目前無法確認更新；本機戰役仍可繼續。');}}
  finally{checking.current=false;}
 },[embedded,refresh]);
 useEffect(()=>{
  if(embedded){void check();return;}
  let disposed=false;
  registerSW({immediate:true,onNeedReload(){/* Activation never reloads before the explicit save below. */},onNeedRefresh(){if(!disposed){waiting.current=true;void check();}},onRegisteredSW(url,r){if(!disposed){scriptURL.current=url;registration.current=r;}},onRegisterError(){if(!disposed&&!loading.current)setText('更新元件尚未就緒；本機戰役可繼續，請稍後檢查更新。');}});
  void check();const visible=()=>{if(!document.hidden)void check();};const timer=setInterval(visible,60000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);window.addEventListener('online',visible);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);};
 },[check,embedded]);
 const update=async()=>{
  if(embedded||loading.current)return;loading.current=true;setUpdating(true);setText('正在準備新版…');
  let phase:'prepare'|'save'|'activate'='prepare',saved=false,noCampaign=false;
  const confirmSave=async()=>{if(saved||noCampaign)return;phase='save';setText('正在保存進度…');noCampaign=(await save())==='no-campaign';saved=!noCampaign;phase='prepare';};
  try{
   let worker:ServiceWorker|undefined,alreadyControlled=false;
   if('serviceWorker' in navigator){
    const priorController=navigator.serviceWorker.controller;let recreated=false;const r=await refresh(async()=>{await confirmSave();recreated=true;});
    if(!r)throw new Error('新版尚未備妥，請稍後再試。');
    worker=await waitForWaiting(r,recreated?navigator.serviceWorker:undefined,priorController);
    alreadyControlled=recreated&&r.active===worker&&worker.state==='activated';
   }
   await confirmSave();
   phase='activate';setText(saved?'本次保存已確認，正在載入新版…':'目前沒有開啟戰役，正在載入新版…');if(worker&&!alreadyControlled)await activateWaiting(worker,navigator.serviceWorker);
   const url=new URL(window.location.href);url.searchParams.set('_appUpdate',latest.current||String(Date.now()));window.location.replace(url.href);
  }catch(error){
   const timeout=error instanceof Error&&error.message.includes('逾時');
   // confirmSave also changes this value inside a callback awaited by refreshRegistration.
   const failedPhase=phase as 'prepare'|'save'|'activate';
   setText(failedPhase==='prepare'?'新版下載尚未完成或更新元件失效；'+(saved?'本次保存已確認。':noCampaign?'目前沒有開啟戰役。':'本次尚未執行保存。')+'請稍後按更新重試；若仍失敗，請先手動保存並匯出備份，再一般重新整理。':failedPhase==='save'?'未取得保存完成確認，已停止載入新版；不能確認本次保存成功。請先手動保存或匯出備份後再重試。':(saved?'本次保存已確認；':noCampaign?'目前沒有開啟戰役；':'')+(timeout?'新版啟用等待逾時':'新版啟用失敗')+'，目前頁面保留。請稍後重試；若仍失敗，請先匯出備份，再一般重新整理。');
  }
  finally{loading.current=false;setUpdating(false);}
 };
 return{text:reloadNotice+text,available:ready||!!version,updating,check,update};
}
