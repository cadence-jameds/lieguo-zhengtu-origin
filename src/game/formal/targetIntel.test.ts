import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {FormalPersistence} from '../persistence';
import {battlefield,dispatch,arrive} from './combatTestSupport';
import {advanceFormal} from './reducer';
import {reportId,sequenceKey} from './ids';
import type {FormalReport} from './model';
it('target intel spans older report pages, separates observation modes, survives reconnect, and respects save cursor',async()=>{
 const suffix='target-intel',p=new FormalPersistence({suffix});
 try{
 let w=battlefield();w.cities[0].military!.units={scout:20};w.cities[1].military!.units={militia:28};w.cities[1].wallLevel=1;w=await p.start(w);
 let t=dispatch(w,'scout',{scout:2},0,1,'resources-army');w=await p.save(t.world,t.reports,w.revision);t=arrive(w);w=await p.save(t.world,t.reports,w.revision);t=advanceFormal(w,w.armies[0].arrivalAt!);w=await p.save(t.world,t.reports,w.revision);const resources=t.reports[0].battle!.intel!;
 t=dispatch(w,'scout',{scout:2},0,1,'defenses-army');w=await p.save(t.world,t.reports,w.revision);t=arrive(w);w=await p.save(t.world,t.reports,w.revision);t=advanceFormal(w,w.armies[0].arrivalAt!);w=await p.save(t.world,t.reports,w.revision);const defenses=t.reports[0].battle!.intel!;
 const next=structuredClone(w);next.revision++;const fillers:FormalReport[]=Array.from({length:55},()=>{const sequence=next.sequences.report++;return {id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:w.playerFactionId,at:w.time,category:'system',title:'城務',text:'歷史分頁'};});w=await p.save(next,fillers,w.revision);
 expect((await p.readReportPage(w)).rows.every(r=>!r.battle)).toBe(true);
 p.db.close();const reopen=new FormalPersistence({suffix});const intel=await reopen.readCityIntel(w,w.cities[1].id);
 expect(intel.resources!.intel).toEqual(defenses);expect(intel.defenses!.intel).toEqual(defenses);expect(intel.army!.intel).toEqual(defenses);
 const cutoff=structuredClone(w);cutoff.sequences.report=t.reports[0].sequence;
 expect((await reopen.readCityIntel(cutoff,w.cities[1].id)).defenses!.intel).toEqual(resources);
 expect((await reopen.readCityIntel(w,w.cities[2].id))).toEqual({});
 await reopen.db.delete();
 }finally{await p.db.delete();}
});
