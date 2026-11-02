import {scenarioWorld as projectWorld} from './ledgerTestSupport';
import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {FormalPersistence} from '../persistence';
import {createFormalFixture} from './fixture';
import {submitFormalOrder} from './reducer';
import {order} from './developmentTestSupport';
const stores:FormalPersistence[]=[];
const store=()=>{const s=new FormalPersistence({suffix:'delta-draft-'+crypto.randomUUID()});stores.push(s);return s;};
afterEach(async()=>{vi.restoreAllMocks();for(const s of stores.splice(0))await s.db.delete();});
it('C4 a caller mutation during checksum cannot change the durable snapshot, authority or returned state',async()=>{
 const s=store(),initial=await s.start(createFormalFixture()),next=submitFormalOrder(initial,order(initial,{type:'city.rename',cityId:initial.cities[0].id,name:'Before crypto'}));
 expect(next.ack?.status).toBe('committed');const expected=structuredClone(projectWorld(next.world)),native=crypto.subtle.digest.bind(crypto.subtle);
 let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{entered();await gate;return native(algorithm,data);});
 const saving=s.save(next.world,next.reports,initial.revision);await ready;
 next.world.cities[0].name='MUTATED';next.world.sequences.project+=100;next.world.commandReceipts[0].fingerprint='MUTATED';next.world.time+=100;
 release();const committed=await saving;expect(projectWorld(committed)).toEqual(expected);expect(projectWorld((await s.loadSave()).game!)).toEqual(expected);
 committed.cities[0].name='Local only';expect((await s.loadSave()).game!.cities[0].name).toBe('Before crypto');
});
for(const key of ['commandId','issuerId','fingerprint','committedRevision','disposition'] as const)
it(`C4 the optimized durable-history guard rejects a modified ${key} and rolls back every store`,async()=>{
 const s=store(),a=await s.start(createFormalFixture()),first=submitFormalOrder(a,order(a,{type:'city.rename',cityId:a.cities[0].id,name:'First'})),b=await s.save(first.world,first.reports,a.revision);
 const result=submitFormalOrder(b,order(b,{type:'city.rename',cityId:b.cities[0].id,name:'Second'})),next={...result,world:structuredClone(projectWorld(result.world))},receipt=next.world.commandReceipts[0];
 if(key==='commandId')receipt.commandId='command:changed' as typeof receipt.commandId;
 else if(key==='issuerId')receipt.issuerId=b.factions[1].id;
 else if(key==='fingerprint')receipt.fingerprint='changed';
 else if(key==='committedRevision')receipt.committedRevision++;
 else receipt.disposition='rolled-back';
 const before=await Promise.all(s.db.tables.map(t=>t.toArray()));
 await expect(s.save(next.world,next.reports,b.revision)).rejects.toThrow('Durable dedupe history cannot be dropped');
 expect(await Promise.all(s.db.tables.map(t=>t.toArray()))).toEqual(before);
});
