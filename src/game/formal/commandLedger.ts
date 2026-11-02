import type {CommandAck,CommandReceipt,FormalWorld,FormalOrder} from './model';
import {emptyLedger,prepareLedger,verifyLedger,type LedgerCandidate} from '../../../scripts/command-ledger-candidate.mjs';
import {digest,canonicalJSON} from './canonical';

export type OriginalResult={commandId:string;issuerId:string;fingerprint:string;ack:CommandAck;state:'committed'|'rejected'|'needs-confirmation';order?:FormalOrder};
export type ResultSegment={campaignId:string;sequence:number;previous:string;records:OriginalResult[];checksum:string};
export type LedgerManifest={format:1;campaignId:string;version:number;worldRevision:number;branch:number;writerEpoch:number;branchRevision:number;orderPrefix:number;historyRoot:string;resultRoot:string;resultSegments:number;checksum:string};
export type LedgerAnchor={root:string;campaignId:string;worldRevision:number;branch:number;writerEpoch:number;authorityRevision:number;checkpoint:string};
export type LedgerState={format:1;anchor:LedgerAnchor;pending:CommandReceipt[];outcomes?:OriginalResult[]};
export type LedgerArchive={manifest:LedgerManifest;history:ReturnType<LedgerCandidate['archive']>;results:ResultSegment[]};
function validateOriginal(r:OriginalResult,history:LedgerCandidate,revision:number){
 const keys=Object.keys(r).sort().join(',');if(keys!=='ack,commandId,fingerprint,issuerId,state'&&keys!=='ack,commandId,fingerprint,issuerId,order,state')throw Error('原始結果欄位無效。');
 if(!/^command:[A-Za-z0-9_.-]{1,100}$/.test(r.commandId)||!/^faction:[A-Za-z0-9_.-]{1,100}$/.test(r.issuerId)||typeof r.fingerprint!=='string'||!r.fingerprint||!r.ack||r.ack.commandId!==r.commandId||!Number.isSafeInteger(r.ack.revision)||r.ack.revision<0||r.ack.revision>revision||Object.keys(r.ack).some(k=>!['commandId','status','revision','originalRevision','requiresConfirmation','reason'].includes(k))||r.ack.reason!==undefined&&typeof r.ack.reason!=='string')throw Error('原始命令結果無效。');
 if(r.state==='needs-confirmation'?r.ack.requiresConfirmation!==true:r.ack.requiresConfirmation!==undefined)throw Error('原始結果確認旗標不一致。');
 const receipt=history.lookup(history.manifest.campaignId,r.commandId);
 if(r.state==='committed'){if(!receipt||r.ack.status!=='committed'||r.ack.revision!==receipt.committedRevision)throw Error('正式結果與世界命令收據不一致。');}
 else if(!['rejected','needs-confirmation'].includes(r.state)||r.ack.status!=='rejected'||receipt)throw Error('拒絕結果與世界效果衝突。');
 if(receipt&&(receipt.issuerId!==r.issuerId||receipt.fingerprint!==r.fingerprint))throw Error('結果身份衝突。');
 if(r.order&&(r.order.commandId!==r.commandId||r.order.issuerId!==r.issuerId||r.order.campaignId!==history.manifest.campaignId||canonicalJSON({campaignId:r.order.campaignId,issuerId:r.order.issuerId,payload:r.order.payload})!==r.fingerprint))throw Error('原始操作與結果身份不符。');
}
type Node<T>={key:string;value:T;left?:Node<T>;right?:Node<T>;height:number};
const height=<T>(n?:Node<T>)=>n?.height??0;
function node<T>(key:string,value:T,left?:Node<T>,right?:Node<T>):Node<T>{return Object.freeze({key,value,left,right,height:1+Math.max(height(left),height(right))});}
function left<T>(n:Node<T>){const r=n.right!;return node(r.key,r.value,node(n.key,n.value,n.left,r.left),r.right);}
function right<T>(n:Node<T>){const l=n.left!;return node(l.key,l.value,l.left,node(n.key,n.value,l.right,n.right));}
function put<T>(n:Node<T>|undefined,key:string,value:T):Node<T>{if(!n)return node(key,value);let r=key===n.key?node(key,value,n.left,n.right):key<n.key?node(n.key,n.value,put(n.left,key,value),n.right):node(n.key,n.value,n.left,put(n.right,key,value));if(height(r.left)-height(r.right)>1){if(key>r.left!.key)r=node(r.key,r.value,left(r.left!),r.right);return right(r);}if(height(r.right)-height(r.left)>1){if(key<r.right!.key)r=node(r.key,r.value,r.left,right(r.right!));return left(r);}return r;}
function get<T>(n:Node<T>|undefined,key:string):T|undefined{while(n){if(n.key===key)return n.value;n=key<n.key?n.left:n.right;}return undefined;}
function frozen<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(frozen);Object.freeze(v);}return v;}
const proofKey=Symbol('verified-ledger'),proofs=new WeakSet<object>(),bindings=new WeakMap<FormalWorld,VerifiedLedger>();
const zero='0'.repeat(64),verified=new Map<string,VerifiedLedger>(),weakRoots=new Map<string,Set<WeakRef<VerifiedLedger>>>(),proofRefs=new WeakMap<VerifiedLedger,WeakRef<VerifiedLedger>>();
const cleanup=new FinalizationRegistry<{root:string;ref:WeakRef<VerifiedLedger>}>(entry=>{const set=weakRoots.get(entry.root);set?.delete(entry.ref);if(!set?.size)weakRoots.delete(entry.root);});
export function cachedLedger(root:string){const strong=verified.get(root);if(strong)return strong;const refs=weakRoots.get(root);for(const ref of refs??[]){const s=ref.deref();if(s)return s;refs?.delete(ref);}if(!refs?.size)weakRoots.delete(root);}
function remember(s:VerifiedLedger){const root=s.manifest.checksum;if(!proofRefs.has(s)){const ref=new WeakRef(s);proofRefs.set(s,ref);const set=weakRoots.get(root)??new Set();set.add(ref);weakRoots.set(root,set);cleanup.register(s,{root,ref});}verified.delete(root);verified.set(root,s);while(verified.size>4)verified.delete(verified.keys().next().value!);return s;}
/** Immutable, version-specific proof. Only prepare/verify below can create one.
 * The cache accelerates resolution; storage load always verifies persisted bytes
 * and its Authority binding, never uses this cache as proof of a committed head. */
export class VerifiedLedger {
 readonly issuers:readonly string[];readonly count:number;readonly maxRevision:number;
 constructor(token:unknown,readonly history:LedgerCandidate,readonly results:readonly ResultSegment[],readonly manifest:LedgerManifest,private index:Node<OriginalResult>|undefined,private chunks:readonly (readonly string[])[],private ends:readonly number[],issuers?:ReadonlySet<string>){
  if(token!==proofKey)throw Error('帳本證明必須經過完整驗證。');proofs.add(this);this.results=Object.freeze([...results]);this.chunks=Object.freeze(chunks.map(c=>Object.freeze(c)));this.ends=Object.freeze([...ends]);
  this.issuers=Object.freeze([...(issuers??new Set(history.segments.flatMap(s=>s.events.map((e:any)=>e.receipt.issuerId as string))))]);this.count=history.manifest.recordCount;this.maxRevision=history.manifest.worldRevision;Object.freeze(this);
 }
 receipt(id:string){return this.history.lookup(this.manifest.campaignId,id);}
 result(id:string){return get(this.index,id);}
 at(i:number):CommandReceipt|undefined{if(i<0||i>=this.count)return;let lo=0,hi=this.ends.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(i<this.ends[mid])hi=mid;else lo=mid+1;}return this.receipt(this.chunks[lo][i-(lo?this.ends[lo-1]:0)]) as CommandReceipt;}
 archive():LedgerArchive{return {manifest:structuredClone(this.manifest),history:this.history.archive(),results:structuredClone(this.results) as ResultSegment[]};}
 nextIndex(records:OriginalResult[]){let n=this.index;for(const r of records)n=put(n,r.commandId,r);return n;}
 nextOrder(history:LedgerCandidate){const chunks=this.chunks.slice(),ends=this.ends.slice();let total=this.count;for(const s of history.segments.slice(this.history.segments.length)){const ids=s.events.filter((e:any)=>e.kind==='identity').map((e:any)=>e.receipt.commandId as string);if(ids.length){chunks.push(Object.freeze(ids));ends.push(total+=ids.length);}}return {chunks,ends};}
}
export function resolveLedger(state:LedgerState):VerifiedLedger{
 const a=state.anchor,s=cachedLedger(a.root);if(!s)throw Error('帳本版本尚未驗證，請重新載入。');const m=s.manifest;
 if(state.format!==1||a.campaignId!==m.campaignId||a.worldRevision!==m.worldRevision||a.authorityRevision!==m.worldRevision||a.branch!==m.branch||a.writerEpoch!==m.writerEpoch||a.checkpoint!==m.checksum)throw Error('Verified Snapshot 版本綁定不符。');return s;
}
export function useLedgerProof(s:VerifiedLedger){if(!proofs.has(s))throw Error('無效帳本證明。');remember(s);}
export function worldLedger(w:FormalWorld){if(!w.ledger)throw Error('世界缺少帳本版本。');const bound=bindings.get(w);if(bound?.manifest.checksum===w.ledger.anchor.root)useLedgerProof(bound);return resolveLedger(w.ledger);}
export function anchor(s:VerifiedLedger):LedgerAnchor{const m=s.manifest;return {root:m.checksum,campaignId:m.campaignId,worldRevision:m.worldRevision,authorityRevision:m.worldRevision,branch:m.branch,writerEpoch:m.writerEpoch,checkpoint:m.checksum};}
export function bindLedger(w:FormalWorld,s:VerifiedLedger,pending:CommandReceipt[]=[],outcomes:OriginalResult[]=[]):FormalWorld{
 if(!proofs.has(s))throw Error('無效帳本證明。');remember(s);bindings.set(w,s);w.ledger={format:1,anchor:anchor(s),pending,outcomes};delete (w as Partial<FormalWorld>).commandReceipts;
 Object.defineProperty(w,'commandReceipts',{configurable:true,enumerable:false,get:()=>commandHistory(w)});return w;
}
const views=new WeakSet<object>();
export const isHistoryView=(v:unknown)=>!!v&&typeof v==='object'&&views.has(v);
export function commandHistory(w:FormalWorld):CommandReceipt[]{
 if(!w.ledger)return w.commandReceipts;
 const s=worldLedger(w),tail=w.ledger.pending;
 const view=new Proxy([] as CommandReceipt[],{get(_t,key){
  if(key==='length')return s.count+tail.length;
  if(key===Symbol.iterator)return function*(){for(let i=0;i<s.count;i++)yield s.at(i)!;yield*tail;};
  if(key==='push')return (...rows:CommandReceipt[])=>{for(const r of rows){if(s.result(r.commandId)||s.receipt(r.commandId)||tail.some(t=>t.commandId===r.commandId))throw Error('Duplicate ledger receipt');if(w.ledger!.outcomes)w.ledger!.outcomes=w.ledger!.outcomes.filter(o=>o.commandId!==r.commandId);tail.push(r);}return s.count+tail.length;};
  if(key==='slice')return (start=0,end=s.count+tail.length)=>Array.from(view).slice(start,end);
  if(typeof key==='string'&&/^\d+$/.test(key)){const i=Number(key);return i<s.count?s.at(i):tail[i-s.count];}
  if(key==='toJSON')return ()=>Array.from(view);
  return Reflect.get(Array.prototype,key);
 },has(_t,key){return typeof key==='string'&&/^\d+$/.test(key)?Number(key)<s.count+tail.length:key in Array.prototype;},ownKeys(){return [...Array.from({length:s.count+tail.length},(_,i)=>String(i)),'length'];},getOwnPropertyDescriptor(_t,key){if(key==='length')return {value:s.count+tail.length,writable:true,enumerable:false,configurable:false};if(typeof key==='string'&&/^\d+$/.test(key)&&Number(key)<s.count+tail.length)return {value:Number(key)<s.count?s.at(Number(key)):tail[Number(key)-s.count],enumerable:true,configurable:true,writable:false};},set(){throw Error('正式帳本歷史不可原地改寫。');}});views.add(view);return view;
}
export function copyHistory(source:FormalWorld,target:FormalWorld){if(source.ledger)bindLedger(target,worldLedger(source),source.ledger.pending.map(r=>({...r})),structuredClone(source.ledger.outcomes??[]));else target.commandReceipts=source.commandReceipts.map(r=>({...r}));return target;}
export function pendingHistory(w:FormalWorld){return w.ledger?w.ledger.pending:w.commandReceipts;}
export function findReceipt(w:FormalWorld,id:string):CommandReceipt|undefined{return w.ledger?w.ledger.pending.find(r=>r.commandId===id)??worldLedger(w).receipt(id) as CommandReceipt|undefined:w.commandReceipts.find(r=>r.commandId===id);}
export function originalResult(w:FormalWorld,id:string){return w.ledger?worldLedger(w).result(id):undefined;}
export function recordOriginalRejection(w:FormalWorld,order:FormalOrder,ack:CommandAck){if(!w.ledger||ack.status!=='rejected'||originalResult(w,order.commandId)||findReceipt(w,order.commandId)||w.ledger.outcomes?.some(r=>r.commandId===order.commandId))return;const r:OriginalResult={commandId:order.commandId,issuerId:order.issuerId,fingerprint:canonicalJSON({campaignId:order.campaignId,issuerId:order.issuerId,payload:order.payload}),state:ack.requiresConfirmation||ack.reason?.includes('重新確認')?'needs-confirmation':'rejected',ack:{...structuredClone(ack),...(ack.requiresConfirmation||ack.reason?.includes('重新確認')?{requiresConfirmation:true as const}:{})},order:structuredClone(order)};(w.ledger.outcomes??=[]).push(r);}
export function normalizeOutcomeRevisions(w:FormalWorld){for(const r of w.ledger?.outcomes??[])r.ack.revision=w.revision;}
export function receiptIndex(w:FormalWorld){return {get:(id:string)=>findReceipt(w,id),has:(id:string)=>!!findReceipt(w,id)};}
export function hotWorld(w:FormalWorld){const out={...w};if(w.ledger)delete (out as Partial<FormalWorld>).commandReceipts;return out;}
export function projectWorld(w:FormalWorld){if(!w.ledger)return w;const out={...w,commandReceipts:Array.from(commandHistory(w))};delete out.ledger;return out;}

export async function emptyVerifiedLedger(campaignId:string){const history=await emptyLedger(campaignId),body={format:1 as const,campaignId,version:0,worldRevision:0,branch:0,writerEpoch:0,branchRevision:0,orderPrefix:0,historyRoot:history.manifest.checksum,resultRoot:zero,resultSegments:0};return remember(new VerifiedLedger(proofKey,history,[],frozen({...body,checksum:await digest(body)}),undefined,[],[]));}
export async function prepareVerifiedLedger(base:VerifiedLedger,receipts:readonly CommandReceipt[],results:OriginalResult[],worldRevision:number,branch:number,writerEpoch:number){
 if(!proofs.has(base))throw Error('無效帳本基準。');
 const history=await prepareLedger(base.history,receipts,{worldRevision,branch,writerEpoch,recovery:branch!==base.manifest.branch});
 const fresh:OriginalResult[]=[],seen=new Map<string,OriginalResult>();for(const raw of results){const r=frozen(structuredClone(raw)),old=base.result(r.commandId)??seen.get(r.commandId);validateOriginal(r,history,worldRevision);if(old){if(canonicalJSON(old)!==canonicalJSON(r))throw Error('不可覆寫原始命令結果。');}else{seen.set(r.commandId,r);fresh.push(r);}}
 const segments=base.results.slice();let root=base.manifest.resultRoot;for(let i=0;i<fresh.length;i+=128){const body={campaignId:base.manifest.campaignId,sequence:segments.length+1,previous:root,records:fresh.slice(i,i+128)},s=frozen({...body,checksum:await digest(body)});segments.push(s);root=s.checksum;}
 const body={format:1 as const,campaignId:base.manifest.campaignId,version:base.manifest.version+1,worldRevision,branch,writerEpoch,branchRevision:branch!==base.manifest.branch?worldRevision:base.manifest.branchRevision,orderPrefix:branch!==base.manifest.branch?history.manifest.recordCount:base.manifest.orderPrefix,historyRoot:history.manifest.checksum,resultRoot:root,resultSegments:segments.length};let order=base.nextOrder(history);if(branch!==base.manifest.branch){const ids=order.chunks.flat().sort();order={chunks:[ids],ends:[ids.length]};}return remember(new VerifiedLedger(proofKey,history,segments,frozen({...body,checksum:await digest(body)}),base.nextIndex(fresh),order.chunks,order.ends,new Set([...base.issuers,...receipts.map(r=>r.issuerId)])));
}
export async function verifyLedgerArchive(value:LedgerArchive):Promise<VerifiedLedger>{
 if(!value||Object.keys(value).sort().join(',')!=='history,manifest,results'||!value.manifest||!Array.isArray(value.results))throw Error('帳本封裝損毀。');
 const m=value.manifest,{checksum,...body}=m;if(m.format!==1||Object.keys(m).sort().join(',')!=='branch,branchRevision,campaignId,checksum,format,historyRoot,orderPrefix,resultRoot,resultSegments,version,worldRevision,writerEpoch'||await digest(body)!==checksum)throw Error('帳本 Manifest 損毀。');
 for(const n of [m.version,m.worldRevision,m.branch,m.writerEpoch,m.resultSegments,m.orderPrefix,m.branchRevision])if(!Number.isSafeInteger(n)||n<0)throw Error('帳本版本無效。');
 const history=await verifyLedger(value.history);if(history.manifest.campaignId!==m.campaignId||history.manifest.checksum!==m.historyRoot||history.manifest.worldRevision>m.worldRevision||value.results.length!==m.resultSegments)throw Error('帳本參照不完整。');
 const ownedResults=structuredClone(value.results);let index:Node<OriginalResult>|undefined,root=zero;for(let i=0;i<ownedResults.length;i++){const s=ownedResults[i],{checksum:sum,...b}=s;if(Object.keys(s).sort().join(',')!=='campaignId,checksum,previous,records,sequence'||s.campaignId!==m.campaignId||s.sequence!==i+1||s.previous!==root||!Array.isArray(s.records)||!s.records.length||s.records.length>128||await digest(b)!==sum)throw Error('結果區段損毀。');for(const r of s.records){validateOriginal(r,history,m.worldRevision);if(get(index,r.commandId)||!/^command:[A-Za-z0-9_.-]{1,100}$/.test(r.commandId)||!/^faction:[A-Za-z0-9_.-]{1,100}$/.test(r.issuerId)||!r.fingerprint||r.ack.commandId!==r.commandId||!['committed','rejected','needs-confirmation'].includes(r.state)||!Number.isSafeInteger(r.ack.revision)||r.ack.revision<0||r.ack.revision>m.worldRevision||!['committed','duplicate','rejected','rolled-back'].includes(r.ack.status))throw Error('原始命令結果無效。');const receipt=history.lookup(m.campaignId,r.commandId);if(receipt&&(receipt.issuerId!==r.issuerId||receipt.fingerprint!==r.fingerprint))throw Error('結果身份衝突。');index=put(index,r.commandId,frozen(r));}root=sum;}
 if(root!==m.resultRoot)throw Error('結果 Manifest 不完整。');
 const chunks:string[][]=[],ends:number[]=[];let count=0;for(const s of history.segments){const ids=s.events.filter((e:any)=>e.kind==='identity').map((e:any)=>e.receipt.commandId as string);if(ids.length){chunks.push(ids);ends.push(count+=ids.length);}}
 if(m.branchRevision>m.worldRevision)throw Error('分支版本超出世界。');
 if(m.orderPrefix>count)throw Error('歷史排序前綴不完整。');if(m.orderPrefix){const ids=chunks.flat(),prefix=ids.slice(0,m.orderPrefix).sort();chunks.splice(0,chunks.length,[...prefix,...ids.slice(m.orderPrefix)]);ends.splice(0,ends.length,count);}
 for(const s of history.segments)for(const e of s.events)if(e.kind==='identity'&&!get(index,e.receipt.commandId))throw Error('收據缺少原始結果。');
 return remember(new VerifiedLedger(proofKey,history,frozen(ownedResults),frozen(structuredClone(m)),index,chunks,ends));
}
