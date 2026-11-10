import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {afterEach,expect,it,vi} from 'vitest';
import {createFormalFixture} from './fixture';
import {digest} from './canonical';
let store:import('../persistence').FormalPersistence|undefined,legacy:Dexie|undefined;
afterEach(async()=>{await legacy?.delete();legacy=undefined;await store?.db.delete();store=undefined;vi.unstubAllGlobals();vi.restoreAllMocks();});
it.each([false,true])('incompatible activity reports actual historical backup availability (%s)',async historical=>{
 vi.resetModules();vi.stubGlobal('setInterval',vi.fn());
 const {FormalPersistence}=await import('../persistence');store=new FormalPersistence();await store.acquireWriter();await store.start(createFormalFixture());
 const row=await store.db.saves.get('current');if(row?.kind!=='world')throw Error('fixture');
 Object.assign(row.data.snapshot.metadata,{contentVersion:'older-worker-test-content'});row.data.metadata={...row.data.snapshot.metadata};row.data.checksum=await digest(row.data.snapshot);
 const authority=await store.db.saves.get('authority') as any;authority.worldChecksum=row.data.checksum;const {checksum:_,...body}=authority;authority.checksum=await digest(body);await store.db.saves.bulkPut([row,authority]);
 if(historical){legacy=new Dexie('lieguo-formal-ledger-v1');legacy.version(1).stores({saves:'id'});await legacy.table('saves').put({id:'current',data:{syntheticArchive:true}});}
 const messages:any[]=[],port={postMessage:(message:any)=>messages.push(structuredClone(message)),onmessage:null as null|((e:{data:unknown})=>void)};vi.stubGlobal('self',port);
 await import('../runtime.worker');port.onmessage!({data:{type:'load',stateMode:'projection-v2'}});
 await vi.waitFor(()=>expect(messages.some(m=>m.type==='error'&&m.incompatibleStartToken)).toBe(true));
 const response=messages.find(m=>m.type==='error');expect(response.legacyAvailable).toBe(historical);expect(await store.db.saves.get('current')).toEqual(row);
});
