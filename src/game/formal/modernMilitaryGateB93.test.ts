import {it,expect} from 'vitest';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {changeCityOwner,settleCity,HOUR} from './economy';
import {resourceKeys,type FormalWorld,type FormalReport} from './model';
import {isMissionArmy} from './combatModel';
import {advanceFormal} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {validateFormalWorld} from './schema';
import {counterMultiplier,hitDamage} from './combatModifiers';
import {handleCombatEvent} from './battles';
import {EventScheduler} from './scheduler';
function finishDefense(input:FormalWorld){
 let w=input;const reports:FormalReport[]=[];const attacker=w.armies.filter(isMissionArmy).find(a=>a.status==='outbound');
 let next=w.combat!.battles[0]?.nextRoundAt??attacker!.arrivalAt;for(let rounds=0;rounds<50;rounds++){
  const t=advanceFormal(w,next);w=t.world;reports.push(...t.reports);
  if(!w.combat!.battles.length)return {world:w,reports};next=w.combat!.battles[0].nextRoundAt;
 }throw Error('Defense did not resolve');
}
for(const [label,converted,existingModern] of [['traditional',0,0],['full retrofit',10,0],['partial retrofit',4,0],['mixed preexisting trucks',4,3]] as const)for(const fate of ['held','mutual','captured'] as const)it(`B9-3 Gate ${label}: actual stationed defense ${fate}, report, return and save/load conserve supply vehicles`,async()=>{
 const lost=fate!=='held';
 let w=battlefield();const home=w.cities[0].id,host=w.cities[2].id;w.factions[0].modernQualification='full';changeCityOwner(w,w.cities[2],w.playerFactionId,'receive');
 const sent:Record<string,number>={militia:100,baggage:10,...(existingModern?{'modern.baggage':existingModern}:{})};w.cities[0].military!.units={...sent};w=arrive(dispatch(w,'reinforce',sent,0,2).world).world;
 const stationed=w.armies.filter(isMissionArmy)[0],identity={id:stationed.id,ownerFactionId:stationed.ownerFactionId,originCityId:stationed.originCityId},history=structuredClone(stationed.initialUnits);settleCity(w,w.cities[2]);const stock={...w.cities[2].stock},population=w.cities[2].population;
 if(converted)w=issue(w,{type:'military.modernize',cityId:host,armyId:identity.id,unitId:'baggage',count:converted}).world;
 const current=w.armies.filter(isMissionArmy).find(a=>a.id===identity.id)!;expect(current).toMatchObject(identity);expect(current.initialUnits).toEqual(history);expect(w.cities[2].population).toBe(population);
 for(const [r,price] of [['food',20],['wood',80],['stone',50],['gold',130]] as const)expect(w.cities[2].stock[r]).toBe(stock[r]-converted*price);
 const battleBefore={militia:100,...(10-converted?{baggage:10-converted}:{}),...(existingModern+converted?{'modern.baggage':existingModern+converted}:{})};expect(current.units).toEqual(battleBefore);
 const enemy={militia:fate==='captured'?250:fate==='mutual'?100:80};w.cities[1].military!.units={...enemy};w=dispatch(w,'conquest',enemy,1,2).world;
 const inTransit=(await decodeSave(await encodeSave(w))).world,arrival=w.armies.filter(isMissionArmy).find(a=>a.status==='outbound')!.arrivalAt,entered=advanceFormal(w,arrival);expect(advanceFormal(inTransit,arrival)).toEqual(entered);w=entered.world;expect(w.combat!.battles).toHaveLength(1);expect(w.combat!.battles[0].participants.find(p=>p.armyId===identity.id)!.before).toEqual(battleBefore);
 const loaded=(await decodeSave(await encodeSave(w))).world,result=finishDefense(w);expect(finishDefense(loaded)).toEqual(result);w=result.world;expect(result.reports).toHaveLength(1);
 const battle=result.reports[0].battle!,defender=battle.defenders.find(d=>d.armyId===identity.id)!;expect(defender.before).toEqual(battleBefore);expect(battle.outcome).toBe(fate==='captured'?'conquered':fate==='mutual'?'mutual-destruction':'held');
 const alive=defender.after.militia??0;if(lost)expect(alive).toBe(0);else{expect(alive).toBeGreaterThan(0);expect(alive).toBeLessThan(100);}
 let survivors=0;for(const [id,n] of [['baggage',10-converted],['modern.baggage',existingModern+converted]] as const){
  const expected=lost?0:n-Math.round(n*((100-alive)/100)**1.2);expect(defender.after[id]??0,id).toBe(expected);survivors+=expected;
 }
 expect(survivors).toBeLessThan(10+existingModern);expect(w.cities[0].military!.units).toEqual({});
 const final=w.combat!.receipts.find(r=>r.kind==='final'&&r.battleId===battle.battleId)!,snapshot=structuredClone(w);expect(handleCombatEvent(w,{type:'combat.round',battleId:battle.battleId,id:final.eventId,at:final.at},new EventScheduler(w.events))).toEqual([]);expect(w).toEqual(snapshot);
 if(lost){const empty=w.armies.filter(isMissionArmy).find(a=>a.id===identity.id);if(empty){expect(empty.units).toEqual({});expect(empty.initialUnits).toEqual(history);w=(await decodeSave(await encodeSave(w))).world;w=issue(w,{type:'army.recall',cityId:host,armyId:identity.id}).world;}expect(w.armies.some(a=>a.id===identity.id)).toBe(false);const restored=(await decodeSave(await encodeSave(w))).world,next=w.time+HOUR;expect(advanceFormal(restored,next)).toEqual(advanceFormal(w,next));w=advanceFormal(w,next).world;expect(w.cities[0].military!.units).toEqual({});}
 else{
  const remaining=w.armies.filter(isMissionArmy).find(a=>a.id===identity.id)!;expect(remaining).toMatchObject(identity);expect(remaining.initialUnits).toEqual(history);expect(remaining.units).toEqual(defender.after);
  w=issue(w,{type:'army.recall',cityId:host,armyId:identity.id}).world;const returning=w.armies.filter(isMissionArmy).find(a=>a.id===identity.id)!;expect(returning.initialUnits).toEqual(history);expect(returning.returnCityId).toBe(home);
  const restored=(await decodeSave(await encodeSave(w))).world,returned=advanceFormal(w,returning.arrivalAt);expect(advanceFormal(restored,returning.arrivalAt)).toEqual(returned);w=returned.world;expect(w.armies.some(a=>a.id===identity.id)).toBe(false);expect(w.cities[0].military!.units).toEqual(defender.after);
 }
 expect(resourceKeys.every(r=>Number.isSafeInteger(w.cities[2].stock[r]))).toBe(true);validateFormalWorld(w);
});
for(const [traditional,modern,bonus] of [['militia','modern.militia',2],['swordsman','modern.militia',2],['spearman','modern.spearman',2],['pikeman','modern.spearman',2],['archer','modern.archer',1.8],['crossbowman','modern.archer',1.8],['skirmisher','modern.skirmisher',1.8],['heavy-skirmisher','modern.skirmisher',1.8]] as const)it(`B9-3 Gate royal sniper special counters distinguish ${traditional} from ${modern}`,()=>{
 expect(counterMultiplier('modern.guard.civ_britannia',traditional)).toBe(1);expect(counterMultiplier('modern.guard.civ_britannia',modern)).toBe(bonus);
});
it('B9-3 Gate royal sniper retains era damage and guard-specific conditions without multiplying modern bonuses onto traditional targets',()=>{
 const id='modern.guard.civ_britannia';expect(hitDamage(id,'militia',undefined,undefined)).toBe(54);expect(hitDamage(id,'archer',undefined,undefined)).toBe(54);expect(hitDamage(id,'modern.militia',undefined,undefined)).toBe(35);expect(hitDamage(id,'modern.archer',undefined,undefined)).toBeCloseTo(31.4);
 expect(counterMultiplier('guard.civ_britannia','militia')).toBe(1.8);expect(counterMultiplier('guard.civ_britannia','spearman')).toBe(1.6);expect(counterMultiplier(id,'modern.guard.civ_japan')).toBe(1.5);expect(counterMultiplier(id,'guard.civ_japan')).toBe(1);expect(counterMultiplier(id,'modern.guard.civ_byzantium')).toBe(1);expect(counterMultiplier(id,'modern.guard.civ_mongolia')).toBe(1);
});
