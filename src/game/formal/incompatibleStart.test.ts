import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {createFormalFixture} from './fixture';
import {digest} from './canonical';
import {submitFormalOrder} from './reducer';
import {OLD_CAMPAIGN_MESSAGE} from './saveCodec';
import {receiveDurableFixture} from './durableIdentityTestSupport';
import {order} from './testSupport';
const stores:FormalPersistence[]=[];
const make=()=>{let fail:FailurePoint|undefined;const p=new FormalPersistence({suffix:'new-game-'+crypto.randomUUID(),fault:q=>{if(q===fail)throw new DOMException('injected','QuotaExceededError');}});stores.push(p);return{p,setFault:(q?:FailurePoint)=>{fail=q;}};};
const rows=(p:FormalPersistence)=>Promise.all(p.db.tables.map(async t=>[t.name,await t.toArray()]));
const fresh=()=>{const w=createFormalFixture({campaign:'new-'+crypto.randomUUID()});return submitFormalOrder(w,order(w,'new-rename',{type:'city.rename',cityId:w.cities[0].id,name:'新戰役'})).world;};
async function unsupported(p:FormalPersistence){
 const r=await p.db.saves.get('current');if(r?.kind!=='world')throw Error('fixture');
 // A real, self-consistent older envelope in the current namespace. No fake
 // load success: the ordinary loader must reject this exact stored version.
 Object.assign(r.data.snapshot.metadata,{contentVersion:'older-test-content'});
 r.data.metadata={...r.data.snapshot.metadata};r.data.checksum=await digest(r.data.snapshot);
 const a=await p.db.saves.get('authority') as any;a.worldChecksum=r.data.checksum;const {checksum:_,...body}=a;a.checksum=await digest(body);
 await p.db.saves.bulkPut([r,a]);
}
async function prepared(){const {p,setFault}=make();await p.acquireWriter();const w=await p.start(createFormalFixture());await unsupported(p);return{p,w,setFault};}
afterEach(async()=>{for(const p of stores.splice(0))await p.db.delete();});
it('explicit incompatible activity can start without backup and reload the new format',async()=>{
 const {p,w}=await prepared();await expect(p.loadSave()).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);
 const token=await p.incompatibleStartToken();expect(token).toMatch(/^[a-f0-9]{64}$/);
 const next=await p.start(fresh(),token);expect(next.campaignId).not.toBe(w.campaignId);expect((await p.loadSave()).game?.campaignId).toBe(next.campaignId);
 expect((await p.db.backups.toArray()).every(r=>r.campaignId===next.campaignId)).toBe(true);expect(await p.backupList()).toHaveLength(1);
 const quick=await p.exportStoredSave('quick');expect(JSON.parse(quick).snapshot.campaignId).toBe(next.campaignId);
});
it('reading a consent token then cancelling is read-only; an unconfirmed start cannot replace old activity',async()=>{
 const {p}=await prepared(),before=await rows(p);await p.incompatibleStartToken();expect(await rows(p)).toEqual(before);
 await expect(p.start(fresh())).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(await rows(p)).toEqual(before);
});
it('a new writer fences an old consent token and the old writer',async()=>{
 const {p}=await prepared(),token=await p.incompatibleStartToken(),other=new FormalPersistence({suffix:p.db.name.slice('lieguo-formal-bounded-v1-'.length)});stores.push(other);await other.acquireWriter();const before=await rows(p);
 await expect(p.start(fresh(),token)).rejects.toThrow();await expect(other.start(fresh(),token)).rejects.toThrow();expect(await rows(p)).toEqual(before);
});
it.each(['world','authority','index'] as const)('%s corruption never becomes permission to overwrite',async kind=>{
 const {p,w}=await prepared();if(kind==='world'){const r=await p.db.saves.get('current');if(r?.kind==='world'){r.data.snapshot.cities[0].stock.food++;await p.db.saves.put(r);}}
 if(kind==='authority'){const a=await p.db.saves.get('authority') as any;a.revision++;await p.db.saves.put(a);}
 if(kind==='index')await p.db.table('LedgerIdentity').put({campaignId:w.campaignId,commandId:'command:forged',issuerId:w.playerFactionId});
 const before=await rows(p);await expect(p.incompatibleStartToken()).rejects.toThrow();await expect(p.start(fresh(),'forged')).rejects.toThrow();expect(await rows(p)).toEqual(before);
});
it('pending durable intent prevents incompatible replacement even after explicit consent',async()=>{
 const {p}=make();await p.acquireWriter();const w=await p.start(createFormalFixture());await receiveDurableFixture(p,order(w,'pending',{type:'city.rename',cityId:w.cities[0].id,name:'尚未完成'}));await unsupported(p);const before=await rows(p);
 await expect(p.incompatibleStartToken()).rejects.toThrow('未完成');await expect(p.start(fresh(),'confirmed')).rejects.toThrow();expect(await rows(p)).toEqual(before);
});
it.each(['branch-write','report-write','backup-write','world-write','authority-write','metadata-write','ledger-segment-write','ledger-result-write','ledger-index-write','ledger-manifest-write','ledger-head-write','retention-write'] as const)('replacement %s failure rolls back source, Recovery, identity, writer and new world',async point=>{
 const {p,setFault}=await prepared(),token=await p.incompatibleStartToken(),before=await rows(p);setFault(point);
 await expect(p.start(fresh(),token)).rejects.toThrow('injected');expect(await rows(p)).toEqual(before);
 setFault();const next=await p.start(fresh(),token);expect((await p.loadSave()).game?.campaignId).toBe(next.campaignId);
});
it('a compatible campaign keeps the existing new-game and Recovery behavior',async()=>{
 const {p}=make();await p.acquireWriter();const old=await p.start(createFormalFixture()),next=await p.start(fresh());expect(next.campaignId).not.toBe(old.campaignId);expect(await p.backupList()).toHaveLength(2);expect((await p.loadSave()).game?.campaignId).toBe(next.campaignId);
});
