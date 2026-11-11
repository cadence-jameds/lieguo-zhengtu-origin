import {existingDatabase} from './campaignStorage';
import {FORMAL_DB_NAME,FORMAL_WRITER_LOCK,LEGACY_FORMAL_DB_NAME,RETIRED_FORMAL_DB_NAME} from './formal/versions';

/** Explicit game-owned namespaces only. Never enumerate-and-delete an origin. */
export const campaignDatabases=[
 {name:FORMAL_DB_NAME,label:'現行正式戰役',scope:'活動戰役、回復點、戰報、Durable Inbox、近期結果與防重播資料'},
 {name:'lieguo-formal-ledger-v1',label:'已退役命令帳本戰役',scope:'此舊版戰役的全部資料'},
 {name:RETIRED_FORMAL_DB_NAME,label:'已退役正式戰役',scope:'此舊版戰役的全部資料'},
 {name:LEGACY_FORMAL_DB_NAME,label:'早期正式戰役',scope:'此舊版戰役的全部資料'},
 {name:'guozhan-river-valley-v027',label:'舊版河谷戰役',scope:'此舊版戰役的全部資料'},
 {name:'guozhan-river-valley-v020',label:'早期河谷戰役',scope:'此舊版戰役的全部資料'},
] as const;
export type StorageEntry={name:string;label:string;scope:string;state:'present'|'absent'|'unreadable';tables?:Record<string,number>;error?:string};
export type DeleteResult={name:string;state:'deleted'|'absent'|'failed'|'uncertain'|'not-attempted';text:string};
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
function allowed(names:readonly string[]){if(!names.length||new Set(names).size!==names.length||names.some(n=>!campaignDatabases.some(d=>d.name===n)))throw Error('請明確選擇本遊戲清單中的戰役資料庫。');}
function request<T>(r:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??Error('無法讀取資料庫。'));});}
function boundedRead<T>(work:Promise<T>,tx:IDBTransaction|undefined){let timer:ReturnType<typeof setTimeout>;return Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{try{tx?.abort();}catch{/* already finished */}reject(Error('讀取資料庫逾時；原資料保留，請關閉其他分頁後重試。'));},8000);})]).finally(()=>clearTimeout(timer));}
export async function inspectLocalCampaigns():Promise<StorageEntry[]>{
 return Promise.all(campaignDatabases.map(async d=>{let db:IDBDatabase|undefined;try{
  db=await existingDatabase(d.name);if(!db)return {...d,state:'absent' as const};
  const names=Array.from(db.objectStoreNames),tx=names.length?db.transaction(names,'readonly'):undefined;
  const tables=Object.fromEntries(await boundedRead(Promise.all(names.map(async n=>[n,await request(tx!.objectStore(n).count())])),tx));
  return {...d,state:'present' as const,tables};
 }catch(e){return {...d,state:'unreadable' as const,error:message(e)};}finally{db?.close();}}));
}
/** A raw archive is not an importable/validated game save. No writes or migration. */
export async function exportSelectedCampaigns(names:readonly string[]){
 allowed(names);const databases:Record<string,Record<string,unknown[]>>={};
 for(const name of names){const db=await existingDatabase(name);if(!db)continue;
  try{const stores=Array.from(db.objectStoreNames),tx=stores.length?db.transaction(stores,'readonly'):undefined;databases[name]=Object.fromEntries(await boundedRead(Promise.all(stores.map(async n=>[n,await request(tx!.objectStore(n).getAll())])),tx));}finally{db.close();}
 }
 const text=JSON.stringify({format:'lieguo-recovery-archive-v1',databases});if(new TextEncoder().encode(text).length>100*1024*1024)throw Error('原始備份超過 100 MiB，原資料保留。');return text;
}
/** A canceled version upgrade is a non-destructive exclusive-connection probe.
 * If blocked, no delete request has been issued. Late upgrades ALWAYS abort. */
function exclusiveProbe(name:string,version:number){return new Promise<void>((resolve,reject)=>{
 let ended=false,exclusive=false;const finish=(error?:Error)=>{if(ended)return;ended=true;clearTimeout(timer);error?reject(error):resolve();};
 const timer=setTimeout(()=>finish(Error('資料庫連線檢查逾時；未執行刪除，請關閉其他遊戲分頁。')),8000);
 const r=indexedDB.open(name,version+1);
 r.onupgradeneeded=()=>{exclusive=true;r.transaction!.abort();};
 r.onsuccess=()=>{r.result.close();finish(Error('未能安全取得資料庫獨占連線，未執行刪除。'));};
 r.onblocked=()=>finish(Error('IndexedDB 連線被其他分頁占用（blocked）；未執行刪除，請關閉其他遊戲分頁。'));
 r.onerror=e=>{e.preventDefault();finish(exclusive&&r.error?.name==='AbortError'?undefined:r.error??Error('無法檢查資料庫連線。'));};
});}
async function deleteOne(name:string):Promise<DeleteResult>{
 let db:IDBDatabase|undefined,unreadable=false;
 try{db=await existingDatabase(name);}catch(e){
  // A blocked/timed-out read may still own a queued request: never enqueue a
  // destructive request behind it. Other read failures may be purged ONLY by
  // this user-confirmed path, after both writer locks have been acquired.
  if(/逾時|正在使用|blocked/.test(message(e)))throw e;
  unreadable=true;
 }
 if(!db&&!unreadable)return {name,state:'absent',text:'資料庫已不存在。'};
 if(db){const version=db.version;db.close();await exclusiveProbe(name,version);}
 const result=await new Promise<DeleteResult>((resolve)=>{
  let ended=false;const finish=(state:DeleteResult['state'],text:string)=>{if(ended)return;ended=true;clearTimeout(timer);resolve({name,state,text});};
  const timer=setTimeout(()=>finish('uncertain','刪除結果尚未確認；已停止後續項目，請關閉其他遊戲分頁後重新檢查。'),8000);
  const r=indexedDB.deleteDatabase(name);
  r.onsuccess=()=>finish('deleted','已刪除指定資料庫。');
  r.onerror=()=>finish('failed',r.error?.message??'刪除失敗，未確認完成。');
  // Native delete requests cannot be canceled. Do not falsely promise rollback
  // or restart the engine while an unexpected late blocker leaves it uncertain.
  r.onblocked=()=>finish('uncertain','刪除請求受到 blocked 阻擋；可能仍在等待連線，已停止後續項目。請關閉其他分頁後重新檢查。');
 });
 if(result.state==='deleted'){const remaining=await existingDatabase(name);if(remaining){remaining.close();return {name,state:'uncertain',text:'刪除後仍發現資料庫，請重新檢查；未宣稱完成。'};}}
 return result;
}
export async function deleteLocalCampaigns(names:readonly string[],confirmed:boolean,locks:LockManager):Promise<DeleteResult[]>{
 allowed(names);if(confirmed!==true)throw Error('尚未明確確認刪除；所有資料保留。');if(!locks)throw Error('瀏覽器不支援安全寫入鎖定，已停止刪除。');
 // New/retired Formal writers share one lock; pre-Formal pages use the second.
 const lockNames=[FORMAL_WRITER_LOCK,'guozhan-river-valley-v020-writer'];
 const acquire=async(i:number):Promise<DeleteResult[]>=>i<lockNames.length?locks.request(lockNames[i],{ifAvailable:true},async lock=>{
  if(!lock)throw Error('另一分頁持有戰役 Writer Lock，已停止刪除；請先關閉該分頁。');return acquire(i+1);
 }):remove();
 const remove=async()=>{const results:DeleteResult[]=[];let stopped=false;for(const name of names){
  if(stopped){results.push({name,state:'not-attempted',text:'前一項未完成，未執行此項。'});continue;}
  try{const result=await deleteOne(name);results.push(result);stopped=!['deleted','absent'].includes(result.state);}catch(e){results.push({name,state:'failed',text:message(e)});stopped=true;}
 }return results;};
 return acquire(0);
}
