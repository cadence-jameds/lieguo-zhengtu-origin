import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {createFormalFixture} from './fixture';
import {initializeEconomy} from './economy';
import {withModernHistory} from './catchupTestSupport';
import {breakthroughWork,updateWonderIntegrity} from './breakthrough';
import {applyWonderDamage} from './wonderCondition';
import {WONDER_MAX_DURABILITY,WONDER_FULL_REPAIR_COST,WONDER_FULL_REPAIR_DURATION} from './wonder';
import {eventId,resolutionId} from './ids';
import {EventScheduler} from './scheduler';
import {validateFormalWorld} from './schema';
import {advanceFormal,advanceFormalCooperative} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence} from '../persistence';
import type {FormalWorld} from './model';
import {HOUR} from './time';

/** Compact, already-paid historical B9-1/2 prerequisite; no new engineering funding. */
function world(active=true){
 let w=createFormalFixture({campaign:'wonder-durability-'+crypto.randomUUID()});initializeEconomy(w);w=withModernHistory(w);
 if(active){
  const p=w.largeProjects[1],owner=p.owner.kind==='empire'?p.owner.empireId:null,f=w.factions[1].id;
  if(!owner)throw Error('Historical empire missing');
  w.factions[1].empireId=owner;w.factions[1].modernQualification='none';
  w.politics={legions:[{id:'legion:b95',name:'測試軍團',description:'',leader:f,members:[f],empireId:owner}],empires:[{id:owner,name:'測試帝國',leader:f,legions:['legion:b95'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};
  p.createdAt=w.time;p.shipments[0].dispatchedAt=w.time;p.shipments[0].authorizationSnapshot.checkedAt=w.time;
  if(p.shipments[0].phase!=='arrived')throw Error('Historical shipment missing');p.shipments[0].arrivedAt=w.time;
  Object.assign(p.breakthrough!,{phase:'building',workPeriods:[],discardedWorkMs:0,activeSince:w.time,completionEventId:eventId('b95-breakthrough-complete'),completedAt:null,qualifiedFactionIds:[]});
  w.events.push({type:'breakthrough.complete',projectId:p.projectId,id:p.breakthrough!.completionEventId!,at:w.time+p.durationMs});
 }
 return validateFormalWorld(w);
}
function hit(w:FormalWorld,damage:number,key='hit'){
 const s=new EventScheduler(w.events),e={type:'fixture.marker' as const,id:eventId(key),marker:key,at:w.time};
 const applied=applyWonderDamage(w,w.largeProjects[0].projectId,e,resolutionId(key),damage,s);w.events=s.snapshot();return{applied,e};
}
it('B9-5 sealed constants preserve full-wonder 120000 and full-ruins repair 6M/12h',()=>{
 expect(WONDER_MAX_DURABILITY).toBe(120000);expect(WONDER_FULL_REPAIR_COST).toEqual({food:1000000,wood:1750000,stone:2250000,gold:1000000});expect(WONDER_FULL_REPAIR_DURATION).toBe(12*HOUR);
});
it('B9-5 a formal wonder completion persists full numeric durability without granting a victory or qualification',()=>{
 let w=world();w.largeProjects=w.largeProjects.filter(p=>p.kind==='world-wonder');
 const p=w.largeProjects[0],state=p.wonder!,s=p.shipments[0];p.createdAt=w.time;state.phase='building';state.startedAt=w.time;state.completedAt=null;s.dispatchedAt=w.time;s.authorizationSnapshot.checkedAt=w.time;
 if(s.phase!=='arrived')throw Error('Historical shipment missing');s.arrivedAt=w.time;
 w.events.push({type:'wonder.complete',id:state.completionEventId!,projectId:p.projectId,at:w.time+p.durationMs});validateFormalWorld(w);
 const qualifications=w.factions.map(f=>f.modernQualification),result=advanceFormal(w,w.time+p.durationMs);w=result.world;
 expect(w.largeProjects[0].wonder!.durability).toEqual({maximum:120000,current:120000,ledger:[]});expect(w.largeProjects[0].wonder!.integrity).toBe('intact');expect(w.factions.map(f=>f.modernQualification)).toEqual(qualifications);expect(result.reports.filter(r=>r.title==='世界奇觀完成')).toHaveLength(1);validateFormalWorld(w);
});
it('B9-5 real numeric damage immediately pauses an incomplete breakthrough and ruins roll back once',async()=>{
 let w=world();w=advanceFormal(w,w.time+31*HOUR).world;const resources=w.cities.map(c=>({...c.stock}));
 expect(hit(w,1000).applied).toBe(1000);expect(w.cities.map(c=>c.stock)).toEqual(resources);expect(w.largeProjects[0].wonder!.durability!.current).toBe(119000);expect(w.largeProjects[0].wonder!.integrity).toBe('damaged');
 expect(w.largeProjects[1].breakthrough!.phase).toBe('paused');expect(breakthroughWork(w,w.largeProjects[1])).toBe(31*HOUR);expect(w.events.some(e=>e.type==='breakthrough.complete')).toBe(false);
 w=(await decodeSave(await encodeSave(w))).world;w=advanceFormal(w,w.time+HOUR).world;
 const result=hit(w,Number.MAX_SAFE_INTEGER,'destroy');expect(result.applied).toBe(119000);expect(w.largeProjects[0].wonder!.durability!.current).toBe(0);expect(w.largeProjects[0].wonder!.integrity).toBe('ruins');expect(breakthroughWork(w,w.largeProjects[1])).toBe(24*HOUR);
 const before=structuredClone(w);expect(hit(w,Number.MAX_SAFE_INTEGER,'destroy').applied).toBe(0);expect(w).toEqual(before);
 w=(await decodeSave(await encodeSave(w))).world;expect((await advanceFormalCooperative(w,w.time+HOUR)).world).toEqual(advanceFormal(w,w.time+HOUR).world);
 expect(breakthroughWork(w,w.largeProjects[1])).toBe(24*HOUR);expect(w.factions.every(f=>f.modernQualification==='none')).toBe(true);validateFormalWorld(w);
});
it.each([-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('B9-5 rejects unsafe damage %s atomically',damage=>{
 const w=world(),before=structuredClone(w);expect(()=>hit(w,damage)).toThrow();expect(w).toEqual(before);
});
it('B9-5 replays remain inert after time advances; conflicting receipts and enum-only healing are rejected',()=>{
 let w=world();const {e}=hit(w,1000);w=advanceFormal(w,w.time+HOUR).world;const before=structuredClone(w),s=new EventScheduler(w.events);
 expect(applyWonderDamage(w,w.largeProjects[0].projectId,e,resolutionId('hit'),1000,s)).toBe(0);expect(w).toEqual(before);
 expect(()=>applyWonderDamage(w,w.largeProjects[0].projectId,e,resolutionId('hit'),2000,s)).toThrow();
 expect(()=>applyWonderDamage(w,w.largeProjects[0].projectId,{...e,at:w.time},resolutionId('other'),1000,s)).toThrow();
 expect(()=>updateWonderIntegrity(w,w.largeProjects[0].projectId,'intact',s)).toThrow();expect(w).toEqual(before);
});
it.each(['current','integrity','duplicate','receipt','maximum'] as const)('B9-5 Save rejects inconsistent %s durability',async field=>{
 const w=world();hit(w,1000);const state=w.largeProjects[0].wonder!,d=state.durability!;
 if(field==='current')d.current++;if(field==='integrity')state.integrity='intact';if(field==='duplicate')d.ledger.push({...d.ledger[0]});if(field==='receipt')d.ledger[0].after--;if(field==='maximum')Object.assign(d,{maximum:120001});
 expect(()=>validateFormalWorld(w)).toThrow();await expect(encodeSave(w)).rejects.toThrow();
});
it('B9-5 already-completed breakthrough and permanent qualifications survive actual destruction',async()=>{
 const w=world(false),b=structuredClone(w.largeProjects[1]),f=structuredClone(w.factions);hit(w,120000);expect(w.largeProjects[1]).toEqual(b);expect(w.factions).toEqual(f);expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
});
const databases:FormalPersistence[]=[];afterEach(async()=>{for(const d of databases.splice(0))await d.db.delete();});
it('B9-5 formal atomic Save/Load, backup restore and Recovery retain numeric damage and dedup receipts',async()=>{
 let fail=false;const db=new FormalPersistence({suffix:'b95-durability-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('damage-write-fault');}});databases.push(db);
 let w=await db.start(world());const draft=structuredClone(w);hit(draft,1000);draft.revision++;
 fail=true;await expect(db.save(draft,[],w.revision)).rejects.toThrow('damage-write-fault');expect((await db.loadSave()).game).toEqual(w);fail=false;
 w=await db.save(draft,[],w.revision);expect((await db.loadSave()).game).toEqual(w);const backup=(await db.backupList())[0];
 const restored=await db.restore(backup.id);expect(restored.largeProjects).toEqual(w.largeProjects);const snapshot=structuredClone(restored);expect(hit(restored,1000).applied).toBe(0);expect(restored).toEqual(snapshot);
 await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovered=await db.loadSave();expect(recovered.recovered).toBe(true);expect(recovered.game!.largeProjects).toEqual(w.largeProjects);expect(hit(recovered.game!,1000).applied).toBe(0);
});
