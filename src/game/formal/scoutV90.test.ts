import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {build,order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {decodeSave,encodeSave} from './saveCodec';
import {empireId} from './ids';
import {invalidateSpatial} from './spatial';
import {citySnapshot} from './economy';
import {FormalPersistence} from '../persistence';
import type {FormalWorld} from './model';
const evidence:Record<string,unknown>={};
function launch(w:FormalWorld,count=10){return issue(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target:{kind:'city',cityId:w.cities[1].id},units:{scout:count}}).world;}
function setup(){const w=battlefield();w.cities[0].military!.units={scout:10};w.cities[1].military!.units={scout:4,militia:30,archer:3};w.cities[1].wallLevel=7;build(w.cities[1],'castle',2);build(w.cities[1],'bunker.0',3);build(w.cities[1],'academy',6);return w;}
describe('v90 city single scouting snapshot',()=>{
 it('single command captures resources/garrison/reinforcements/legal defenses at arrival; only surviving origin return delivers, and IndexedDB reconnect/export retains the same snapshot',async()=>{
  const store=new FormalPersistence({suffix:'v90-complete'});try{
   let w=setup();w.factions[1].empireId=w.factions[2].empireId=empireId('scout-allies');w.cities[2].military!.units={knight:2};w=arrive(dispatch(w,'reinforce',{knight:2},2,1).world).world;
   w=await store.start(w);let t=issue(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target:{kind:'city',cityId:w.cities[1].id},units:{scout:10}});w=await store.save(t.world,t.reports,w.revision);
   const scout=w.armies.find(a=>a.mission==='scout')!,at=scout.arrivalAt!,stock=citySnapshot({...w,time:at},w.cities[1].id)!.stock;
   expect(scout.scoutMode).toBeUndefined();expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
   t=arrive(w);expect(t.reports).toEqual([]);w=await store.save(t.world,t.reports,w.revision);const returning=w.armies.find(a=>a.mission==='scout')!,intel=structuredClone(returning.pendingIntel!);
   expect(intel).toMatchObject({observedAt:at,resources:stock,garrison:{scout:4,militia:30,archer:3},units:{scout:4,militia:30,archer:3,knight:2},reinforcements:[{ownerFactionId:w.factions[2].id,originCityId:w.cities[2].id,units:{knight:2}}],wallLevel:7,defenses:{castle:2,'bunker.0':3}});
   expect(Object.keys(intel).sort()).toEqual(['observedAt','observedRealAt','cityId','units','resources','garrison','reinforcements','wallLevel','defenses'].sort());expect(intel.observedRealAt).toBeGreaterThan(0);expect(returning.units!.scout).toBe(8);
   expect(await store.readCityIntel(w,w.cities[1].id)).toEqual({});expect((await store.readReportPage(w)).rows).toHaveLength(0);
   const loaded=(await decodeSave(await encodeSave(w))).world;loaded.cities[1].stock.gold=1;loaded.cities[1].wallLevel=1;loaded.cities[1].military!.units={militia:999};loaded.cities[1].buildings.castle=1;loaded.armies.find(a=>a.mission==='reinforce')!.units={knight:99};
   t=advanceFormal(loaded,returning.arrivalAt!-1);expect(t.reports).toEqual([]);w=await store.save(t.world,t.reports,w.revision);t=advanceFormal(w,returning.arrivalAt!);expect(t.reports).toHaveLength(1);expect(t.reports[0].battle!.intel).toEqual(intel);expect(t.world.cities[0].military!.units.scout).toBe(8);
   // Keep the modified runtime only in this scenario; save compares the durable revision cursor.
   w=await store.save(t.world,t.reports,w.revision);store.db.close();const reopen=new FormalPersistence({suffix:'v90-complete'});
   const target=await reopen.readCityIntel(w,w.cities[1].id);expect(target.army).toEqual(target.resources);expect(target.resources).toEqual(target.defenses);expect(target.army!.intel).toEqual(intel);
   const exported=await decodeSave(JSON.parse(await reopen.exportStoredSave('full')));expect(exported.reports![0].battle!.intel).toEqual(intel);expect(w.combat!.receipts.filter(r=>r.kind==='scout-delivery')).toHaveLength(1);evidence.complete={intel,report:t.reports[0],target};await reopen.db.delete();
  }finally{await store.db.delete();}
 });
 for(const mode of ['resources-army','defenses-army'] as const)it(`old outbound ${mode} survives load and resolves to complete v90 intel`,async()=>{let w=setup();w.metadata.appVersion='0.30.28';w=dispatch(w,'scout',{scout:10},0,1,mode).world;w=(await decodeSave(await encodeSave(w))).world;expect(w.armies[0].scoutMode).toBe(mode);w=arrive(w).world;const snapshot=w.armies[0].pendingIntel!;expect(snapshot.resources).toBeDefined();expect(snapshot.wallLevel).toBe(7);expect(snapshot.garrison).toEqual({scout:4,militia:30,archer:3});expect(snapshot.reinforcements).toEqual([]);const loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded.armies[0].pendingIntel).toEqual(snapshot);expect(advanceFormal(loaded,loaded.armies[0].arrivalAt!).reports[0].battle!.intel).toEqual(snapshot);});
 for(const mode of ['resources-army','defenses-army'] as const)it(`old returning ${mode} partial observation loads without re-observing or fabricating`,async()=>{let w=setup();w.metadata.appVersion='0.30.28';w=arrive(dispatch(w,'scout',{scout:10},0,1,mode).world).world;const i=w.armies[0].pendingIntel!;delete i.garrison;delete i.reinforcements;if(mode==='resources-army'){delete i.wallLevel;delete i.defenses;}else delete i.resources;const snapshot=structuredClone(i);w=(await decodeSave(await encodeSave(w))).world;w.cities[1].stock.gold=2;w.cities[1].wallLevel=1;expect(advanceFormal(w,w.armies[0].arrivalAt!).reports[0].battle!.intel).toEqual(snapshot);});
 for(const count of [5,6])it(`${count} scouts fail against five counters (6 ties); zero intelligence and unchanged winner losses`,()=>{let w=setup();w.cities[1].military!.units={scout:5,militia:70};w=launch(w,count);const t=arrive(w),p=t.reports[0].battle!;expect(p.outcome).toBe('scout-failed');expect(p.intel).toBeUndefined();expect(p.defenders.every(g=>!Object.keys(g.before).length&&!Object.keys(g.after).length)).toBe(true);expect(p.wallBefore+p.wallAfter+p.populationBefore+p.populationAfter).toBe(0);expect(t.world.armies).toHaveLength(0);expect(t.world.cities[1].military!.units).toEqual({scout:count===6?2:3,militia:70});evidence['failure-'+count]=p;});
 it('failed attacker reports reveal no reinforcement identities or source cities',()=>{let w=setup();w.factions[1].empireId=w.factions[2].empireId=empireId('hidden-allies');w.cities[2].military!.units={scout:5,knight:2};w=arrive(dispatch(w,'reinforce',{scout:5,knight:2},2,1).world).world;w=launch(w,5);const p=arrive(w).reports[0].battle!;expect(p.intel).toBeUndefined();expect(p.defenders).toEqual([{ownerFactionId:w.cities[1].ownerFactionId,armyId:null,cityId:w.cities[1].id,before:{},after:{}}]);});
 it('mixed soldiers are rejected; no selectable information mode is necessary',()=>{const w=setup(),before=structuredClone(w);const t=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target:{kind:'city',cityId:w.cities[1].id},units:{scout:1,militia:1}}));expect(t.ack?.status).toBe('rejected');expect(w).toEqual(before);expect(launch(w).armies[0].scoutMode).toBeUndefined();});
 it('defender still receives a successful scouting alert without an attacker report before return',()=>{let w=setup();w.cities[1].military!.units={scout:10};w.cities[0].military!.units={scout:1,militia:50};w=dispatch(w,'scout',{scout:10},1,0).world;const t=arrive(w);expect(t.reports).toHaveLength(1);expect(t.reports[0]).toMatchObject({category:'system',title:'遭到偵察'});expect(t.reports[0].battle).toBeUndefined();});
 it('zero surviving scouts cannot deliver a retained snapshot',()=>{let w=arrive(launch(setup())).world;w.armies[0].units={};const t=advanceFormal(w,w.armies[0].arrivalAt!);expect(t.reports).toEqual([]);expect(t.world.combat!.receipts.some(r=>r.kind==='scout-delivery')).toBe(false);});
 it('fallback return to another city does not deliver source-city-bound intelligence',()=>{let w=arrive(launch(setup())).world;w.cities[0].ownerFactionId=w.factions[1].id;w.cities[2].ownerFactionId=w.playerFactionId;invalidateSpatial(w);w=advanceFormal(w,w.armies[0].arrivalAt!).world;expect(w.armies[0].returnCityId).toBe(w.cities[2].id);const t=advanceFormal(w,w.armies[0].arrivalAt!);expect(t.reports).toEqual([]);expect(t.world.combat!.receipts.some(r=>r.kind==='scout-delivery')).toBe(false);});
 it('records inspectable v90 scenario evidence',()=>{mkdirSync('docs/scout-v03029',{recursive:true});writeFileSync('docs/scout-v03029/scenarios.json',JSON.stringify(evidence,null,2));expect(evidence.complete).toBeDefined();});
});
