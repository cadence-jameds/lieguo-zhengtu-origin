import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {campaignDatabases,campaignWriterLocks,deleteLocalCampaigns,exportSelectedCampaigns,inspectLocalCampaigns} from './storageRecovery';
import {FORMAL_DB_NAME} from './formal/versions';
const locks=(held='')=>({request:async(name:string,_options:unknown,run:(lock:unknown)=>Promise<unknown>)=>run(name===held?null:{name})}) as LockManager;
const seed=(name:string)=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('saves','readwrite');t.objectStore('saves').put({synthetic:true},'current');t.oncomplete=()=>resolve(db);};});
const read=(name:string)=>new Promise<unknown>((resolve,reject)=>{const r=indexedDB.open(name);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,t=d.transaction('saves','readonly'),q=t.objectStore('saves').get('current');q.onsuccess=()=>{d.close();resolve(q.result);};};});
afterEach(async()=>{vi.restoreAllMocks();for(const {name} of await indexedDB.databases())if(name)await new Promise<void>(r=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=()=>r();});});
it('inventory is read only, includes known namespaces, and never adopts unknown databases',async()=>{
 const unknown=await seed('unrelated-origin-application');unknown.close();const before=await indexedDB.databases(),remove=vi.spyOn(indexedDB,'deleteDatabase');
 const rows=await inspectLocalCampaigns();expect(rows.map(r=>r.name)).toEqual(campaignDatabases.map(r=>r.name));expect(rows.every(r=>r.state==='absent')).toBe(true);expect(remove).not.toHaveBeenCalled();expect(await indexedDB.databases()).toEqual(before);
 await expect(deleteLocalCampaigns(['unrelated-origin-application'],true,locks())).rejects.toThrow('清單');expect(await read('unrelated-origin-application')).toEqual({synthetic:true});
});
it('requires explicit consent, and deletes only selected data after optionally exporting it',async()=>{
 for(const n of [FORMAL_DB_NAME,'lieguo-formal-ledger-v1']){const db=await seed(n);db.close();}
 await expect(deleteLocalCampaigns([FORMAL_DB_NAME],false,locks())).rejects.toThrow('確認');expect(await read(FORMAL_DB_NAME)).toEqual({synthetic:true});
 const archive=JSON.parse(await exportSelectedCampaigns([FORMAL_DB_NAME]));expect(Object.keys(archive.databases)).toEqual([FORMAL_DB_NAME]);
 const outcome=await deleteLocalCampaigns(['lieguo-formal-ledger-v1'],true,locks());expect(outcome[0].state).toBe('deleted');expect(await read(FORMAL_DB_NAME)).toEqual({synthetic:true});expect((await indexedDB.databases()).some(d=>d.name==='lieguo-formal-ledger-v1')).toBe(false);
});
it.each(campaignWriterLocks)('writer lock %s prevents every deletion',async held=>{
 const db=await seed(FORMAL_DB_NAME);db.close();const remove=vi.spyOn(indexedDB,'deleteDatabase');await expect(deleteLocalCampaigns([FORMAL_DB_NAME],true,locks(held))).rejects.toThrow('Writer Lock');expect(remove).not.toHaveBeenCalled();expect(await read(FORMAL_DB_NAME)).toEqual({synthetic:true});
});
it('blocked exclusive probe issues no destructive request, including after the blocker later closes',async()=>{
 const blocker=await seed(FORMAL_DB_NAME);blocker.onversionchange=()=>{};const remove=vi.spyOn(indexedDB,'deleteDatabase');
 const results=await deleteLocalCampaigns([FORMAL_DB_NAME],true,locks());expect(results[0].state).toBe('failed');expect(results[0].text).toContain('blocked');expect(remove).not.toHaveBeenCalled();blocker.close();await new Promise(r=>setTimeout(r,20));expect(await read(FORMAL_DB_NAME)).toEqual({synthetic:true});
});
it('explicit confirmed cleanup can remove an unreadable known DB, without treating it as an empty campaign',async()=>{
 const db=await seed(FORMAL_DB_NAME);db.close();vi.spyOn(indexedDB,'open').mockImplementationOnce(()=>{throw new DOMException('injected unreadable database','UnknownError');});
 const results=await deleteLocalCampaigns([FORMAL_DB_NAME],true,locks());expect(results[0].state).toBe('deleted');expect((await indexedDB.databases()).some(d=>d.name===FORMAL_DB_NAME)).toBe(false);
});
it('partial failure is reported and remaining databases are not attempted',async()=>{
 const names=[FORMAL_DB_NAME,'lieguo-formal-ledger-v1','lieguo-formal-stage2-time2'];for(const n of names){const db=await seed(n);db.close();}
 const original=indexedDB.deleteDatabase.bind(indexedDB);vi.spyOn(indexedDB,'deleteDatabase').mockImplementation(name=>{if(name!==names[1])return original(name);const q={error:new DOMException('injected quota','QuotaExceededError'),onerror:null as null|(()=>void)};queueMicrotask(()=>q.onerror?.());return q as unknown as IDBOpenDBRequest;});
 const out=await deleteLocalCampaigns(names,true,locks());expect(out.map(r=>r.state)).toEqual(['deleted','failed','not-attempted']);expect(await read(names[1])).toEqual({synthetic:true});expect(await read(names[2])).toEqual({synthetic:true});
});
