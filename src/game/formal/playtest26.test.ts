import {it,expect} from 'vitest';
import {make,rich,build,commit,reject} from './developmentTestSupport';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {advanceFormal} from './reducer';
import {validateFormalWorld} from './schema';
import {effectiveSpeed,protectedFaction,SHIELD_DURATION} from './playtest';
import {storageCapacity} from './catalogB3';
import {advanceOffline} from './offline';
import {tacticalRoundWorldMs} from './battles';
import {isMissionArmy} from './combatModel';
it('developer controls use the current campaign, 200X offline clock and normal 10X conquest ceiling',()=>{
 let w=make();const campaign=w.campaignId,normal=w.speed;w=commit(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:200,shield:true});
 expect(w.campaignId).toBe(campaign);expect(w.speed).toBe(normal);expect(effectiveSpeed(w)).toBe(200);expect(tacticalRoundWorldMs(effectiveSpeed(w))/effectiveSpeed(w)).toBe(tacticalRoundWorldMs(50)/50);expect(w.cities[0].stock.food).toBe(1e9);expect(w.cities[1].stock.food).toBeLessThan(1e9);expect(protectedFaction(w,w.playerFactionId)).toBe(true);expect(w.factions[0].protectionUntil).toBe(w.time+SHIELD_DURATION);
 expect(advanceOffline(w,1000,2000).world.time-w.time).toBe(200000);w=commit(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:false,speed:200});expect(effectiveSpeed(w)).toBe(normal);expect(w.cities[0].developerResources).toBeUndefined();expect(w.cities[0].stock.food).toBeLessThanOrEqual(storageCapacity(w.cities[0]));expect(protectedFaction(w,w.playerFactionId)).toBe(true);validateFormalWorld(w);
});
it('whole building demolition frees its slot, preserves population, stops growth and can rebuild housing',()=>{
 let w=make();rich(w);const c=w.cities[0],start=c.population;w=commit(w,{type:'building.demolish',cityId:c.id,key:'residence'});const j=w.cities[0].economy!.construction[0];expect(j.durationMs).toBe(15*15*60000);expect(j.toLevel).toBe(0);expect(j.paidResources).toBeUndefined();w=advanceFormal(w,j.startsAt+j.durationMs).world;const after=w.cities[0];expect(after.buildings.residence).toBeUndefined();expect(after.economy!.slots.residence).toBeUndefined();expect(after.population).toBeGreaterThanOrEqual(start);expect(after.housing).toBe(400);expect(after.housingShortage).toBe(true);validateFormalWorld(w);
 const pop=after.population;w=advanceFormal(w,w.time+3600000).world;expect(w.cities[0].population).toBe(pop);w=commit(w,{type:'building.upgrade',cityId:c.id,key:'residence'});expect(w.cities[0].economy!.construction[0].toLevel).toBe(1);
});
it('demolition cancellation returns no materials, preserves building and rejects duplicate upgrading',()=>{
 let w=make();rich(w);build(w.cities[0],'mill',3);w=commit(w,{type:'building.demolish',cityId:w.cities[0].id,key:'mill'});const j=w.cities[0].economy!.construction[0],stock={...w.cities[0].stock};reject(w,{type:'building.upgrade',cityId:w.cities[0].id,key:'mill'});w=commit(w,{type:'construction.cancel',cityId:w.cities[0].id,constructionCommandId:j.commandId});expect(w.cities[0].buildings.mill).toBe(3);expect(w.cities[0].stock).toEqual(stock);expect(w.events.some(e=>e.id===j.eventId)).toBe(false);validateFormalWorld(w);
});
it('warehouse demolition reconciles real storage; fixed center and active training buildings reject atomically',()=>{
 let w=make();rich(w);build(w.cities[0],'barracks',1);reject(w,{type:'building.demolish',cityId:w.cities[0].id,key:'center'});w=commit(w,{type:'military.recruit',cityId:w.cities[0].id,unitId:'militia',count:1});reject(w,{type:'building.demolish',cityId:w.cities[0].id,key:'barracks'});w=commit(w,{type:'building.demolish',cityId:w.cities[0].id,key:'warehouse.0'});const j=w.cities[0].economy!.construction[0];w=advanceFormal(w,j.startsAt+j.durationMs).world;for(const stock of Object.values(w.cities[0].stock))expect(stock).toBeLessThanOrEqual(800);validateFormalWorld(w);
});
it('shield blocks hostile dispatch and arrival; successful city scouting clears the issuer shield',()=>{
 let w=battlefield();w.cities[0].military!.units={scout:2};w=commit(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:50,shield:true});w=dispatch(w,'scout',{scout:2}).world;expect(protectedFaction(w,w.playerFactionId)).toBe(false);w.factions.find(f=>f.id===w.cities[1].ownerFactionId)!.protectionUntil=w.time+SHIELD_DURATION;const t=arrive(w);expect(t.world.armies.filter(isMissionArmy)[0].status).toBe('returning');expect(t.world.armies.filter(isMissionArmy)[0].pendingIntel).toBeUndefined();expect(t.reports[0].battle?.outcome).toBe('no-target');
 const fresh=battlefield();fresh.cities[0].military!.units={militia:10};fresh.factions.find(f=>f.id===fresh.cities[1].ownerFactionId)!.protectionUntil=SHIELD_DURATION;reject(fresh,{type:'army.dispatch',cityId:fresh.cities[0].id,mission:'raid',target:{kind:'city',cityId:fresh.cities[1].id},units:{militia:10}});
});
it('turning protection on during conquest stops the next round without damage and resolves exactly once',()=>{
 let w=battlefield();w.cities[0].military!.units={militia:100};w.cities[1].military!.units={militia:100};w=dispatch(w,'conquest',{militia:100},1,0).world;w=arrive(w).world;expect(w.combat!.battles).toHaveLength(1);w=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:200,shield:true}).world;const before={...w.cities[0].military!.units},round=w.combat!.battles[0].round,at=w.combat!.battles[0].nextRoundAt;const t=advanceFormal(w,at);w=t.world;expect(w.cities[0].military!.units).toEqual(before);expect(w.combat!.battles).toHaveLength(0);expect(w.combat!.receipts.filter(r=>r.kind==='round')).toHaveLength(round);expect(w.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);expect(w.armies.filter(isMissionArmy).every(a=>a.status==='returning')).toBe(true);validateFormalWorld(w);expect(advanceFormal(w,at).reports).toHaveLength(0);
});
