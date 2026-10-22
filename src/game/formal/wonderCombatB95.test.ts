import {expect,it} from 'vitest';
import {endgameWorld,act} from './endgameTestSupport';
import {advanceFormal} from './reducer';
import {isMissionArmy} from './combatModel';
import {makePools} from './combatResolver';
import {wonderBombardment} from './siege';
import {encodeSave,decodeSave} from './saveCodec';
import {handleCombatEvent} from './battles';
import {EventScheduler} from './scheduler';
import {order} from './developmentTestSupport';
import {submitFormalOrder} from './reducer';
import type {FormalWorld} from './model';
function send(w:FormalWorld,units:Record<string,number>,mission:'wonder-destruction'|'conquest'='wonder-destruction'){
 w.cities[0].military!.units={...units};return act(w,{type:'army.dispatch',cityId:w.cities[0].id,mission,target:{kind:'city',cityId:w.cities[2].id},units,...(mission==='conquest'?{wonderPriority:true}:{} )});
}
function resolve(w:FormalWorld){const reports:import('./model').FormalReport[]=[];for(let i=0;i<100;i++){const next=w.combat!.battles[0]?.nextRoundAt??w.armies.filter(isMissionArmy).find(a=>a.status==='outbound')?.arrivalAt;if(next===undefined)return{world:w,reports};const t=advanceFormal(w,next);w=t.world;reports.push(...t.reports);if(!w.combat!.battles.length&&!w.armies.some(a=>a.status==='outbound'))return{world:w,reports};}throw Error('Mission did not resolve');}
for(const [unit,tiers,modern,expected] of [['catapult',0,false,45],['catapult',2,false,54],['catapult',2,true,54],['modern.catapult',2,false,54],['modern.catapult',2,true,64.8]] as const)it(`B9-5 actual ${unit} bombardment tiers=${tiers} modern-tech=${modern}`,()=>{
 const w=endgameWorld(),f=w.factions[0];if(tiers)f.techIds.push('siege.projection.1','siege.projection.2');if(modern)f.techIds.push('modern.siege-engineering');expect(wonderBombardment(w,makePools({[unit]:1},f.id,w.cities[0].id,null,f))).toBe(expected);
});
it('B9-5 destroys a wonder behind intact Lv15 walls, returns survivors, preserves ownership and deduplicates actual battle/save',async()=>{
 let w=endgameWorld(true);w.cities[2].wallLevel=15;const owner=w.cities[2].ownerFactionId;w=send(w,{catapult:3000});const transit=(await decodeSave(await encodeSave(w))).world,result=resolve(w);expect(resolve(transit)).toEqual(result);w=result.world;
 const p=result.reports.find(r=>r.battle)!.battle!;expect(p.mission).toBe('wonder-destruction');expect(p.outcome).toBe('wonder-destroyed');expect(p.siegeRounds).toBe(1);expect(p.wonder?.damage).toBe(120000);expect(p.wonder?.after).toBe(0);expect(w.cities[2].wallLevel).toBe(15);expect(w.cities[2].ownerFactionId).toBe(owner);expect(w.armies.filter(isMissionArmy)[0].status).toBe('returning');expect(w.largeProjects[1].breakthrough!.phase).toBe('paused');
 const receipt=w.combat!.receipts.find(r=>r.kind==='final')!,before=structuredClone(w);expect(handleCombatEvent(w,{type:'combat.round',battleId:p.battleId,id:receipt.eventId,at:receipt.at},new EventScheduler(w.events))).toEqual([]);expect(w).toEqual(before);expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
 const army=w.armies.filter(isMissionArmy)[0];w=advanceFormal(w,army.arrivalAt).world;expect(w.cities[0].military!.units.catapult).toBe(3000);expect(w.cities[2].ownerFactionId).toBe(owner);
});
it('B9-5 a 12-round failure persists partial numeric damage, exact five-minute spacing and remaining rounds through save/load',async()=>{
 let w=send(endgameWorld(),{catapult:1});w=advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt).world;
 expect(w.combat!.battles[0].siegeRound).toBe(1);expect(w.combat!.battles[0].nextRoundAt-w.time).toBe(300000);
 w=(await decodeSave(await encodeSave(w))).world;const loaded=structuredClone(w),result=resolve(w);expect(resolve(loaded)).toEqual(result);w=result.world;const p=result.reports.find(r=>r.battle)!.battle!;
 expect(p.siegeRounds).toBe(12);expect(p.conquestReason).toBe('wonder-timeout');expect(p.outcome).toBe('wonder-held');expect(p.wonder!.damage).toBe(540);expect(w.largeProjects[0].wonder!.durability!.current).toBe(119460);expect(w.largeProjects[0].wonder!.durability!.ledger).toHaveLength(12);expect(w.cities[2].ownerFactionId).toBe(w.factions[1].id);
});
it('B9-5 actual guarding battle must clear defenders before bombardment; lost catapults fail without damage',()=>{
 let w=endgameWorld();w.cities[2].military!.units={'modern.knight':200};w=send(w,{catapult:1,militia:1});const result=resolve(w);expect(result.reports.find(r=>r.battle)!.battle!.outcome).toBe('wonder-held');expect(result.world.largeProjects[0].wonder!.durability!.ledger).toHaveLength(0);expect(result.world.cities[2].ownerFactionId).toBe(w.factions[1].id);
});
it('B9-5 conquest may damage the wonder but still requires normal occupiers and wall clearance',()=>{
 let w=endgameWorld();w.cities[2].wallLevel=0;w=send(w,{militia:5000,catapult:10},'conquest');const result=resolve(w),p=result.reports.find(r=>r.battle)!.battle!;
 expect(p.outcome).toBe('conquered');expect(result.world.cities[2].ownerFactionId).toBe(w.playerFactionId);expect(p.wonder!.damage).toBe(450);expect(result.world.largeProjects[0].wonder!.durability!.current).toBe(119550);
});
it('B9-5 malformed targeting, absent catapults and hostile permissions use the same formal command rejection',()=>{
 const w=endgameWorld();w.cities[0].military!.units={militia:10,catapult:1};
 for(const [mission,units,target] of [['wonder-destruction',{militia:10},w.cities[2].id],['wonder-destruction',{catapult:1},w.cities[1].id]] as const){const before=structuredClone(w),t=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission,units,target:{kind:'city',cityId:target}}));expect(t.ack?.status).toBe('rejected');expect(w).toEqual(before);}
});
