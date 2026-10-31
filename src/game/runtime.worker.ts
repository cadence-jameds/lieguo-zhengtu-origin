import {worldPaused} from './formal/extinction';
import {enableAutonomy} from './formal/autonomy';
import {exportLegacyCampaign,hasLegacyCampaign} from './persistence';
import {effectiveSpeed} from './formal/playtest';
/// <reference lib="webworker" />
import {createFormalWorld} from './world';
import {advanceFormal,submitFormalOrder} from './engine';
import {advanceFormalCooperative} from './formal/reducer';
import {backupList,clearSavedGames,exportStoredSave,importSave,loadWithOffline,readReportPage,reportStatus,reportAction,type ReportFilter,readCityIntel,restore,save,startCampaign} from './persistence';
import type {FormalOrder,FormalWorld,FormalReport} from './formal/model';
import {worldPatch} from './worldStream';
import {governanceAfterCatchup,governanceWithBase,type GovernanceBase} from './governanceAdmission';
import {playerOrderBase,playerOrderWithBase,type PlayerOrderBase} from './orderAdmission';
export type RuntimeRequest=({type:'load'|'sync'|'snapshot'|'backups'|'away'|'resume'|'reset'|'exportLegacy'}
 | {type:'start';seed:number;speed:number;name:string;civilizationId?:string;offlineHours?:0|1|4|8|12;transitionId?:string}
 | {type:'command';order:FormalOrder;governanceBase?:GovernanceBase;playerBase?:PlayerOrderBase}
 | {type:'import';text:string;transitionId?:string}
 | {type:'restore';id:number;transitionId?:string}
 | {type:'export';mode?:'quick'|'full'}
 | {type:'cityIntel';cityId:string;generation?:number;queryId:string;campaignId:string;reportCursor:number;time:number}
 | {type:'reportStatus'}
 | {type:'reportAction';action:'read'|'clear';ids?:string[];filter?:ReportFilter}
 | {type:'reportPage';page:number;filter?:ReportFilter}) & {requestId?:string;stateMode?:'patch';visibilityAt?:number};
let world:FormalWorld|null=null,draining=false,tickPending=false,tickRunning=false,away=false;
const requests:RuntimeRequest[]=[];
const awayBoundaries=new WeakMap<RuntimeRequest,{target:number;wallAt:number}>();
let anchor=performance.now(),anchorTime=0,lastSavedAt=anchor,retryAt=0,passiveRevisionBase=0,branchRevision=0,foregroundRevision=0;
let foregroundFence:number|undefined;
let patchMode=false,lastPublished:FormalWorld|null=null;
const post=(value:unknown)=>self.postMessage(value);
const clock=()=>({campaignId:world?.campaignId,time:away?(world?.time??0):targetTime(),speed:world?effectiveSpeed(world):1,running:!away&&!!world&&!worldPaused(world)});
const state=()=>{const data={type:'state',clock:clock(),passiveRevisionBase};if(patchMode&&world&&lastPublished?.campaignId===world.campaignId)post({...data,patch:worldPatch(lastPublished,world)});else post({...data,world});lastPublished=world;};
const reanchor=()=>{anchor=performance.now();anchorTime=world?.time??0;lastSavedAt=anchor;retryAt=0;passiveRevisionBase=world?.revision??0;branchRevision=passiveRevisionBase;foregroundRevision=branchRevision;lastPublished=null;};
const targetTime=(now=performance.now())=>(world&&worldPaused(world))?world.time:anchorTime+Math.floor(Math.max(0,Math.min(now,foregroundFence??now)-anchor)*(world?effectiveSpeed(world):1));
async function publishReportStatus(){if(!world)return;try{post({type:'reportStatus',data:await reportStatus(world)});}catch{post({type:'notice',text:'暫時無法讀取戰報通知，世界仍持續運行。'});}}
async function advanceAndSave(target=targetTime(),wallAt?:number){
 if(!world||worldPaused(world))return;
 if(target<=world.time)return;
 const hasEvents=world.events.some(e=>e.at<=target);
 // Only complete events yield. The draft remains private until this entire
 // target replay and its one durable transaction finish.
 const result=await advanceFormalCooperative(world,target,undefined,{yieldIntervalMs:8}),committed=await save(result.world,result.reports,world.revision,wallAt);
 world=committed;if(worldPaused(world))reanchor();lastSavedAt=performance.now();retryAt=0;if(hasEvents)passiveRevisionBase=world.revision;state();if(result.reports.length)await publishReportStatus();
}
async function handle(r:RuntimeRequest){
 if(r.stateMode==='patch')patchMode=true;
 if(r.type==='snapshot'){lastPublished=null;state();return;}
 if(r.type==='exportLegacy'){post({type:'export',text:await exportLegacyCampaign(),mode:'historical'});return;}
 if(r.type==='resume'&&world&&!away){state();return;}
 if(r.type==='load'||r.type==='resume'){
  if(r.type==='load'&&world&&!away)await advanceAndSave();
  away=true;
  let lastStage:'read'|'offline'|'save'|''='',lastEvents=-1;
  const result=await loadWithOffline((stage,fraction,events)=>{
   if(stage!==lastStage){
    lastStage=stage;
    post({type:'phase',text:stage==='read'?'讀取與驗證本機存檔':stage==='offline'?'推進離線期間的世界':'原子保存接續進度'});
   }
   if(stage==='offline'&&fraction!==undefined&&events!==undefined&&events!==lastEvents){
    lastEvents=events;
    post({type:'progress',progress:fraction,events});
   }
  });
  let loaded=result.game;if(loaded&&!worldPaused(loaded)&&!loaded.fixture&&!loaded.autonomy){const draft=structuredClone(loaded);enableAutonomy(draft);draft.revision++;loaded=await save(draft,[],loaded.revision);}world=loaded;away=false;foregroundFence=undefined;reanchor();post({type:'loaded',legacyAvailable:await hasLegacyCampaign(),recovered:result.recovered,offline:result.summary});state();world?await publishReportStatus():post({type:'reportStatus',data:{unread:0,alerts:0,counts:{all:0,battle:0,diplomacy:0,chronicle:0}}});return;}
 if(r.type==='away'){if(away){state();return;}const boundary=awayBoundaries.get(r)??{target:targetTime(),wallAt:Date.now()};away=true;await advanceAndSave(Math.max(world?.time??0,boundary.target),boundary.wallAt);state();return;}
 if(r.type==='reset'){await clearSavedGames();world=null;reanchor();post({type:'resetDone'});state();return;}
 if(r.type==='start'){
  const name=r.name.trim();if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))throw new Error('請輸入 1～24 字的名字。');
  const fixture=createFormalWorld({campaign:crypto.randomUUID(),seed:r.seed,speed:r.speed,name,civilizationId:r.civilizationId,offlineHours:r.offlineHours});
  enableAutonomy(fixture);const committed=await startCampaign(fixture);world=committed;away=false;foregroundFence=undefined;reanchor();post({type:'switched',transitionId:r.transitionId,world});await publishReportStatus();return;
 }
 if(r.type==='restore'||r.type==='import'){
  // Persistence performs history cleanup, Recovery, world and authority changes atomically.
  const committed=r.type==='restore'?await restore(r.id,true):await importSave(r.text,true);
  world=committed;away=false;foregroundFence=undefined;reanchor();post({type:'switched',transitionId:r.transitionId,world});await publishReportStatus();return;
 }
 if(r.type==='cityIntel'){if(!world||r.campaignId!==world.campaignId){post({type:'cityIntel',queryId:r.queryId,error:'戰役已變更，請重新開啟情報窗。'});return;}if(r.generation!==undefined&&(!Number.isSafeInteger(r.generation)||r.generation<0))throw new Error('無效的據點世代。');if(!Number.isSafeInteger(r.reportCursor)||r.reportCursor<1||!Number.isSafeInteger(r.time)||r.time<0)throw new Error('無效的情報游標。');const snapshot={...world,time:Math.min(world.time,r.time),sequences:{...world.sequences,report:Math.min(world.sequences.report,r.reportCursor)}};post({type:'cityIntel',queryId:r.queryId,data:await readCityIntel(snapshot,r.cityId,r.generation)});return;}
 if(!world)throw new Error('請先建立正式世界。');
 if(r.type==='command'){
  if(r.order?.issuerId!==world.playerFactionId)throw new Error('此分頁只能下達玩家勢力命令。');
  // Revalidate the rendered intent before catching up to admission time. A
  // stale but unchanged click must not start at an old checkpoint's clock.
  let caughtUp=false;const catchupReports:FormalReport[]=[];
  let admission=world,order=governanceWithBase(world,r.order,r.governanceBase,branchRevision);
  order=playerOrderWithBase(admission,order,r.playerBase,branchRevision,foregroundRevision);
  if(order.expectedRevision===world.revision&&!world.commandReceipts.some(c=>c.commandId===order.commandId)){
   const before=admission,catchupBase=r.playerBase?playerOrderBase(before,order.payload):undefined;
   const target=targetTime();
   if(world.events.some(e=>e.at<=target)){
    // The completed event replay and foreground command share one durable transaction.
    // The authoritative world remains unchanged until the combined save succeeds.
    const replay=await advanceFormalCooperative(world,target,undefined,{yieldIntervalMs:8});admission=replay.world;catchupReports.push(...replay.reports);caughtUp=true;order=governanceAfterCatchup(before,admission,order);
    order=playerOrderWithBase(admission,order,catchupBase,branchRevision,foregroundRevision);
   }
   else if(target>world.time){admission=advanceFormal(world,target).world;admission.revision=world.revision;}
  }
  const result=submitFormalOrder(admission,order);
  if(result.ack?.status==='committed'){
   // One transaction has one revision, including all newly replayed AI receipts.
   if(caughtUp){result.world.revision=world.revision+1;for(let i=world.commandReceipts.length;i<result.world.commandReceipts.length;i++)result.world.commandReceipts[i].committedRevision=Math.min(result.world.commandReceipts[i].committedRevision,result.world.revision);result.ack.revision=result.world.revision;}
   const committed=await save(result.world,[...catchupReports,...result.reports],world.revision);
   world=committed;foregroundRevision=world.revision;if(r.order.payload.type==='developer.configure'||r.order.payload.type==='campaign.configure'||r.order.payload.type==='player.rebirth'||r.order.payload.type==='player.end'||worldPaused(world))reanchor();lastSavedAt=performance.now();retryAt=0;passiveRevisionBase=world.revision;post({type:'commandAck',ack:result.ack});state();if(result.reports.length||catchupReports.length)await publishReportStatus();
  }else{if(caughtUp){world=await save(admission,catchupReports,world.revision);lastSavedAt=performance.now();retryAt=0;passiveRevisionBase=world.revision;if(result.ack)result.ack.revision=world.revision;}const ack=result.ack;if(order.payload.type==='governance.set'&&ack?.reason==='世界版本已更新，請重新確認狀態。')ack.reason='治理狀態已更新，已刷新城市資料；請確認方針、預算及保留量後再次套用。';post({type:'commandAck',ack});state();if(result.reports.length||catchupReports.length)await publishReportStatus();}
  return;
 }
 if(r.type==='backups'){post({type:'backups',items:await backupList()});return;}
 if(r.type==='reportStatus'){await publishReportStatus();return;}
 if(r.type==='reportAction'){post({type:'reportStatus',data:await reportAction(world,r.action,r.ids,r.filter)});return;}
 if(r.type==='reportPage'){post({type:'reportPage',data:await readReportPage(world,r.page,r.filter)});return;}
 if(r.type==='export'){await advanceAndSave();post({type:'export',text:await exportStoredSave(r.mode??'quick'),mode:r.mode??'quick'});return;}
 await advanceAndSave();if(r.type==='sync')post({type:'synced',requestId:r.requestId});
}
async function runRequest(r:RuntimeRequest){
 try{await handle(r);}catch(error:unknown){
  const text=error instanceof Error?error.message:'正式提交失敗。';
  if(r.type==='command')post({type:'commandAck',ack:{commandId:r.order?.commandId,status:'rejected',revision:world?.revision??0,reason:text}});
  else if(r.type==='start'||r.type==='import'||r.type==='restore')post({type:'switchFailed',transitionId:r.transitionId,world,text});
  else if(r.type==='reportPage'||r.type==='reportStatus'||r.type==='reportAction')post({type:'notice',text:'戰報操作暫時失敗，請重試。'});
  else if(r.type==='cityIntel')post({type:'cityIntel',queryId:r.queryId,error:text});
  else post({type:'error',text,requestId:r.requestId,...(text==='本次更新調整戰役時間與離線推進規則，舊版戰役無法繼續使用，請建立新戰役。'?{legacyAvailable:true}:{})});
  // Failed transitions carry the prior world; failed load remains a visible error.
  if(r.type==='command')state();
 }finally{if(r.requestId)post({type:'requestDone',requestId:r.requestId});}
}
/** All foreground requests, including campaign/visibility barriers, retain
 * arrival order. A pending tick never overtakes them; an in-flight replay or
 * transaction must finish before the next request may mutate the world. */
async function drain(){
 try{
  while(requests.length||tickPending){
   const request=requests.shift();
   if(request){await runRequest(request);continue;}
   tickPending=false;tickRunning=true;
   try{if(!away)await advanceAndSave();}
   catch(error:unknown){retryAt=performance.now()+1000;post({type:'notice',error:true,text:error instanceof Error?error.message:'自動保存失敗，先前進度保留。'});}
   finally{tickRunning=false;}
  }
 }finally{draining=false;}
}
function scheduleDrain(){if(draining)return;draining=true;void drain();}
self.onmessage=(event:MessageEvent<RuntimeRequest>)=>{
 const r=event.data;
 // Capture the visibility boundary before it can wait behind an atomic save.
 if(r.type==='away'&&!away){const received=performance.now(),absolute=performance.timeOrigin+received,at=Number.isFinite(r.visibilityAt)?Math.max(0,Math.min(received,r.visibilityAt!-performance.timeOrigin)):received;foregroundFence=Math.min(foregroundFence??at,at);awayBoundaries.set(r,{target:targetTime(foregroundFence),wallAt:Math.max(0,Date.now()-(absolute-(performance.timeOrigin+foregroundFence)))});}
 requests.push(r);
 if(r.type==='command')post({type:'commandReceived',commandId:r.order?.commandId,requestId:r.requestId});
 scheduleDrain();
};
setInterval(()=>{
 if(!world||worldPaused(world)||tickPending||tickRunning||away)return;
 // Ordinary checkpoints every ten seconds; due events still commit at 100ms polls.
 // The absolute anchor preserves elapsed time even when persistence takes longer.
 const now=performance.now(),target=targetTime(now);
 if(now<retryAt)return;
 if(now-lastSavedAt<10000&&!world.events.some(e=>e.at<=target))return;
 tickPending=true;
 scheduleDrain();
},100);
