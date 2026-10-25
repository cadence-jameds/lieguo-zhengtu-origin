import {FORMAL_DB_NAME} from './formal/versions';
import {metadataSchema} from './formal/schema';
export type StoredCampaignStatus='empty'|'stored'|'incompatible'|'historical';
// Only the approved time2 namespace isolates schema1 as a read-only archive.
// On main schema1 is still writable: its rows must NEVER take this path.
const historicalName='lieguo-formal-stage2-schema1';
const hasArchiveBoundary=()=>String(FORMAL_DB_NAME)==='lieguo-formal-stage2-time2';
const databaseNames=()=>[...new Set([FORMAL_DB_NAME,'lieguo-formal-stage2-schema1'])];
function storageDeadline<T>(operation:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;return Promise.race([operation,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('讀取本機資料逾時，原始資料保留。')),8000);})]).finally(()=>clearTimeout(timer));}
type StoredRow={kind?:string;data?:{metadata?:Record<string,unknown>}};
function idbRequest<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('無法讀取本機資料，原始資料保留。'));});}
/** Dexie.exists() probes a missing DB via open/abort/deleteDatabase. This path
 * must remain strictly read only, including browsers without databases(). */
async function existingDatabase(name:string):Promise<IDBDatabase|undefined>{
 if(typeof indexedDB.databases==='function'&&!(await storageDeadline(indexedDB.databases())).some(db=>db.name===name))return;
 return new Promise((resolve,reject)=>{
  let ended=false,absent=false;const finish=(db?:IDBDatabase,error?:Error)=>{if(ended){db?.close();return;}ended=true;clearTimeout(timer);error?reject(error):resolve(db);};
  const timer=setTimeout(()=>finish(undefined,Error('讀取本機資料逾時，原始資料保留。')),8000);let request:IDBOpenDBRequest;try{request=indexedDB.open(name);}catch(error){finish(undefined,error instanceof Error?error:Error('無法讀取本機資料，原始資料保留。'));return;}
  request.onupgradeneeded=()=>{absent=true;request.transaction?.abort();}; // abort leaves an absent namespace absent
  request.onsuccess=()=>finish(request.result);
  request.onerror=event=>{event.preventDefault();finish(undefined,absent?undefined:Error('無法讀取本機資料，原始資料保留。'));};
  request.onblocked=()=>finish(undefined,Error('本機資料正在使用中，請稍後重試；原始資料保留。'));
 });
}
async function withExisting<T>(name:string,read:(db:DatabaseReader)=>Promise<T>):Promise<T|undefined>{
 const connection=await existingDatabase(name);if(!connection)return;
 const names=Array.from(connection.objectStoreNames);if(!names.length){connection.close();return;}
 const transaction=connection.transaction(names,'readonly');
 const table=(name:string)=>{const store=transaction.objectStore(name);return {name,count:()=>idbRequest(store.count()),toArray:()=>idbRequest<unknown[]>(store.getAll()),get:(key:IDBValidKey)=>idbRequest<StoredRow|undefined>(store.get(key))};};
 try{return await storageDeadline(read({tables:names.map(table),table}));}
 finally{connection.close();}
}
type DatabaseReader={tables:{name:string;count:()=>Promise<number>;toArray:()=>Promise<unknown[]>}[];table:(name:string)=>{get:(key:IDBValidKey)=>Promise<StoredRow|undefined>}};
/** Read only, including backups/reports/authority. No load, repair or migration. */
export async function inspectCampaignStorage():Promise<StoredCampaignStatus>{
 let stored=false,incompatible=false,historical=false;
 for(const name of databaseNames())await withExisting(name,async db=>{
  let hasRows=false;for(const table of db.tables)if(await table.count())hasRows=true;
  if(name===historicalName&&name!==String(FORMAL_DB_NAME)&&hasArchiveBoundary()){
   historical ||= hasRows;return;
  }
  stored ||= hasRows;
  if(db.tables.some(t=>t.name==='saves')){const row=await db.table('saves').get('current'),metadata=row?.kind==='world'?row.data?.metadata:undefined;
   if(metadata&&typeof metadata.contentVersion==='string'&&!metadataSchema.safeParse(metadata).success)incompatible=true;
  }
 });
 return incompatible?'incompatible':stored?'stored':historical?'historical':'empty';
}
/** A historical archive is deliberately not an importable world envelope. */
export async function exportCampaignArchive():Promise<string>{
 const databases:Record<string,Record<string,unknown[]>>={};
 for(const name of databaseNames())await withExisting(name,async db=>{const tables:Record<string,unknown[]>={};for(const t of db.tables)tables[t.name]=await t.toArray();if(Object.values(tables).some(rows=>rows.length))databases[name]=tables;});
 if(!Object.keys(databases).length)throw new UpdateArchiveError('沒有可匯出的本機戰役資料。');
 const text=JSON.stringify({format:'lieguo-recovery-archive-v1',databases});
 if(new TextEncoder().encode(text).length>100*1024*1024)throw new UpdateArchiveError('原始備份超過100 MiB，原始資料仍保留。');
 return text;
}
class UpdateArchiveError extends Error{}
