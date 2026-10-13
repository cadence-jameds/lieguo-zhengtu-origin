import {enableAutonomy} from './formal/autonomy';
import {effectiveSpeed} from './formal/playtest';
/// <reference lib="webworker" />
import {createFormalWorld} from './world';
import {advanceFormal,submitFormalOrder} from './engine';
import {backupList,clearSavedGames,exportStoredSave,importSave,loadWithOffline,readReportPage,reportStatus,reportAction,type ReportFilter,readCityIntel,restore,save,startCampaign} from './persistence';
import type {FormalOrder,FormalWorld} from './formal/model';
import {worldPatch} from './worldStream';
import {governanceAfterCatchup,governanceWithBase,type GovernanceBase} from './governanceAdmission';
export type RuntimeRequest=({type:'load'|'sync'|'snapshot'|'backups'|'away'|'resume'|'reset'}
 | {type:'start';seed:number;speed:number;name:string;civilizationId?:string;offlineHours?:0|1|6|24;transitionId?:string}
 | {type:'command';order:FormalOrder;governanceBase?:GovernanceBase}
 | {type:'import';text:string;transitionId?:string}
 | {type:'restore';id:number;transitionId?:string}
 | {type:'export';mode?:'quick'|'full'}
 | {type:'cityIntel';cityId:string;generation?:number;queryId:string;campaignId:string;reportCursor:number;time:number}
 | {type:'reportStatus'}
 | {type:'reportAction';action:'read'|'clear';ids?:string[];filter?:ReportFilter}
 | {type:'reportPage';page:number;filter?:ReportFilter}) & {requestId?:string;stateMode?:'patch'};
let world:FormalWorld|null=null,queue:Promise<unknown>=Promise.resolve(),tickPending=false,away=false;
let anchor=performance.now(),anchorTime=0,lastSavedAt=anchor,retryAt=0,passiveRevisionBase=0,branchRevision=0;
let patchMode=false,lastPublished:FormalWorld|null=null;
const post=(value:unknown)=>self.postMessage(value);
const clock=()=>({campaignId:world?.campaignId,time:targetTime(),speed:world?effectiveSpeed(world):1,running:!away});
const state=()=>{const data={type:'state',clock:clock(),passiveRevisionBase};if(patchMode&&world&&lastPublished?.campaignId===world.campaignId)post({...data,patch:worldPatch(lastPublished,world)});else post({...data,world});lastPublished=world;};
const reanchor=()=>{anchor=performance.now();anchorTime=world?.time??0;lastSavedAt=anchor;retryAt=0;passiveRevisionBase=world?.revision??0;branchRevision=passiveRevisionBase;lastPublished=null;};
const targetTime=(now=performance.now())=>anchorTime+Math.floor(Math.max(0,now-anchor)*(world?effectiveSpeed(world):1));
async function publishReportStatus(){if(!world)return;try{post({type:'reportStatus',data:await reportStatus(world)});}catch{post({type:'notice',text:'暫時無法讀取戰報通知，世界仍持續運行。'});}}
async function advanceAndSave(){
 if(!world)return;
 const target=targetTime();
 if(target<=world.time)return;
 const hasEvents=world.events.some(e=>e.at<=target);
 const result=advanceFormal(world,target),committed=await save(result.world,result.reports,world.revision);
 world=committed;lastSavedAt=performance.now();retryAt=0;if(hasEvents)passiveRevisionBase=world.revision;state();if(result.reports.length)await publishReportStatus();
}
async function handle(r:RuntimeRequest){
 if(r.stateMode==='patch')patchMode=true;
 if(r.type==='snapshot'){lastPublished=null;state();return;}
 if(r.type==='load'||r.type==='resume'){post({type:'phase',text:'計算離線世界推進'});const result=await loadWithOffline();let loaded=result.game;if(loaded&&!loaded.fixture&&!loaded.autonomy){const draft=structuredClone(loaded);enableAutonomy(draft);draft.revision++;loaded=await save(draft,[],loaded.revision);}world=loaded;away=false;reanchor();post({type:'loaded',recovered:result.recovered,offline:result.summary});state();world?await publishReportStatus():post({type:'reportStatus',data:{unread:0,alerts:0,counts:{all:0,battle:0,diplomacy:0,chronicle:0}}});return;}
 if(r.type==='away'){await advanceAndSave();away=true;state();return;}
 if(r.type==='reset'){await clearSavedGames();world=null;reanchor();post({type:'resetDone'});state();return;}
 if(r.type==='start'){
  const name=r.name.trim();if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))throw new Error('請輸入 1～24 字的名字。');
  const fixture=createFormalWorld({campaign:crypto.randomUUID(),seed:r.seed,speed:r.speed,name,civilizationId:r.civilizationId,offlineHours:r.offlineHours});
  enableAutonomy(fixture);const committed=await startCampaign(fixture);world=committed;away=false;reanchor();post({type:'switched',transitionId:r.transitionId,world});await publishReportStatus();return;
 }
 if(r.type==='restore'||r.type==='import'){
  // Persistence performs history cleanup, Recovery, world and authority changes atomically.
  const committed=r.type==='restore'?await restore(r.id,true):await importSave(r.text,true);
  world=committed;away=false;reanchor();post({type:'switched',transitionId:r.transitionId,world});await publishReportStatus();return;
 }
 if(r.type==='cityIntel'){if(!world||r.campaignId!==world.campaignId){post({type:'cityIntel',queryId:r.queryId,error:'戰役已變更，請重新開啟情報窗。'});return;}if(r.generation!==undefined&&(!Number.isSafeInteger(r.generation)||r.generation<0))throw new Error('無效的據點世代。');if(!Number.isSafeInteger(r.reportCursor)||r.reportCursor<1||!Number.isSafeInteger(r.time)||r.time<0)throw new Error('無效的情報游標。');const snapshot={...world,time:Math.min(world.time,r.time),sequences:{...world.sequences,report:Math.min(world.sequences.report,r.reportCursor)}};post({type:'cityIntel',queryId:r.queryId,data:await readCityIntel(snapshot,r.cityId,r.generation)});return;}
 if(!world)throw new Error('請先建立正式世界。');
 if(r.type==='command'){
  if(r.order?.issuerId!==world.playerFactionId)throw new Error('此分頁只能下達玩家勢力命令。');
  // Catch up the command's admission time without exposing/saving a clock-only
  // draft. Only unchanged governance configuration may bridge this admission's
  // own catch-up; economic orders and already-stale orders retain their gate.
  let admission=world,order=r.order;
  if(r.order.expectedRevision===world.revision&&!world.commandReceipts.some(c=>c.commandId===r.order.commandId)){
   const target=targetTime();
   if(world.events.some(e=>e.at<=target)){await advanceAndSave();order=governanceAfterCatchup(admission,world!,order);admission=world!;}
   else if(target>world.time){admission=advanceFormal(world,target).world;admission.revision=world.revision;}
  }
  order=governanceWithBase(admission,order,r.governanceBase,branchRevision);
  const result=submitFormalOrder(admission,order);
  if(result.ack?.status==='committed'){
   const committed=await save(result.world,result.reports,world.revision);
   world=committed;if(r.order.payload.type==='developer.configure')reanchor();lastSavedAt=performance.now();retryAt=0;passiveRevisionBase=world.revision;post({type:'commandAck',ack:result.ack});state();if(result.reports.length)await publishReportStatus();
  }else{const ack=result.ack;if(order.payload.type==='governance.set'&&ack?.reason==='世界版本已更新，請重新確認狀態。')ack.reason='治理狀態已更新，已刷新城市資料；請確認方針、預算及保留量後再次套用。';post({type:'commandAck',ack});state();if(result.reports.length)await publishReportStatus();}
  return;
 }
 if(r.type==='backups'){post({type:'backups',items:await backupList()});return;}
 if(r.type==='reportStatus'){await publishReportStatus();return;}
 if(r.type==='reportAction'){post({type:'reportStatus',data:await reportAction(world,r.action,r.ids,r.filter)});return;}
 if(r.type==='reportPage'){post({type:'reportPage',data:await readReportPage(world,r.page,r.filter)});return;}
 if(r.type==='export'){await advanceAndSave();post({type:'export',text:await exportStoredSave(r.mode??'quick'),mode:r.mode??'quick'});return;}
 await advanceAndSave();if(r.type==='sync')post({type:'synced',requestId:r.requestId});
}
self.onmessage=(event:MessageEvent<RuntimeRequest>)=>{
 const r=event.data;
 queue=queue.then(()=>handle(r)).catch((error:unknown)=>{
  const text=error instanceof Error?error.message:'正式提交失敗。';
  if(r.type==='command')post({type:'commandAck',ack:{commandId:r.order?.commandId,status:'rejected',revision:world?.revision??0,reason:text}});
  else if(r.type==='start'||r.type==='import'||r.type==='restore')post({type:'switchFailed',transitionId:r.transitionId,world,text});
  else if(r.type==='reportPage'||r.type==='reportStatus'||r.type==='reportAction')post({type:'notice',text:'戰報操作暫時失敗，請重試。'});
  else if(r.type==='cityIntel')post({type:'cityIntel',queryId:r.queryId,error:text});
  else post({type:'error',text,requestId:r.requestId});
  // Failed transitions carry the prior world; failed load remains a visible error.
  if(r.type==='command')state();
 }).finally(()=>{if(r.requestId)post({type:'requestDone',requestId:r.requestId});});
};
setInterval(()=>{
 if(!world||tickPending||away)return;
 // Ordinary checkpoints every ten seconds; due events still commit at 100ms polls.
 // The absolute anchor preserves elapsed time even when persistence takes longer.
 const now=performance.now(),target=targetTime(now);
 if(now<retryAt)return;
 if(now-lastSavedAt<10000&&!world.events.some(e=>e.at<=target))return;
 tickPending=true;
 queue=queue.then(()=>{if(!away)return advanceAndSave();}).catch((error:unknown)=>{retryAt=performance.now()+1000;post({type:'notice',error:true,text:error instanceof Error?error.message:'自動保存失敗，先前進度保留。'});}).finally(()=>{tickPending=false;});
},100);
