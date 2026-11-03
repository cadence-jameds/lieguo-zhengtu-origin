import Dexie from 'dexie';
import {verifyLedgerArchive} from './formal/commandLedger';
import type {LedgerArchive,VerifiedLedger,OriginalResult} from './formal/commandLedger';
export type LedgerBundle={format:1;heads:{campaignId:string;root:string}[];manifests:{campaignId:string;root:string;manifest:LedgerArchive['manifest'];historyManifest:LedgerArchive['history']['manifest']}[];segments:LedgerArchive['history']['segments'];results:LedgerArchive['results']};
export function archiveFromBundle(b:LedgerBundle,campaignId:string,root:string):LedgerArchive{
 if(b.format!==1||new Set(b.manifests.map(m=>m.campaignId+'/'+m.root)).size!==b.manifests.length||new Set(b.segments.map((s:any)=>s.checksum)).size!==b.segments.length||new Set(b.results.map(s=>s.checksum)).size!==b.results.length||new Set(b.heads.map(h=>h.campaignId)).size!==b.heads.length)throw Error('帳本封裝身份不完整。');
 const m=b.manifests.find(m=>m.campaignId===campaignId&&m.root===root);if(!m||m.root!==m.manifest.checksum)throw Error('封裝缺少帳本版本。');
 function chain<T extends {checksum:string}>(rows:T[],last:string,count:number,key:keyof T){if(!Number.isSafeInteger(count)||count<0||count>rows.length)throw Error('封裝區段數無效。');const map=new Map(rows.map(s=>[s.checksum,s])),out:T[]=[],seen=new Set<string>();for(let i=0;i<count;i++){if(seen.has(last))throw Error('封裝區段鏈循環。');seen.add(last);const s=map.get(last);if(!s)throw Error('封裝區段遺失。');out.push(s);last=String(s[key]);}if(last!=='0'.repeat(64))throw Error('封裝區段鏈錯誤。');return out.reverse();}
 return {manifest:m.manifest,history:{manifest:m.historyManifest,segments:chain<any>(b.segments,m.historyManifest.lastSegmentHash,m.historyManifest.segmentCount,'previousHash')},results:chain(b.results,m.manifest.resultRoot,m.manifest.resultSegments,'previous')};
}
import {jsonDataEqual} from './formal/jsonDataEqual';
export const ledgerStores={LedgerSegments:'checksum,campaignId',LedgerResults:'checksum,campaignId',LedgerManifests:'[campaignId+root],campaignId',LedgerIdentity:'[campaignId+commandId]',LedgerHeads:'campaignId'};
export const ledgerIdentityRange=(db:Dexie,campaignId:string)=>db.table('LedgerIdentity').where('[campaignId+commandId]').between([campaignId,''],[campaignId,'\uffff'],true,true);
export const ledgerTables=(db:Dexie)=>Object.keys(ledgerStores).map(k=>db.table(k));
/** One consistent read transaction only. Raw rows are not verification proofs;
 * shared ancestors avoid another native clone, but still require validation. */
export class LedgerReadSession {
 private readonly scope=Dexie.currentTransaction?.idbtrans;private readonly rows=new Map<string,Promise<any>>();private readonly prefetched=new Set<string>();
 constructor(private readonly db:Dexie){if(!this.scope)throw Error('區段讀取必須綁定一致交易。');}
 private check(db:Dexie){if(db!==this.db||Dexie.currentTransaction?.idbtrans!==this.scope)throw Error('區段讀取不可跨交易重用。');}
 async prefetch(db:Dexie,table:string,campaignId:string,required:number,minimumRecords:number){
  this.check(db);const key=table+'/'+campaignId;if(!Number.isSafeInteger(required)||!Number.isSafeInteger(minimumRecords)||minimumRecords<0||required<32||required*4<minimumRecords||minimumRecords===0&&required<512||this.prefetched.has(key))return;
  // Real gameplay often creates one segment per command. Avoid tens of
  // thousands of serial hash-link reads, without scanning unrelated campaigns
  // or a much larger future branch when restoring a small checkpoint.
  const query=db.table(table).where('campaignId').equals(campaignId),count=await query.count();
  if(count<required||count>required*1.25+8)return;
  for(const row of await query.toArray()){const id=table+'/'+row.checksum;if(!this.rows.has(id))this.rows.set(id,Promise.resolve(row));}this.prefetched.add(key);
 }
 read(db:Dexie,table:string,key:string){this.check(db);const id=table+'/'+key;let value=this.rows.get(id);if(!value){value=db.table(table).get(key);this.rows.set(id,value!);}return value!;}
}
export async function readLedgerArchive(db:Dexie,campaignId:string,root:string,session?:LedgerReadSession):Promise<LedgerArchive>{
 return db.transaction('r',ledgerTables(db),async()=>{
  session??=new LedgerReadSession(db);
  const row=await db.table('LedgerManifests').get([campaignId,root]);if(!row||row.root!==row.manifest.checksum)throw Error('帳本 Manifest 遺失。');
  await Promise.all([session.prefetch(db,'LedgerSegments',campaignId,row.historyManifest.segmentCount,row.historyManifest.recordCount),session.prefetch(db,'LedgerResults',campaignId,row.manifest.resultSegments,row.historyManifest.recordCount)]);
  async function chain(table:string,last:string,count:number,previous:string){if(!Number.isSafeInteger(count)||count<0)throw Error('帳本區段數無效。');const result=[],seen=new Set<string>();let key=last;for(let i=0;i<count;i++){if(seen.has(key))throw Error('帳本區段鏈循環。');seen.add(key);const s=await session!.read(db,table,key);if(!s||s.campaignId!==campaignId)throw Error('帳本區段遺失。');result.push(s);key=s[previous];}if(key!=='0'.repeat(64))throw Error('帳本鏈不完整。');return result.reverse();}
  const [segments,results]=await Promise.all([chain('LedgerSegments',row.historyManifest.lastSegmentHash,row.historyManifest.segmentCount,'previousHash'),chain('LedgerResults',row.manifest.resultRoot,row.manifest.resultSegments,'previous')]);
  return {manifest:row.manifest,history:{manifest:row.historyManifest,segments},results} as LedgerArchive;
 });
}
export async function readLedger(db:Dexie,campaignId:string,root:string){return verifyLedgerArchive(await readLedgerArchive(db,campaignId,root));}
/** Caller holds one r/rw transaction. Keyset pages bound native structured-clone
 * allocation; no cursor per record, offset scan, or missing boundary key. */
export async function scanLedgerIdentity(db:Dexie,campaignId:string,visit:(rows:any[])=>void){
 let after='',first=true;for(;;){const rows=await db.table('LedgerIdentity').where('[campaignId+commandId]').between([campaignId,after],[campaignId,'\uffff'],first,true).limit(512).toArray();if(!rows.length)return;visit(rows);after=rows.at(-1).commandId;first=false;}
}
/** Called only inside the same transaction as world/Authority/Inbox/checkpoint.
 * Published segments are immutable; ordinary append writes only new segments.
 * Portable imports also retain independently verified historic roots. */
export async function writeLedger(db:Dexie,s:VerifiedLedger,base:VerifiedLedger|undefined,changed:readonly string[],fault?:(point:any)=>void,repairIndex=false){
 const prefix=base&&base.history.segments.every((v,i)=>s.history.segments[i]?.checksum===v.checksum);
 for(const [table,segments,point] of [['LedgerSegments',s.history.segments.slice(prefix?base!.history.segments.length:0),'ledger-segment-write'],['LedgerResults',s.results.slice(base&&s.results[base.results.length-1]?.checksum===base.results.at(-1)?.checksum?base.results.length:0),'ledger-result-write']] as const){
  for(let i=0;i<segments.length;i+=128){const batch=segments.slice(i,i+128),existing=await db.table(table).bulkGet(batch.map(v=>v.checksum)),fresh=[];for(let j=0;j<batch.length;j++){const old=existing[j],segment=batch[j];if(old&&!jsonDataEqual(old,segment))throw Error(table==='LedgerResults'?'不可變結果區段衝突。':'不可變區段衝突。');if(!old)fresh.push(segment);}if(fresh.length)await db.table(table).bulkAdd(fresh);for(const _ of batch)fault?.(point);}
 }
 const ids=new Set(repairIndex?s.results.flatMap(v=>v.records.map(r=>r.commandId)):changed),writes:any[]=[],extra:any[]=[];
 const check=(id:string,old:any)=>{const receipt=s.receipt(id),original=s.result(id);if(!original)throw Error('命令缺少原始結果。');const sameOriginal=old&&old.issuerId===original.issuerId&&old.fingerprint===original.fingerprint&&jsonDataEqual(old.original,original);if(old&&!sameOriginal&&!repairIndex)throw Error('持久身份衝突。');if(!sameOriginal||!jsonDataEqual(old.receipt,receipt))writes.push({campaignId:s.manifest.campaignId,commandId:id,issuerId:original.issuerId,fingerprint:original.fingerprint,original,receipt});};
 if(repairIndex||ids.size>256&&ids.size*2>=s.results.reduce((n,segment)=>n+segment.records.length,0)){await scanLedgerIdentity(db,s.manifest.campaignId,rows=>{for(const old of rows){const id=old.commandId;if(ids.delete(id))check(id,old);else if(repairIndex&&!s.result(id))extra.push([s.manifest.campaignId,id]);}});for(const id of ids)check(id,undefined);}
 else{const keys=[...ids];for(let i=0;i<keys.length;i+=256){const batch=keys.slice(i,i+256),existing=await db.table('LedgerIdentity').bulkGet(batch.map(id=>[s.manifest.campaignId,id]));batch.forEach((id,j)=>check(id,existing[j]));}}
 if(extra.length)await db.table('LedgerIdentity').bulkDelete(extra);if(repairIndex)fault?.('ledger-index-write');
 for(let i=0;i<writes.length;i+=256){await db.table('LedgerIdentity').bulkPut(writes.slice(i,i+256));fault?.('ledger-index-write');}
 const manifestRow={campaignId:s.manifest.campaignId,root:s.manifest.checksum,manifest:s.manifest,historyManifest:s.history.manifest},prior=await db.table('LedgerManifests').get([s.manifest.campaignId,s.manifest.checksum]);if(prior&&!jsonDataEqual(prior,manifestRow))throw Error('不可變 Manifest 衝突。');if(!prior)await db.table('LedgerManifests').add(manifestRow);fault?.('ledger-manifest-write');
}
export async function publishLedgerHead(db:Dexie,s:VerifiedLedger,fault?:(point:any)=>void){await db.table('LedgerHeads').put({campaignId:s.manifest.campaignId,root:s.manifest.checksum});fault?.('ledger-head-write');}
export function resultFromReceipt(r:{commandId:any;issuerId:any;fingerprint:string;committedRevision:number}):OriginalResult{return {commandId:r.commandId,issuerId:r.issuerId,fingerprint:r.fingerprint,state:'committed',ack:{commandId:r.commandId,status:'committed',revision:r.committedRevision}};}
