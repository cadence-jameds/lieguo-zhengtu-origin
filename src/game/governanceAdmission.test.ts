import {expect,it} from 'vitest';
import {createFormalWorld} from './formal/generator';
import {build} from './formal/developmentTestSupport';
import {order} from './formal/testSupport';
import {advanceFormal,submitFormalOrder} from './formal/reducer';
import {governanceAfterCatchup,governanceBase,governanceWithBase} from './governanceAdmission';
import type {FormalWorld} from './formal/model';
const scene=()=>{const w=createFormalWorld({campaign:'governance-admission',seed:90217});build(w.cities[0],'townhall',1);return w;};
const command=(w:FormalWorld)=>order(w,'setting',{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'reserve',budget:2400,reserve:180});
it('bridges unchanged settings once while the reducer keeps strict revision and receipt deduplication',()=>{
 const w=scene(),o=command(w),next=advanceFormal(w,100).world;
 expect(submitFormalOrder(next,o).ack?.status).toBe('rejected');
 const admitted=governanceAfterCatchup(w,next,o);expect(admitted.commandId).toBe(o.commandId);expect(admitted.payload).toBe(o.payload);expect(admitted.expectedRevision).toBe(next.revision);
 const t=submitFormalOrder(next,admitted);expect(t.ack?.status).toBe('committed');expect(t.world.cities[0].stock).toEqual(next.cities[0].stock);expect(t.world.events.filter(e=>e.type==='governance.decide')).toHaveLength(1);
 const replay=submitFormalOrder(t.world,admitted);expect(replay.ack?.status).toBe('duplicate');expect(replay.world).toEqual(t.world);
});
it('never bridges already-stale, future-time, foreign-campaign or economic orders',()=>{
 const w=scene(),o=command(w),next=advanceFormal(w,100).world;
 for(const invalid of [{...o,expectedRevision:-1},{...o,issuedWorldTime:1},{...o,issuedWorldTime:-1},{...o,issuedWorldTime:NaN},{...o,campaignId:next.campaignId.replace('admission','other') as typeof o.campaignId},order(w,'cost',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})])expect(governanceAfterCatchup(w,next,invalid)).toBe(invalid);
});
it('requires a fresh player decision after ownership, qualification or configuration changes',()=>{
 const w=scene(),o=command(w);
 for(const change of [(n:FormalWorld)=>{n.cities[0].ownerFactionId=n.factions[1].id;},(n:FormalWorld)=>{n.cities[0].buildings.townhall=0;},(n:FormalWorld)=>{n.playerFactionId=n.factions[1].id;}]){const n=advanceFormal(w,100).world;change(n);expect(governanceAfterCatchup(w,n,o)).toBe(o);}
 const updated=submitFormalOrder(w,{...o,commandId:order(w,'newer',o.payload).commandId}).world;
 expect(governanceAfterCatchup(w,updated,o)).toBe(o);
});
it('rejects ABA writes even when the newer configuration returns to identical values',()=>{
 const raw=scene(),first=submitFormalOrder(raw,command(raw)).world,o=order(first,'old-intent',{type:'governance.set',cityId:first.cities[0].id,enabled:false,policy:'reserve',budget:2400,reserve:180});
 if(o.payload.type!=='governance.set')throw Error('test setup');
 const a=submitFormalOrder(first,order(first,'newer-a',{...o.payload,enabled:true,policy:'economy'})).world;
 const b=submitFormalOrder(a,order(a,'newer-b',{...o.payload,enabled:true,policy:'reserve'})).world;
 b.commandReceipts.sort((a,b)=>a.commandId.localeCompare(b.commandId));
 expect(governanceAfterCatchup(first,b,o)).toBe(o);expect(submitFormalOrder(b,o).ack?.status).toBe('rejected');
 expect(governanceWithBase(b,o,governanceBase(first,first.cities[0].id))).toBe(o);
});
it('a queued background event can bridge a captured UI precondition, never an unguarded stale order',()=>{
 const w=scene(),o=command(w),base=governanceBase(w,w.cities[0].id),next=advanceFormal(w,100).world;
 expect(governanceWithBase(next,o)).toBe(o);expect(governanceWithBase(next,o,{...base,revision:next.revision})).toBe(o);
 expect(governanceWithBase(next,o,base,next.revision)).toBe(o);
 for(const time of [-1,NaN,Infinity]){const invalid={...o,issuedWorldTime:time};expect(governanceWithBase(next,invalid,base)).toBe(invalid);}
 const t=submitFormalOrder(next,governanceWithBase(next,o,base));expect(t.ack?.status).toBe('committed');expect(t.world.governors![0].policy).toBe('reserve');
});
