import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {FormalPersistence} from '../persistence';
import {battlefield,arrive} from './combatTestSupport';
import {order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {handleCombatEvent} from './battles';
import {clearWild} from './wildLifecycle';
import {EventScheduler} from './scheduler';
import {validateFormalWorld} from './schema';
const setup=()=>{const w=battlefield();w.cities[0].military!.units={scout:5,militia:20};const site=w.worldLayer!.wildSites[0],target={kind:'wild' as const,siteId:site.id,generation:site.generation};return {w,site,target};};
it('wild scouts observe resources/army without consuming loot, damaging defenders or changing 432 slots; delivery and generation lookup persist',async()=>{
 const p=new FormalPersistence({suffix:'wild-scout'});
 try{
 let {w,site,target}=setup();const before=structuredClone(site);w=await p.start(w);
 const cmd=order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target,units:{scout:2},scoutMode:'resources-army'});
 let t=submitFormalOrder(w,cmd);expect(t.ack?.status).toBe('committed');w=await p.save(t.world,t.reports,w.revision);
 const event=w.events.find(e=>e.id===w.armies[0].movementEventId)!;t=arrive(w);expect(t.reports).toEqual([]);w=await p.save(t.world,t.reports,w.revision);
 expect(w.worldLayer!.wildSites[0]).toEqual(before);expect(w.worldLayer!.wildSites).toHaveLength(432);expect(w.armies[0].cargo).toEqual({food:0,wood:0,stone:0,gold:0});
 expect(await p.readCityIntel(w,site.id,site.generation)).toEqual({});
 const restored=(await decodeSave(await encodeSave(w))).world;expect(restored.armies[0].pendingIntel).toEqual({observedAt:w.time,observedRealAt:w.armies[0].pendingIntel!.observedRealAt,siteId:site.id,generation:site.generation,units:before.defenders,resources:before.loot});
 expect(w.armies[0].pendingIntel!.observedRealAt).toBeGreaterThan(0);const snapshot=structuredClone(w);handleCombatEvent(w,event,new EventScheduler(w.events));expect(w).toEqual(snapshot);
 t=advanceFormal(restored,restored.armies[0].arrivalAt!);expect(t.reports).toHaveLength(1);expect(t.reports[0].battle!.intel!.wallLevel).toBeUndefined();w=await p.save(t.world,t.reports,w.revision);
 expect(w.cities[0].military!.units.scout).toBe(5);expect(w.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);expect(w.combat!.receipts.filter(r=>r.kind==='scout-delivery')).toHaveLength(1);
 const full=(await decodeSave(JSON.parse(await p.exportStoredSave('full'))));expect(full.reports![0].battle!.intel).toEqual(t.reports[0].battle!.intel);
 expect((await p.readCityIntel(w,site.id,site.generation)).resources!.intel.resources).toEqual(before.loot);
 expect(await p.readCityIntel(w,site.id,site.generation+1)).toEqual({});expect(await p.readCityIntel(w,site.id)).toEqual({});validateFormalWorld(w);
 }finally{await p.db.delete();}
});
it('wild scout rejects selectable defenses, mixed forces, conquest and stale generations atomically',()=>{
 const {w,target}=setup();for(const change of [{scoutMode:'defenses-army' as const},{units:{scout:2,militia:1}},{mission:'conquest' as const},{target:{...target,generation:target.generation+1}}]){
 const before=structuredClone(w),cmd=order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target,units:{scout:2},scoutMode:'resources-army',...change});expect(submitFormalOrder(w,cmd).ack?.status).toBe('rejected');expect(w).toEqual(before);
 }
});
it('wild scout arriving after clearance returns without leaking the old or respawned generation',()=>{
 let {w,target}=setup();w=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target,units:{scout:2},scoutMode:'resources-army'})).world;
 const s=new EventScheduler(w.events);clearWild(w,w.worldLayer!.wildSites[0],s);w.events=s.snapshot();const t=arrive(w);expect(t.reports[0].battle!.outcome).toBe('no-target');expect(t.reports[0].battle!.intel).toBeUndefined();expect(t.world.armies[0].pendingIntel).toBeUndefined();expect(t.world.armies[0].status).toBe('returning');expect(t.world.worldLayer!.wildSites).toHaveLength(432);
});
