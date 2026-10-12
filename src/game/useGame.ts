import {useCallback,useEffect,useRef,useState} from 'react';
import {effectiveSpeed} from './formal/playtest';
import {withSaveLock} from './saveLock';
import {commandId} from './formal/ids';
import type {CommandAck,FormalCommand,FormalOrder,FormalReport,FormalWorld} from './formal/model';
import type {OfflineSummary} from './formal/offline';
import type {RuntimeRequest} from './runtime.worker';
import {PendingRequests,ClockConflictRetry,reconcileWorld} from './interaction';
import {displayClock} from './presentation/liveClock';
import type {CityIntel} from './formal/combatModel';
import {applyWorldPatch} from './worldStream';
import {governanceBase,type GovernanceBase} from './governanceAdmission';
export function useGame(){
 const [world,setWorld]=useState<FormalWorld|null>(null),[status,setStatus]=useState<'loading'|'ready'|'error'|'locked'>('loading');
 const [offline,setOffline]=useState<OfflineSummary|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [transition,setTransition]=useState(''),[synced,setSynced]=useState(0),[reportCount,setReportCount]=useState(0),[reportEpoch,setReportEpoch]=useState(0),[reportStatus,setReportStatus]=useState({unread:0,alerts:0,counts:{all:0,battle:0,chronicle:0}}),[reportData,setReportData]=useState<{page:number;filter:string;count:number}|null>(null);
 const [backups,setBackups]=useState<{id:number;at:number;label:string;time:number}[]>([]),[reports,setReports]=useState<FormalReport[]>([]);
 const worker=useRef<Worker|null>(null),current=useRef<FormalWorld|null>(null);
 const intelQueries=useRef(new Map<string,{resolve:(value:CityIntel)=>void;reject:(error:Error)=>void}>());
 const readCityIntel=useCallback((snapshot:FormalWorld,cityId:string,generation?:number)=>new Promise<CityIntel>((resolve,reject)=>{if(!worker.current){resolve({});return;}const queryId=crypto.randomUUID();intelQueries.current.set(queryId,{resolve,reject});worker.current.postMessage({type:'cityIntel',queryId,cityId,...(generation!==undefined?{generation}:{}),campaignId:snapshot.campaignId,reportCursor:snapshot.sequences.report,time:snapshot.time});}),[]);
 const rejectIntel=()=>{for(const q of intelQueries.current.values())q.reject(new Error('情報查詢已中斷。'));intelQueries.current.clear();};
 const requests=useRef(new PendingRequests()),commands=useRef(new ClockConflictRetry());
 const saves=useRef(new Map<string,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
 const finishSave=(id:string,error?:Error)=>{const pending=saves.current.get(id);if(!pending)return;clearTimeout(pending.timer);saves.current.delete(id);error?pending.reject(error):pending.resolve();};
 const rejectSaves=(error:Error)=>{for(const id of saves.current.keys())finishSave(id,error);};
 const sync=useCallback(()=>new Promise<void>((resolve,reject)=>{
  if(!worker.current){reject(new Error('存檔尚未就緒。'));return;}
  const requestId=crypto.randomUUID();
  const timer=setTimeout(()=>{finishSave(requestId,new Error('保存等待逾時，請稍後再試。'));requests.current.finish(requestId);setBusy(requests.current.busy);},30000);
  saves.current.set(requestId,{resolve,reject,timer});requests.current.add(requestId);setBusy(true);worker.current.postMessage({type:'sync',requestId});
 }),[]);
 const send=useCallback((r:RuntimeRequest)=>{if(worker.current){const requestId=crypto.randomUUID();requests.current.add(requestId);setBusy(true);worker.current.postMessage({...r,requestId});}},[]);
 useEffect(()=>{
  let disposed=false,release:(()=>void)|undefined;const abort=new AbortController();
  if(!navigator.locks){setStatus('error');setError('瀏覽器無法鎖定正式存檔，請使用支援 Web Locks 的瀏覽器。');return;}
  void withSaveLock(navigator.locks,abort.signal,async()=>{
   if(disposed)return;
   const w=new Worker(new URL('./runtime.worker.ts',import.meta.url),{type:'module'});worker.current=w;
   w.onmessage=e=>{
    const r=e.data;
    if(r.type==='cityIntel'){const q=intelQueries.current.get(r.queryId);if(q){intelQueries.current.delete(r.queryId);if(r.error)q.reject(new Error(r.error));else q.resolve(r.data);}return;}
    if(r.type==='requestDone'){finishSave(r.requestId,new Error('保存未完成，請稍後再試。'));requests.current.finish(r.requestId);setBusy(requests.current.busy);return;}
    if(r.type==='state'||r.type==='switched'||r.type==='switchFailed'){
     const incoming=r.patch?applyWorldPatch(current.current,r.patch):r.world;
     if(r.patch&&incoming===undefined){worker.current?.postMessage({type:'snapshot'});return;}
     const prior=current.current,next=reconcileWorld(prior,incoming);if(r.type==='switched'||prior?.campaignId!==next?.campaignId||(prior?.sequences.report??0)>(next?.sequences.report??0)){setReports([]);setReportData(null);setReportStatus({unread:0,alerts:0,counts:{all:0,battle:0,chronicle:0}});setReportEpoch(n=>n+1);}current.current=next;setWorld(next);
     if(next){const anchor=r.clock??{campaignId:next.campaignId,time:next.time,speed:effectiveSpeed(next),running:true};displayClock.adopt({...anchor,running:anchor.running&&!document.hidden});}
     else displayClock.stop();
     if(r.type==='switched'||r.type==='switchFailed')commands.current.clear();
     else for(const retry of commands.current.refresh(next,r.passiveRevisionBase))send({type:'command',order:retry});
     if(r.type==='switchFailed'){setError(r.text);setStatus(r.world?'ready':'error');}else{setError('');setStatus('ready');}
    }
    if(r.type==='error'){if(r.requestId)finishSave(r.requestId,new Error(r.text));displayClock.stop();setError(r.text);setStatus('error');}
    if(r.type==='notice')setNotice(r.text);
    if(r.type==='loaded'&&r.offline&&r.offline.elapsedRealMs>30000)setOffline(r.offline);
    if(r.type==='loaded'&&r.recovered)setNotice('已原子回復最近的有效正式回復點。');
    if(r.type==='backups')setBackups(r.items);
    if(r.type==='reportStatus'){setReportStatus(r.data);setReportEpoch(n=>n+1);}
    if(r.type==='reportPage'){setReports(r.data.rows);setReportCount(r.data.count);setReportData(r.data);if(r.data.counts)setReportStatus(r.data);}
    if(r.type==='switched')setTransition(r.transitionId??'');
    if(r.type==='synced'){finishSave(r.requestId);setSynced(n=>n+1);setNotice('進度已保存。');}
    if(r.type==='commandAck'){const a=r.ack as CommandAck;commands.current.acknowledge(a);setNotice(a.reason??(a.status==='duplicate'?'此命令已提交，不會重複執行。':'命令已提交。'));}
    if(r.type==='export'){
     const url=URL.createObjectURL(new Blob([r.text],{type:'application/json'})),a=document.createElement('a');
     a.href=url;a.download='列國征途-formal-'+r.mode+'.realm-save';a.click();URL.revokeObjectURL(url);
    }
   };
   w.onerror=e=>{rejectIntel();rejectSaves(new Error(e.message));requests.current.clear();commands.current.clear();displayClock.stop();setError(e.message);setStatus('error');setBusy(false);};w.postMessage({type:'load',stateMode:'patch'});
   await new Promise<void>(r=>{release=r;});w.terminate();worker.current=null;
  },()=>{setStatus('locked');setError('另一分頁持有正式存檔，請先關閉它。');}).catch(e=>{if(!disposed){setError(String(e));setStatus('error');}});
  return()=>{disposed=true;abort.abort();release?.();rejectIntel();rejectSaves(new Error('保存已中斷。'));requests.current.clear();commands.current.clear();displayClock.stop();};
 },[]);
 useEffect(()=>{const change=()=>{if(document.hidden)displayClock.stop();worker.current?.postMessage({type:document.hidden?'away':'resume'});};const hide=()=>{displayClock.stop();worker.current?.postMessage({type:'away'});};document.addEventListener('visibilitychange',change);window.addEventListener('pagehide',hide);return()=>{document.removeEventListener('visibilitychange',change);window.removeEventListener('pagehide',hide);};},[]);
 const issue=useCallback((payload:FormalCommand,base?:GovernanceBase)=>{const g=current.current;if(!g||requests.current.busy)return;const order:FormalOrder={commandId:commandId(crypto.randomUUID()),campaignId:g.campaignId,issuerId:g.playerFactionId,issuedWorldTime:g.time,expectedRevision:payload.type==='governance.set'&&base?base.revision:g.revision,payload};commands.current.track(order);send({type:'command',order,...(payload.type==='governance.set'?{governanceBase:base??governanceBase(g,payload.cityId)}:{})});},[send]);
 const importFile=async(file:File)=>{if(file.size>100*1024*1024){setError('存檔超過 100 MiB。');return;}send({type:'import',text:await file.text(),transitionId:crypto.randomUUID()});};
 return{reportEpoch,reportStatus,reportData,readCityIntel,offline,clearOffline:()=>setOffline(null),world,status,error,notice,busy,backups,reports,reportCount,transition,synced,sync,send,issue,importFile};
}
