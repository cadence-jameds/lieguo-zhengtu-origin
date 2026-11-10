import {createReplayFence,validateReplayFence,intakeEpoch,nextIntakeEpoch,acceptCommandIdentity,type ReplayFence} from './replayFence';
import {assertCommandFactsTransition,evidenceReceipt,ensureCommandFacts,pruneCommandEvidence} from './formal/commandEvidence';
import {commandHistory,pendingHistory,worldLedger,findReceipt,bindLedger,cachedLedger,emptyVerifiedLedger,prepareVerifiedLedger,verifyLedgerArchive,type VerifiedLedger,type OriginalResult,normalizeOutcomeRevisions} from './formal/commandLedger';
import {cloneWorldDraft} from './formal/worldDraft';
import {ledgerStores,ledgerTables,scanLedgerIdentity,readLedger,readLedgerArchive,writeLedger,publishLedgerHead,resultFromReceipt,archiveFromBundle,LedgerReadSession,type LedgerBundle} from './ledgerStore';
import {jsonDataEqual} from './formal/jsonDataEqual';
import {commandEvidenceValueSchema,validateFormalWorld} from './formal/schema';
import {commandFingerprint,confirmationAck,terminalCommand,resultState,WriterConflict,RevisionConflict,COMMAND_TTL,MAX_COMMAND_ATTEMPTS,type InboxCommand,type CommandIntent,type WriterContext} from './durableCommands';
import {worldPaused} from './formal/extinction';
import {validateGrowthProofs,growthTaskSchema} from './formal/growthTaskSchema';
import {reconcileGrowthAuthority} from './formal/growthTaskAuthority';
import type {GrowthTaskState} from './formal/growthTasks';
import {syncGrowthTasks} from './formal/growthTasks';
import {sanitizeSharedKnowledge,sanitizeScoutReport,scoutReportAuthorized} from './formal/reportScope';
import {enableAutonomy} from './formal/autonomy';
import {effectiveSpeed} from './formal/playtest';
import {advanceOfflineCooperative,type OfflineSummary} from './formal/offline';
import type {CooperativeAdvanceOptions} from './formal/reducer';
import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {isMissionArmy,type CityIntel,type BattleReportPayload} from './formal/combatModel';
import type {CampaignId} from './formal/ids';
import type {CommandAck,FormalOrder,CommandReceipt,FormalReport,FormalWorld} from './formal/model';
import {orderSchema} from './formal/schema';
import {digest,canonicalJSON} from './formal/canonical';
import {OLD_CAMPAIGN_MESSAGE,assertCampaignCompatibility,decodeSave,encodeSave,validateReportHistory,sealTransport,type FormalEnvelope} from './formal/saveCodec';
import {FORMAL_DB_NAME,LEGACY_FORMAL_DB_NAME,RETIRED_FORMAL_DB_NAME} from './formal/versions';
export {decodeSave,encodeSave} from './formal/saveCodec';
/** Presentation timestamps are captured while the event's real clock anchor is known. */
function stampBattle(p:BattleReportPayload,real:(at:number)=>number){p.realResolvedAt??=real(p.resolvedAt);if(p.intel)p.intel.observedRealAt??=real(p.intel.observedAt);}
function stampPending(w:FormalWorld,real:(at:number)=>number){for(const a of w.armies)if(isMissionArmy(a)){if(a.pendingIntel)a.pendingIntel.observedRealAt??=real(a.pendingIntel.observedAt);if(a.pendingReport)stampBattle(a.pendingReport,real);}}
export type FailurePoint='fence-write'|'retention-write'|'report-write'|'history-modified'|'backup-write'|'world-write'|'authority-write'|'inbox-write'|'result-write'|'writer-write'|'metadata-write'|'branch-write'|'ledger-segment-write'|'ledger-result-write'|'ledger-index-write'|'ledger-manifest-write'|'ledger-head-write';
type RuntimeMeta={fenceChecksum?:string;fence?:ReplayFence;recentCampaigns?:CampaignId[];id:'runtime';writerEpoch:number;branch:number;foregroundRevision?:number;campaignId?:CampaignId;playerFactionId?:FormalWorld['playerFactionId'];revision?:number};
function mergeGrowth(current:GrowthTaskState|undefined,prior:GrowthTaskState|undefined){if(!current)return prior&&structuredClone(prior);if(!prior)return structuredClone(current);const next=structuredClone(current);next.startedAt=Math.min(next.startedAt,prior.startedAt);next.recordedThrough=Math.max(next.recordedThrough,prior.recordedThrough);for(const [k,n]of Object.entries(prior.facts))next.facts[k]=Math.max(next.facts[k]??0,n);Object.assign(next.completed,prior.completed);Object.assign(next.claimed,structuredClone(prior.claimed));next.settledCities=[...new Set([...next.settledCities,...prior.settledCities])];next.autoShipments=[...new Set([...next.autoShipments,...prior.autoShipments])];return next;}
function originalCommand(row:InboxCommand,ack:CommandAck):OriginalResult{if(row.originalResult)return row.originalResult;const state=resultState(ack);return {commandId:row.commandId,issuerId:row.issuerId,fingerprint:row.fingerprint,state:state==='committed'?'committed':state==='needs-confirmation'?'needs-confirmation':'rejected',ack:{...structuredClone(ack),...(state==='needs-confirmation'?{requiresConfirmation:true as const}:{})},order:structuredClone(row.order)};}
type CommandCommit={row:InboxCommand;ack:CommandAck};
type WorldRow={id:'current';kind:'world';at:number;data:FormalEnvelope};
type DomainAuthority={campaignId:string;playerFactionId?:string;growthTasks?:GrowthTaskState;claimEvidence?:Record<string,import('./formal/commandEvidence').CommandEvidence>;labIncoming?:true};
type CampaignAuthority=Omit<DomainAuthority,'campaignId'>&{campaignId:CampaignId;ledgerRoot?:string};
type RecoveryRef={at:number;id:number;campaignId:CampaignId;root:string;checksum:string};
type AuthorityRow={savedAt?:number;recovery:RecoveryRef[];checksum?:string;id:'authority';kind:'authority';activeCampaignId?:CampaignId;worldChecksum?:string;revision:number;sequences:FormalWorld['sequences'];campaigns:CampaignAuthority[]};
/** Both ledgers are strict receiptSchema records; compare every field without serializing history twice. */
const sameReceipt=(a:CommandReceipt,b:CommandReceipt)=>a.commandId===b.commandId&&a.issuerId===b.issuerId&&a.fingerprint===b.fingerprint&&a.committedRevision===b.committedRevision&&a.disposition===b.disposition;
export type RecoveryRow={id?:number;at:number;label:string;campaignId:CampaignId;gameTime:number;reportCursor:number;data:FormalEnvelope};
/** Pure candidate validation: no database access, history changes, or authority writes. */
export async function validateCheckpointCandidate(checkpoint:RecoveryRow,archive?:import('./formal/commandLedger').LedgerArchive|VerifiedLedger):Promise<FormalWorld>{
 const {world}=await decodeSave(checkpoint.data,archive);
 if(checkpoint.gameTime!==world.time||checkpoint.reportCursor!==world.sequences.report||checkpoint.campaignId!==world.campaignId)throw new Error('回復點游標不一致。');
 return world;
}
type ReportRow=FormalReport&{key:string};
export type ReportFilter='all'|'battle'|'diplomacy'|'chronicle';
const reportMatches=(r:FormalReport,filter:ReportFilter)=>filter==='all'||(filter==='battle'?r.category==='battle'||r.category==='scout':filter==='diplomacy'?r.category==='diplomacy':r.category==='system'||r.category==='research');
const domainAuthoritySchema=z.object({campaignId:z.string().regex(/^campaign:[A-Za-z0-9_.-]{1,100}$/),playerFactionId:z.string().regex(/^faction:[A-Za-z0-9_.-]{1,100}$/).optional(),growthTasks:growthTaskSchema.optional(),claimEvidence:z.record(commandEvidenceValueSchema).optional(),labIncoming:z.literal(true).optional()}).strict();
const recoveryRefSchema=z.object({at:z.number().int().nonnegative().safe(),id:z.number().int().positive().safe(),campaignId:z.custom<CampaignId>(v=>typeof v==='string'&&/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(v)),root:z.string().regex(/^[0-9a-f]{64}$/),checksum:z.string().regex(/^[0-9a-f]{64}$/)}).strict();
const authoritySchema=z.object({savedAt:z.number().int().nonnegative().safe().optional(),recovery:z.array(recoveryRefSchema).max(2),checksum:z.string().regex(/^[0-9a-f]{64}$/).optional(),id:z.literal('authority'),kind:z.literal('authority'),activeCampaignId:z.custom<CampaignId>(v=>typeof v==='string'&&/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(v)).optional(),worldChecksum:z.string().regex(/^[0-9a-f]{64}$/).optional(),revision:z.number().int().nonnegative().safe(),sequences:z.object({event:z.number().int().positive().safe(),report:z.number().int().positive().safe(),project:z.number().int().positive().safe()}).strict(),campaigns:z.array(z.object({campaignId:z.custom<CampaignId>(v=>typeof v==='string'&&/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(v)),ledgerRoot:z.string().regex(/^[0-9a-f]{64}$/).optional(),playerFactionId:z.string().regex(/^faction:[A-Za-z0-9_.-]{1,100}$/).optional(),growthTasks:growthTaskSchema.optional(),claimEvidence:z.record(commandEvidenceValueSchema).optional(),labIncoming:z.literal(true).optional()}).strict())}).strict();
export class FormalDatabase extends Dexie {
 Inbox!:Table<InboxCommand,number>;RuntimeMeta!:Table<RuntimeMeta,string>;
 saves!:Table<WorldRow|AuthorityRow,string>;backups!:Table<RecoveryRow,number>;BattleReports!:Table<ReportRow,string>;
 constructor(suffix='',databaseName:string=FORMAL_DB_NAME){
  if(suffix&&!/^[A-Za-z0-9_.-]+$/.test(suffix))throw new Error('Invalid formal database suffix');
  super(databaseName+(suffix?'-'+suffix:''));
  this.version(1).stores({saves:'id',backups:'++id,at,campaignId',BattleReports:'key,campaignId,[campaignId+sequence],[campaignId+ownerFactionId+sequence]',Inbox:'++sequence,&[campaignId+commandId],[branch+state],state,campaignId',RuntimeMeta:'id',StorageMeta:'id',...ledgerStores});
  this.on('populate',tx=>tx.table('StorageMeta').add({id:'format',format:'formal-bounded-world-v1'}));
  this.on('ready',async()=>{if((await this.table('StorageMeta').get('format'))?.format!=='formal-bounded-world-v1')throw Error(OLD_CAMPAIGN_MESSAGE);});

 }
}
function reconcileReceipts(target:FormalWorld,prior:readonly CommandReceipt[],retireMissing=false,retired=new Set<string>()):CommandReceipt[]{
 const priorIds=new Set(prior.map(r=>r.commandId)),source=commandHistory(target);
 // A verified portable snapshot can still carry an outcome already retired in
 // this receiver's newer window. Its imported terminal Inbox must retire with
 // that deliberately excluded receipt, rather than resurrecting an Original
 // Result with no matching receipt. The snapshot's world effects are unchanged.
 if(retireMissing)for(const r of source)if(!priorIds.has(r.commandId))retired.add(r.commandId);
 const entries=new Map(source.filter(r=>!retireMissing||priorIds.has(r.commandId)).map(r=>[r.commandId,r]));
 for(const old of prior){const chosen=entries.get(old.commandId);
  if(chosen&&(chosen.issuerId!==old.issuerId||chosen.fingerprint!==old.fingerprint))throw new Error('CommandId conflict in imported authority.');
  if(!chosen){
   // An absent bounded receipt proves rollback only when the effect is newer
   // than the checkpoint. Older effects may already be part of its snapshot.
   if(old.committedRevision>target.revision)entries.set(old.commandId,{...old,disposition:'rolled-back'});
   else retired.add(old.commandId);
  }
 }
 return [...entries.values()].sort((a,b)=>a.commandId<b.commandId?-1:a.commandId>b.commandId?1:0);
}
const reportKey=(r:FormalReport)=>r.campaignId+'/'+r.id;
/** All world/report/history/Recovery/authority changes share exactly one IDB transaction. */
export class FormalPersistence {
 readonly db:FormalDatabase;
 private suffix:string;
 constructor(options:{suffix?:string;fault?:(point:FailurePoint)=>void}={}){this.db=new FormalDatabase(options.suffix);this.suffix=options.suffix??'';this.fault=options.fault;}
 private fault?: (point:FailurePoint)=>void;
 private writerEpoch:number|undefined;
 private damagedRoots=new Set<string>();
 private async meta(){const stored=await this.db.RuntimeMeta.get('runtime'),m=stored??{id:'runtime' as const,writerEpoch:0,branch:0};if(stored){const {fenceChecksum,...body}=m;if(!m.fence||fenceChecksum!==await Dexie.waitFor(digest(body)))throw Error('命令防重播水位檢查碼不符，原資料保留。');validateReplayFence(m.fence);}else m.fence=createReplayFence();if(m.fence.writerEpoch!==m.writerEpoch||m.fence.branch!==m.branch)throw Error('命令操作世代與寫入權不一致。');return m;}
 private async putMeta(meta:RuntimeMeta){const {fenceChecksum:_previous,...body}=meta;meta.fenceChecksum=await Dexie.waitFor(digest(body));await this.db.RuntimeMeta.put(meta);}
 private assertWriter(meta:RuntimeMeta){if(meta.writerEpoch!==(this.writerEpoch??0))throw new WriterConflict();}
 /** Called only by the Worker created under the page's exclusive Web Lock. */
 async acquireWriter():Promise<WriterContext>{
  const meta=await this.db.transaction('rw',this.db.RuntimeMeta,this.db.saves,async()=>{const m=await this.meta();if(m.campaignId===undefined){const current=await this.db.saves.get('current');const snapshot=current?.kind==='world'?current.data?.snapshot:undefined;if(snapshot&&typeof snapshot.campaignId==='string'&&typeof snapshot.playerFactionId==='string'&&Number.isSafeInteger(snapshot.revision)&&snapshot.revision>=0){m.campaignId=snapshot.campaignId;m.playerFactionId=snapshot.playerFactionId;m.revision=snapshot.revision;}}m.writerEpoch++;m.fence=nextIntakeEpoch(m.fence!,m.writerEpoch,m.branch);if(!Number.isSafeInteger(m.writerEpoch))throw Error('寫入版本超出安全範圍。');await this.putMeta(m);this.fault?.('writer-write');return m;});
  this.writerEpoch=meta.writerEpoch;return {...meta,commandEpoch:intakeEpoch(meta.fence!)};
 }
 async writerContext():Promise<WriterContext>{const m=await this.meta();this.assertWriter(m);return {...m,commandEpoch:intakeEpoch(m.fence!)};}
 /** A read-only consent token, bound to the exact source and acquired writer.
  * Only an explicitly unsupported envelope can enter this replacement path. */
 async incompatibleStartToken():Promise<string|undefined>{
  return this.db.transaction('r',[this.db.saves,this.db.RuntimeMeta,this.db.Inbox,this.db.backups,this.db.BattleReports,...ledgerTables(this.db)],async()=>{
   const meta=await this.meta();this.assertWriter(meta);const authority=await this.authority(),current=await this.db.saves.get('current');
   if((await this.pendingCommands()).length)throw Error('仍有未完成的持久命令，請先查詢與恢復；原資料保留。');
   if(!current){if(authority.activeCampaignId||await this.db.Inbox.count()||await this.db.backups.count()||await this.db.BattleReports.count()||await this.db.table('LedgerHeads').count())throw Error('仍有未確認的本機戰役資料，原資料保留。');return;}
   return this.replacementToken(current,authority,meta);
  });
 }
 private async assertStartSource(current:WorldRow|AuthorityRow,authority:AuthorityRow){
  if(current.kind!=='world')throw Error('無法確認目前活動戰役，原資料保留。');
  const w=current.data?.snapshot,a=authority.campaigns.find(c=>c.campaignId===authority.activeCampaignId);
  if(!w||w.campaignId!==authority.activeCampaignId||w.revision!==authority.revision||current.at!==authority.savedAt||current.data.checksum!==authority.worldChecksum||canonicalJSON(current.data.metadata)!==canonicalJSON(w.metadata)||await Dexie.waitFor(digest(w))!==current.data.checksum||!a?.ledgerRoot||w.ledger?.anchor.root!==a.ledgerRoot||(await this.db.table('LedgerHeads').get(w.campaignId))?.root!==a.ledgerRoot)throw Error('活動戰役完整性或 Authority 不一致，原資料保留。');
 }
 private async replacementToken(current:WorldRow|AuthorityRow,authority:AuthorityRow,meta:RuntimeMeta){
  if(current.kind!=='world')throw Error('無法確認目前活動戰役，原資料保留。');
  let incompatible=false;try{assertCampaignCompatibility(current.data);}catch(e){if(e instanceof Error&&e.message===OLD_CAMPAIGN_MESSAGE)incompatible=true;else throw e;}
  if(!incompatible)throw Error('活動戰役版本已變更，請重新讀取後確認。');
  await this.assertStartSource(current,authority);
  if((await this.pendingCommands()).length)throw Error('仍有未完成的持久命令，請先查詢與恢復；原資料保留。');
  const id=authority.activeCampaignId!,root=authority.campaigns.find(c=>c.campaignId===id)!.ledgerRoot!,proof=await this.ledger(id,root),identities=await this.db.table('LedgerIdentity').where('[campaignId+commandId]').between([id,Dexie.minKey],[id,Dexie.maxKey]).toArray();
  if(identities.length!==proof.results.reduce((n,s)=>n+s.records.length,0)||identities.some(e=>!jsonDataEqual(e.original,proof.result(e.commandId))||!jsonDataEqual(e.receipt,proof.receipt(e.commandId))||e.issuerId!==proof.result(e.commandId)?.issuerId||e.fingerprint!==proof.result(e.commandId)?.fingerprint))throw Error('命令身份索引不一致，原資料保留。');
  return Dexie.waitFor(digest([current,authority.checksum,meta.writerEpoch,meta.branch]));
 }
 async receiveCommand(order:FormalOrder,intent:CommandIntent={},branch?:number,now=Date.now()):Promise<InboxCommand>{
  // Strict parsing occurs before T1; never store mutable caller-owned payloads.
  order=orderSchema.parse(order);intent=structuredClone(intent);
  return this.db.transaction('rw',[this.db.RuntimeMeta,this.db.Inbox,this.db.saves,this.db.table('LedgerIdentity'),this.db.table('LedgerManifests'),this.db.table('LedgerHeads')],async()=>{
   const meta=await this.meta();this.assertWriter(meta);
   const fingerprint=commandFingerprint(order),old=await this.db.Inbox.where('[campaignId+commandId]').equals([order.campaignId,order.commandId]).first();
   if(old){if(old.issuerId!==order.issuerId||old.fingerprint!==fingerprint)throw new Error('CommandId 已用於不同命令。');return old;}
   const active=await this.authority(),current=await this.db.saves.get('current'),root=active.campaigns.find(c=>c.campaignId===order.campaignId)?.ledgerRoot;
   if(active.activeCampaignId!==order.campaignId||current?.kind!=='world'||current.data.snapshot.ledger?.anchor.root!==root||current.data.checksum!==active.worldChecksum)throw Error('請先載入一致的戰役快照。');
   const proof=root&&cachedLedger(root),header=root&&await this.db.table('LedgerManifests').get([order.campaignId,root]),head=await this.db.table('LedgerHeads').get(order.campaignId);if(!proof||!header||head?.root!==root||canonicalJSON(header.manifest)!==canonicalJSON(proof.manifest)||this.damagedRoots.has(root!))throw Error('請重新載入並驗證近期命令結果。');
   const identity=await this.db.table('LedgerIdentity').get([order.campaignId,order.commandId]),original=proof.result(order.commandId);if(!!identity!==!!original||identity&&(canonicalJSON(identity.original)!==canonicalJSON(original)||canonicalJSON(identity.receipt)!==canonicalJSON(proof.receipt(order.commandId))))throw Error('命令身份索引不一致，請重新載入恢復。');if(identity&&(identity.issuerId!==order.issuerId||identity.fingerprint!==fingerprint))throw Error('CommandId 已用於不同命令。');
   if(meta.campaignId!==order.campaignId||meta.playerFactionId!==order.issuerId)throw new Error('命令不屬於目前玩家戰役。');
   const row:InboxCommand={...structuredClone(intent),campaignId:order.campaignId,commandId:order.commandId,issuerId:order.issuerId,order:structuredClone(order),fingerprint,originalRevision:order.expectedRevision,originalBranch:branch??meta.branch,branch:meta.branch,writerEpoch:meta.writerEpoch,state:'pending',createdAt:now,deadline:now+COMMAND_TTL,attempts:0,nextAttemptAt:0};
   if(identity){row.originalResult=identity.original;row.state=identity.receipt?.disposition==='rolled-back'?'rolled-back':identity.original.state;row.ack=row.state==='rolled-back'?{commandId:order.commandId,status:'rolled-back',revision:meta.revision??0,originalRevision:identity.original.ack.revision}:structuredClone(identity.original.ack);}else if(row.originalBranch!==meta.branch||order.expectedRevision<(meta.foregroundRevision??0)){row.lastError='戰役分支或玩家操作已變更，請重新確認原始操作。';}
   if(!identity)meta.fence=acceptCommandIdentity(meta.fence!,order.commandId);await this.putMeta(meta);this.fault?.('fence-write');row.sequence=await this.db.Inbox.add(row);this.fault?.('inbox-write');return row;
  });
 }
 async commandStatus(campaignId:FormalOrder['campaignId'],commandId:FormalOrder['commandId']):Promise<InboxCommand|undefined>{
  const row=await this.db.Inbox.where('[campaignId+commandId]').equals([campaignId,commandId]).first();if(!row)return;
  const head=await this.db.table('LedgerHeads').get(campaignId);if(!head){if(terminalCommand(row))throw Error('終局命令缺少帳本證據。');return row;}
  const proof=await this.ledger(campaignId,head.root),original=proof.result(commandId);if(!original){if(terminalCommand(row))throw Error('終局命令缺少原始結果。');return row;}
  let state:InboxCommand['state'],ack:CommandAck,conflict:InboxCommand['conflict'];
  if(original.issuerId!==row.issuerId||original.fingerprint!==row.fingerprint){state='rejected';ack=row.conflict?.issuerId===original.issuerId&&row.conflict.fingerprint===original.fingerprint&&row.conflict.ack.status==='rejected'?structuredClone(row.conflict.ack):{commandId,status:'rejected',revision:proof.manifest.worldRevision,reason:'CommandId 已用於不同命令。'};conflict={issuerId:original.issuerId,fingerprint:original.fingerprint,ack};}
  else if(original.state==='committed'){const receipt=proof.receipt(commandId);if(!receipt)throw Error('提交結果缺少收據。');state=receipt.disposition==='applied'?'committed':'rolled-back';ack=receipt.disposition==='applied'?structuredClone(original.ack):{commandId,status:'rolled-back',revision:proof.manifest.branchRevision,originalRevision:original.ack.revision,reason:'此命令已由回復點撤銷。'};}
  else{state=original.state;ack=structuredClone(original.ack);}
  const result={...row,state,ack,originalResult:conflict?undefined:original,conflict};
  // T3 may repair only this display/query cache. The immutable outcome and head
  // are already committed; cache quota/notification failure cannot undo them.
  if(canonicalJSON([row.state,row.ack,row.originalResult,row.conflict])!==canonicalJSON([state,ack,result.originalResult,conflict]))try{await this.db.transaction('rw',[this.db.Inbox,this.db.RuntimeMeta,this.db.table('LedgerHeads')],async()=>{this.assertWriter(await this.meta());if((await this.db.table('LedgerHeads').get(campaignId))?.root!==head.root)return;const latest=await this.db.Inbox.get(row.sequence!);if(latest&&latest.issuerId===row.issuerId&&latest.fingerprint===row.fingerprint)await this.db.Inbox.put({...latest,state,ack,originalResult:result.originalResult,conflict});});}catch{/* Authoritative result remains queryable. */}
  return result;
 }
 /** One consistent observation distinguishes an unused current identity from
  * a retired/closed identity. A missing row alone never proves old success or
  * failure. Queries do not mint IDs, advance watermarks, or execute commands. */
 async queryCommandStatus(campaignId:FormalOrder['campaignId'],commandId:FormalOrder['commandId']){
  const availability=await this.db.transaction('r',[this.db.RuntimeMeta,this.db.Inbox],async()=>{
   const meta=await this.meta();this.assertWriter(meta);
   if(await this.db.Inbox.where('[campaignId+commandId]').equals([campaignId,commandId]).first())return 'known' as const;
   if(meta.campaignId!==campaignId)return 'retired' as const;
   try{acceptCommandIdentity(meta.fence!,commandId);return 'unreceived' as const;}catch{return 'retired' as const;}
  });
  // No observer wait may hold the writer transaction open. The Runtime's
  // existing stableRead retries if a committed publication changes meanwhile.
  const row=await this.commandStatus(campaignId,commandId);return row?{row,availability:'known' as const}:{availability:availability==='known'?'retired' as const:availability};
 }
 async pendingCommands(){return this.db.Inbox.where('state').anyOf('pending','retryable').sortBy('sequence');}
 async commandPage(before=Number.MAX_SAFE_INTEGER){return this.db.Inbox.where('sequence').below(before).reverse().limit(100).toArray();}
 private async checkCommand(row:InboxCommand,meta:RuntimeMeta){
  this.assertWriter(meta);const stored=await this.db.Inbox.get(row.sequence!);
  if(!stored||stored.campaignId!==row.campaignId||stored.commandId!==row.commandId||stored.fingerprint!==row.fingerprint||stored.issuerId!==row.issuerId)throw new Error('找不到一致的持久命令。');
  if(stored.branch!==meta.branch)throw new WriterConflict();
  return stored;
 }
 private async writeResult(command:CommandCommit,meta:RuntimeMeta,prior?:OriginalResult){
  const stored=await this.checkCommand(command.row,meta);
  if(terminalCommand(stored))throw new Error('命令已具有正式結果，請查詢原結果。');
  if(command.ack.commandId!==stored.commandId||command.ack.revision!==(meta.revision??0)&&(!prior||canonicalJSON(prior.ack)!==canonicalJSON(command.ack)))throw new Error('正式結果身分或 revision 不一致。');
  const identity=await this.db.table('LedgerIdentity').get([stored.campaignId,stored.commandId]);
  if(identity&&(identity.issuerId!==stored.issuerId||identity.fingerprint!==stored.fingerprint)){if(command.ack.status!=='rejected')throw Error('衝突意圖不可宣告成功。');const ack={commandId:stored.commandId,status:'rejected' as const,revision:meta.revision??0,reason:'CommandId 已用於不同命令。'};await this.db.Inbox.put({...stored,state:'rejected',ack,originalResult:undefined,conflict:{issuerId:identity.issuerId,fingerprint:identity.fingerprint,ack}});this.fault?.('result-write');return;}
  await this.db.Inbox.put({...stored,attempts:Math.max(stored.attempts,command.row.attempts),state:resultState(command.ack),ack:structuredClone(command.ack),originalResult:identity?.original??stored.originalResult??originalCommand(stored,command.ack),lastError:undefined});this.fault?.('result-write');
 }
 private async ledger(campaignId:CampaignId,root:string){
  const row=await this.db.table('LedgerManifests').get([campaignId,root]);if(!row||row.manifest.checksum!==root)throw Error('權威帳本版本遺失。');
  const cached=cachedLedger(root);if(cached&&!this.damagedRoots.has(root)){if(canonicalJSON(cached.manifest)!==canonicalJSON(row.manifest)||canonicalJSON(cached.history.manifest)!==canonicalJSON(row.historyManifest))throw Error('權威帳本版本損毀。');return cached;}
  const raw=await readLedgerArchive(this.db,campaignId,root);return Dexie.waitFor(verifyLedgerArchive(raw));
 }
 private async checkpoint(b:RecoveryRow,context?:AuthorityRow){assertCampaignCompatibility(b.data);const authority=context??await this.authority(),ref=authority.recovery.find(r=>r.id===b.id);if(!ref||ref.at!==b.at||ref.campaignId!==b.campaignId||ref.root!==b.data.snapshot.ledger?.anchor.root||ref.checksum!==b.data.checksum)throw Error('回復點與權威引用不一致。');const a=b.data.snapshot.ledger?.anchor;if(!a)throw Error(OLD_CAMPAIGN_MESSAGE);return validateCheckpointCandidate(b,await readLedger(this.db,a.campaignId,a.root));}
 async finishCommand(row:InboxCommand,ack:CommandAck,expectedRevision:number):Promise<FormalWorld>{
  row=structuredClone(row);ack=structuredClone(ack);
  return this.db.transaction('rw',[this.db.RuntimeMeta,this.db.Inbox,this.db.saves,this.db.backups,...ledgerTables(this.db)],async()=>{
   const meta=await this.meta(),stored=await this.checkCommand(row,meta);row={...stored,attempts:Math.max(stored.attempts,row.attempts)};const authority=await this.authority();if(authority.revision!==expectedRevision)throw new RevisionConflict();
   const current=await this.db.saves.get('current');if(current?.kind!=='world'||current.data.snapshot.campaignId!==row.campaignId)throw new RevisionConflict();
   const root=authority.campaigns.find(c=>c.campaignId===row.campaignId)?.ledgerRoot;if(!root||current.data.snapshot.ledger?.anchor.root!==root)throw Error('世界與權威帳本不一致。');
   const base=await this.ledger(row.campaignId,root),w=validateFormalWorld(current.data.snapshot);
   if(w.ledger!.anchor.worldRevision!==w.revision||w.ledger!.pending.length)throw Error('未提交帳本草稿。');
   const original=base.result(row.commandId)??originalCommand(row,ack);
   const ledger=await Dexie.waitFor(prepareVerifiedLedger(base,[],[original],w.revision,meta.branch,meta.writerEpoch));bindLedger(w,ledger);
   const envelope=await Dexie.waitFor(encodeSave(w,undefined,false));
   await writeLedger(this.db,ledger,base,[row.commandId],this.fault);await publishLedgerHead(this.db,ledger,this.fault);
   await this.db.saves.put({...current,data:envelope});this.fault?.('world-write');
   authority.campaigns.find(c=>c.campaignId===row.campaignId)!.ledgerRoot=ledger.manifest.checksum;authority.worldChecksum=envelope.checksum;
   await this.putAuthority(authority);this.fault?.('authority-write');
   await this.writeResult({row,ack},meta,base.result(row.commandId));await this.pruneRetainedStorage(meta,authority);return envelope.snapshot;
  });
 }
 async noteCommandFailure(row:InboxCommand,error:string,retryable:boolean,now=Date.now()):Promise<InboxCommand&{committedWorld?:FormalWorld}>{
  const result=await this.db.transaction('rw',this.db.RuntimeMeta,this.db.Inbox,this.db.saves,async()=>{
   const meta=await this.meta(),stored=await this.checkCommand(row,meta);if(terminalCommand(stored))return {stored};
   stored.attempts++;stored.lastError=error;
   if(retryable&&stored.attempts<MAX_COMMAND_ATTEMPTS&&now<stored.deadline){stored.state='retryable';stored.nextAttemptAt=now+250*2**(stored.attempts-1);await this.db.Inbox.put(stored);return {stored};}
   const revision=(await this.authority()).revision,ack=confirmationAck(stored,revision,'命令尚未提交：'+error+'；請重新載入並確認原始操作。');return {stored,ack,revision};
  });
  if(!result.ack)return result.stored;
  const world=await this.finishCommand(result.stored,result.ack,result.revision!),stored=(await this.commandStatus(row.campaignId,row.commandId))!;
  Object.defineProperty(stored,'committedWorld',{value:world,enumerable:false});return stored;
 }
 private async switchInbox(meta:RuntimeMeta,world?:FormalWorld,projection?:CommandReceipt[]){
  meta.branch++;meta.fence=nextIntakeEpoch(meta.fence!,meta.writerEpoch,meta.branch);meta.foregroundRevision=world?.revision??0;if(!world){delete meta.campaignId;delete meta.playerFactionId;meta.revision=0;}await this.putMeta(meta);
  // Branch changes are infrequent; no full Inbox scan on ordinary checkpoints.
  const receipts=new Map((projection??(world?Array.from(commandHistory(world)):[])).map(r=>[r.commandId,r] as const));
  await this.db.Inbox.toCollection().modify(row=>{
   if(!terminalCommand(row)){row.state='needs-confirmation';row.ack=confirmationAck(row,world?.revision??0,'戰役分支已切換，舊命令未執行，請重新確認。');row.originalResult??=originalCommand(row,row.ack);}
   if(world&&row.campaignId===world.campaignId&&(row.originalResult?.state==='committed'||row.state==='committed'||row.state==='rolled-back')){
    const r=receipts.get(row.commandId);
    if(r?.disposition==='rolled-back'){row.state='rolled-back';row.ack={commandId:row.commandId,status:'rolled-back',revision:world.revision,originalRevision:r.committedRevision,reason:'此命令已由回復點撤銷。'};}else if(r?.disposition==='applied'){row.state='committed';row.ack=structuredClone(row.originalResult?.ack??{commandId:row.commandId,status:'committed',revision:r.committedRevision});}
   }
  });this.fault?.('branch-write');
 }

 private async projectInbox(ledger:VerifiedLedger,revision:number){
  await this.db.Inbox.where('campaignId').equals(ledger.manifest.campaignId).modify(row=>{
   const original=ledger.result(row.commandId);if(!original||!terminalCommand(row))return;
   if(original.issuerId!==row.issuerId||original.fingerprint!==row.fingerprint){const ack=row.conflict?.ack??{commandId:row.commandId,status:'rejected' as const,revision,reason:'CommandId 已用於不同命令。'};row.state='rejected';row.ack=ack;row.originalResult=undefined;row.conflict={issuerId:original.issuerId,fingerprint:original.fingerprint,ack};return;}
   row.conflict=undefined;row.originalResult=original;if(original.state==='committed'){const r=ledger.receipt(row.commandId)!;row.state=r.disposition==='applied'?'committed':'rolled-back';row.ack=r.disposition==='applied'?structuredClone(original.ack):{commandId:row.commandId,status:'rolled-back',revision,originalRevision:original.ack.revision,reason:'此命令已由回復點撤銷。'};}else{row.state=original.state;row.ack=structuredClone(original.ack);}
  });
 }
 private async advanceOtherLedgers(meta:RuntimeMeta,authority:AuthorityRow,revision:number,activeCampaign?:CampaignId,portable?:{snapshots:VerifiedLedger[];heads:{campaignId:string;root:string}[];growthAuthority:DomainAuthority[]}){
  const heads=await this.db.table('LedgerHeads').toArray(),campaigns=new Set([...heads.map(h=>h.campaignId as string),...(portable?.heads.map(h=>h.campaignId)??[])]);
  for(const campaign of [...campaigns].sort()){
   if(campaign===activeCampaign)continue;
   const held=authority.campaigns.find(c=>c.campaignId===campaign),root=held?.ledgerRoot??heads.find(h=>h.campaignId===campaign)?.root;
   const old=root?await this.ledger(campaign as CampaignId,root):await Dexie.waitFor(emptyVerifiedLedger(campaign)),incomingRoot=portable?.heads.find(h=>h.campaignId===campaign)?.root,incoming=incomingRoot?portable!.snapshots.find(s=>s.manifest.checksum===incomingRoot):undefined;
   const receipts:CommandReceipt[]=[],outcomes=new Map<string,OriginalResult>();
   if(incoming){for(let i=0;i<incoming.count;i++){const r=incoming.at(i)!,prior=old.receipt(r.commandId);if(prior&&!sameReceipt({...r,disposition:prior.disposition},prior))throw Error('跨戰役命令身份衝突。');if(!prior&&!root)receipts.push(r);}for(const seg of incoming.results)for(const r of seg.records){const prior=old.result(r.commandId);if(prior&&canonicalJSON(prior)!==canonicalJSON(r))throw Error('跨戰役原始結果衝突。');if(!prior&&!root)outcomes.set(r.commandId,r);}}
   for(const row of await this.db.Inbox.where('campaignId').equals(campaign).toArray())if(terminalCommand(row)&&!old.result(row.commandId)&&!outcomes.has(row.commandId)){if(!row.ack)throw Error('終局 Inbox 缺少結果。');outcomes.set(row.commandId,row.originalResult??originalCommand(row,row.ack));}
   const next=await Dexie.waitFor(prepareVerifiedLedger(old,receipts,[...outcomes.values()],revision,meta.branch,meta.writerEpoch));
   await writeLedger(this.db,next,root?old:undefined,[...receipts.map(r=>r.commandId),...outcomes.keys()],this.fault);await publishLedgerHead(this.db,next,this.fault);
   const importedGrowth=portable?.growthAuthority.find(g=>g.campaignId===campaign)?.growthTasks;
   authority.campaigns=authority.campaigns.filter(c=>c.campaignId!==campaign);authority.campaigns.push({campaignId:campaign as CampaignId,ledgerRoot:next.manifest.checksum,growthTasks:mergeGrowth(importedGrowth,held?.growthTasks),claimEvidence:held?.claimEvidence,playerFactionId:held?.playerFactionId,labIncoming:held?.labIncoming});
   await this.projectInbox(next,revision);
  }
 }
 /** GC runs within the SAME world/result/Authority T2 transaction. Only
  * terminal rows outside the bounded recent windows and unreachable versions
  * are retired; T1 pending/retryable rows are never candidates. */
 private async pruneRetainedStorage(meta:RuntimeMeta,authority:AuthorityRow){
  const active=authority.activeCampaignId;if(active)meta.recentCampaigns=[active,...(meta.recentCampaigns??[]).filter(id=>id!==active)].slice(0,4);
  const campaigns=new Set(meta.recentCampaigns??[]),heads=await this.db.table('LedgerHeads').toArray();
  for(const head of heads)if(!campaigns.has(head.campaignId))await this.db.table('LedgerHeads').delete(head.campaignId);
  const keptHeads=heads.filter(h=>campaigns.has(h.campaignId)),proofs=new Map<string,VerifiedLedger>();for(const head of keptHeads)proofs.set(head.campaignId,await this.ledger(head.campaignId,head.root));
  const retired:number[]=[];for(const row of await this.db.Inbox.toArray())if(terminalCommand(row)&&!proofs.get(row.campaignId)?.result(row.commandId))retired.push(row.sequence!);
  if(retired.length)await this.db.Inbox.bulkDelete(retired);
  // Retention needs only the compound identity, not another native clone of
  // every original payload/Ack. Verification and conflict checks still read
  // actual rows at their existing boundaries, inside this same T2 transaction.
  for(const key of await this.db.table('LedgerIdentity').toCollection().primaryKeys()){
   const [campaignId,commandId]=key as [string,string];
   if(!proofs.get(campaignId)?.result(commandId))await this.db.table('LedgerIdentity').delete(key);
  }
  const references=[...keptHeads,...authority.recovery.map(b=>({campaignId:b.campaignId,root:b.root}))],roots=new Set(references.map(r=>r.campaignId+'/'+r.root)),segments=new Set<string>(),results=new Set<string>();
  for(const ref of references){const archive=await readLedgerArchive(this.db,ref.campaignId,ref.root);for(const s of archive.history.segments)segments.add(s.checksum);for(const s of archive.results)results.add(s.checksum);}
  for(const row of await this.db.table('LedgerManifests').toArray())if(!roots.has(row.campaignId+'/'+row.root))await this.db.table('LedgerManifests').delete([row.campaignId,row.root]);
  for(const [table,keys]of [['LedgerSegments',segments],['LedgerResults',results]] as const)for(const key of await this.db.table(table).toCollection().primaryKeys())if(!keys.has(String(key)))await this.db.table(table).delete(key);
  const retainedCampaigns=new Set(references.map(r=>r.campaignId));for(const campaign of authority.campaigns)if(!retainedCampaigns.has(campaign.campaignId))delete campaign.ledgerRoot;
  await this.putAuthority(authority);await this.putMeta(meta);this.fault?.('retention-write');
 }
 private async putAuthority(authority:AuthorityRow){
  authoritySchema.parse(authority);
  for(const domain of authority.campaigns){
   const kept:NonNullable<DomainAuthority['claimEvidence']>={};
   validateGrowthProofs(domain.growthTasks,domain.playerFactionId??'',id=>{const fact=domain.claimEvidence?.[id];if(!fact||fact.commandId!==id)return;kept[id]=fact;return evidenceReceipt(domain.campaignId,fact);},message=>{throw Error(message);});
   if(domain.claimEvidence)domain.claimEvidence=kept;
  }
  const {checksum:_previous,...body}=authority;authority.checksum=await Dexie.waitFor(digest(body));await this.db.saves.put(authority);
 }
 private async authority():Promise<AuthorityRow>{
  const row=await this.db.saves.get('authority');
  if(!row)return{id:'authority',kind:'authority',recovery:[],revision:0,sequences:{event:1,report:1,project:1},campaigns:[]};
  const {checksum,...body}=row as AuthorityRow;if(!checksum||checksum!==await Dexie.waitFor(digest(body)))throw Error('權威領域資料檢查碼不符，原資料保留。');
  const a=authoritySchema.parse(row);
  if(new Set(a.campaigns.map(x=>x.campaignId)).size!==a.campaigns.length)throw new Error('Duplicate campaign authority');
  return a;
 }
 private async commit(input:FormalWorld,reportWrites:readonly FormalReport[],mode:'save'|'start'|'restore'|'import',expectedRevision?:number,savedAt=Date.now(),activateAI=false,command?:CommandCommit,portable?:{snapshots:VerifiedLedger[];heads:{campaignId:string;root:string}[];inbox:InboxCommand[];recovery:{at:number;label:string;data:FormalEnvelope}[];growthAuthority:DomainAuthority[]},replacementToken?:string):Promise<FormalWorld>{
  // Final encodeSave validates the entire stamped candidate before any writes.
  // Avoid validating the same 2.8MB world twice in this transaction.
  input=validateFormalWorld(input);ensureCommandFacts(input);validateReportHistory(input,reportWrites);if(command)command=structuredClone(command);
  // No memory mutation; caller may switch its displayed world only after this resolves.
  const committed=await this.db.transaction('rw',[this.db.saves,this.db.backups,this.db.BattleReports,this.db.Inbox,this.db.RuntimeMeta,...ledgerTables(this.db)],async()=>{
   const meta=await this.meta();this.assertWriter(meta);if(command)command.row=await this.checkCommand(command.row,meta);
   const authority=await this.authority(),current=await this.db.saves.get('current');
   if(mode==='start'){
    if(current){
     if(replacementToken){
      if(await this.replacementToken(current,authority,meta)!==replacementToken)throw new RevisionConflict();
      const old=authority.activeCampaignId!;
      // User-confirmed incompatible activity only. Never clear the database or
      // a historical namespace; all removals roll back with the new T2 below.
      await this.db.backups.where('campaignId').equals(old).delete();
      await this.db.BattleReports.where('campaignId').equals(old).delete();
      authority.recovery=authority.recovery.filter(r=>r.campaignId!==old);
      // Preserve campaign authority and the global revision waterline, exactly
      // as a normal new-game transition does; only incompatible Recovery retires.
     }else{if(current.kind!=='world')throw Error('無法確認活動戰役，原資料保留。');assertCampaignCompatibility(current.data);await this.assertStartSource(current,authority);}
    }else if(replacementToken||authority.activeCampaignId)throw Error('活動戰役版本已變更，請重新讀取後確認。');
   }
   if(expectedRevision!==undefined&&authority.revision!==expectedRevision)throw new RevisionConflict();
   if(mode==='save'&&current?.kind==='world'){const held=authority.campaigns.find(c=>c.campaignId===current.data.snapshot.campaignId),head=await this.db.table('LedgerHeads').get(current.data.snapshot.campaignId);if(current.data.snapshot.revision!==authority.revision||current.data.checksum!==authority.worldChecksum||held?.ledgerRoot!==current.data.snapshot.ledger?.anchor.root||head?.root!==held?.ledgerRoot)throw Error('世界與 Authority 版本不一致。');}
   // Ordinary saves only stamp pending army reports and sanitize shared AI intel.
   // Copy those mutable branches now; encodeSave still strictly validates and
   // deep-copies the entire final candidate before checksum or any DB writes.
   // Transitions/AI activation retain the general full draft.
   // Keep the original source revision/root separate from the stamped candidate:
   // import Recovery filtering depends on that unchanged source version.
   let w=sanitizeSharedKnowledge(cloneWorldDraft(input));
   const priorRoot=authority.campaigns.find(c=>c.campaignId===w.campaignId)?.ledgerRoot??(await this.db.table('LedgerHeads').get(w.campaignId))?.root;let base=priorRoot?await this.ledger(w.campaignId,priorRoot):portable?.snapshots.find(s=>s.manifest.checksum===input.ledger?.anchor.root)??await Dexie.waitFor(emptyVerifiedLedger(w.campaignId));
   if(mode==='save'&&input.ledger&&input.ledger.anchor.root!==base.manifest.checksum)throw new RevisionConflict();
   if(portable){
    for(const snap of portable.snapshots)await writeLedger(this.db,snap,undefined,[],this.fault);
    for(const imported of portable.inbox){const old=await this.db.Inbox.where('[campaignId+commandId]').equals([imported.campaignId,imported.commandId]).first();if(old&&(old.issuerId!==imported.issuerId||old.fingerprint!==imported.fingerprint))throw Error('匯入 Inbox 身份衝突。');if(!old){const copy={...imported};delete copy.sequence;await this.db.Inbox.add(copy);}}
    const importedBranch=Math.max(meta.branch,...portable.snapshots.map(s=>s.manifest.branch));if(importedBranch!==meta.branch){meta.branch=importedBranch;meta.fence=nextIntakeEpoch(meta.fence!,meta.writerEpoch,meta.branch);}
    if(portable.snapshots.some(s=>s.manifest.writerEpoch>meta.writerEpoch)){meta.writerEpoch=Math.max(...portable.snapshots.map(s=>s.manifest.writerEpoch))+1;meta.fence=nextIntakeEpoch(meta.fence!,meta.writerEpoch,meta.branch);}
    if(!Number.isSafeInteger(meta.writerEpoch)||!Number.isSafeInteger(meta.branch+1))throw Error('匯入版本超出安全範圍。');

   }
   if(portable)for(const domain of portable.growthAuthority){const existing=authority.campaigns.find(c=>c.campaignId===domain.campaignId);if(!existing)authority.campaigns.push({...structuredClone(domain),campaignId:domain.campaignId as CampaignId});else{existing.growthTasks=mergeGrowth(domain.growthTasks,existing.growthTasks);for(const [id,fact]of Object.entries(domain.claimEvidence??{}))if(existing.claimEvidence?.[id]&&canonicalJSON(existing.claimEvidence[id])!==canonicalJSON(fact))throw Error('CommandId 領域來源衝突。');existing.claimEvidence={...domain.claimEvidence,...existing.claimEvidence};if(domain.labIncoming)existing.labIncoming=true;}}
   let rows:CommandReceipt[];const retired=new Set<string>();
   if(mode==='save'){
    for(const key of ['event','report','project'] as const)if(w.sequences[key]<authority.sequences[key])throw new Error('Durable ID sequence cannot decrease');
    if(current&&current.kind==='world'&&current.data.snapshot.campaignId!==w.campaignId)throw new Error('Campaign switch requires explicit transition');
    const required=current?authority.revision+1:0;
    if(w.revision!==required)throw new Error('Committed revision must advance exactly once');
    if(input.ledger)rows=pendingHistory(w);else{const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));for(let i=0;i<base.count;i++){const r=base.at(i)!,receipt=receipts.get(r.commandId);if(!receipt||!sameReceipt(receipt,r))throw new Error('Durable dedupe history cannot be dropped');}rows=w.commandReceipts.filter(r=>!base.receipt(r.commandId));}
   }else{
    rows=reconcileReceipts(w,Array.from({length:base.count},(_,i)=>base.at(i)!),!!priorRoot,retired);
    const facts=ensureCommandFacts(w);facts.governance=structuredClone(facts.minimumGovernance);facts.origins={...facts.minimumOrigins};facts.fallback=facts.minimumFallback;
    for(const key of ['event','report','project'] as const)w.sequences[key]=Math.max(w.sequences[key],authority.sequences[key]);
    w.revision=Math.max(authority.campaigns.length?authority.revision+1:0,w.revision,...(portable?.snapshots.map(s=>s.manifest.worldRevision)??[]));
    for(const r of rows)w.revision=Math.max(w.revision,r.committedRevision);
   }
   if(mode==='save'&&current?.kind==='world')assertCommandFactsTransition(current.data.snapshot,w,rows);
   if(portable)reconcileGrowthAuthority(w,portable.growthAuthority.find(g=>g.campaignId===w.campaignId)?.growthTasks,true);
   reconcileGrowthAuthority(w,authority.campaigns.find(c=>c.campaignId===w.campaignId)?.growthTasks,mode!=='save');
   const heldDomain=authority.campaigns.find(c=>c.campaignId===w.campaignId);if(heldDomain?.playerFactionId&&heldDomain.playerFactionId!==w.playerFactionId)throw Error('同一戰役的玩家身份不一致。');const incomingDomain=portable?.growthAuthority.find(c=>c.campaignId===w.campaignId);ensureCommandFacts(w);for(const domain of [incomingDomain,heldDomain]){for(const claim of Object.values(w.growthTasks?.claimed??{})){const fact=domain?.claimEvidence?.[claim.commandId];if(fact)w.commandFacts!.evidence[claim.commandId]=structuredClone(fact);}if(domain?.labIncoming&&w.developer)w.developer.labIncoming=true;}
   syncGrowthTasks(w);
   if(activateAI&&!worldPaused(w))enableAutonomy(w);
   const real=(at:number)=>Math.max(0,Math.floor(savedAt-(w.time-at)/effectiveSpeed(input)));
   if(mode==='save'||mode==='start')stampPending(w,real);
   const stampedReports=reportWrites.map(r=>{const copy=structuredClone(sanitizeScoutReport(w,r));if(mode!=='import'){copy.realAt??=real(copy.at);copy.clockSpeed??=effectiveSpeed(input);copy.read??=false;if(copy.battle)stampBattle(copy.battle,real);}return copy;});
   validateReportHistory(w,stampedReports);
   // encodeSave fully validates the final world; crypto needs keep-alive under the revision lock.
   if(mode!=='save'){await this.switchInbox(meta,w,rows);await this.advanceOtherLedgers(meta,authority,w.revision,w.campaignId,portable);}
   ensureCommandFacts(w);pruneCommandEvidence(w,true);normalizeOutcomeRevisions(w);const outcomes=new Map<string,OriginalResult>((w.ledger?.outcomes??[]).map(r=>[r.commandId,r]));
   for(const r of rows){const old=base.result(r.commandId);if(!old)outcomes.set(r.commandId,resultFromReceipt(r));}
   if(mode!=='save')for(const r of await this.db.Inbox.where('campaignId').equals(w.campaignId).toArray())if(terminalCommand(r)&&!base.result(r.commandId)&&!retired.has(r.commandId)){if(!r.ack)throw Error('終局 Inbox 缺少結果。');outcomes.set(r.commandId,r.originalResult??originalCommand(r,r.ack));}
   const imported=portable?.snapshots.find(s=>s.manifest.checksum===input.ledger?.anchor.root)??(mode!=='save'&&input.ledger?worldLedger(input):undefined);if(imported)for(const segment of imported.results)for(const r of segment.records){const old=base.result(r.commandId);if(old&&canonicalJSON(old)!==canonicalJSON(r))throw Error('匯入原始結果衝突。');if(!old&&!priorRoot)outcomes.set(r.commandId,r);}
   if(command&&!base.result(command.row.commandId)){const receipt=rows.find(r=>r.commandId===command.row.commandId);if(!receipt||receipt.issuerId===command.row.issuerId&&receipt.fingerprint===command.row.fingerprint)outcomes.set(command.row.commandId,originalCommand(command.row,command.ack));}
   const ledger=await Dexie.waitFor(prepareVerifiedLedger(base,rows,[...outcomes.values()],w.revision,meta.branch,meta.writerEpoch,retired));
   bindLedger(w,ledger);const envelope=await Dexie.waitFor(encodeSave(w,undefined,false));
   await writeLedger(this.db,ledger,priorRoot?base:undefined,[...rows.map(r=>r.commandId),...outcomes.keys(),...(!priorRoot?base.results.flatMap(s=>s.records.map(r=>r.commandId)):[])],this.fault,mode==='restore');await publishLedgerHead(this.db,ledger,this.fault);
   // All post-crypto history, metadata, authority and returned state use the
   // isolated validated snapshot, even if the caller mutates input while awaiting.
   w=envelope.snapshot;
   if(mode==='restore'||mode==='import'){
    const rows=await this.db.BattleReports.where('campaignId').equals(w.campaignId).toArray();
    const obsolete=mode==='import'?rows:rows.filter(r=>r.at>input.time||r.sequence>=input.sequences.report);
    if(obsolete.length)await this.db.BattleReports.bulkDelete(obsolete.map(r=>r.key));
    const points=await this.db.backups.where('campaignId').equals(w.campaignId).toArray();
    const invalid=mode==='import'?points:points.filter(r=>r.gameTime>input.time||r.reportCursor>input.sequences.report);
    if(invalid.length){await this.db.backups.bulkDelete(invalid.map(r=>r.id!));const removed=new Set(invalid.map(r=>r.id));authority.recovery=authority.recovery.filter(r=>!removed.has(r.id));}
    this.fault?.('history-modified');
   }
   // Repair retained legacy rows in the same atomic transition, preserving IDs and history.
   if(mode==='restore'||mode==='import')await this.sanitizeStoredReports(w);
   if(reportWrites.length)await this.db.BattleReports.bulkPut(stampedReports.map(r=>({...r,key:reportKey(r)})));
   this.fault?.('report-write');
   if(portable)for(const point of portable.recovery.filter(p=>p.data.snapshot.revision<input.revision).slice(0,1)){const id=await this.db.backups.add({at:point.at,label:point.label,campaignId:point.data.snapshot.campaignId,gameTime:point.data.snapshot.time,reportCursor:point.data.snapshot.sequences.report,data:{...point.data,ledger:undefined,bundle:undefined,transportChecksum:undefined}});authority.recovery.push({id,at:point.at,campaignId:point.data.snapshot.campaignId,root:point.data.snapshot.ledger!.anchor.root,checksum:point.data.checksum});}
   // Carry only the identities of replayed automatic commands whose originating
   // events are still pending in one of the two retained checkpoints. Once that
   // event is consumed after Recovery, the reservation is removed from the world.
   // This preserves the old rolled-back AI dedupe behavior without a permanent log.
   for(const point of rows.some(r=>r.commandId.startsWith('command:ai-'))||[...outcomes.keys()].some(id=>id.startsWith('command:ai-'))?await this.db.backups.toArray():[]){
    if(point.campaignId!==w.campaignId)continue;
    const candidate=await Dexie.waitFor(this.checkpoint(point,authority)),events=new Set(candidate.events.map(e=>e.id.slice(6)));let changed=false;ensureCommandFacts(candidate);
    for(const r of rows){const event=/^command:ai-(.+)-[0-9]+$/.exec(r.commandId)?.[1];if(event&&events.has(event)){(candidate.commandFacts!.replayReservations??={})[r.commandId]={receipt:{...r,disposition:'rolled-back'}};changed=true;}}
    for(const r of outcomes.values()){const event=/^command:ai-(.+)-[0-9]+$/.exec(r.commandId)?.[1];if(r.state!=='committed'&&event&&events.has(event)){(candidate.commandFacts!.replayReservations??={})[r.commandId]={result:structuredClone(r)};changed=true;}}
    if(changed){const data=await Dexie.waitFor(encodeSave(candidate,undefined,false));await this.db.backups.put({...point,data});const ref=authority.recovery.find(r=>r.id===point.id);if(ref)ref.checksum=data.checksum;}
   }
   // Two valid checkpoints; ordering uses IDB monotonic IDs, not wall-clock ordering.
   const checkpointId=await this.db.backups.add({at:savedAt,label:mode==='restore'?'手動回復':mode==='import'?'正式匯入':mode==='start'?'B1 fixture開始':'正式回復點',campaignId:w.campaignId,gameTime:w.time,reportCursor:w.sequences.report,data:envelope});
   authority.recovery.push({id:checkpointId,at:savedAt,campaignId:w.campaignId,root:w.ledger!.anchor.root,checksum:envelope.checksum});
   const orderedRefs=authority.recovery.toSorted((a,b)=>a.id-b.id);if(orderedRefs.length>2)await this.db.backups.bulkDelete(orderedRefs.slice(0,-2).map(r=>r.id));authority.recovery=orderedRefs.slice(-2);
   this.fault?.('backup-write');
   await this.db.saves.put({id:'current',kind:'world',at:savedAt,data:envelope});this.fault?.('world-write');
   authority.savedAt=savedAt;authority.revision=w.revision;authority.activeCampaignId=w.campaignId;authority.worldChecksum=envelope.checksum;authority.sequences={...w.sequences};
   authority.campaigns=authority.campaigns.filter(c=>c.campaignId!==w.campaignId);
   authority.campaigns.push({campaignId:w.campaignId,playerFactionId:w.playerFactionId,ledgerRoot:ledger.manifest.checksum,...(w.growthTasks?{growthTasks:structuredClone(w.growthTasks),claimEvidence:Object.fromEntries(Object.values(w.growthTasks.claimed).map(c=>[c.commandId,w.commandFacts!.evidence[c.commandId]]))}:{}),...(w.developer?.labIncoming?{labIncoming:true as const}:{})});
   await this.putAuthority(authority);this.fault?.('authority-write');
   if(command){
    if(command.ack.status==='committed'||command.ack.status==='duplicate'){
     const receipt=findReceipt(w,command.row.commandId);
     if(!receipt||receipt.issuerId!==command.row.issuerId||receipt.fingerprint!==command.row.fingerprint||receipt.disposition!=='applied')throw new Error('正式結果與世界命令收據不一致。');
     meta.foregroundRevision=w.revision;
    }
   }
   meta.campaignId=w.campaignId;meta.playerFactionId=w.playerFactionId;meta.revision=w.revision;await this.putMeta(meta);this.fault?.('metadata-write');
   if(command)await this.writeResult(command,meta,base.result(command.row.commandId));
   if(mode!=='save')await this.projectInbox(ledger,w.revision);else for(const id of new Set([...rows.map(r=>r.commandId),...outcomes.keys()])){if(id===command?.row.commandId)continue;const row=await this.db.Inbox.where('[campaignId+commandId]').equals([w.campaignId,id]).first(),original=ledger.result(id);if(row&&!terminalCommand(row)&&original){const same=original.issuerId===row.issuerId&&original.fingerprint===row.fingerprint,ack=same?structuredClone(original.ack):{commandId:row.commandId,status:'rejected' as const,revision:w.revision,reason:'CommandId 已用於不同命令。'};await this.writeResult({row,ack},meta,original);}}

   await this.pruneRetainedStorage(meta,authority);return {world:w,epoch:meta.writerEpoch};
  });this.writerEpoch=committed.epoch;return committed.world;
 }
 async save(world:FormalWorld,reports:readonly FormalReport[]=[],expectedRevision?:number,savedAt?:number,command?:CommandCommit){return this.commit(world,reports,'save',expectedRevision,savedAt,false,command);}
 async start(world:FormalWorld,replacementToken?:string){return this.commit(world,[],'start',undefined,undefined,false,undefined,undefined,replacementToken);}
 private async loadAnchored(onProgress?:(fraction:number)=>void):Promise<{game:FormalWorld|null;recovered:boolean;savedAt?:number}>{
  let last=-1;const progress=(n:number)=>{const step=Math.floor(n*20);if(step>last){last=step;try{onProgress?.(step/20);}catch{/* A display observer cannot corrupt or restore authority. */}}};progress(0);
  const [row,authority]=await this.db.transaction('r',this.db.saves,async()=>[await this.db.saves.get('current'),await this.authority()] as const);if(!row){if(await hasLegacyCampaign(this.suffix))throw new Error(OLD_CAMPAIGN_MESSAGE);return{game:null,recovered:false};}
  if(row.kind==='world')assertCampaignCompatibility(row.data);
  const active=authority.campaigns.find(c=>c.campaignId===authority.activeCampaignId);if(!active?.ledgerRoot)throw Error('權威戰役版本遺失，原資料保留。');
  progress(.05);let proof:VerifiedLedger;try{proof=await readLedger(this.db,active.campaignId,active.ledgerRoot);}catch{this.damagedRoots.add(active.ledgerRoot);throw Error('近期結果帳本損毀，無法驗證持久存檔；原資料保留，請使用完整備份。');}progress(.5);
  let world:FormalWorld|undefined;
  try{
   if(row.kind!=='world')throw new Error('Invalid world row');
   world=(await decodeSave(row.data,proof)).world;
   const a=authority,root=a.campaigns.find(c=>c.campaignId===world!.campaignId)?.ledgerRoot,head=await this.db.table('LedgerHeads').get(world.campaignId);
   const identityCount=proof.results.reduce((n,s)=>n+s.records.length,0);let entries=0;await this.db.transaction('r',this.db.table('LedgerIdentity'),()=>scanLedgerIdentity(this.db,world!.campaignId,rows=>{for(const e of rows){entries++;const original=proof.result(e.commandId),receipt=proof.receipt(e.commandId);if(!original||e.issuerId!==original.issuerId||e.fingerprint!==original.fingerprint||!jsonDataEqual(e.original,original)||!jsonDataEqual(e.receipt,receipt))throw Error('命令索引與已驗證帳本不符。');}progress(.55+.4*Math.min(1,entries/Math.max(1,identityCount)));}));if(entries!==identityCount)throw Error('命令索引與已驗證帳本不符。');
   if(world.campaignId!==authority.activeCampaignId||world.revision!==a.revision||row.data.checksum!==a.worldChecksum||row.at!==a.savedAt||world.ledger?.anchor.root!==root||head?.root!==root)throw new Error('World and authority diverged');
   const tasks=a.campaigns.find(c=>c.campaignId===world!.campaignId)?.growthTasks;if(tasks&&canonicalJSON(tasks)!==canonicalJSON(world.growthTasks))throw new Error('Growth task authority diverged');
  }catch{
   // Reject corrupt/DEMO snapshots; only a valid formal checkpoint can be restored.
   const candidates=await this.db.backups.orderBy('id').reverse().toArray();
   for(const b of candidates){
    let candidate:FormalWorld;
    try{candidate=await this.checkpoint(b);}catch{continue;}
    // Candidate selected. Storage/CAS/transaction errors must propagate, never try an older point.
    const game=await this.restoreValidatedCheckpoint(candidate,b.at);progress(1);return{game,recovered:true,savedAt:b.at};
   }
   throw new Error('正式存檔與回復點均無法讀取，資料保留。');
  }
  await this.sanitizeStoredReports(world!);
  progress(1);
  return{game:world!,recovered:false,savedAt:row.at};
 }
 private async sanitizeStoredReports(world:FormalWorld){await this.db.transaction('rw',this.db.BattleReports,async()=>{const rows=await this.db.BattleReports.where('campaignId').equals(world.campaignId).toArray();const repaired=rows.map(r=>sanitizeScoutReport(world,r) as ReportRow).filter((r,i)=>r!==rows[i]);if(repaired.length)await this.db.BattleReports.bulkPut(repaired);});}
 async loadSave(){const {game,recovered}=await this.loadAnchored();return {game,recovered};}
 async loadWithOffline(now=Date.now(),onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void,options:CooperativeAdvanceOptions={}):Promise<{game:FormalWorld|null;recovered:boolean;summary?:OfflineSummary}>{
  onProgress?.('read');
  const loaded=await this.loadAnchored(fraction=>onProgress?.('read',fraction,0));if(!loaded.game)return {game:null,recovered:loaded.recovered};
  // Capture provable legacy state before offline replay can change ownership or population.
  loaded.game={...loaded.game,...(loaded.game.growthTasks?{growthTasks:structuredClone(loaded.game.growthTasks)}:{})};syncGrowthTasks(loaded.game);
  onProgress?.('offline',0,0);
  const result=await advanceOfflineCooperative(loaded.game,loaded.savedAt??now,now,(fraction,events)=>onProgress?.('offline',fraction,events),options);
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
   try{await this.checkpoint(b);
    result.push({id:b.id!,at:b.at,label:b.label,time:b.gameTime,reportCursor:b.reportCursor});}catch{/* Invalid or DEMO rows are never offered as formal Recovery. */}
  }
  return result;
 }
 async restore(id:number,activateAI=false){
  if(!Number.isSafeInteger(id)||id<1)throw new Error('回復點 ID 無效。');
  const b=await this.db.backups.get(id);if(!b)throw new Error('找不到正式回復點。');
  return this.restoreValidatedCheckpoint(await this.checkpoint(b),Date.now(),activateAI);
 }
 private async restoreValidatedCheckpoint(world:FormalWorld,savedAt=Date.now(),activateAI=false){
  const a=await this.authority();return this.commit(world,[],'restore',a.revision,savedAt,activateAI);
 }
 async importSave(text:string,activateAI=false){
  if(new TextEncoder().encode(text).length>100*1024*1024)throw new Error('存檔超過 100 MiB。');
  const {world,reports,envelope:e,proof:currentProof}=await decodeSave(JSON.parse(text)),snapshots:VerifiedLedger[]=[currentProof];
  if(e.bundle){for(const m of e.bundle.manifests)if(!snapshots.some(s=>s.manifest.checksum===m.root&&s.manifest.campaignId===m.campaignId))snapshots.push(await verifyLedgerArchive(archiveFromBundle(e.bundle,m.campaignId,m.root)));for(const h of e.bundle.heads)if(!snapshots.some(s=>s.manifest.campaignId===h.campaignId&&s.manifest.checksum===h.root))throw Error('封裝權威 head 不完整。');}
  const inbox=e.inbox??[];
  for(const r of inbox){const o=orderSchema.parse(r.order);if(r.campaignId!==o.campaignId||r.commandId!==o.commandId||r.issuerId!==o.issuerId||r.fingerprint!==commandFingerprint(o)||!['pending','retryable','committed','rejected','needs-confirmation','rolled-back'].includes(r.state)||![r.createdAt,r.deadline,r.attempts,r.nextAttemptAt,r.originalRevision,r.branch,r.writerEpoch].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('匯入 Inbox 無效。');const h=e.bundle?.heads.find(h=>h.campaignId===r.campaignId),proof=h?snapshots.find(s=>s.manifest.checksum===h.root):snapshots.find(s=>s.manifest.campaignId===r.campaignId);if(!proof)throw Error('Inbox 缺少對應戰役帳本。');if(terminalCommand(r)){const original=proof.result(r.commandId);if(!original)throw Error('終局 Inbox 缺少原始結果。');if(r.issuerId!==original.issuerId||r.fingerprint!==original.fingerprint){if(r.state!=='rejected'||r.ack?.status!=='rejected'||r.conflict?.issuerId!==original.issuerId||r.conflict.fingerprint!==original.fingerprint||canonicalJSON(r.ack)!==canonicalJSON(r.conflict.ack))throw Error('衝突拒絕缺少權威證據。');continue;}if(r.originalResult&&canonicalJSON(r.originalResult)!==canonicalJSON(original))throw Error('終局 Inbox 缺少原始結果。');if(!r.ack||r.ack.commandId!==r.commandId||!Number.isSafeInteger(r.ack.revision)||r.ack.revision<0||r.ack.revision>world.revision)throw Error('Inbox 查詢結果無效。');if(original.state==='committed'){const receipt=proof.receipt(r.commandId);if(!receipt||r.state!==(receipt.disposition==='applied'?'committed':'rolled-back')||receipt.disposition==='applied'&&!['committed','duplicate'].includes(r.ack.status)||receipt.disposition==='rolled-back'&&r.ack.status!=='rolled-back')throw Error('Inbox 分支狀態不符。');}else if(r.state!==original.state||canonicalJSON(r.ack)!==canonicalJSON(original.ack))throw Error('Inbox 原始結果不符。');r.originalResult=original;}}
  if(new Set(inbox.map(r=>r.campaignId+'/'+r.commandId)).size!==inbox.length)throw Error('重複 Inbox 身份。');
  const recovery=e.recovery??[];for(const point of recovery){const ref=point.data.snapshot.ledger?.anchor,proof=ref&&snapshots.find(s=>s.manifest.checksum===ref.root);if(!proof)throw Error('回復點缺少帳本。');await decodeSave(point.data,proof);}
  const growthAuthority=e.growthAuthority??[];if(new Set(growthAuthority.map(g=>g.campaignId)).size!==growthAuthority.length)throw Error('重複成長任務權威。');for(const g of growthAuthority)domainAuthoritySchema.parse(g);
  const a=await this.authority();return this.commit(world,reports??[],'import',a.revision,Date.now(),activateAI,undefined,{snapshots,heads:e.bundle?.heads??[{campaignId:world.campaignId,root:world.ledger!.anchor.root}],inbox,recovery,growthAuthority});
 }
 async exportStoredSave(mode:'quick'|'full'='quick'){
  // One read snapshot captures Inbox + world + all advertised Recovery roots.
  // Hashing/portable encoding occurs after the read transaction, over immutable data.
  const captured=await this.db.transaction('r',[this.db.saves,this.db.backups,this.db.Inbox,this.db.BattleReports,...ledgerTables(this.db)],async()=>{
   const current=await this.db.saves.get('current');if(current?.kind!=='world')throw Error('沒有正式存檔可匯出。');const authority=await this.authority();const active=authority.campaigns.find(c=>c.campaignId===authority.activeCampaignId);if(current.data.snapshot.campaignId!==authority.activeCampaignId||current.data.snapshot.revision!==authority.revision||current.data.checksum!==authority.worldChecksum||current.at!==authority.savedAt||current.data.snapshot.ledger?.anchor.root!==active?.ledgerRoot)throw Error('匯出世界與權威版本不一致，原資料保留。');
   const checkpointRows=await this.db.backups.bulkGet(authority.recovery.toSorted((a,b)=>b.id-a.id).map(r=>r.id));if(checkpointRows.some(p=>!p))throw Error('權威回復點遺失，原資料保留，無法完整匯出。');const checkpoints=checkpointRows as RecoveryRow[];for(const point of checkpoints){const ref=authority.recovery.find(r=>r.id===point.id)!;if(ref.checksum!==point.data.checksum||ref.root!==point.data.snapshot.ledger?.anchor.root||ref.at!==point.at)throw Error('回復點與權威引用不一致。');}const heads=await this.db.table('LedgerHeads').toArray(),roots=[...heads,...checkpoints.map(p=>({campaignId:p.campaignId,root:p.data.snapshot.ledger!.anchor.root}))],archives:import('./formal/commandLedger').LedgerArchive[]=[];
   const readSession=new LedgerReadSession(this.db);for(const r of roots)if(!archives.some(a=>a.manifest.campaignId===r.campaignId&&a.manifest.checksum===r.root))archives.push(await readLedgerArchive(this.db,r.campaignId,r.root,readSession));
   return {current,authority,checkpoints,heads,archives,inbox:await this.db.Inbox.toArray(),reports:mode==='full'?await this.db.BattleReports.where('campaignId').equals(current.data.snapshot.campaignId).toArray():undefined};
  });
  const proofs=[];for(const a of captured.archives)proofs.push(await verifyLedgerArchive(a));
  const root=captured.current.data.snapshot.ledger!.anchor.root,proof=proofs.find(s=>s.manifest.checksum===root);if(!proof)throw Error('匯出權威帳本遺失。');
  const {world}=await decodeSave(captured.current.data,proof),reports=captured.reports?.filter(r=>r.sequence<world.sequences.report&&r.at<=world.time).map(({key:_key,...r})=>sanitizeScoutReport(world,r));
  const e=await encodeSave(world,reports,false);
  const segments=new Map(),results=new Map();for(const a of captured.archives){for(const s of a.history.segments)segments.set(s.checksum,s);for(const r of a.results)results.set(r.checksum,r);}
  const bundle:LedgerBundle={format:1,heads:captured.heads.map(h=>({campaignId:h.campaignId,root:h.root})),manifests:captured.archives.map(a=>({campaignId:a.manifest.campaignId,root:a.manifest.checksum,manifest:a.manifest,historyManifest:a.history.manifest})),segments:[...segments.values()],results:[...results.values()]};
  e.bundle=bundle;e.inbox=captured.inbox;e.recovery=captured.checkpoints.map(p=>({at:p.at,label:p.label,data:p.data}));e.growthAuthority=captured.authority.campaigns.map(c=>({campaignId:c.campaignId,playerFactionId:c.playerFactionId,growthTasks:c.growthTasks,claimEvidence:c.claimEvidence,labIncoming:c.labIncoming}));await sealTransport(e);const text=JSON.stringify(e);if(new TextEncoder().encode(text).length>100*1024*1024)throw Error('存檔超過 100 MiB，未產生不可重新匯入的檔案。');return text;
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
 async clearSavedGames(){await this.db.transaction('rw',[this.db.saves,this.db.backups,this.db.BattleReports,this.db.RuntimeMeta,this.db.Inbox,...ledgerTables(this.db)],async()=>{const meta=await this.meta();this.assertWriter(meta);const authority=await this.authority();await this.switchInbox(meta);const revision=authority.revision+1;if(!Number.isSafeInteger(revision))throw Error('版本超出安全範圍。');await this.advanceOtherLedgers(meta,authority,revision);authority.revision=revision;delete authority.worldChecksum;delete authority.savedAt;delete authority.activeCampaignId;await this.putAuthority(authority);this.fault?.('authority-write');await this.db.saves.delete('current');this.fault?.('world-write');await this.db.backups.clear();authority.recovery=[];await this.db.BattleReports.clear();await this.pruneRetainedStorage(meta,authority);});}

}
let store:FormalPersistence|undefined;
const active=()=>store??=new FormalPersistence();
export const save=(...args:Parameters<FormalPersistence['save']>)=>active().save(...args);
export const startCampaign=(world:FormalWorld,replacementToken?:string)=>active().start(world,replacementToken);
export const incompatibleStartToken=()=>active().incompatibleStartToken();
export const loadSave=()=>active().loadSave();
export const backupList=()=>active().backupList();
export const restore=(...args:Parameters<FormalPersistence['restore']>)=>active().restore(...args);
export const importSave=(...args:Parameters<FormalPersistence['importSave']>)=>active().importSave(...args);
export const exportStoredSave=(mode:'quick'|'full'='quick')=>active().exportStoredSave(mode);
export const readReportPage=(world:FormalWorld,page:number,filter?:ReportFilter)=>active().readReportPage(world,page,filter);
export const reportStatus=(world:FormalWorld)=>active().reportStatus(world);
export const reportAction=(world:FormalWorld,action:'read'|'clear',ids?:string[],filter?:ReportFilter)=>active().reportAction(world,action,ids,filter);
export const clearSavedGames=()=>active().clearSavedGames();

export const loadWithOffline=(onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void,options:CooperativeAdvanceOptions={})=>active().loadWithOffline(Date.now(),onProgress,options);

export const readCityIntel=(world:FormalWorld,cityId:string,generation?:number)=>active().readCityIntel(world,cityId,generation);

/** Dynamic-schema open never requests a version upgrade or writes a legacy row. */
export async function hasLegacyCampaign(suffix=''){
 for(const name of ['lieguo-formal-ledger-v1',RETIRED_FORMAL_DB_NAME,LEGACY_FORMAL_DB_NAME].map(n=>n+(suffix?'-'+suffix:''))){if(!await Dexie.exists(name))continue;const old=new Dexie(name);try{await old.open();if(await old.transaction('r',old.tables,async()=>{for(const t of old.tables)if(await t.count())return true;return false;}))return true;}finally{old.close();}}return false;
}
export async function exportLegacyCampaign(){
 let name:string|undefined;for(const candidate of ['lieguo-formal-ledger-v1',RETIRED_FORMAL_DB_NAME,LEGACY_FORMAL_DB_NAME])if(await Dexie.exists(candidate)){name=candidate;break;}if(!name)throw new Error('沒有可匯出的舊戰役。');
 const old=new Dexie(name);
 try{await old.open();const rows=(name:string)=>old.tables.some(t=>t.name===name)?old.table(name).toArray():Promise.resolve([]);const archive=await old.transaction('r',old.tables,async()=>({format:'lieguo-historical-archive-v1',sourceDatabase:name,saves:await rows('saves'),backups:await rows('backups'),reports:await rows('BattleReports')}));const text=JSON.stringify(archive);if(new TextEncoder().encode(text).length>100*1024*1024)throw new Error('舊備份超過100 MiB，原資料保留。');return text;}finally{old.close();}
}

export const acquireWriter=()=>active().acquireWriter();
export const writerContext=()=>active().writerContext();
export const receiveCommand=(...args:Parameters<FormalPersistence['receiveCommand']>)=>active().receiveCommand(...args);
export const commandStatus=(...args:Parameters<FormalPersistence['commandStatus']>)=>active().commandStatus(...args);
export const pendingCommands=()=>active().pendingCommands();
export const commandPage=(before?:number)=>active().commandPage(before);
export const finishCommand=(...args:Parameters<FormalPersistence['finishCommand']>)=>active().finishCommand(...args);
export const noteCommandFailure=(...args:Parameters<FormalPersistence['noteCommandFailure']>)=>active().noteCommandFailure(...args);

export const queryCommandStatus=(...args:Parameters<FormalPersistence['queryCommandStatus']>)=>active().queryCommandStatus(...args);
