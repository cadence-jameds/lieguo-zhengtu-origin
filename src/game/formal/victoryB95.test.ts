import {advanceOfflineCooperative} from './offline';
import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {make,order} from './developmentTestSupport';
import {EventScheduler} from './scheduler';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {reconcileVictory,victoryConditions,handleVictoryEvent} from './victory';
import {invalidateSpatial} from './spatial';
import {empireId} from './ids';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence} from '../persistence';
import {HOUR} from './time';
import type {FormalWorld} from './model';
import {validateFormalWorld} from './schema';
function world(owned=70){const w=make();for(let i=0;i<w.cities.length;i++){const c=w.cities[i];c.population=100;c.housing=400;if(i<owned)c.ownerFactionId=w.playerFactionId;}invalidateSpatial(w);return w;}
function sync(w:FormalWorld){const s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();return w;}
it.each([[69,70,false],[70,69,false],[70,70,true],[71,70,true]])('B9-5 conquest city=%s population=%s eligibility=%s',(cities,pop,expected)=>{
 const w=world(cities),own=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId),other=w.cities.filter(c=>c.ownerFactionId!==w.playerFactionId);for(const c of own)c.population=pop/own.length;for(const c of other)c.population=(100-pop)/other.length;
 // Match the existing public ranking's integer resident totals without fractional fixtures.
 for(const c of w.cities)c.population*=10000;expect(victoryConditions(w).find(c=>c.scope===w.playerFactionId)!.conquest).toBe(expected);
});
it.each([14,15,16])('B9-5 a hostile empire at %s percent has an inclusive 15 percent blocking boundary',hostile=>{
 const w=world(70),members=w.factions.slice(70,70+hostile).map(f=>f.id),id=empireId('enemy-victory');w.politics={legions:[],empires:[{id,name:'敵國',leader:members[0],legions:['legion:enemy-victory-a','legion:enemy-victory-b'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};for(let i=0;i<members.length;i+=10)w.politics.legions.push({id:'legion:enemy-victory-'+(i===0?'a':'b'),name:'敵軍',description:'',leader:members[i],members:members.slice(i,i+10),empireId:id});for(const f of w.factions)if(members.includes(f.id))f.empireId=id;
 expect(victoryConditions(w).find(c=>c.scope===w.playerFactionId)!.conquest).toBe(hostile<15);
});
it('B9-5 an unimperial legion does not aggregate independent conquest ownership',()=>{
 const w=world(69),me=w.playerFactionId,other=w.factions[69].id;w.cities[69].ownerFactionId=other;w.politics={legions:[{id:'legion:unimperial',name:'軍團',description:'',leader:me,members:[me,other],empireId:null}],empires:[],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};expect(victoryConditions(w).find(c=>c.scope===me)!.conquest).toBe(false);
});
it('B9-5 conquest wins at exactly 12 world hours, persists a single result, and replays/offline partition identically',async()=>{
 let w=sync(world()),end=12*HOUR;w=advanceFormal(w,end-1).world;expect(w.victory!.result).toBeNull();const restored=(await decodeSave(await encodeSave(w))).world,result=advanceFormal(w,end);expect(await advanceFormalCooperative(restored,end)).toEqual(result);expect(advanceFormal(restored,end)).toEqual(result);const offline=await advanceOfflineCooperative(restored,0,1);expect(offline.world.victory).toEqual(result.world.victory);expect(offline.reports.filter(r=>r.title==='正式征服勝利')).toHaveLength(1);expect(result.world.victory!.result!.kind).toBe('conquest');expect(result.reports.filter(r=>r.title==='正式征服勝利')).toHaveLength(1);
 w=result.world;const before=structuredClone(w),e={type:'victory.complete' as const,kind:'conquest' as const,scope:w.playerFactionId,id:w.victory!.result!.eventId,at:w.time},reports:import('./model').FormalReport[]=[];handleVictoryEvent(w,e,new EventScheduler(w.events),reports);expect(w).toEqual(before);expect(reports).toEqual([]);expect(advanceFormal(w,end+HOUR).reports).toEqual([]);
});
it('B9-5 loss of any condition clears continuous credit immediately and a fresh crossing requires all 12 hours',()=>{
 let w=sync(world());w=advanceFormal(w,6*HOUR).world;const first=w.victory!.candidates[0].eventId;w.cities[0].ownerFactionId=w.factions[70].id;invalidateSpatial(w);sync(w);expect(w.victory!.candidates).toEqual([]);expect(w.events.some(e=>e.id===first)).toBe(false);
 w=advanceFormal(w,8*HOUR).world;w.cities[0].ownerFactionId=w.playerFactionId;invalidateSpatial(w);sync(w);expect(w.victory!.candidates[0].startedAt).toBe(8*HOUR);expect(advanceFormal(w,20*HOUR-1).world.victory!.result).toBeNull();expect(advanceFormal(w,20*HOUR).world.victory!.result!.at).toBe(20*HOUR);
});
it('B9-5 missing or forged qualification clocks are rejected by native Save validation',()=>{
 const w=sync(world());validateFormalWorld(w);w.events.find(e=>e.type==='victory.complete')!.at--;expect(()=>validateFormalWorld(w)).toThrow();
});
const databases:FormalPersistence[]=[];afterEach(async()=>{for(const d of databases.splice(0))await d.db.delete();});
it('B9-5 formal Save/Load/Recovery preserve the real remaining victory clock without a second result',async()=>{
 const db=new FormalPersistence({suffix:'b95-victory-'+crypto.randomUUID()});databases.push(db);let w=await db.start(sync(world()));const result=advanceFormal(w,12*HOUR);w=await db.save(result.world,result.reports,w.revision);expect((await db.loadSave()).game!.victory).toEqual(w.victory);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovery=await db.loadSave();expect(recovery.recovered).toBe(true);expect(recovery.game!.victory!.result!.kind).toBe('conquest');expect(advanceFormal(recovery.game!,13*HOUR).reports.filter(r=>r.title==='正式征服勝利')).toHaveLength(0);
});
it('B9-5 actual conquest immediately invalidates and genuine reconquest restarts the formal clock',()=>{
 let w=world();for(const c of w.cities)if(c.ownerFactionId===w.playerFactionId)c.population=300;sync(w);const source=w.cities[70],target=w.cities[0];source.military!.units={knight:1000};w=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:source.id,mission:'conquest',target:{kind:'city',cityId:target.id},units:{knight:1000}},undefined,source.ownerFactionId)).world;
 let incoming=w.armies.find(a=>a.status==='outbound')!;expect(incoming.arrivalAt).toBeLessThan(12*HOUR);w=advanceFormal(w,incoming.arrivalAt!).world;expect(w.cities[0].ownerFactionId).toBe(source.ownerFactionId);expect(w.victory!.candidates.some(c=>c.scope===w.playerFactionId)).toBe(false);
 w.cities[1].military!.units={knight:1000};w=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[1].id,mission:'conquest',target:{kind:'city',cityId:target.id},units:{knight:1000}})).world;incoming=w.armies.find(a=>a.status==='outbound')!;w=advanceFormal(w,incoming.arrivalAt!).world;expect(w.cities[0].ownerFactionId).toBe(w.playerFactionId);const timer=w.victory!.candidates.find(c=>c.scope===w.playerFactionId)!;expect(timer.startedAt).toBe(w.time);expect(advanceFormal(w,w.time+12*HOUR-1).world.victory!.result).toBeNull();expect(advanceFormal(w,w.time+12*HOUR).world.victory!.result!.scope).toBe(w.playerFactionId);
});
