import {commandFingerprint,confirmationAck,terminalCommand,resultState,WriterConflict,RevisionConflict,COMMAND_TTL,MAX_COMMAND_ATTEMPTS,type InboxCommand,type CommandIntent,type WriterContext} from './durableCommands';
import {worldPaused} from './formal/extinction';
import {growthTaskSchema} from './formal/growthTaskSchema';
import {reconcileGrowthAuthority} from './formal/growthTaskAuthority';
import type {GrowthTaskState} from './formal/growthTasks';
import {syncGrowthTasks} from './formal/growthTasks';
import {sanitizeSharedKnowledge,sanitizeScoutReport,scoutReportAuthorized} from './formal/reportScope';
import {enableAutonomy} from './formal/autonomy';
import {effectiveSpeed} from './formal/playtest';
import {advanceOfflineCooperative,type OfflineSummary} from './formal/offline';
import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {isMissionArmy,type CityIntel,type BattleReportPayload} from './formal/combatModel';
import type {CampaignId} from './formal/ids';
import type {CommandAck,FormalOrder,CommandReceipt,FormalReport,FormalWorld} from './formal/model';
import {orderSchema,receiptSchema} from './formal/schema';
import {canonicalJSON} from './formal/canonical';
import {OLD_CAMPAIGN_MESSAGE,assertCampaignCompatibility,decodeSave,encodeSave,validateReportHistory,type FormalEnvelope} from './formal/saveCodec';
import {FORMAL_DB_NAME,LEGACY_FORMAL_DB_NAME} from './formal/versions';
export {decodeSave,encodeSave} from './formal/saveCodec';
/** Presentation timestamps are captured while the event's real clock anchor is known. */
function stampBattle(p:BattleReportPayload,real:(at:number)=>number){p.realResolvedAt??=real(p.resolvedAt);if(p.intel)p.intel.observedRealAt??=real(p.intel.observedAt);}
function stampPending(w:FormalWorld,real:(at:number)=>number){for(const a of w.armies)if(isMissionArmy(a)){if(a.pendingIntel)a.pendingIntel.observedRealAt??=real(a.pendingIntel.observedAt);if(a.pendingReport)stampBattle(a.pendingReport,real);}}
export type FailurePoint='report-write'|'history-modified'|'backup-write'|'world-write'|'authority-write'|'inbox-write'|'result-write'|'writer-write'|'metadata-write'|'branch-write';
type RuntimeMeta={id:'runtime';writerEpoch:number;branch:number;foregroundRevision?:number;campaignId?:CampaignId;playerFactionId?:FormalWorld['playerFactionId'];revision?:number};
type CommandCommit={row:InboxCommand;ack:CommandAck};
type WorldRow={id:'current';kind:'world';at:number;data:FormalEnvelope};
type CampaignAuthority={campaignId:CampaignId;receipts:CommandReceipt[];growthTasks?:GrowthTaskState};
type AuthorityRow={id:'authority';kind:'authority';revision:number;sequences:FormalWorld['sequences'];campaigns:CampaignAuthority[]};
/** Both ledgers are strict receiptSchema records; compare every field without serializing history twice. */
const sameReceipt=(a:CommandReceipt,b:CommandReceipt)=>a.commandId===b.commandId&&a.issuerId===b.issuerId&&a.fingerprint===b.fingerprint&&a.committedRevision===b.committedRevision&&a.disposition===b.disposition;
export type RecoveryRow={id?:number;at:number;label:string;campaignId:CampaignId;gameTime:number;reportCursor:number;data:FormalEnvelope};
/** Pure candidate validation: no database access, history changes, or authority writes. */
export async function validateCheckpointCandidate(checkpoint:RecoveryRow):Promise<FormalWorld>{
 const {world}=await decodeSave(checkpoint.data);
 if(checkpoint.gameTime!==world.time||checkpoint.reportCursor!==world.sequences.report||checkpoint.campaignId!==world.campaignId)throw new Error('回復點游標不一致。');
 return world;
}
type ReportRow=FormalReport&{key:string};
export type ReportFilter='all'|'battle'|'diplomacy'|'chronicle';
const reportMatches=(r:FormalReport,filter:ReportFilter)=>filter==='all'||(filter==='battle'?r.category==='battle'||r.category==='scout':filter==='diplomacy'?r.category==='diplomacy':r.category==='system'||r.category==='research');
const authoritySchema=z.object({id:z.literal('authority'),kind:z.literal('authority'),revision:z.number().int().nonnegative().safe(),sequences:z.object({event:z.number().int().positive().safe(),report:z.number().int().positive().safe(),project:z.number().int().positive().safe()}).strict(),campaigns:z.array(z.object({campaignId:z.custom<CampaignId>(v=>typeof v==='string'&&/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(v)),receipts:z.array(receiptSchema),growthTasks:growthTaskSchema.optional()}).strict())}).strict();
export class FormalDatabase extends Dexie {
 Inbox!:Table<InboxCommand,number>;RuntimeMeta!:Table<RuntimeMeta,string>;
 saves!:Table<WorldRow|AuthorityRow,string>;backups!:Table<RecoveryRow,number>;BattleReports!:Table<ReportRow,string>;
 constructor(suffix='',databaseName:string=FORMAL_DB_NAME){
  if(suffix&&!/^[A-Za-z0-9_.-]+$/.test(suffix))throw new Error('Invalid formal database suffix');
  super(databaseName+(suffix?'-'+suffix:''));
  this.version(1).stores({saves:'id',backups:'++id,at,campaignId',BattleReports:'key,campaignId,[campaignId+sequence],[campaignId+ownerFactionId+sequence]'});
  // Additive v1→v2: existing worlds, authority, reports and Recovery are untouched.
  this.version(2).stores({Inbox:'++sequence,&[campaignId+commandId],[branch+state],state',RuntimeMeta:'id'});
 }
}
function reconcileReceipts(target:FormalWorld,prior:readonly CommandReceipt[]):CommandReceipt[]{
 const entries=new Map(target.commandReceipts.map(r=>[r.commandId,structuredClone(r)]));
 for(const old of prior){const chosen=entries.get(old.commandId);
  if(chosen&&(chosen.issuerId!==old.issuerId||chosen.fingerprint!==old.fingerprint))throw new Error('CommandId conflict in imported authority.');
  if(!chosen)entries.set(old.commandId,{...old,disposition:'rolled-back'});
 }
 return [...entries.values()].sort((a,b)=>a.commandId<b.commandId?-1:a.commandId>b.commandId?1:0);
}
const reportKey=(r:FormalReport)=>r.campaignId+'/'+r.id;
/** All world/report/history/Recovery/authority changes share exactly one IDB transaction. */
export class FormalPersistence {
 readonly db:FormalDatabase;
 constructor(options:{suffix?:string;fault?:(point:FailurePoint)=>void}={}){this.db=new FormalDatabase(options.suffix);this.fault=options.fault;}
 private fault?: (point:FailurePoint)=>void;
 private writerEpoch:number|undefined;
 private async meta(){return await this.db.RuntimeMeta.get('runtime')??{id:'runtime' as const,writerEpoch:0,branch:0};}
 private assertWriter(meta:RuntimeMeta){if(meta.writerEpoch!==(this.writerEpoch??0))throw new WriterConflict();}
 /** Called only by the Worker created under the page's exclusive Web Lock. */
 async acquireWriter():Promise<WriterContext>{
  const meta=await this.db.transaction('rw',this.db.RuntimeMeta,this.db.saves,async()=>{const m=await this.meta();if(m.campaignId===undefined){const current=await this.db.saves.get('current');if(current?.kind==='world'){m.campaignId=current.data.snapshot.campaignId;m.playerFactionId=current.data.snapshot.playerFactionId;m.revision=current.data.snapshot.revision;}}m.writerEpoch++;await this.db.RuntimeMeta.put(m);this.fault?.('writer-write');return m;});
  this.writerEpoch=meta.writerEpoch;return meta;
 }
 async writerContext():Promise<WriterContext>{const m=await this.meta();this.assertWriter(m);return m;}
 async receiveCommand(order:FormalOrder,intent:CommandIntent={},branch?:number,now=Date.now()):Promise<InboxCommand>{
  // Strict parsing occurs before T1; never store mutable caller-owned payloads.
  order=orderSchema.parse(order);
  return this.db.transaction('rw',this.db.RuntimeMeta,this.db.Inbox,async()=>{
   const meta=await this.meta();this.assertWriter(meta);
   const fingerprint=commandFingerprint(order),old=await this.db.Inbox.where('[campaignId+commandId]').equals([order.campaignId,order.commandId]).first();
   if(old){if(old.issuerId!==order.issuerId||old.fingerprint!==fingerprint)throw new Error('CommandId 已用於不同命令。');return old;}
   if(meta.campaignId!==order.campaignId||meta.playerFactionId!==order.issuerId)throw new Error('命令不屬於目前玩家戰役。');
   const row:InboxCommand={...structuredClone(intent),campaignId:order.campaignId,commandId:order.commandId,issuerId:order.issuerId,order:structuredClone(order),fingerprint,originalRevision:order.expectedRevision,branch:branch??meta.branch,writerEpoch:meta.writerEpoch,state:'pending',createdAt:now,deadline:now+COMMAND_TTL,attempts:0,nextAttemptAt:0};
   if(row.branch!==meta.branch||order.expectedRevision<(meta.foregroundRevision??0)){row.state='needs-confirmation';row.ack=confirmationAck(row,meta.revision??0,'戰役分支或玩家操作已變更，請重新確認原始操作。');}
   row.sequence=await this.db.Inbox.add(row);this.fault?.('inbox-write');return row;
  });
 }
 async commandStatus(campaignId:FormalOrder['campaignId'],commandId:FormalOrder['commandId']){return this.db.Inbox.where('[campaignId+commandId]').equals([campaignId,commandId]).first();}
 async pendingCommands(){return this.db.Inbox.where('state').anyOf('pending','retryable').sortBy('sequence');}
 async commandPage(before=Number.MAX_SAFE_INTEGER){return this.db.Inbox.where('sequence').below(before).reverse().limit(100).toArray();}
 private async checkCommand(row:InboxCommand,meta:RuntimeMeta){
  this.assertWriter(meta);const stored=await this.db.Inbox.get(row.sequence!);
  if(!stored||stored.fingerprint!==row.fingerprint||stored.issuerId!==row.issuerId)throw new Error('找不到一致的持久命令。');
  if(stored.branch!==meta.branch)throw new WriterConflict();
  return stored;
 }
 private async writeResult(command:CommandCommit,meta:RuntimeMeta){
  const stored=await this.checkCommand(command.row,meta);
  if(terminalCommand(stored))throw new Error('命令已具有正式結果，請查詢原結果。');
  if(command.ack.commandId!==stored.commandId||command.ack.revision!==(meta.revision??0))throw new Error('正式結果身分或 revision 不一致。');
  await this.db.Inbox.put({...stored,state:resultState(command.ack),ack:structuredClone(command.ack),lastError:undefined});this.fault?.('result-write');
 }
 async finishCommand(row:InboxCommand,ack:CommandAck,expectedRevision:number){
  return this.db.transaction('rw',this.db.RuntimeMeta,this.db.Inbox,this.db.saves,async()=>{
   const meta=await this.meta();this.assertWriter(meta);const authority=await this.authority();if(authority.revision!==expectedRevision)throw new RevisionConflict();
   await this.writeResult({row,ack},meta);return ack;
  });
 }
 async noteCommandFailure(row:InboxCommand,error:string,retryable:boolean,now=Date.now()){
  return this.db.transaction('rw',this.db.RuntimeMeta,this.db.Inbox,this.db.saves,async()=>{
   const meta=await this.meta(),stored=await this.checkCommand(row,meta);if(terminalCommand(stored))return stored;
   stored.attempts++;stored.lastError=error;
   if(retryable&&stored.attempts<MAX_COMMAND_ATTEMPTS&&now<stored.deadline){stored.state='retryable';stored.nextAttemptAt=now+250*2**(stored.attempts-1);}
   else{stored.state='needs-confirmation';stored.ack=confirmationAck(stored,(await this.authority()).revision,'命令尚未提交：'+error+'；請重新載入並確認原始操作。');}
   await this.db.Inbox.put(stored);return stored;
  });
 }
 private async switchInbox(meta:RuntimeMeta,world?:FormalWorld){
  meta.branch++;meta.foregroundRevision=world?.revision??0;if(!world){delete meta.campaignId;delete meta.playerFactionId;meta.revision=0;}await this.db.RuntimeMeta.put(meta);
  // Branch changes are infrequent; no full Inbox scan on ordinary checkpoints.
  await this.db.Inbox.toCollection().modify(row=>{
   if(!terminalCommand(row)){row.state='needs-confirmation';row.ack=confirmationAck(row,world?.revision??0,'戰役分支已切換，舊命令未執行，請重新確認。');}
   if(world&&row.campaignId===world.campaignId&&row.state==='committed'){
    const r=world.commandReceipts.find(r=>r.commandId===row.commandId);
    if(r?.disposition==='rolled-back'){row.state='rolled-back';row.ack={commandId:row.commandId,status:'rolled-back',revision:world.revision,originalRevision:r.committedRevision,reason:'此命令已由回復點撤銷。'};}
   }
  });this.fault?.('branch-write');
 }

 private async authority():Promise<AuthorityRow>{
  const row=await this.db.saves.get('authority');
  if(!row)return{id:'authority',kind:'authority',revision:0,sequences:{event:1,report:1,project:1},campaigns:[]};
  const a=authoritySchema.parse(row);
  if(new Set(a.campaigns.map(x=>x.campaignId)).size!==a.campaigns.length)throw new Error('Duplicate campaign authority');
  for(const c of a.campaigns)if(new Set(c.receipts.map(r=>r.commandId)).size!==c.receipts.length||c.receipts.some(r=>r.committedRevision>a.revision))throw new Error('Invalid durable command authority');
  return a;
 }
 private async commit(input:FormalWorld,reportWrites:readonly FormalReport[],mode:'save'|'start'|'restore'|'import',expectedRevision?:number,savedAt=Date.now(),activateAI=false,command?:CommandCommit):Promise<FormalWorld>{
  // Final encodeSave validates the entire stamped candidate before any writes.
  // Avoid validating the same 2.8MB world twice in this transaction.
  validateReportHistory(input,reportWrites);
  // No memory mutation; caller may switch its displayed world only after this resolves.
  return this.db.transaction('rw',this.db.saves,this.db.backups,this.db.BattleReports,this.db.Inbox,this.db.RuntimeMeta,async()=>{
   const meta=await this.meta();this.assertWriter(meta);
   const authority=await this.authority(),current=await this.db.saves.get('current');
   if(expectedRevision!==undefined&&authority.revision!==expectedRevision)throw new RevisionConflict();
   // Ordinary saves only stamp pending army reports and sanitize shared AI intel.
   // Copy those mutable branches now; encodeSave still strictly validates and
   // deep-copies the entire final candidate before checksum or any DB writes.
   // Transitions/AI activation retain the general full draft.
   let w=sanitizeSharedKnowledge(mode==='save'&&!activateAI?{...input,...(input.growthTasks?{growthTasks:structuredClone(input.growthTasks)}:{}),armies:structuredClone(input.armies),...(input.autonomy?{autonomy:structuredClone(input.autonomy)}:{})}:structuredClone(input));
   const prior=authority.campaigns.find(c=>c.campaignId===w.campaignId)?.receipts??[];
   if(mode==='save'){
    for(const key of ['event','report','project'] as const)if(w.sequences[key]<authority.sequences[key])throw new Error('Durable ID sequence cannot decrease');
    if(current&&current.kind==='world'&&current.data.snapshot.campaignId!==w.campaignId)throw new Error('Campaign switch requires explicit transition');
    const required=current?authority.revision+1:0;
    if(w.revision!==required)throw new Error('Committed revision must advance exactly once');
    const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));
    for(const r of prior){const receipt=receipts.get(r.commandId);if(!receipt||!sameReceipt(receipt,r))throw new Error('Durable dedupe history cannot be dropped');}
   }else{
    w.commandReceipts=reconcileReceipts(w,prior);
    for(const key of ['event','report','project'] as const)w.sequences[key]=Math.max(w.sequences[key],authority.sequences[key]);
    w.revision=Math.max(current?authority.revision+1:0,w.revision);
    for(const r of w.commandReceipts)w.revision=Math.max(w.revision,r.committedRevision);
   }
   reconcileGrowthAuthority(w,authority.campaigns.find(c=>c.campaignId===w.campaignId)?.growthTasks,mode!=='save');
   syncGrowthTasks(w);
   if(activateAI&&!worldPaused(w))enableAutonomy(w);
   const real=(at:number)=>Math.max(0,Math.floor(savedAt-(w.time-at)/effectiveSpeed(input)));
   if(mode==='save'||mode==='start')stampPending(w,real);
   const stampedReports=reportWrites.map(r=>{const copy=structuredClone(sanitizeScoutReport(w,r));if(mode!=='import'){copy.realAt??=real(copy.at);copy.clockSpeed??=effectiveSpeed(input);copy.read??=false;if(copy.battle)stampBattle(copy.battle,real);}return copy;});
   validateReportHistory(w,stampedReports);
   // encodeSave fully validates the final world; crypto needs keep-alive under the revision lock.
   const envelope=await Dexie.waitFor(encodeSave(w));
   // All post-crypto history, metadata, authority and returned state use the
   // isolated validated snapshot, even if the caller mutates input while awaiting.
   w=envelope.snapshot;
   if(mode==='restore'||mode==='import'){
    const rows=await this.db.BattleReports.where('campaignId').equals(w.campaignId).toArray();
    const obsolete=mode==='import'?rows:rows.filter(r=>r.at>input.time||r.sequence>=input.sequences.report);
    if(obsolete.length)await this.db.BattleReports.bulkDelete(obsolete.map(r=>r.key));
    const points=await this.db.backups.where('campaignId').equals(w.campaignId).toArray();
    const invalid=mode==='import'?points:points.filter(r=>r.gameTime>input.time||r.reportCursor>input.sequences.report);
    if(invalid.length)await this.db.backups.bulkDelete(invalid.map(r=>r.id!));
    this.fault?.('history-modified');
   }
   // Repair retained legacy rows in the same atomic transition, preserving IDs and history.
   if(mode==='restore'||mode==='import')await this.sanitizeStoredReports(w);
   if(reportWrites.length)await this.db.BattleReports.bulkPut(stampedReports.map(r=>({...r,key:reportKey(r)})));
   this.fault?.('report-write');
   // Two valid checkpoints; ordering uses IDB monotonic IDs, not wall-clock ordering.
   await this.db.backups.add({at:savedAt,label:mode==='restore'?'手動回復':mode==='import'?'正式匯入':mode==='start'?'B1 fixture開始':'正式回復點',campaignId:w.campaignId,gameTime:w.time,reportCursor:w.sequences.report,data:envelope});
   const backupIds=await this.db.backups.orderBy('id').primaryKeys();if(backupIds.length>2)await this.db.backups.bulkDelete(backupIds.slice(0,-2));
   this.fault?.('backup-write');
   await this.db.saves.put({id:'current',kind:'world',at:savedAt,data:envelope});this.fault?.('world-write');
   authority.revision=w.revision;authority.sequences={...w.sequences};
   authority.campaigns=authority.campaigns.filter(c=>c.campaignId!==w.campaignId);
   authority.campaigns.push({campaignId:w.campaignId,receipts:structuredClone(w.commandReceipts),...(w.growthTasks?{growthTasks:structuredClone(w.growthTasks)}:{})});
   await this.db.saves.put(authority);this.fault?.('authority-write');
   if(command){
    if(command.ack.status==='committed'||command.ack.status==='duplicate'){
     const receipt=w.commandReceipts.find(r=>r.commandId===command.row.commandId);
     if(!receipt||receipt.issuerId!==command.row.issuerId||receipt.fingerprint!==command.row.fingerprint||receipt.disposition!=='applied')throw new Error('正式結果與世界命令收據不一致。');
     meta.foregroundRevision=w.revision;
    }
   }
   meta.campaignId=w.campaignId;meta.playerFactionId=w.playerFactionId;meta.revision=w.revision;await this.db.RuntimeMeta.put(meta);this.fault?.('metadata-write');
   if(command)await this.writeResult(command,meta);
   if(mode!=='save')await this.switchInbox(meta,w);
   return w;
  });
 }
 async save(world:FormalWorld,reports:readonly FormalReport[]=[],expectedRevision?:number,savedAt?:number,command?:CommandCommit){return this.commit(world,reports,'save',expectedRevision,savedAt,false,command);}
 async start(world:FormalWorld){return this.commit(world,[],'start');}
 private async loadAnchored():Promise<{game:FormalWorld|null;recovered:boolean;savedAt?:number}>{
  const [row,authority]=await this.db.transaction('r',this.db.saves,async()=>[await this.db.saves.get('current'),await this.authority()] as const);if(!row){if(await hasLegacyCampaign())throw new Error(OLD_CAMPAIGN_MESSAGE);return{game:null,recovered:false};}
  if(row.kind==='world')assertCampaignCompatibility(row.data);
  let world:FormalWorld|undefined;
  try{
   if(row.kind!=='world')throw new Error('Invalid world row');
   world=(await decodeSave(row.data)).world;
   const a=authority,ledger=a.campaigns.find(c=>c.campaignId===world!.campaignId)?.receipts??[];
   if(world.revision!==a.revision||canonicalJSON(world.commandReceipts)!==canonicalJSON(ledger))throw new Error('World and authority diverged');
   const tasks=a.campaigns.find(c=>c.campaignId===world!.campaignId)?.growthTasks;if(tasks&&canonicalJSON(tasks)!==canonicalJSON(world.growthTasks))throw new Error('Growth task authority diverged');
  }catch{
   // Reject corrupt/DEMO snapshots; only a valid formal checkpoint can be restored.
   const candidates=await this.db.backups.orderBy('id').reverse().toArray();
   for(const b of candidates){
    let candidate:FormalWorld;
    try{candidate=await validateCheckpointCandidate(b);}catch{continue;}
    // Candidate selected. Storage/CAS/transaction errors must propagate, never try an older point.
    return{game:await this.restoreValidatedCheckpoint(candidate,b.at),recovered:true,savedAt:b.at};
   }
   throw new Error('正式存檔與回復點均無法讀取，資料保留。');
  }
  await this.sanitizeStoredReports(world!);
  return{game:world!,recovered:false,savedAt:row.at};
 }
 private async sanitizeStoredReports(world:FormalWorld){await this.db.transaction('rw',this.db.BattleReports,async()=>{const rows=await this.db.BattleReports.where('campaignId').equals(world.campaignId).toArray();const repaired=rows.map(r=>sanitizeScoutReport(world,r) as ReportRow).filter((r,i)=>r!==rows[i]);if(repaired.length)await this.db.BattleReports.bulkPut(repaired);});}
 async loadSave(){const {game,recovered}=await this.loadAnchored();return {game,recovered};}
 async loadWithOffline(now=Date.now(),onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void):Promise<{game:FormalWorld|null;recovered:boolean;summary?:OfflineSummary}>{
  onProgress?.('read');
  const loaded=await this.loadAnchored();if(!loaded.game)return {game:null,recovered:loaded.recovered};
  // Capture provable legacy state before offline replay can change ownership or population.
  loaded.game={...loaded.game,...(loaded.game.growthTasks?{growthTasks:structuredClone(loaded.game.growthTasks)}:{})};syncGrowthTasks(loaded.game);
  onProgress?.('offline',0,0);
  const result=await advanceOfflineCooperative(loaded.game,loaded.savedAt??now,now,(fraction,events)=>onProgress?.('offline',fraction,events));
  // Even 0h refreshes the wall anchor atomically. Expose nothing until save resolves.
  const draft=result.world.revision===loaded.game.revision?{...result.world,revision:result.world.revision+1}:result.world;
  const real=(at:number)=>Math.max(0,Math.floor((loaded.savedAt??now)+(at-loaded.game!.time)/loaded.game!.speed));
  stampPending(draft,real);
  const reports=result.reports.map(r=>{const copy={...r,realAt:real(r.at),clockSpeed:loaded.game!.speed};if(copy.battle)stampBattle(copy.battle,real);return copy;});
  onProgress?.('save');
  const game=await this.commit(draft,reports,'save',loaded.game.revision,now);
  return{game,recovered:loaded.recovered,summary:{...result.summary,recovered:loaded.recovered}};
 }
 async backupList(){
  const result:{id:number;at:number;label:string;time:number;reportCursor:number}[]=[];
  for(const b of await this.db.backups.orderBy('id').reverse().toArray()){
   try{await validateCheckpointCandidate(b);
    result.push({id:b.id!,at:b.at,label:b.label,time:b.gameTime,reportCursor:b.reportCursor});}catch{/* Invalid or DEMO rows are never offered as formal Recovery. */}
  }
  return result;
 }
 async restore(id:number,activateAI=false){
  if(!Number.isSafeInteger(id)||id<1)throw new Error('回復點 ID 無效。');
  const b=await this.db.backups.get(id);if(!b)throw new Error('找不到正式回復點。');
  return this.restoreValidatedCheckpoint(await validateCheckpointCandidate(b),Date.now(),activateAI);
 }
 private async restoreValidatedCheckpoint(world:FormalWorld,savedAt=Date.now(),activateAI=false){
  const a=await this.authority();return this.commit(world,[],'restore',a.revision,savedAt,activateAI);
 }
 async importSave(text:string,activateAI=false){
  if(new TextEncoder().encode(text).length>100*1024*1024)throw new Error('存檔超過 100 MiB。');
  const {world,reports}=await decodeSave(JSON.parse(text)),a=await this.authority();
  return this.commit(world,reports??[],'import',a.revision,Date.now(),activateAI);
 }
 async exportStoredSave(mode:'quick'|'full'='quick'){
  const {world,reports}=await this.db.transaction('r',this.db.saves,this.db.BattleReports,async()=>{
   const row=await this.db.saves.get('current');if(!row||row.kind!=='world')throw new Error('沒有正式存檔可匯出。');
   const {world}=await Dexie.waitFor(decodeSave(row.data));
   const reports=mode==='full'?(await this.db.BattleReports.where('campaignId').equals(world.campaignId).toArray()).filter(r=>r.sequence<world.sequences.report&&r.at<=world.time).map(({key:_key,...r})=>sanitizeScoutReport(world,r)):undefined;
   return{world,reports};
  });
  return JSON.stringify(await encodeSave(world,reports));
 }
 private reportQuery(world:FormalWorld){return this.db.BattleReports.where('[campaignId+ownerFactionId+sequence]').between([world.campaignId,world.playerFactionId,1],[world.campaignId,world.playerFactionId,world.sequences.report],true,false).filter(r=>r.at<=world.time&&scoutReportAuthorized(r));}
 async reportStatus(world:FormalWorld){
  const counts={all:0,battle:0,diplomacy:0,chronicle:0},unread={all:0,battle:0,diplomacy:0,chronicle:0};
  await this.reportQuery(world).each(r=>{const bucket=r.category==='battle'||r.category==='scout'?'battle':r.category==='diplomacy'?'diplomacy':'chronicle';counts.all++;counts[bucket]++;if(r.read!==true){unread.all++;unread[bucket]++;}});
  return {counts,unread:unread.all,alerts:unread.battle};
 }
 async readReportPage(world:FormalWorld,page=0,filter:ReportFilter='all'){
  if(!Number.isSafeInteger(page)||page<0||!['all','battle','diplomacy','chronicle'].includes(filter))throw new Error('無效的戰報頁碼或分類。');
  const query=this.reportQuery(world).filter(r=>reportMatches(r,filter));
  // Dexie Collection modifiers mutate the query: count before applying page limits.
  const count=await query.count();
  const rows=(await query.reverse().offset(page*50).limit(50).toArray()).map(({key:_key,...r})=>r);
  return{page,filter,count,rows,...await this.reportStatus(world)};
 }
 async reportAction(world:FormalWorld,action:'read'|'clear',ids?:string[],filter:ReportFilter='all'){
  if(!['read','clear'].includes(action)||!['all','battle','diplomacy','chronicle'].includes(filter))throw new Error('無效的戰報操作。');
  return this.db.transaction('rw',this.db.BattleReports,this.db.RuntimeMeta,async()=>{
   this.assertWriter(await this.meta());
   const query=this.reportQuery(world).filter(r=>reportMatches(r,filter)&&(!ids||ids.includes(r.id)));
   if(action==='clear')await query.delete();else await query.modify({read:true});
   return this.reportStatus(world);
  });
 }
 /** Read delivered, player-owned historical intel across all report pages; never inspect pending armies. */
 async readCityIntel(world:FormalWorld,cityId:string,generation?:number){
  const result:CityIntel={};
  await this.db.BattleReports.where('[campaignId+ownerFactionId+sequence]')
   .between([world.campaignId,world.playerFactionId,1],[world.campaignId,world.playerFactionId,world.sequences.report],true,false)
   .reverse().until(()=>!!result.army&&!!result.resources&&(generation!==undefined||!!result.defenses)).each(r=>{
    const p=r.battle,i=p?.intel;
    if(!scoutReportAuthorized(r)||r.at>world.time||!i||(generation===undefined?i.cityId!==cityId:i.siteId!==cityId||i.generation!==generation)||!p!.attackers.some(a=>a.ownerFactionId===world.playerFactionId))return;
    const observation={intel:i,owner:p!.ownerBefore};
    result.army??=observation;
    if(i.resources)result.resources??=observation;
    if(i.wallLevel!==undefined)result.defenses??=observation;
   });
  return result;
 }
 /** Explicit formal reset only. Does not enumerate, access, or delete any DEMO DB. */
 async clearSavedGames(){await this.db.transaction('rw',this.db.saves,this.db.backups,this.db.BattleReports,this.db.RuntimeMeta,this.db.Inbox,async()=>{const meta=await this.meta();this.assertWriter(meta);await this.switchInbox(meta);await this.db.saves.clear();await this.db.backups.clear();await this.db.BattleReports.clear();});}
}
let store:FormalPersistence|undefined;
const active=()=>store??=new FormalPersistence();
export const save=(...args:Parameters<FormalPersistence['save']>)=>active().save(...args);
export const startCampaign=(world:FormalWorld)=>active().start(world);
export const loadSave=()=>active().loadSave();
export const backupList=()=>active().backupList();
export const restore=(...args:Parameters<FormalPersistence['restore']>)=>active().restore(...args);
export const importSave=(...args:Parameters<FormalPersistence['importSave']>)=>active().importSave(...args);
export const exportStoredSave=(mode:'quick'|'full'='quick')=>active().exportStoredSave(mode);
export const readReportPage=(world:FormalWorld,page:number,filter?:ReportFilter)=>active().readReportPage(world,page,filter);
export const reportStatus=(world:FormalWorld)=>active().reportStatus(world);
export const reportAction=(world:FormalWorld,action:'read'|'clear',ids?:string[],filter?:ReportFilter)=>active().reportAction(world,action,ids,filter);
export const clearSavedGames=()=>active().clearSavedGames();

export const loadWithOffline=(onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void)=>active().loadWithOffline(Date.now(),onProgress);

export const readCityIntel=(world:FormalWorld,cityId:string,generation?:number)=>active().readCityIntel(world,cityId,generation);

/** Dynamic-schema open never requests a version upgrade or writes a legacy row. */
export async function hasLegacyCampaign(){
 if(!await Dexie.exists(LEGACY_FORMAL_DB_NAME))return false;
 const old=new Dexie(LEGACY_FORMAL_DB_NAME);try{await old.open();return await old.transaction('r',old.tables,async()=>{for(const t of old.tables)if(await t.count())return true;return false;});}finally{old.close();}
}
export async function exportLegacyCampaign(){
 if(!await Dexie.exists(LEGACY_FORMAL_DB_NAME))throw new Error('沒有可匯出的舊戰役。');
 const old=new Dexie(LEGACY_FORMAL_DB_NAME);
 try{await old.open();const rows=(name:string)=>old.tables.some(t=>t.name===name)?old.table(name).toArray():Promise.resolve([]);const archive=await old.transaction('r',old.tables,async()=>({format:'lieguo-historical-archive-v1',sourceDatabase:LEGACY_FORMAL_DB_NAME,saves:await rows('saves'),backups:await rows('backups'),reports:await rows('BattleReports')}));const text=JSON.stringify(archive);if(new TextEncoder().encode(text).length>100*1024*1024)throw new Error('舊備份超過100 MiB，原資料保留。');return text;}finally{old.close();}
}

export const acquireWriter=()=>active().acquireWriter();
export const writerContext=()=>active().writerContext();
export const receiveCommand=(...args:Parameters<FormalPersistence['receiveCommand']>)=>active().receiveCommand(...args);
export const commandStatus=(...args:Parameters<FormalPersistence['commandStatus']>)=>active().commandStatus(...args);
export const pendingCommands=()=>active().pendingCommands();
export const commandPage=(before?:number)=>active().commandPage(before);
export const finishCommand=(...args:Parameters<FormalPersistence['finishCommand']>)=>active().finishCommand(...args);
export const noteCommandFailure=(...args:Parameters<FormalPersistence['noteCommandFailure']>)=>active().noteCommandFailure(...args);
