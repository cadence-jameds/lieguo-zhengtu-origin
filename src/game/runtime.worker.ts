import {acquireWriter,writerContext,receiveCommand,commandStatus,pendingCommands,commandPage,finishCommand,noteCommandFailure} from './persistence';
import {captureIntent,revalidateInbox,terminalCommand,confirmationAck,retryableStorageError,type InboxCommand,type WriterContext,type CommandIntent} from './durableCommands';
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
import {type GovernanceBase} from './governanceAdmission';
import {type PlayerOrderBase} from './orderAdmission';
export type RuntimeRequest=({type:'load'|'sync'|'snapshot'|'backups'|'away'|'resume'|'reset'|'exportLegacy'}
 | {type:'start';seed:number;speed:number;name:string;civilizationId?:string;offlineHours?:0|1|4|8|12;transitionId?:string}
 | {type:'command';order:FormalOrder;governanceBase?:GovernanceBase;playerBase?:PlayerOrderBase;extinctionBase?:string;branch?:number}
 | {type:'commandQuery';campaignId:FormalOrder['campaignId'];commandId:FormalOrder['commandId']}
 | {type:'commandList';before?:number}
 | {type:'import';text:string;transitionId?:string}
 | {type:'restore';id:number;transitionId?:string}
 | {type:'export';mode?:'quick'|'full'}
 | {type:'cityIntel';cityId:string;generation?:number;queryId:string;campaignId:string;reportCursor:number;time:number}
 | {type:'reportStatus'}
 | {type:'reportAction';action:'read'|'clear';ids?:string[];filter?:ReportFilter}
 | {type:'reportPage';page:number;filter?:ReportFilter}) & {requestId?:string;stateMode?:'patch';visibilityAt?:number};
let writer:WriterContext|undefined;
const intake=new WeakMap<RuntimeRequest,Promise<InboxCommand>>();
let intakeQueue:Promise<unknown>=Promise.resolve();
let world:FormalWorld|null=null,draining=false,tickPending=false,tickRunning=false,away=false;
const requests:RuntimeRequest[]=[];
const awayBoundaries=new WeakMap<RuntimeRequest,{target:number;wallAt:number}>();
let anchor=performance.now(),anchorTime=0,lastSavedAt=anchor,retryAt=0,passiveRevisionBase=0;
let foregroundFence:number|undefined;
let patchMode=false,lastPublished:FormalWorld|null=null;
const post=(value:unknown)=>{try{self.postMessage(value);}catch{/* T3 notification loss is recovered by durable query/reload. */}};
const clock=()=>({campaignId:world?.campaignId,time:away?(world?.time??0):targetTime(),speed:world?effectiveSpeed(world):1,running:!away&&!!world&&!worldPaused(world)});
const state=()=>{const data={type:'state',clock:clock(),passiveRevisionBase,branch:writer?.branch};if(patchMode&&world&&lastPublished?.campaignId===world.campaignId)post({...data,patch:worldPatch(lastPublished,world)});else post({...data,world});lastPublished=world;};
const reanchor=()=>{anchor=performance.now();anchorTime=world?.time??0;lastSavedAt=anchor;retryAt=0;passiveRevisionBase=world?.revision??0;lastPublished=null;};
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
 if(r.type==='commandQuery'){const row=await commandStatus(r.campaignId,r.commandId);post({type:'commandStatus',row,commandId:r.commandId});if(row?.ack)post({type:'commandAck',ack:row.ack});return;}
 if(r.type==='commandList'){post({type:'commandList',rows:await commandPage(r.before)});return;}
 if(r.type==='snapshot'){lastPublished=null;state();return;}
 if(r.type==='exportLegacy'){post({type:'export',text:await exportLegacyCampaign(),mode:'historical'});return;}
 if(r.type==='resume'&&world&&!away){state();return;}
 if(r.type==='load'||r.type==='resume'){
  if(!writer)writer=await acquireWriter();
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
  let loaded=result.game;if(loaded&&!worldPaused(loaded)&&!loaded.fixture&&!loaded.autonomy){const draft=structuredClone(loaded);enableAutonomy(draft);draft.revision++;loaded=await save(draft,[],loaded.revision);}world=loaded;writer=await writerContext();away=false;foregroundFence=undefined;reanchor();
  // Resume durable intake in its persisted order. Branch switches have already
  // terminalized old Pending atomically; a new writer rechecks original intent.
  const recovered=await pendingCommands();
  for(const row of recovered){if(requests.some(q=>q.type==='command'&&q.order.commandId===row.commandId&&q.order.campaignId===row.campaignId))continue;
   const q:RuntimeRequest={type:'command',order:row.order,playerBase:row.playerBase,governanceBase:row.governanceBase,extinctionBase:row.extinctionBase,branch:row.branch};intake.set(q,Promise.resolve(row));requests.push(q);
  }
  const recent=await commandPage(),visible=[...recent,...recovered.filter(row=>!recent.some(r=>r.sequence===row.sequence))];post({type:'commandList',rows:visible});post({type:'loaded',legacyAvailable:await hasLegacyCampaign(),recovered:result.recovered,offline:result.summary});state();world?await publishReportStatus():post({type:'reportStatus',data:{unread:0,alerts:0,counts:{all:0,battle:0,diplomacy:0,chronicle:0}}});return;}
 if(r.type==='away'){if(away){state();return;}const boundary=awayBoundaries.get(r)??{target:targetTime(),wallAt:Date.now()};away=true;await advanceAndSave(Math.max(world?.time??0,boundary.target),boundary.wallAt);state();return;}
 if(r.type==='reset'){await clearSavedGames();writer=await writerContext();world=null;reanchor();post({type:'resetDone'});state();return;}
 if(r.type==='start'){
  const name=r.name.trim();if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))throw new Error('請輸入 1～24 字的名字。');
  const fixture=createFormalWorld({campaign:crypto.randomUUID(),seed:r.seed,speed:r.speed,name,civilizationId:r.civilizationId,offlineHours:r.offlineHours});
  enableAutonomy(fixture);const committed=await startCampaign(fixture);world=committed;writer=await writerContext();away=false;foregroundFence=undefined;reanchor();post({type:'switched',transitionId:r.transitionId,world,branch:writer.branch});await publishReportStatus();return;
 }
 if(r.type==='restore'||r.type==='import'){
  // Persistence performs history cleanup, Recovery, world and authority changes atomically.
  const committed=r.type==='restore'?await restore(r.id,true):await importSave(r.text,true);
  world=committed;writer=await writerContext();away=false;foregroundFence=undefined;reanchor();post({type:'switched',transitionId:r.transitionId,world,branch:writer.branch});await publishReportStatus();return;
 }
 if(r.type==='cityIntel'){if(!world||r.campaignId!==world.campaignId){post({type:'cityIntel',queryId:r.queryId,error:'戰役已變更，請重新開啟情報窗。'});return;}if(r.generation!==undefined&&(!Number.isSafeInteger(r.generation)||r.generation<0))throw new Error('無效的據點世代。');if(!Number.isSafeInteger(r.reportCursor)||r.reportCursor<1||!Number.isSafeInteger(r.time)||r.time<0)throw new Error('無效的情報游標。');const snapshot={...world,time:Math.min(world.time,r.time),sequences:{...world.sequences,report:Math.min(world.sequences.report,r.reportCursor)}};post({type:'cityIntel',queryId:r.queryId,data:await readCityIntel(snapshot,r.cityId,r.generation)});return;}
 if(!world)throw new Error('請先建立正式世界。');
 if(r.type==='command'){await executeCommand(r);return;}
 if(r.type==='backups'){post({type:'backups',items:await backupList()});return;}
 if(r.type==='reportStatus'){await publishReportStatus();return;}
 if(r.type==='reportAction'){post({type:'reportStatus',data:await reportAction(world,r.action,r.ids,r.filter)});return;}
 if(r.type==='reportPage'){post({type:'reportPage',data:await readReportPage(world,r.page,r.filter)});return;}
 if(r.type==='export'){await advanceAndSave();post({type:'export',text:await exportStoredSave(r.mode??'quick'),mode:r.mode??'quick'});return;}
 await advanceAndSave();if(r.type==='sync')post({type:'synced',requestId:r.requestId});
}
/** T1 is awaited here, but runs independently of the world/AI drain. */
async function executeCommand(r:Extract<RuntimeRequest,{type:'command'}>){
 let row=await intake.get(r)!;
 for(;;){
  try{
  // A repeated ID always queries durable authority before considering execution.
  row=await commandStatus(row.campaignId,row.commandId)??row;
  if(terminalCommand(row)){post({type:'commandStatus',row});if(row.ack)post({type:'commandAck',ack:row.ack});state();return;}
   if(!world)throw new Error('請先建立正式世界。');
   if(row.branch!==writer?.branch)throw new Error('戰役分支已切換，請重新確認原始操作。');
   if(world.commandReceipts.some(c=>c.commandId===row.commandId)){
    const ack=submitFormalOrder(world,row.order).ack!;await finishCommand(row,ack,world.revision);post({type:'commandAck',ack});state();return;
   }
   let order=revalidateInbox(world,row);
   if(Date.now()>=row.deadline)order=undefined;
   if(!order){
    const ack=confirmationAck(row,world.revision,Date.now()>=row.deadline?'命令等待逾時，請重新確認原始操作。':undefined);
    await finishCommand(row,ack,world.revision);post({type:'commandAck',ack});return;
   }
   let admission=world,caughtUp=false;const catchupReports:FormalReport[]=[];
   const target=targetTime();
   if(!worldPaused(world)){
    if(world.events.some(e=>e.at<=target)){
     const before=admission,replay=await advanceFormalCooperative(world,target,undefined,{yieldIntervalMs:8});
     admission=replay.world;catchupReports.push(...replay.reports);caughtUp=true;
     // Revalidate the execution intent again after AI catch-up, preserving the
     // original row. No targets, quantities or original revisions are rewritten.
     const intent=captureIntent(before,order),check={...row,...intent,order};
     order=revalidateInbox(admission,check)!;
     if(!order){
      const ack=confirmationAck(row,world.revision+1);admission.revision=world.revision+1;
      for(let i=world.commandReceipts.length;i<admission.commandReceipts.length;i++)admission.commandReceipts[i].committedRevision=admission.revision;
      world=await save(admission,catchupReports,world.revision,undefined,{row,ack});passiveRevisionBase=world.revision;
      post({type:'commandAck',ack});state();return;
     }
    }else if(target>world.time){admission=advanceFormal(world,target).world;admission.revision=world.revision;}
   }
   const result=submitFormalOrder(admission,order),ack=result.ack!;
   if(ack.status==='committed'||caughtUp){
    result.world.revision=world.revision+1;
    for(let i=world.commandReceipts.length;i<result.world.commandReceipts.length;i++)result.world.commandReceipts[i].committedRevision=Math.min(result.world.commandReceipts[i].committedRevision,result.world.revision);
    ack.revision=result.world.revision;
    world=await save(result.world,[...catchupReports,...result.reports],world.revision,undefined,{row,ack});
    if(['developer.configure','campaign.configure','player.rebirth','player.end'].includes(order.payload.type)||worldPaused(world))reanchor();
    lastSavedAt=performance.now();retryAt=0;passiveRevisionBase=world.revision;
   }else await finishCommand(row,ack,world.revision);
   // T3 cannot undo a committed T2, including a failed postMessage/notification.
   try{post({type:'commandAck',ack});state();if(result.reports.length||catchupReports.length)await publishReportStatus();}catch{/* Durable query/reload returns the exact result. */}
   return;
  }catch(error){
   // A lost Ack or an error after transaction completion must never be retried.
   const saved=await commandStatus(row.campaignId,row.commandId).catch(()=>undefined);
   if(saved&&terminalCommand(saved)){if(saved.ack)post({type:'commandAck',ack:saved.ack});return;}
   const text=error instanceof Error?error.message:'正式提交失敗。';
   let failed:InboxCommand;
   try{failed=await noteCommandFailure(row,text,retryableStorageError(error));}
   catch{
    post({type:'commandBlocked',commandId:row.commandId,text:'無法保存命令結果；原持久命令保留。請檢查儲存空間後重新載入並查詢。'});state();return;
   }
   post({type:'commandStatus',row:failed});
   if(terminalCommand(failed)){if(failed.ack)post({type:'commandAck',ack:failed.ack});state();return;}
   // At most three attempts, bounded by a durable wall-clock deadline. The
   // foreground drain keeps order; small T1 writes can still complete meanwhile.
   await new Promise<void>(resolve=>setTimeout(resolve,Math.max(0,failed.nextAttemptAt-Date.now())));row=failed;
  }
 }
}
async function runRequest(r:RuntimeRequest){
 try{await handle(r);}catch(error:unknown){
  const text=error instanceof Error?error.message:'正式提交失敗。';
  if(r.type==='command'){const existing=await commandStatus(r.order.campaignId,r.order.commandId).catch(()=>undefined);post({type:'commandReceiveFailed',commandId:r.order?.commandId,row:existing,text:(existing?'此重送未受理：':'命令未持久接收：')+text+' 原始操作保留，請查詢後確認。'});}
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
 if(r.type==='command'){
  post({type:'commandReceived',commandId:r.order?.commandId,requestId:r.requestId});
  const branch=r.branch??writer?.branch;
  const intent:CommandIntent={playerBase:r.playerBase,governanceBase:r.governanceBase,extinctionBase:r.extinctionBase};
  if(world&&r.order.expectedRevision===world.revision)Object.assign(intent,captureIntent(world,r.order),r.governanceBase?{governanceBase:r.governanceBase}:{});
  const received=intakeQueue.then(()=>receiveCommand(r.order,intent,branch));intake.set(r,received);
  intakeQueue=received.then(row=>{post({type:'commandDurable',row});},()=>{});
 }
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
