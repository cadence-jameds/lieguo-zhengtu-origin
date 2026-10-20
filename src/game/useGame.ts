import {feedbackForAck,uncertainFeedback,type CommandFeedback} from './commandFeedback';
import {useCallback,useEffect,useRef,useState} from 'react';
import {effectiveSpeed} from './formal/playtest';
import {withSaveLock} from './saveLock';
import {commandId} from './formal/ids';
import type {CommandAck,FormalCommand,FormalOrder,FormalReport,FormalWorld} from './formal/model';
import type {OfflineSummary} from './formal/offline';
import type {RuntimeRequest} from './runtime.worker';
import {PendingRequests,PendingCommand,reconcileWorld} from './interaction';
import {playerOrderBase} from './orderAdmission';
import {displayClock} from './presentation/liveClock';
import type {CityIntel} from './formal/combatModel';
import {applyWorldPatch} from './worldStream';
import {governanceBase,type GovernanceBase} from './governanceAdmission';
export function useGame(){
 const [world,setWorld]=useState<FormalWorld|null>(null),[status,setStatus]=useState<'loading'|'ready'|'error'|'locked'>('loading');
 const [offline,setOffline]=useState<OfflineSummary|null>(null);
 const [loadPhase,setLoadPhase]=useState('啟動世界引擎'),[loadProgress,setLoadProgress]=useState<number|null>(null),[loadEvents,setLoadEvents]=useState(0);
 const stopCurrentLoad=useRef<(()=>void)|null>(null);
 const [feedback,setFeedback]=useState<CommandFeedback>({kind:'idle',text:''});
 const commandTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [transition,setTransition]=useState(''),[synced,setSynced]=useState(0),[reportCount,setReportCount]=useState(0),[reportEpoch,setReportEpoch]=useState(0),[reportStatus,setReportStatus]=useState({unread:0,alerts:0,counts:{all:0,battle:0,diplomacy:0,chronicle:0}}),[reportData,setReportData]=useState<{page:number;filter:string;count:number}|null>(null);
 const [backups,setBackups]=useState<{id:number;at:number;label:string;time:number}[]>([]),[reports,setReports]=useState<FormalReport[]>([]);
 const worker=useRef<Worker|null>(null),current=useRef<FormalWorld|null>(null);
 const intelQueries=useRef(new Map<string,{resolve:(value:CityIntel)=>void;reject:(error:Error)=>void}>());
 const readCityIntel=useCallback((snapshot:FormalWorld,cityId:string,generation?:number)=>new Promise<CityIntel>((resolve,reject)=>{if(!worker.current){resolve({});return;}const queryId=crypto.randomUUID();intelQueries.current.set(queryId,{resolve,reject});worker.current.postMessage({type:'cityIntel',queryId,cityId,...(generation!==undefined?{generation}:{}),campaignId:snapshot.campaignId,reportCursor:snapshot.sequences.report,time:snapshot.time});}),[]);
 const rejectIntel=()=>{for(const q of intelQueries.current.values())q.reject(new Error('情報查詢已中斷。'));intelQueries.current.clear();};
 const requests=useRef(new PendingRequests()),commands=useRef(new PendingCommand());
 const saves=useRef(new Map<string,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
 const finishSave=(id:string,error?:Error)=>{const pending=saves.current.get(id);if(!pending)return;clearTimeout(pending.timer);saves.current.delete(id);error?pending.reject(error):pending.resolve();};
 const rejectSaves=(error:Error)=>{for(const id of saves.current.keys())finishSave(id,error);};
 const sync=useCallback(()=>new Promise<void>((resolve,reject)=>{
  if(!worker.current){reject(new Error('存檔尚未就緒。'));return;}
  const requestId=crypto.randomUUID();
  const timer=setTimeout(()=>{finishSave(requestId,new Error('保存等待逾時，請稍後再試。'));requests.current.finish(requestId);setBusy(requests.current.busy);},30000);
  saves.current.set(requestId,{resolve,reject,timer});requests.current.add(requestId);setBusy(true);worker.current.postMessage({type:'sync',requestId});
 }),[]);
 const send=useCallback((r:RuntimeRequest)=>{if(worker.current){const requestId=crypto.randomUUID();
  if(r.type==='command'){if(commands.current.busy)return;commands.current.track(r.order.commandId);setError('');setNotice('指令受理中：已送出，等待引擎確認。');setFeedback({kind:'sending',text:'指令已送出，等待引擎受理。'});clearTimeout(commandTimer.current);commandTimer.current=setTimeout(()=>{if(commands.current.matches(r.order.commandId))setFeedback(uncertainFeedback);},30000);}
  requests.current.add(requestId);setBusy(true);worker.current.postMessage({...r,requestId});}},[]);
 useEffect(()=>{
  let disposed=false,release:(()=>void)|undefined;const abort=new AbortController();
  if(!navigator.locks){setStatus('error');setError('瀏覽器無法鎖定正式存檔，請使用支援 Web Locks 的瀏覽器。');return;}
  void withSaveLock(navigator.locks,abort.signal,async()=>{
   if(disposed)return;
   const w=new Worker(new URL('./runtime.worker.ts',import.meta.url),{type:'module'});worker.current=w;
   let loading=true,lastEvents=-1,watchdog:ReturnType<typeof setTimeout>|undefined;
   const clearWatchdog=()=>{clearTimeout(watchdog);watchdog=undefined;};
   const stop=(message:string)=>{
    if(worker.current!==w)return;
    clearWatchdog();w.terminate();worker.current=null;loading=false;rejectIntel();rejectSaves(new Error(message));requests.current.clear();commands.current.clear();displayClock.stop();setBusy(false);setError(message);setStatus('error');
   };
   const arm=()=>{clearWatchdog();watchdog=setTimeout(()=>stop('載入階段「'+loadStage+'」超過 30 秒沒有回應。已停止本次載入，原有存檔與回復點保留，請重新整理後重試。'),30000);};
   let loadStage='啟動世界引擎';
   stopCurrentLoad.current=()=>stop('已停止載入，原有存檔與回復點保留，請重新整理後重試。');
   setLoadPhase(loadStage);setLoadProgress(null);setLoadEvents(0);arm();
   w.onmessage=e=>{
    if(disposed||worker.current!==w)return;
    const msg=e.data;
    if(msg.type==='phase'){
     loading=true;loadStage=msg.text;setLoadPhase(loadStage);
     // Every load/resume has its own monotonically increasing event count.
     // A smaller second replay must still refresh the watchdog.
     if(loadStage==='讀取與驗證本機存檔'){lastEvents=-1;setLoadProgress(null);setLoadEvents(0);}
     setStatus('loading');arm();return;
    }
    if(msg.type==='progress'){
     if(loading&&Number.isFinite(msg.progress))setLoadProgress(Math.max(0,Math.min(1,msg.progress)));
     if(loading&&Number.isFinite(msg.events)&&msg.events>lastEvents){lastEvents=msg.events;setLoadEvents(lastEvents);arm();}
     return;
    }
    const r=e.data;
    if(r.type==='cityIntel'){const q=intelQueries.current.get(r.queryId);if(q){intelQueries.current.delete(r.queryId);if(r.error)q.reject(new Error(r.error));else q.resolve(r.data);}return;}
    if(r.type==='requestDone'){finishSave(r.requestId,new Error('保存未完成，請稍後再試。'));requests.current.finish(r.requestId);setBusy(requests.current.busy);return;}
    if(r.type==='state'||r.type==='switched'||r.type==='switchFailed'){
     loading=false;clearWatchdog();
     const incoming=r.patch?applyWorldPatch(current.current,r.patch):r.world;
     if(r.patch&&incoming===undefined){worker.current?.postMessage({type:'snapshot'});return;}
     // A checked patch already keeps every unchanged branch; comparing its
     // changed sections again repeats Worker serialization on the main thread.
     const prior=current.current,next=r.patch?incoming:reconcileWorld(prior,incoming);if(r.type==='switched'||prior?.campaignId!==next?.campaignId||(prior?.sequences.report??0)>(next?.sequences.report??0)){setReports([]);setReportData(null);setReportStatus({unread:0,alerts:0,counts:{all:0,battle:0,diplomacy:0,chronicle:0}});setReportEpoch(n=>n+1);}current.current=next;setWorld(next);
     if(next){const anchor=r.clock??{campaignId:next.campaignId,time:next.time,speed:effectiveSpeed(next),running:true};displayClock.adopt({...anchor,running:anchor.running&&!document.hidden});}
     else displayClock.stop();
     if(r.type==='switched'||r.type==='switchFailed'){clearTimeout(commandTimer.current);commands.current.clear();setFeedback({kind:'idle',text:''});}
     if(r.type==='switchFailed'){setError(r.text);setStatus(r.world?'ready':'error');}else{setError('');setStatus('ready');}
    }
    if(r.type==='error'){clearTimeout(commandTimer.current);commands.current.clear();setFeedback({kind:'error',text:r.text});loading=false;clearWatchdog();if(r.requestId)finishSave(r.requestId,new Error(r.text));displayClock.stop();setError(r.text);setStatus('error');}
    if(r.type==='notice'&&(!commands.current.busy||r.error)){setNotice(r.text);setFeedback(r.error?{kind:'error',text:r.text}:{kind:'idle',text:''});}
    if(r.type==='loaded'&&r.offline&&r.offline.elapsedRealMs>30000)setOffline(r.offline);
    if(r.type==='loaded'&&r.recovered)setNotice('已原子回復最近的有效正式回復點。');
    if(r.type==='backups')setBackups(r.items);
    if(r.type==='reportStatus'){setReportStatus(r.data);setReportEpoch(n=>n+1);}
    if(r.type==='reportPage'){setReports(r.data.rows);setReportCount(r.data.count);setReportData(r.data);if(r.data.counts)setReportStatus(r.data);}
    if(r.type==='switched')setTransition(r.transitionId??'');
    if(r.type==='synced'){finishSave(r.requestId);setSynced(n=>n+1);if(!commands.current.busy)setNotice('進度已保存。');}
    if(r.type==='commandReceived'&&commands.current.matches(r.commandId)){setNotice('指令已受理，正在確認並保存。');setFeedback({kind:'pending',text:'指令已受理，正在確認並保存。'});}
    if(r.type==='commandAck'){const a=r.ack as CommandAck;if(commands.current.acknowledge(a)){clearTimeout(commandTimer.current);const feedback=feedbackForAck(a);setNotice(feedback.text);setFeedback(feedback);}}
    if(r.type==='export'){
     const url=URL.createObjectURL(new Blob([r.text],{type:'application/json'})),a=document.createElement('a');
     a.href=url;a.download='列國征途-formal-'+r.mode+'.realm-save';a.click();URL.revokeObjectURL(url);
    }
   };
   w.onerror=e=>{loading=false;clearWatchdog();rejectIntel();rejectSaves(new Error(e.message));requests.current.clear();commands.current.clear();displayClock.stop();setError(e.message);setStatus('error');setBusy(false);};w.postMessage({type:'load',stateMode:'patch'});
   await new Promise<void>(r=>{release=r;});w.terminate();worker.current=null;
  },()=>{setStatus('locked');setError('另一分頁持有正式存檔，請先關閉它。');}).catch(e=>{if(!disposed){setError(String(e));setStatus('error');}});
  return()=>{clearTimeout(commandTimer.current);disposed=true;stopCurrentLoad.current=null;abort.abort();release?.();rejectIntel();rejectSaves(new Error('保存已中斷。'));requests.current.clear();commands.current.clear();displayClock.stop();};
 },[]);
 useEffect(()=>{const change=()=>{if(document.hidden)displayClock.stop();worker.current?.postMessage({type:document.hidden?'away':'resume'});};const hide=()=>{displayClock.stop();worker.current?.postMessage({type:'away'});};document.addEventListener('visibilitychange',change);window.addEventListener('pagehide',hide);return()=>{document.removeEventListener('visibilitychange',change);window.removeEventListener('pagehide',hide);};},[]);
 // Capture the rendered world: a Worker message may update current.current
 // before React commits the new target level shown by a construction button.
 const issue=useCallback((payload:FormalCommand,base?:GovernanceBase)=>{const g=world;if(!g||requests.current.busy||commands.current.busy)return;const order:FormalOrder={commandId:commandId(crypto.randomUUID()),campaignId:g.campaignId,issuerId:g.playerFactionId,issuedWorldTime:g.time,expectedRevision:payload.type==='governance.set'&&base?base.revision:g.revision,payload};send({type:'command',order,...(payload.type==='governance.set'?{governanceBase:base??governanceBase(g,payload.cityId)}:{playerBase:playerOrderBase(g,payload)})});},[send,world]);
 const importFile=async(file:File)=>{if(file.size>100*1024*1024){setError('存檔超過 100 MiB。');return;}send({type:'import',text:await file.text(),transitionId:crypto.randomUUID()});};
 return{feedback,reportEpoch,reportStatus,reportData,readCityIntel,offline,clearOffline:()=>setOffline(null),world,status,error,notice,busy,backups,reports,reportCount,transition,synced,sync,send,issue,importFile,loadPhase,loadProgress,loadEvents,cancelLoad:()=>stopCurrentLoad.current?.(),retryLoad:()=>window.location.reload()};
}
