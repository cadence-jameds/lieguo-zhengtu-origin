import {SaveHealth} from './saveStatus';
import {playerMessage} from './playerMessage';
import {inspectCampaignStorage} from './campaignStorage';
import {RetiredCommand} from './replayFence';
import {prepareAdmissionMap} from './admissionMap';
import {OLD_CAMPAIGN_MESSAGE} from './formal/saveCodec';
import {commandHistory,findReceipt,normalizeOutcomeRevisions} from './formal/commandLedger';
import {acquireWriter,writerContext,receiveCommand,commandStatus,queryCommandStatus,pendingCommands,commandPage,finishCommand,noteCommandFailure} from './persistence';
import {captureIntent,revalidateInbox,terminalCommand,confirmationAck,retryableStorageError,type InboxCommand,type WriterContext,type CommandIntent} from './durableCommands';
import {worldPaused} from './formal/extinction';
import {enableAutonomy} from './formal/autonomy';
import {exportLegacyCampaign,hasLegacyCampaign} from './persistence';
import {effectiveSpeed} from './formal/playtest';
/// <reference lib="webworker" />
import {createFormalWorld} from './world';
import {advanceFormal,submitFormalOrder} from './engine';
import {advanceFormalCooperative} from './formal/reducer';
import {RuntimeWorkBudget} from './runtimeWorkBudget';
import {incompatibleStartToken,backupList,clearSavedGames,exportStoredSave,importSave,loadWithOffline,readReportPage,reportStatus,reportAction,type ReportFilter,readCityIntel,restore,save,startCampaign} from './persistence';
import type {FormalOrder,FormalWorld,FormalReport} from './formal/model';
import {WorldStream} from './worldStream';
import type {ProjectionIdentity} from './presentationModel';
import {type GovernanceBase} from './governanceAdmission';
import {type PlayerOrderBase} from './orderAdmission';
export type RuntimeRequest=({type:'load'|'sync'|'snapshot'|'backups'|'away'|'resume'|'reset'|'exportLegacy'}
 | {type:'start';replaceIncompatible?:string;seed:number;speed:number;name:string;civilizationId?:string;offlineHours?:0|1|4|8|12;transitionId?:string}
 | {type:'command';order:FormalOrder;governanceBase?:GovernanceBase;playerBase?:PlayerOrderBase;extinctionBase?:string;branch?:number;projection?:ProjectionIdentity}
 | {type:'commandQuery';campaignId:FormalOrder['campaignId'];commandId:FormalOrder['commandId']}
 | {type:'commandList';before?:number}
 | {type:'import';text:string;transitionId?:string}
 | {type:'restore';id:number;transitionId?:string}
 | {type:'export';mode?:'quick'|'full'}
 | {type:'cityIntel';cityId:string;generation?:number;queryId:string;campaignId:string;reportCursor:number;time:number}
 | {type:'reportStatus'}
 | {type:'reportAction';action:'read'|'clear';ids?:string[];filter?:ReportFilter}
 | {type:'reportPage';page:number;filter?:ReportFilter}) & {requestId?:string;startupRecovery?:boolean;stateMode?:'patch'|'projection-v2';visibilityAt?:number};
let writer:WriterContext|undefined;
let startWithoutWorld=false;
const intake=new WeakMap<RuntimeRequest,Promise<InboxCommand>>();
let intakeQueue:Promise<unknown>=Promise.resolve();
const workBudget=new RuntimeWorkBudget();
let queryQueue:Promise<unknown>=Promise.resolve();
const queryIntake=new WeakMap<RuntimeRequest,Promise<unknown>>();
const controls=new Set<RuntimeRequest['type']>(['load','resume','away','start','restore','import','reset']);
let controlPending=0;
let world:FormalWorld|null=null,draining=false,tickPending=false,tickRunning=false,away=false;
const requests:RuntimeRequest[]=[];
const awayBoundaries=new WeakMap<RuntimeRequest,{target:number;wallAt:number}>();
let anchor=performance.now(),anchorTime=0,lastSavedAt=anchor,retryAt=0,passiveRevisionBase=0;
let foregroundFence:number|undefined;
const stream=new WorldStream(),runtimeSession=stream.sessionId;let notificationSequence=0;
const notify=(value:Record<string,unknown>)=>{try{self.postMessage({...value,runtimeSession,notificationSequence:++notificationSequence,writerEpoch:writer?.writerEpoch,branch:writer?.branch,commandEpoch:writer?.commandEpoch});}catch{/* T3 loss never changes T2. */}};
const clock=()=>({campaignId:world?.campaignId,time:away?(world?.time??0):targetTime(),speed:world?effectiveSpeed(world):1,running:!away&&!!world&&!worldPaused(world)});
const publish=(source:FormalWorld|null,data:Record<string,unknown>,snapshot=false)=>{try{const projection=stream.publish(source,writer??{branch:0,writerEpoch:0},snapshot);notify({...data,projection,clock:clock(),passiveRevisionBase});}catch{notify({type:'projectionUnavailable',text:'畫面投影暫時無法更新；正式結果已保留，請重新同步畫面。'});}};
const post=(value:unknown)=>{const data=value as Record<string,unknown>;if(Object.hasOwn(data,'world')){const {world:source,...rest}=data;publish(source as FormalWorld|null,rest,true);}else notify(data);};
const state=(snapshot=false)=>publish(world,{type:'state'},snapshot);
const reanchor=()=>{anchor=performance.now();anchorTime=world?.time??0;lastSavedAt=anchor;retryAt=0;passiveRevisionBase=world?.revision??0;stream.reset();};
const saveHealth=new SaveHealth(),saveErrors=new WeakSet<Error>();
const saved=(verified=false)=>{const status=saveHealth.committed();if(status||verified)post({type:'saveStatus',status:status??{...saveHealth.status},committed:true});};
const saveFailed=(cause:unknown)=>{const error=cause instanceof Error?cause:new Error(String(cause));saveErrors.add(error);const status=saveHealth.failure(error,!away);if(status)post({type:'saveStatus',status});return error;};
async function persistWorld(...args:Parameters<typeof save>){try{const committed=await save(...args);saved();return committed;}catch(error){throw saveFailed(error);}}
const targetTime=(now=performance.now())=>(world&&worldPaused(world))?world.time:anchorTime+Math.floor(Math.max(0,Math.min(now,foregroundFence??now)-anchor)*(world?effectiveSpeed(world):1));
async function publishReportStatus(){if(!world)return;try{post({type:'reportStatus',data:await reportStatus(world)});}catch{post({type:'notice',text:'暫時無法讀取戰報通知，世界仍持續運行。'});}}
async function advanceAndSave(target=targetTime(),wallAt?:number){
 if(!world||worldPaused(world))return;
 if(target<=world.time)return;
 const hasEvents=world.events.some(e=>e.at<=target);
 // Only complete events yield. The draft remains private until this entire
 // target replay and its one durable transaction finish.
 const result=await advanceFormalCooperative(world,target,undefined,workBudget.advance),committed=await persistWorld(result.world,result.reports,world.revision,wallAt);
 world=committed;if(worldPaused(world))reanchor();lastSavedAt=performance.now();retryAt=0;if(hasEvents)passiveRevisionBase=world.revision;state();if(result.reports.length)await publishReportStatus();
}
async function handle(r:RuntimeRequest){
 if(r.type==='commandQuery'){const result=await stableRead(async()=>{let found=await queryCommandStatus(r.campaignId,r.commandId);if(!found.row){await queryIntake.get(r);found=await queryCommandStatus(r.campaignId,r.commandId);}return found;}),row=result.row;post({type:row?'commandStatus':'commandUnavailable',availability:result.availability,row,campaignId:r.campaignId,commandId:r.commandId});if(row?.ack)post({type:'commandAck',ack:row.ack,campaignId:row.campaignId});state(true);return;}
 if(r.type==='commandList'){post({type:'commandList',rows:await stableRead(()=>commandPage(r.before))});return;}
 if(r.type==='snapshot'){state(true);return;}
 if(r.type==='exportLegacy'){post({type:'export',text:await exportLegacyCampaign(),mode:'historical'});return;}
 if(r.type==='resume'&&world&&!away){state();return;}
 if(r.type==='load'||r.type==='resume'){
  if(!writer)writer=await acquireWriter();
  if(r.type==='load'&&r.startupRecovery){
   const stored=await inspectCampaignStorage();
   if(stored!=='empty'&&stored!=='historical'){const token=await incompatibleStartToken();if(token){post({type:'error',text:OLD_CAMPAIGN_MESSAGE,incompatibleStartToken:token,legacyAvailable:await hasLegacyCampaign().catch(()=>false)});return;}throw Error('本機仍有尚未成功載入的戰役或命令；已保留原資料。請重新讀取，或在存檔管理明確確認刪除後再建立新戰役。');}
   writer=await writerContext();world=null;startWithoutWorld=true;away=false;reanchor();state(true);return;
  }
  if(r.type==='load'&&world&&!away)await advanceAndSave();
  away=true;
  let lastStage:'read'|'offline'|'save'|''='',lastEvents=-1;
  let saving=false;
  const result=await loadWithOffline((stage,fraction,events)=>{
   if(stage==='save')saving=true;
   if(stage!==lastStage){
    lastStage=stage;
    post({type:'phase',text:stage==='read'?'讀取與驗證本機存檔':stage==='offline'?'推進離線期間的世界':'原子保存接續進度'});
   }
   if(stage==='read'&&fraction!==undefined)post({type:'phase',text:`讀取與驗證本機存檔（${Math.round(fraction*100)}%）`});
   if(stage==='offline'&&fraction!==undefined&&events!==undefined&&events!==lastEvents){
    lastEvents=events;
    post({type:'progress',progress:fraction,events});
   }
  },workBudget.advance).catch(error=>{throw saving?saveFailed(error):error;});
  if(result.game)saved(true);
  let loaded=result.game;if(loaded&&!worldPaused(loaded)&&!loaded.fixture&&!loaded.autonomy){const draft=structuredClone(loaded);enableAutonomy(draft);draft.revision++;loaded=await persistWorld(draft,[],loaded.revision);}if(loaded)await prepareAdmissionMap(loaded);const loadedWriter=await writerContext();world=loaded;startWithoutWorld=!loaded;writer=loadedWriter;away=false;foregroundFence=undefined;reanchor();
  // Resume durable intake in its persisted order. Branch switches have already
  // terminalized old Pending atomically; a new writer rechecks original intent.
  const recovered=await pendingCommands(),recoveredRequests:RuntimeRequest[]=[];
  for(const row of recovered){
   const queued=requests.findIndex(q=>q.type==='command'&&q.order.commandId===row.commandId&&q.order.campaignId===row.campaignId);
   const q:RuntimeRequest=queued>=0?requests.splice(queued,1)[0]:{type:'command',order:row.order,playerBase:row.playerBase,governanceBase:row.governanceBase,extinctionBase:row.extinctionBase,branch:row.branch};
   intake.set(q,Promise.resolve(row));recoveredRequests.push(q);
  }
  requests.unshift(...recoveredRequests);
  const recent=await commandPage(),visible=[...recent,...recovered.filter(row=>!recent.some(r=>r.sequence===row.sequence))];post({type:'commandList',rows:visible});post({type:'loaded',legacyAvailable:await hasLegacyCampaign(),recovered:result.recovered,offline:result.summary});state();world?await publishReportStatus():post({type:'reportStatus',data:{unread:0,alerts:0,counts:{all:0,battle:0,diplomacy:0,chronicle:0}}});return;}
 if(r.type==='away'){if(away){state();return;}const boundary=awayBoundaries.get(r)??{target:targetTime(),wallAt:Date.now()};away=true;await advanceAndSave(Math.max(world?.time??0,boundary.target),boundary.wallAt);state();return;}
 if(r.type==='reset'){await clearSavedGames();writer=await writerContext();world=null;startWithoutWorld=true;reanchor();post({type:'resetDone'});state();return;}
 if(r.type==='start'){
  if(!world&&!startWithoutWorld&&!r.replaceIncompatible)throw Error('戰役尚未安全讀取，請先重新讀取或確認版本不相容；原資料保留。');
  const name=r.name.trim();if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))throw new Error('請輸入 1～24 字的名字。');
  const fixture=createFormalWorld({campaign:crypto.randomUUID(),seed:r.seed,speed:r.speed,name,civilizationId:r.civilizationId,offlineHours:r.offlineHours});
  enableAutonomy(fixture);const committed=await startCampaign(fixture,r.replaceIncompatible);await prepareAdmissionMap(committed);const nextWriter=await writerContext();world=committed;saved(true);writer=nextWriter;away=false;foregroundFence=undefined;reanchor();post({type:'switched',transitionId:r.transitionId,world,branch:writer.branch});await publishReportStatus();return;
 }
 if(r.type==='restore'||r.type==='import'){
  // Persistence performs history cleanup, Recovery, world and authority changes atomically.
  const committed=r.type==='restore'?await restore(r.id,true):await importSave(r.text,true);
  await prepareAdmissionMap(committed);const nextWriter=await writerContext();world=committed;saved(true);writer=nextWriter;away=false;foregroundFence=undefined;reanchor();post({type:'switched',transitionId:r.transitionId,world,branch:writer.branch});await publishReportStatus();return;
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
class QueryViewChanged extends Error{}
/** A cache reference detects a concurrent publication; it is never an integrity
 * proof. Each read still uses Persistence's verified authoritative result. */
async function stableRead<T>(read:()=>Promise<T>):Promise<T>{
 for(let attempt=0;attempt<3;attempt++){const source=world,context=writer,result=await read();if(world===source&&writer===context)return result;}
 throw new QueryViewChanged('命令查詢期間權威版本持續更新，請稍後重新查詢。');
}
/** T1 is awaited here, but runs independently of the world/AI drain. */
async function executeCommand(r:Extract<RuntimeRequest,{type:'command'}>){
 let row=await intake.get(r)!;
 for(;;){
  try{
  // A repeated ID always queries durable authority before considering execution.
  row=await commandStatus(row.campaignId,row.commandId)??row;
  if(terminalCommand(row)){post({type:'commandStatus',row});if(row.ack)post({type:'commandAck',ack:row.ack,campaignId:row.campaignId});state();return;}
   if(!world)throw new Error('請先建立正式世界。');
   if(row.branch!==writer?.branch||row.lastError==='戰役分支或玩家操作已變更，請重新確認原始操作。'){const ack=confirmationAck(row,world.revision);world=await finishCommand(row,ack,world.revision);post({type:'commandAck',ack,campaignId:row.campaignId});state();return;}
   if(findReceipt(world,row.commandId)){
    const ack=submitFormalOrder(world,row.order).ack!;world=await finishCommand(row,ack,world.revision);post({type:'commandAck',ack,campaignId:row.campaignId});state();return;
   }
   let order=revalidateInbox(world,row);
   if(Date.now()>=row.deadline)order=undefined;
   if(!order){
    const ack=confirmationAck(row,world.revision,Date.now()>=row.deadline?'命令等待逾時，請重新確認原始操作。':undefined);
    world=await finishCommand(row,ack,world.revision);post({type:'commandAck',ack,campaignId:row.campaignId});return;
   }
   let admission=world,caughtUp=false;const catchupReports:FormalReport[]=[];
   const target=targetTime();
   if(!worldPaused(world)){
    if(world.events.some(e=>e.at<=target)){
     const before=admission,replay=await advanceFormalCooperative(world,target,undefined,workBudget.advance);
     admission=replay.world;catchupReports.push(...replay.reports);caughtUp=true;
     // Revalidate the execution intent again after AI catch-up, preserving the
     // original row. No targets, quantities or original revisions are rewritten.
     const intent=captureIntent(before,order),check={...row,...intent,order};
     order=revalidateInbox(admission,check)!;
     if(!order){
      const ack=confirmationAck(row,world.revision+1);admission.revision=world.revision+1;
      for(let i=commandHistory(world).length;i<commandHistory(admission).length;i++)commandHistory(admission)[i].committedRevision=admission.revision;
      normalizeOutcomeRevisions(admission);world=await persistWorld(admission,catchupReports,world.revision,undefined,{row,ack});passiveRevisionBase=world.revision;
      post({type:'commandAck',ack,campaignId:row.campaignId});state();return;
     }
    }else if(target>world.time){admission=advanceFormal(world,target).world;admission.revision=world.revision;}
   }
   const result=submitFormalOrder(admission,order),ack=result.ack!;
   if(ack.status==='committed'||caughtUp){
    result.world.revision=world.revision+1;
    for(let i=commandHistory(world).length;i<commandHistory(result.world).length;i++)commandHistory(result.world)[i].committedRevision=Math.min(commandHistory(result.world)[i].committedRevision,result.world.revision);
    normalizeOutcomeRevisions(result.world);ack.revision=result.world.revision;
    world=await persistWorld(result.world,[...catchupReports,...result.reports],world.revision,undefined,{row,ack});
    if(['developer.configure','campaign.configure','player.rebirth','player.end'].includes(order.payload.type)||worldPaused(world))reanchor();
    lastSavedAt=performance.now();retryAt=0;passiveRevisionBase=world.revision;
   }else world=await finishCommand(row,ack,world.revision);
   // T3 cannot undo a committed T2, including a failed postMessage/notification.
   try{post({type:'commandAck',ack,campaignId:row.campaignId});state();if(result.reports.length||catchupReports.length)await publishReportStatus();}catch{/* Durable query/reload returns the exact result. */}
   return;
  }catch(error){
   // A lost Ack or an error after transaction completion must never be retried.
   const saved=await commandStatus(row.campaignId,row.commandId).catch(()=>undefined);
   if(saved&&terminalCommand(saved)){if(saved.ack)post({type:'commandAck',ack:saved.ack,campaignId:row.campaignId});return;}
   const text=error instanceof Error?error.message:'正式提交失敗。';
   let failed:InboxCommand&{committedWorld?:FormalWorld};
   try{failed=await noteCommandFailure(row,text,retryableStorageError(error));}
   catch{
    post({type:'commandBlocked',campaignId:row.campaignId,commandId:row.commandId,text:'無法保存命令結果；原持久命令保留。請檢查儲存空間後重新載入並查詢。'});state();return;
   }
   if(failed.committedWorld)world=failed.committedWorld;
   post({type:'commandStatus',row:failed});
   if(terminalCommand(failed)){if(failed.ack)post({type:'commandAck',ack:failed.ack,campaignId:row.campaignId});state();return;}
   // At most three attempts, bounded by a durable wall-clock deadline. The
   // foreground drain keeps order; small T1 writes can still complete meanwhile.
   await new Promise<void>(resolve=>setTimeout(resolve,Math.max(0,failed.nextAttemptAt-Date.now())));row=failed;
  }
 }
}
async function runRequest(r:RuntimeRequest){
 try{await handle(r);}catch(error:unknown){
  const text=playerMessage(error,'操作未完成，原始資料保留；請重新讀取或重試。');
  if(error instanceof Error&&saveErrors.has(error)&&r.type!=='command')post({type:'saveRequestFailed',requestId:r.requestId,operation:r.type,text:'保存尚未完成，原始進度保留。'});
  else if(error instanceof QueryViewChanged)post({type:'notice',error:true,text});
  else if(r.type==='command'){const existing=await commandStatus(r.order.campaignId,r.order.commandId).catch(()=>undefined);post({type:'commandReceiveFailed',retired:error instanceof RetiredCommand,campaignId:r.order?.campaignId,commandId:r.order?.commandId,row:existing,text:(error instanceof RetiredCommand?'舊身份已關閉，這次重送未執行：':existing?'此重送未受理：':'命令未持久接收：')+text+' 原始操作保留，請查詢後確認。'});}
  else if(r.type==='start'||r.type==='import'||r.type==='restore')post({type:'switchFailed',transitionId:r.transitionId,world,text});
  else if(r.type==='reportPage'||r.type==='reportStatus'||r.type==='reportAction')post({type:'notice',text:'戰報操作暫時失敗，請重試。'});
  else if(r.type==='cityIntel')post({type:'cityIntel',queryId:r.queryId,error:text});
  else{
   let token:string|undefined,display=text;
   if(r.type==='load'||r.type==='resume'){
    startWithoutWorld=false;
    if(text===OLD_CAMPAIGN_MESSAGE)try{token=await incompatibleStartToken();startWithoutWorld=!token;}catch(e){display=e instanceof Error?e.message:'無法安全確認舊戰役，原資料保留。';}
   }
   post({type:'error',text:display,requestId:r.requestId,...(text===OLD_CAMPAIGN_MESSAGE?{legacyAvailable:await hasLegacyCampaign().catch(()=>false)}:{}),incompatibleStartToken:token});
  }
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
   if(request){if(controls.has(request.type)){try{await queryQueue;await runRequest(request);}finally{controlPending--;}}else await runRequest(request);continue;}
   tickPending=false;tickRunning=true;
   try{if(!away)await advanceAndSave();}
   catch(error:unknown){retryAt=performance.now()+1000;if(!(error instanceof Error&&saveErrors.has(error)))post({type:'notice',error:true,text:playerMessage(error,'世界更新暫時失敗，請重新同步。')});}
   finally{tickRunning=false;}
  }
 }finally{draining=false;}
}
function scheduleDrain(){if(draining)return;draining=true;void drain();}
self.onmessage=(event:MessageEvent<RuntimeRequest>)=>{
 const r=event.data;
 // Queries read persisted authority and the last committed UI source, never
 // the private replay draft. A known durable ID never waits for unrelated
 // intake. An unknown ID waits for preceding T1 before reporting absence.
 // Mutating barriers retain the original foreground FIFO.
 if((r.type==='commandQuery'||r.type==='commandList')&&!controlPending){
  queryIntake.set(r,intakeQueue);queryQueue=queryQueue.then(()=>runRequest(r)).catch(()=>{});return;
 }
 if(controls.has(r.type))controlPending++;
 // Capture the high-precision boundary before it waits behind a save.
 // Persistence quantizes only the final shared wall anchor, never this fence.
 if(r.type==='away'&&!away){const received=performance.now(),absolute=performance.timeOrigin+received,at=Number.isFinite(r.visibilityAt)?Math.max(0,Math.min(received,r.visibilityAt!-performance.timeOrigin)):received;foregroundFence=Math.min(foregroundFence??at,at);awayBoundaries.set(r,{target:targetTime(foregroundFence),wallAt:Date.now()-(absolute-(performance.timeOrigin+foregroundFence))});}
 requests.push(r);
 if(r.type==='command'){
  post({type:'commandReceived',campaignId:r.order?.campaignId,commandId:r.order?.commandId,requestId:r.requestId});
  const branch=r.projection?.branch??r.branch??writer?.branch;
  const intent:CommandIntent={playerBase:r.playerBase,governanceBase:r.governanceBase,extinctionBase:r.extinctionBase};
  const received=intakeQueue.then(()=>{const p=r.projection;if(p&&(p.protocolVersion!==2||p.sessionId!==stream.sessionId||p.projectionSequence>stream.projectionSequence||p.campaignId!==r.order.campaignId||p.writerEpoch!==writer?.writerEpoch||p.branch!==r.branch||p.revision<r.order.expectedRevision||r.order.payload.type!=='governance.set'&&p.revision!==r.order.expectedRevision||!Number.isSafeInteger(p.projectionSequence)||p.projectionSequence<1))throw Error('畫面版本或寫入權已變更，請重新同步後確認原操作。');return receiveCommand(r.order,intent,branch);});intake.set(r,received);
  workBudget.trackIntake(received);
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
