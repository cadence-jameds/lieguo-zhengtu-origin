import Dexie from 'dexie';
import {FORMAL_DB_NAME} from './formal/versions';
import {metadataSchema} from './formal/schema';
export type StoredCampaignStatus='empty'|'stored'|'incompatible';
// The second name is the historical production namespace. When UX-1 changes
// FORMAL_DB_NAME, old rows must still prevent a false empty confirmation.
const databaseNames=()=>[...new Set([FORMAL_DB_NAME,'lieguo-formal-stage2-schema1'])];
async function withExisting<T>(name:string,read:(db:Dexie)=>Promise<T>):Promise<T|undefined>{
 if(!await Dexie.exists(name))return;
 const db=new Dexie(name);try{await db.open();return await db.transaction('r',db.tables,()=>read(db));}finally{db.close();}
}
/** Read only, including backups/reports/authority. No load, repair or migration. */
export async function inspectCampaignStorage():Promise<StoredCampaignStatus>{
 let stored=false,incompatible=false;
 for(const name of databaseNames())await withExisting(name,async db=>{
  for(const table of db.tables)if(await table.count())stored=true;
  if(db.tables.some(t=>t.name==='saves')){const row=await db.table('saves').get('current'),metadata=row?.kind==='world'?row.data?.metadata:undefined;
   if(metadata&&typeof metadata.contentVersion==='string'&&!metadataSchema.safeParse(metadata).success)incompatible=true;
  }
 });
 return incompatible?'incompatible':stored?'stored':'empty';
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
