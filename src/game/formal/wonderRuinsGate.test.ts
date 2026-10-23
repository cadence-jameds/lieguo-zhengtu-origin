import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {endgameWorld,nativeEndgameWorld,act} from './endgameTestSupport';
import {enableAutonomy} from './autonomy';
import {advanceFormal,submitFormalOrder} from './reducer';
import {applyWonderDamage} from './wonderCondition';
import {canDestroyWonder} from './wonder';
import {EventScheduler} from './scheduler';
import {eventId,resolutionId} from './ids';
import {order} from './developmentTestSupport';
import {isMissionArmy} from './combatModel';
import {handleCombatEvent} from './battles';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {FormalPersistence} from '../persistence';
import {validateFormalWorld} from './schema';
import {HOUR} from './time';
import type {FormalWorld} from './model';

function hit(w:FormalWorld,damage:number){const s=new EventScheduler(w.events);applyWonderDamage(w,w.largeProjects[0].projectId,{type:'fixture.marker',marker:'ruins-gate',id:eventId('ruins-gate'),at:w.time},resolutionId('ruins-gate'),damage,s);w.events=s.snapshot();return validateFormalWorld(w);}
function dispatch(w:FormalWorld,count:number,priority=false){return act(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:priority?'conquest':'wonder-destruction',target:{kind:'city',cityId:w.cities[2].id},units:priority?{catapult:count,militia:100}:{catapult:count},...(priority?{wonderPriority:true}:{})});}
function outbound(w:FormalWorld){return w.armies.filter(isMissionArmy).find(a=>a.status==='outbound')!;}
function constructing(){let w=endgameWorld();w.largeProjects=w.largeProjects.filter(p=>p.wonder);const p=w.largeProjects[0],b=p.wonder!,t=p.shipments[0];delete b.durability;delete b.integrity;delete b.clock;p.createdAt=w.time;b.phase='building';b.startedAt=w.time;b.completedAt=null;t.dispatchedAt=w.time;t.authorizationSnapshot.checkedAt=w.time;if(t.phase!=='arrived')throw Error('History missing');t.arrivedAt=w.time;w.events.push({type:'wonder.complete',projectId:p.projectId,id:b.completionEventId!,at:w.time+p.durationMs});return advanceFormal(w,w.time+9.6*HOUR).world;}

it('B9 Final Gate a real AI arrival at pre-destroyed ruins grants no unearned garrison intelligence',()=>{
 let w=nativeEndgameWorld();enableAutonomy(w);const c=w.cities[31],id=c.ownerFactionId,target=w.cities[0];c.military!.units={catapult:1};target.military!.units={militia:25};w=act(w,{type:'army.dispatch',cityId:c.id,mission:'wonder-destruction',target:{kind:'city',cityId:target.id},units:{catapult:1}},id);const at=outbound(w).arrivalAt;
 for(const a of w.autonomy!.agents){a.nextAt=at+HOUR;const e=w.events.find(e=>e.id===a.eventId)!;e.at=a.nextAt;}hit(w,120000);const intel=structuredClone(w.autonomy!.agents.find(a=>a.factionId===id)!.intel),result=advanceFormal(w,at);expect(result.world.combat!.receipts.find(r=>r.kind==='final')?.outcome).toBe('no-target');expect(result.world.autonomy!.agents.find(a=>a.factionId===id)!.intel).toEqual(intel);expect(result.world.cities[0].military!.units).toEqual({militia:25});expect(result.world.combat!.statistics.wonderDestructions??0).toBe(0);
});

it.each(['intact','damaged','construction'] as const)('B9 Final Gate %s positive HP accepts a real destruction order',state=>{
 let w=state==='construction'?constructing():endgameWorld();if(state==='damaged')w=hit(w,60000);w.cities[0].military!.units={catapult:1};expect(canDestroyWonder(w,w.largeProjects[0])).toBe(true);w=dispatch(w,1);const result=advanceFormal(w,outbound(w).arrivalAt);expect(result.world.largeProjects[0].wonder!.durability!.ledger.at(-1)).toMatchObject({kind:'damage',amount:45});expect(result.world.combat!.battles[0].siegeRound).toBe(1);
});
it.each(['player','ai'] as const)('B9 Final Gate %s cannot redispatch against zero HP ruins or lose troops/stock',role=>{
 const w=hit(endgameWorld(),120000);w.factions[0].role=role;w.cities[0].military!.units={catapult:1};const before=structuredClone(w),t=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'wonder-destruction',target:{kind:'city',cityId:w.cities[2].id},units:{catapult:1}}));expect(canDestroyWonder(w,w.largeProjects[0])).toBe(false);expect(t.ack?.status).toBe('rejected');expect(t.world).toBe(w);expect(w).toEqual(before);
});
it('B9 Final Gate construction ruins remain invalid while time passes; ordinary priority conquest remains legal',()=>{
 let w=hit(constructing(),120000);const maximum=w.largeProjects[0].wonder!.durability!.maximum;w=advanceFormal(w,w.time+HOUR).world;expect(w.largeProjects[0].wonder!.durability!.maximum).toBe(maximum);expect(canDestroyWonder(w,w.largeProjects[0])).toBe(false);
 w.cities[0].military!.units={militia:100,catapult:1};w.cities[2].wallLevel=0;w=dispatch(w,1,true);const t=advanceFormal(w,outbound(w).arrivalAt);expect(t.reports.find(r=>r.battle)?.battle).toMatchObject({outcome:'conquered'});expect(t.world.cities[2].ownerFactionId).toBe(w.playerFactionId);expect(t.world.largeProjects[0].wonder!.durability!.current).toBe(0);expect(t.world.combat!.statistics.wonderDestructions??0).toBe(0);
});
it('B9 Final Gate two dispatched armies yield one real destruction and a harmless changed-target return',async()=>{
 let w=endgameWorld(true);w.cities[0].military!.units={catapult:3001};w=dispatch(w,3000);w=dispatch(w,1);const at=outbound(w).arrivalAt,loaded=(await decodeSave(await encodeSave(w))).world,result=advanceFormal(w,at);expect(advanceFormal(loaded,at)).toEqual(result);
 const reports=result.reports.filter(r=>r.battle).map(r=>r.battle!);expect(reports.map(p=>p.outcome)).toEqual(['wonder-destroyed','no-target']);expect(reports[0].wonder).toMatchObject({damage:120000,after:0});expect(reports[1].wonder?.damage??0).toBe(0);expect(reports[1].rounds).toBe(0);expect(result.world.combat!.statistics.wonderDestructions).toBe(1);expect(result.world.largeProjects[0].wonder!.durability!.ledger).toHaveLength(1);expect(result.world.armies.filter(isMissionArmy).every(a=>a.status==='returning')).toBe(true);
 const before=structuredClone(result.world),s=new EventScheduler(before.events);for(const r of before.combat!.receipts.filter(r=>r.kind==='final'))expect(handleCombatEvent(before,{type:'combat.round',battleId:r.battleId,id:r.eventId,at:r.at},s)).toEqual([]);expect(before).toEqual(result.world);validateFormalWorld(before);
});
it('B9 Final Gate an active battle cannot claim another damage event as its own destruction',async()=>{
 let w=endgameWorld(true);w.cities[0].military!.units={catapult:1};w=dispatch(w,1);w=advanceFormal(w,outbound(w).arrivalAt).world;expect(w.combat!.battles[0].wonder!.damage).toBe(45);hit(w,120000);w=(await decodeSave(await encodeSave(w))).world;const result=advanceFormal(w,w.combat!.battles[0].nextRoundAt),p=result.reports.find(r=>r.battle)!.battle!;expect(p).toMatchObject({outcome:'wonder-held',conquestReason:'wonder-unavailable',siegeRounds:1,wonder:{damage:45}});expect(result.world.combat!.statistics.wonderDestructions??0).toBe(0);expect(result.world.largeProjects[0].wonder!.durability!.ledger).toHaveLength(2);validateFormalWorld(result.world);
});
it.each([1,3,6,10,25] as const)('B9 Final Gate %sX Save/Load and offline preserve twelve effective rounds with no success statistic',async speed=>{
 let w=endgameWorld();w.speed=speed;w.cities[0].military!.units={catapult:1};w=dispatch(w,1);w=advanceFormal(w,outbound(w).arrivalAt).world;const end=w.time+11*300000,loaded=(await decodeSave(await encodeSave(w))).world,direct=advanceFormal(w,end),offline=await advanceOfflineCooperative(loaded,0,(end-loaded.time)/speed);expect(offline.world.largeProjects).toEqual(direct.world.largeProjects);expect(offline.world.combat).toEqual(direct.world.combat);
 const p=direct.reports.find(r=>r.battle)!.battle!;expect(p).toMatchObject({outcome:'wonder-held',siegeRounds:12,wonder:{damage:540}});expect(p.siegeHistory!.every((r,i)=>i===0||r.at-p.siegeHistory![i-1].at===300000)).toBe(true);expect(direct.world.combat!.statistics.wonderDestructions??0).toBe(0);expect(direct.world.largeProjects[0].wonder!.durability!.ledger).toHaveLength(12);const before=structuredClone(direct.world),r=before.combat!.receipts.find(r=>r.kind==='final')!;handleCombatEvent(before,{type:'combat.round',battleId:p.battleId,id:r.eventId,at:r.at},new EventScheduler(before.events));expect(before).toEqual(direct.world);
});
it('B9 Final Gate Recovery and offline retain one destruction, zero extra receipts and an invalid ruins target',async()=>{
 let w=endgameWorld();w.cities[0].military!.units={catapult:3001};w=dispatch(w,3000);w=dispatch(w,1);const db=new FormalPersistence({suffix:'ruins-gate-'+crypto.randomUUID()});
 try{w=await db.start(w);const end=outbound(w).arrivalAt,direct=advanceFormal(w,end),offline=await advanceOfflineCooperative(structuredClone(w),0,(end-w.time)/w.speed);expect(offline.world.largeProjects).toEqual(direct.world.largeProjects);expect(offline.world.combat).toEqual(direct.world.combat);w=await db.save(direct.world,direct.reports,w.revision);const backup=(await db.backupList())[0];await db.restore(backup.id);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovered=await db.loadSave();expect(recovered.recovered).toBe(true);expect(recovered.game!.largeProjects).toEqual(w.largeProjects);expect(recovered.game!.combat).toEqual(w.combat);expect(canDestroyWonder(recovered.game!,recovered.game!.largeProjects[0])).toBe(false);expect(advanceFormal(recovered.game!,recovered.game!.time).reports).toEqual([]);}finally{await db.db.delete();}
});
