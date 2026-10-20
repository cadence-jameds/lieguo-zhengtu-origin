import {afterEach,expect,it,vi} from 'vitest';
import {worldPatch,applyWorldPatch} from './worldStream';
import {createFormalWorld} from './formal/generator';
import {advanceFormal,submitFormalOrder} from './formal/reducer';
import {order} from './formal/testSupport';
const w=createFormalWorld({campaign:'stream',seed:90217});
afterEach(()=>vi.restoreAllMocks());
it('an appended receipt transports the complete exact world without serializing either history for comparison',()=>{
 const next=submitFormalOrder(w,order(w,'append-history',{type:'city.rename',cityId:w.cities[0].id,name:'New name'})).world,spy=vi.spyOn(JSON,'stringify');
 const patch=worldPatch(w,next);
 expect(spy.mock.calls.filter(([value])=>value===w.commandReceipts||value===next.commandReceipts)).toHaveLength(0);
 expect(patch.changes.commandReceipts).toBe(next.commandReceipts);expect(applyWorldPatch(w,patch)).toEqual(next);
});
it('same-length Recovery history changes are transported and unchanged histories preserve identity',()=>{
 const original=submitFormalOrder(w,order(w,'rollback-history',{type:'city.rename',cityId:w.cities[0].id,name:'Before rollback'})).world;
 const equal=structuredClone(original),same=worldPatch(original,equal);expect(same.changes.commandReceipts).toBeUndefined();
 equal.revision++;equal.commandReceipts[0].disposition='rolled-back';const patch=worldPatch(original,equal);
 expect(patch.changes.commandReceipts).toEqual(equal.commandReceipts);expect(applyWorldPatch(original,patch)).toEqual(equal);
});
it('nonstandard receipt serialization keeps the original full-comparison fallback',()=>{
 const next={...w,commandReceipts:[] as typeof w.commandReceipts};Object.assign(w.commandReceipts,{toJSON:()=>[]});
 try{next.commandReceipts.push({commandId:'command:custom' as never,issuerId:w.playerFactionId,fingerprint:'x',committedRevision:0,disposition:'applied'});Object.assign(next.commandReceipts,{toJSON:()=>[]});expect(worldPatch(w,next).changes.commandReceipts).toBeUndefined();}
 finally{delete (w.commandReceipts as any).toJSON;}
});
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
