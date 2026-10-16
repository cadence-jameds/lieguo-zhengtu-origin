import {enableAutonomy} from './formal/autonomy';
import {effectiveSpeed} from './formal/playtest';
import {advanceOfflineCooperative,type OfflineSummary} from './formal/offline';
import Dexie,{type Table} from 'dexie';
import {z} from 'zod';
import {isMissionArmy,type CityIntel,type BattleReportPayload} from './formal/combatModel';
import type {CampaignId} from './formal/ids';
import type {CommandReceipt,FormalReport,FormalWorld} from './formal/model';
import {receiptSchema,validateFormalWorld} from './formal/schema';
import {canonicalJSON} from './formal/canonical';
import {decodeSave,encodeSave,validateReportHistory,type FormalEnvelope} from './formal/saveCodec';
import {FORMAL_DB_NAME} from './formal/versions';
export {decodeSave,encodeSave} from './formal/saveCodec';
/** Presentation timestamps are captured while the event's real clock anchor is known. */
function stampBattle(p:BattleReportPayload,real:(at:number)=>number){p.realResolvedAt??=real(p.resolvedAt);if(p.intel)p.intel.observedRealAt??=real(p.intel.observedAt);}
function stampPending(w:FormalWorld,real:(at:number)=>number){for(const a of w.armies)if(isMissionArmy(a)){if(a.pendingIntel)a.pendingIntel.observedRealAt??=real(a.pendingIntel.observedAt);if(a.pendingReport)stampBattle(a.pendingReport,real);}}
export type FailurePoint='report-write'|'history-modified'|'backup-write'|'world-write'|'authority-write';
type WorldRow={id:'current';kind:'world';at:number;data:FormalEnvelope};
type CampaignAuthority={campaignId:CampaignId;receipts:CommandReceipt[]};
type AuthorityRow={id:'authority';kind:'authority';revision:number;sequences:FormalWorld['sequences'];campaigns:CampaignAuthority[]};
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
const authoritySchema=z.object({id:z.literal('authority'),kind:z.literal('authority'),revision:z.number().int().nonnegative().safe(),sequences:z.object({event:z.number().int().positive().safe(),report:z.number().int().positive().safe(),project:z.number().int().positive().safe()}).strict(),campaigns:z.array(z.object({campaignId:z.custom<CampaignId>(v=>typeof v==='string'&&/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(v)),receipts:z.array(receiptSchema)}).strict())}).strict();
export class FormalDatabase extends Dexie {
 saves!:Table<WorldRow|AuthorityRow,string>;backups!:Table<RecoveryRow,number>;BattleReports!:Table<ReportRow,string>;
 constructor(suffix=''){
  if(suffix&&!/^[A-Za-z0-9_.-]+$/.test(suffix))throw new Error('Invalid formal database suffix');
  super(FORMAL_DB_NAME+(suffix?'-'+suffix:''));
  this.version(1).stores({saves:'id',backups:'++id,at,campaignId',BattleReports:'key,campaignId,[campaignId+sequence],[campaignId+ownerFactionId+sequence]'});
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
 private async authority():Promise<AuthorityRow>{
  const row=await this.db.saves.get('authority');
  if(!row)return{id:'authority',kind:'authority',revision:0,sequences:{event:1,report:1,project:1},campaigns:[]};
  const a=authoritySchema.parse(row);
  if(new Set(a.campaigns.map(x=>x.campaignId)).size!==a.campaigns.length)throw new Error('Duplicate campaign authority');
  for(const c of a.campaigns)if(new Set(c.receipts.map(r=>r.commandId)).size!==c.receipts.length||c.receipts.some(r=>r.committedRevision>a.revision))throw new Error('Invalid durable command authority');
  return a;
 }
 private async commit(input:FormalWorld,reportWrites:readonly FormalReport[],mode:'save'|'start'|'restore'|'import',expectedRevision?:number,savedAt=Date.now(),activateAI=false):Promise<FormalWorld>{
  validateFormalWorld(input);validateReportHistory(input,reportWrites);
  // No memory mutation; caller may switch its displayed world only after this resolves.
  return this.db.transaction('rw',this.db.saves,this.db.backups,this.db.BattleReports,async()=>{
   const authority=await this.authority(),current=await this.db.saves.get('current');
   if(expectedRevision!==undefined&&authority.revision!==expectedRevision)throw new Error('存檔 revision 衝突，命令未提交。');
   const w=structuredClone(input),prior=authority.campaigns.find(c=>c.campaignId===w.campaignId)?.receipts??[];
   if(mode==='save'){
    for(const key of ['event','report','project'] as const)if(w.sequences[key]<authority.sequences[key])throw new Error('Durable ID sequence cannot decrease');
    if(current&&current.kind==='world'&&current.data.snapshot.campaignId!==w.campaignId)throw new Error('Campaign switch requires explicit transition');
    const required=current?authority.revision+1:0;
    if(w.revision!==required)throw new Error('Committed revision must advance exactly once');
    const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));
    for(const r of prior){const receipt=receipts.get(r.commandId);if(!receipt||canonicalJSON(receipt)!==canonicalJSON(r))throw new Error('Durable dedupe history cannot be dropped');}
   }else{
    w.commandReceipts=reconcileReceipts(w,prior);
    for(const key of ['event','report','project'] as const)w.sequences[key]=Math.max(w.sequences[key],authority.sequences[key]);
    w.revision=Math.max(current?authority.revision+1:0,w.revision);
    for(const r of w.commandReceipts)w.revision=Math.max(w.revision,r.committedRevision);
   }
   if(activateAI)enableAutonomy(w);
   const real=(at:number)=>Math.max(0,Math.floor(savedAt-(w.time-at)/effectiveSpeed(input)));
   if(mode==='save'||mode==='start')stampPending(w,real);
   const stampedReports=reportWrites.map(r=>{const copy=structuredClone(r);if(mode!=='import'){copy.realAt??=real(copy.at);copy.clockSpeed??=effectiveSpeed(input);copy.read??=false;if(copy.battle)stampBattle(copy.battle,real);}return copy;});
   validateReportHistory(w,stampedReports);
   // encodeSave fully validates the final world; crypto needs keep-alive under the revision lock.
   const envelope=await Dexie.waitFor(encodeSave(w));
   if(mode==='restore'||mode==='import'){
    const rows=await this.db.BattleReports.where('campaignId').equals(w.campaignId).toArray();
    const obsolete=mode==='import'?rows:rows.filter(r=>r.at>input.time||r.sequence>=input.sequences.report);
    if(obsolete.length)await this.db.BattleReports.bulkDelete(obsolete.map(r=>r.key));
    const points=await this.db.backups.where('campaignId').equals(w.campaignId).toArray();
    const invalid=mode==='import'?points:points.filter(r=>r.gameTime>input.time||r.reportCursor>input.sequences.report);
    if(invalid.length)await this.db.backups.bulkDelete(invalid.map(r=>r.id!));
    this.fault?.('history-modified');
   }
   if(reportWrites.length)await this.db.BattleReports.bulkPut(stampedReports.map(r=>({...r,key:reportKey(r)})));
   this.fault?.('report-write');
   // Two valid checkpoints; ordering uses IDB monotonic IDs, not wall-clock ordering.
   await this.db.backups.add({at:savedAt,label:mode==='restore'?'手動回復':mode==='import'?'正式匯入':mode==='start'?'B1 fixture開始':'正式回復點',campaignId:w.campaignId,gameTime:w.time,reportCursor:w.sequences.report,data:envelope});
   const backupIds=await this.db.backups.orderBy('id').primaryKeys();if(backupIds.length>2)await this.db.backups.bulkDelete(backupIds.slice(0,-2));
   this.fault?.('backup-write');
   await this.db.saves.put({id:'current',kind:'world',at:savedAt,data:envelope});this.fault?.('world-write');
   authority.revision=w.revision;authority.sequences={...w.sequences};
   authority.campaigns=authority.campaigns.filter(c=>c.campaignId!==w.campaignId);
   authority.campaigns.push({campaignId:w.campaignId,receipts:structuredClone(w.commandReceipts)});
   await this.db.saves.put(authority);this.fault?.('authority-write');
   return w;
  });
 }
 async save(world:FormalWorld,reports:readonly FormalReport[]=[],expectedRevision?:number){return this.commit(world,reports,'save',expectedRevision);}
 async start(world:FormalWorld){return this.commit(world,[],'start');}
 private async loadAnchored():Promise<{game:FormalWorld|null;recovered:boolean;savedAt?:number}>{
  const [row,authority]=await this.db.transaction('r',this.db.saves,async()=>[await this.db.saves.get('current'),await this.authority()] as const);if(!row)return{game:null,recovered:false};
  let world:FormalWorld|undefined;
  try{
   if(row.kind!=='world')throw new Error('Invalid world row');
   world=(await decodeSave(row.data)).world;
   const a=authority,ledger=a.campaigns.find(c=>c.campaignId===world!.campaignId)?.receipts??[];
   if(world.revision!==a.revision||canonicalJSON(world.commandReceipts)!==canonicalJSON(ledger))throw new Error('World and authority diverged');
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
  return{game:world!,recovered:false,savedAt:row.at};
 }
 async loadSave(){const {game,recovered}=await this.loadAnchored();return {game,recovered};}
 async loadWithOffline(now=Date.now(),onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void):Promise<{game:FormalWorld|null;recovered:boolean;summary?:OfflineSummary}>{
  onProgress?.('read');
  const loaded=await this.loadAnchored();if(!loaded.game)return {game:null,recovered:loaded.recovered};
  onProgress?.('offline',0,0);
  const result=await advanceOfflineCooperative(loaded.game,loaded.savedAt??now,now,(fraction,events)=>onProgress?.('offline',fraction,events));
  // Even 0h refreshes the wall anchor atomically. Expose nothing until save resolves.
  const draft=result.world===loaded.game?{...result.world,revision:result.world.revision+1}:result.world;
  const real=(at:number)=>Math.max(0,Math.floor((loaded.savedAt??now)+(at-loaded.game!.time)/effectiveSpeed(loaded.game!)));
  stampPending(draft,real);
  const reports=result.reports.map(r=>{const copy={...r,realAt:real(r.at),clockSpeed:effectiveSpeed(loaded.game!)};if(copy.battle)stampBattle(copy.battle,real);return copy;});
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
   const reports=mode==='full'?(await this.db.BattleReports.where('campaignId').equals(world.campaignId).toArray()).filter(r=>r.sequence<world.sequences.report&&r.at<=world.time).map(({key:_key,...r})=>r):undefined;
   return{world,reports};
  });
  return JSON.stringify(await encodeSave(world,reports));
 }
 private reportQuery(world:FormalWorld){return this.db.BattleReports.where('[campaignId+ownerFactionId+sequence]').between([world.campaignId,world.playerFactionId,1],[world.campaignId,world.playerFactionId,world.sequences.report],true,false).filter(r=>r.at<=world.time);}
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
  return this.db.transaction('rw',this.db.BattleReports,async()=>{
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
    if(r.at>world.time||!i||(generation===undefined?i.cityId!==cityId:i.siteId!==cityId||i.generation!==generation)||!p!.attackers.some(a=>a.ownerFactionId===world.playerFactionId))return;
    const observation={intel:i,owner:p!.ownerBefore};
    result.army??=observation;
    if(i.resources)result.resources??=observation;
    if(i.wallLevel!==undefined)result.defenses??=observation;
   });
  return result;
 }
 /** Explicit formal reset only. Does not enumerate, access, or delete any DEMO DB. */
 async clearSavedGames(){await this.db.transaction('rw',this.db.saves,this.db.backups,this.db.BattleReports,async()=>{await this.db.saves.clear();await this.db.backups.clear();await this.db.BattleReports.clear();});}
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
