import {expect,it} from 'vitest';
import {worldPatch,applyWorldPatch} from './worldStream';
import {createFormalWorld} from './formal/generator';
import {advanceFormal,submitFormalOrder} from './formal/reducer';
import {order} from './formal/testSupport';
const w=createFormalWorld({campaign:'stream',seed:90217});
it('a passive checkpoint transports clock/revision only and preserves all terrain and entity identities',()=>{
 const next=advanceFormal(w,1000).world,patch=worldPatch(w,next),merged=applyWorldPatch(w,patch)!;
 expect(Object.keys(patch.changes).sort()).toEqual(['revision','time']);expect(merged).toEqual(next);expect(merged.worldLayer).toBe(w.worldLayer);expect(merged.cities).toBe(w.cities);expect(JSON.stringify(patch).length).toBeLessThan(200);
});
it('command and completion patches reconstruct the exact durable world without carrying unchanged terrain',()=>{
 const started=submitFormalOrder(w,order(w,'build',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})).world,first=worldPatch(w,started);expect(first.changes.worldLayer).toBeUndefined();const a=applyWorldPatch(w,first)!;expect(a).toEqual(started);
 const job=started.cities[0].economy!.construction[0],finished=advanceFormal(started,job.startsAt+job.durationMs).world,second=worldPatch(started,finished),b=applyWorldPatch(a,second)!;expect(b).toEqual(finished);expect(b.cities[0].fields![0].level).toBe(1);expect(b.worldLayer).toBe(w.worldLayer);
});
it('wrong campaign or missing base revision requires a full snapshot, never a partial corrupt world',()=>{
 const next=advanceFormal(w,1000).world,patch=worldPatch(w,next);expect(applyWorldPatch(null,patch)).toBeUndefined();expect(applyWorldPatch({...w,revision:100},patch)).toBeUndefined();expect(applyWorldPatch(createFormalWorld({campaign:'other',seed:90217}),patch)).toBeUndefined();expect(applyWorldPatch(w,worldPatch(w,w))).toBe(w);
});
