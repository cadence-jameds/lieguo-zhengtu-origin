import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {catchupWorld,act,fundCatchup,withModernHistory} from './catchupTestSupport';
import {make,order,reject,build,rich} from './developmentTestSupport';
import {EMERGENCY_COST,EMERGENCY_DURATION,emergencyEligibility,handleCatchupEvent} from './modernCatchup';
import {resourceKeys,zeroResources,type FormalWorld} from './model';
import {empireId,factionId,cityId} from './ids';
import {advanceFormal,submitFormalOrder} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {EventScheduler} from './scheduler';
import {validateFormalWorld} from './schema';
import {advanceOfflineCooperative} from './offline';
import {economicChoices,enableAutonomy} from './autonomy';
export function empire(w:FormalWorld,members=w.factions.map(f=>f.id)){
 const id=empireId('catchup-current');w.politics={legions:[{id:'legion:catchup-current',name:'共同體',description:'',leader:members[0],members:[...members],empireId:id}],empires:[{id,name:'帝國',leader:members[0],legions:['legion:catchup-current'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};for(const f of w.factions){f.empireId=members.includes(f.id)?id:null;f.age=2;}w.modernAwareness??={pools:{},battles:[]};w.modernAwareness.pools[id]={value:100,significantEncounter:true,encountered:['modern.knight']};return w;
}
function start(w=catchupWorld()){return act(w,{type:'modern.emergency.start',cityId:w.cities[0].id});}
let funding:FormalWorld|undefined;
function funded(){if(!funding){const w=start();funding=fundCatchup(w,w.largeProjects.at(-1)!.projectId);}return structuredClone(funding);}
it('B9-4B requires another camp completed breakthrough and exactly 100 effective cognition; frozen personal pool cannot qualify empire',()=>{
 let w=catchupWorld();w.modernAwareness!.pools[w.playerFactionId].value=99;reject(w,{type:'modern.emergency.start',cityId:w.cities[0].id});w.modernAwareness!.pools[w.playerFactionId].value=100;
 const noHistory=make();noHistory.modernAwareness={pools:{[noHistory.playerFactionId]:{value:100,significantEncounter:true,encountered:[]}},battles:[]};reject(noHistory,{type:'modern.emergency.start',cityId:noHistory.cities[0].id});
 w=empire(w);w.modernAwareness!.pools[w.factions[0].empireId!].value=99;expect(emergencyEligibility(w,w.playerFactionId)).toContain('100');reject(w,{type:'modern.emergency.start',cityId:w.cities[0].id});
});
it('B9-4B real four-resource stock deduction, in-transit reservation, scheduled arrival and replay identity',async()=>{
 let w=start();const p=w.largeProjects.at(-1)!,c=w.cities[0],cargo={food:100,wood:200,stone:300,gold:400},before={...c.stock},cmd=order(w,{type:'modern.project.ship',cityId:c.id,projectId:p.projectId,resources:cargo},'four-resource');w=submitFormalOrder(w,cmd).world;
 expect(w.largeProjects.at(-1)!.poolResources).toEqual(zeroResources());for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(before[r]-cargo[r]);expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');
 const t=w.logistics!.at(-1)!,arrival=w.events.find(e=>e.id===t.arrivalEventId)!,loaded=(await decodeSave(await encodeSave(w))).world,arrived=advanceFormal(w,t.arrivalAt);expect(advanceFormal(loaded,t.arrivalAt)).toEqual(arrived);w=arrived.world;expect(w.largeProjects.at(-1)!.poolResources).toEqual(cargo);const snapshot=structuredClone(w);expect(handleCatchupEvent(w,arrival,new EventScheduler(w.events))).toBe(true);expect(w).toEqual(snapshot);
 reject(w,{type:'modern.emergency.start',cityId:c.id});reject(w,{type:'modern.project.ship',cityId:c.id,projectId:p.projectId,resources:{food:EMERGENCY_COST.food,wood:0,stone:0,gold:0}});
});
it('B9-4B 36M arrives through 1200 capacity-limited paid shipments before exact 24h, no premature or duplicate qualification',async()=>{
 let w=funded(),p=w.largeProjects.at(-1)!;expect(p.requiredResources).toEqual(EMERGENCY_COST);expect(p.shipments).toHaveLength(1200);expect(p.durationMs).toBe(24*3600000);const end=p.catchup!.startedAt!+EMERGENCY_DURATION;
 expect(advanceFormal(w,end-1).world.factions[0].modernQualification).toBe('none');const loaded=(await decodeSave(await encodeSave(w))).world,direct=advanceFormal(w,end);expect(advanceFormal(loaded,end)).toEqual(direct);const offline=await advanceOfflineCooperative({...w,offlineHours:12},0,(end-w.time)/w.speed);expect(offline.world.largeProjects.at(-1)!.catchup!.phase).toBe('building');
 w=direct.world;p=w.largeProjects.at(-1)!;expect(p.catchup!.qualifiedFactionIds).toEqual([w.playerFactionId]);expect(w.factions[0].modernQualification).toBe('full');const event={id:p.catchup!.completionEventId!,type:'modern.project.complete' as const,projectId:p.projectId,at:end},before=structuredClone(w);handleCatchupEvent(w,event,new EventScheduler(w.events));expect(w).toEqual(before);expect(w.events.some(e=>/victory/.test(e.type))).toBe(false);validateFormalWorld(w);
});
it('B9-4B personal project remains personal after empire join and grants only its initiator',()=>{
 let w=empire(funded());const id=w.largeProjects.at(-1)!.projectId;expect(w.largeProjects.at(-1)!.owner).toEqual({kind:'faction',factionId:w.playerFactionId});// Add a distinct member that has not earned a permanent qualification.
 const member={...w.factions[0],id:factionId('new-member'),name:'後加入',modernQualification:'none' as const};w.factions.push(member);w.cities.push({...structuredClone(w.cities[1]),id:cityId('new-member'),ownerFactionId:member.id,x:20,y:20});w.politics!.legions[0].members.push(member.id);
 w=advanceFormal(w,w.largeProjects.find(p=>p.projectId===id)!.catchup!.startedAt!+EMERGENCY_DURATION).world;expect(w.factions.find(f=>f.id===member.id)!.modernQualification).toBe('none');expect(w.largeProjects.at(-1)!.catchup!.qualifiedFactionIds).toEqual([w.playerFactionId]);
});
it('B9-4B empire completion uses current member snapshot and remains permanent after dissolution; external faction cannot pay',()=>{
 let w=start(empire(catchupWorld(),[factionId('player')]));const p=w.largeProjects.at(-1)!;expect(p.owner.kind).toBe('empire');const other=w.factions[1];expect(submitFormalOrder(w,order(w,{type:'modern.project.ship',cityId:w.cities[2].id,projectId:p.projectId,resources:{food:1,wood:0,stone:0,gold:0}},'foreign-pay',other.id)).ack?.status).toBe('rejected');
 w=fundCatchup(w,p.projectId);w=advanceFormal(w,w.largeProjects.at(-1)!.catchup!.startedAt!+EMERGENCY_DURATION).world;expect(w.largeProjects.at(-1)!.catchup!.qualifiedFactionIds).toEqual([w.playerFactionId]);w=act(w,{type:'politics',cityId:w.cities[0].id,action:'empire-dissolve'});expect(w.factions[0].modernQualification).toBe('full');expect(w.largeProjects.at(-1)!.catchup!.phase).toBe('completed');
});
it('B9-4B Save/Load, Recovery and failed write preserve funded project and exactly-once completion',async()=>{
 const {FormalPersistence}=await import('../persistence');let fail=false;const db=new FormalPersistence({suffix:'catchup-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('catchup write fault');}});
 try{let w=await db.start(funded());const p=w.largeProjects.at(-1)!,end=p.catchup!.startedAt!+p.durationMs,t=advanceFormal(w,end);fail=true;await expect(db.save(t.world,t.reports,w.revision)).rejects.toThrow('catchup write fault');expect((await db.loadSave()).game!.factions[0].modernQualification).toBe('none');fail=false;w=await db.save(t.world,t.reports,w.revision);const backup=(await db.backupList())[0];await db.restore(backup.id);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const r=await db.loadSave();expect(r.recovered).toBe(true);expect(r.game!.largeProjects.at(-1)!.catchup).toEqual(w.largeProjects.at(-1)!.catchup);expect(advanceFormal(r.game!,end).world.factions[0].modernQualification).toBe('full');}finally{await db.db.delete();}
});
it('B9-4B 99 AI eligibility and real command route use own market stock without free project resources',()=>{
 let w=withModernHistory(make());enableAutonomy(w);for(const id of w.factions.filter(f=>f.role==='ai').map(f=>f.id)){const f=w.factions.find(f=>f.id===id)!;f.modernQualification='none';// Keep the historical recipient fully qualified; it already has the full route.
  if(w.largeProjects[1].breakthrough!.qualifiedFactionIds.includes(id)){f.modernQualification='full';continue;}const c=rich(w,w.cities.find(c=>c.ownerFactionId===id)!,10000);build(c,'market',15);w.modernAwareness??={pools:{},battles:[]};w.modernAwareness.pools[id]={value:100,significantEncounter:true,encountered:[]};const o=order(w,{type:'modern.emergency.start',cityId:c.id},'ai-emergency-'+id.slice(8),id);w=submitFormalOrder(w,o).world;expect(w.largeProjects.at(-1)!.poolResources).toEqual(zeroResources());const agent=w.autonomy!.agents.find(a=>a.factionId===id)!;expect(economicChoices(w,c,agent).some(x=>x.command.type==='modern.project.ship')).toBe(true);}
 expect(w.largeProjects.filter(p=>p.catchup)).toHaveLength(98);
},30000);
