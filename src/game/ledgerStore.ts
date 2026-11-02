import type Dexie from 'dexie';
import {verifyLedgerArchive} from './formal/commandLedger';
import type {LedgerArchive,VerifiedLedger,OriginalResult} from './formal/commandLedger';
export type LedgerBundle={format:1;heads:{campaignId:string;root:string}[];manifests:{campaignId:string;root:string;manifest:LedgerArchive['manifest'];historyManifest:LedgerArchive['history']['manifest']}[];segments:LedgerArchive['history']['segments'];results:LedgerArchive['results']};
export function archiveFromBundle(b:LedgerBundle,campaignId:string,root:string):LedgerArchive{
 if(b.format!==1||new Set(b.manifests.map(m=>m.campaignId+'/'+m.root)).size!==b.manifests.length||new Set(b.segments.map((s:any)=>s.checksum)).size!==b.segments.length||new Set(b.results.map(s=>s.checksum)).size!==b.results.length||new Set(b.heads.map(h=>h.campaignId)).size!==b.heads.length)throw Error('帳本封裝身份不完整。');
 const m=b.manifests.find(m=>m.campaignId===campaignId&&m.root===root);if(!m||m.root!==m.manifest.checksum)throw Error('封裝缺少帳本版本。');
 function chain<T extends {checksum:string}>(rows:T[],last:string,count:number,key:keyof T){const map=new Map(rows.map(s=>[s.checksum,s])),out:T[]=[];for(let i=0;i<count;i++){const s=map.get(last);if(!s)throw Error('封裝區段遺失。');out.push(s);last=String(s[key]);}if(last!=='0'.repeat(64))throw Error('封裝區段鏈錯誤。');return out.reverse();}
 return {manifest:m.manifest,history:{manifest:m.historyManifest,segments:chain<any>(b.segments,m.historyManifest.lastSegmentHash,m.historyManifest.segmentCount,'previousHash')},results:chain(b.results,m.manifest.resultRoot,m.manifest.resultSegments,'previous')};
}
import {canonicalJSON} from './formal/canonical';
export const ledgerStores={LedgerSegments:'checksum,campaignId',LedgerResults:'checksum,campaignId',LedgerManifests:'[campaignId+root],campaignId',LedgerIdentity:'[campaignId+commandId]',LedgerHeads:'campaignId'};
export const ledgerIdentityRange=(db:Dexie,campaignId:string)=>db.table('LedgerIdentity').where('[campaignId+commandId]').between([campaignId,''],[campaignId,'\uffff'],true,true);
export const ledgerTables=(db:Dexie)=>Object.keys(ledgerStores).map(k=>db.table(k));
export async function readLedgerArchive(db:Dexie,campaignId:string,root:string):Promise<LedgerArchive>{
 return db.transaction('r',ledgerTables(db),async()=>{
  const row=await db.table('LedgerManifests').get([campaignId,root]);if(!row||row.root!==row.manifest.checksum)throw Error('帳本 Manifest 遺失。');
  async function chain(table:string,last:string,count:number,previous:string){const result=[];let key=last;for(let i=0;i<count;i++){const s=await db.table(table).get(key);if(!s||s.campaignId!==campaignId)throw Error('帳本區段遺失。');result.push(s);key=s[previous];}if(key!=='0'.repeat(64))throw Error('帳本鏈不完整。');return result.reverse();}
  const segments=await chain('LedgerSegments',row.historyManifest.lastSegmentHash,row.historyManifest.segmentCount,'previousHash'),results=await chain('LedgerResults',row.manifest.resultRoot,row.manifest.resultSegments,'previous');
  return {manifest:row.manifest,history:{manifest:row.historyManifest,segments},results} as LedgerArchive;
 });
}
export async function readLedger(db:Dexie,campaignId:string,root:string){return verifyLedgerArchive(await readLedgerArchive(db,campaignId,root));}
/** Called only inside the same transaction as world/Authority/Inbox/checkpoint.
 * Published segments are immutable; ordinary append writes only new segments.
 * Portable imports also retain independently verified historic roots. */
export async function writeLedger(db:Dexie,s:VerifiedLedger,base:VerifiedLedger|undefined,changed:readonly string[],fault?:(point:any)=>void,repairIndex=false){
 const prefix=base&&base.history.segments.every((v,i)=>s.history.segments[i]?.checksum===v.checksum);
 for(const segment of s.history.segments.slice(prefix?base!.history.segments.length:0)){const old=await db.table('LedgerSegments').get(segment.checksum);if(old&&canonicalJSON(old)!==canonicalJSON(segment))throw Error('不可變區段衝突。');if(!old)await db.table('LedgerSegments').add(segment);fault?.('ledger-segment-write');}
 for(const segment of s.results.slice(base&&s.results[base.results.length-1]?.checksum===base.results.at(-1)?.checksum?base.results.length:0)){const old=await db.table('LedgerResults').get(segment.checksum);if(old&&canonicalJSON(old)!==canonicalJSON(segment))throw Error('不可變結果區段衝突。');if(!old)await db.table('LedgerResults').add(segment);fault?.('ledger-result-write');}
 if(repairIndex){await ledgerIdentityRange(db,s.manifest.campaignId).delete();fault?.('ledger-index-write');}
 const ids=[...new Set(repairIndex?s.results.flatMap(v=>v.records.map(r=>r.commandId)):changed)],existing=await db.table('LedgerIdentity').bulkGet(ids.map(id=>[s.manifest.campaignId,id])),writes=[];
 for(let i=0;i<ids.length;i++){const id=ids[i],receipt=s.receipt(id),original=s.result(id),old=existing[i];if(!original)throw Error('命令缺少原始結果。');if(old&&(old.issuerId!==original.issuerId||old.fingerprint!==original.fingerprint||canonicalJSON(old.original)!==canonicalJSON(original)))throw Error('持久身份衝突。');if(old&&canonicalJSON(old.receipt)===canonicalJSON(receipt))continue;writes.push({campaignId:s.manifest.campaignId,commandId:id,issuerId:original.issuerId,fingerprint:original.fingerprint,original,receipt});}
 for(let i=0;i<writes.length;i+=256){await db.table('LedgerIdentity').bulkPut(writes.slice(i,i+256));fault?.('ledger-index-write');}
 const manifestRow={campaignId:s.manifest.campaignId,root:s.manifest.checksum,manifest:s.manifest,historyManifest:s.history.manifest},prior=await db.table('LedgerManifests').get([s.manifest.campaignId,s.manifest.checksum]);if(prior&&canonicalJSON(prior)!==canonicalJSON(manifestRow))throw Error('不可變 Manifest 衝突。');if(!prior)await db.table('LedgerManifests').add(manifestRow);fault?.('ledger-manifest-write');
}
export async function publishLedgerHead(db:Dexie,s:VerifiedLedger,fault?:(point:any)=>void){await db.table('LedgerHeads').put({campaignId:s.manifest.campaignId,root:s.manifest.checksum});fault?.('ledger-head-write');}
export function resultFromReceipt(r:{commandId:any;issuerId:any;fingerprint:string;committedRevision:number}):OriginalResult{return {commandId:r.commandId,issuerId:r.issuerId,fingerprint:r.fingerprint,state:'committed',ack:{commandId:r.commandId,status:'committed',revision:r.committedRevision}};}
