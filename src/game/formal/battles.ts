import {applyWonderDamage,reconcileWonders,settleWonderDurability} from './wonderCondition';
import {effectiveAwareness,recordModernRound,recordModernConquest} from './modernAwareness';
import {isSupplyUnit,scoutUnits,scoutCount,removeScouts} from './unitCatalog';
import {rememberBattle,memoryFor} from './aiKnowledge';
import {exileUnits,defeatExile,deliverCraftsmen,discardCapturedArmies,type ExileSite} from './extinction';
import {conquestOwner,legionOf,empireOf} from './politics';
import {wildSiteName} from './wildSiteNames';
import {proportionalResources} from './banditLoot';
import {protectedFaction,effectiveSpeed} from './playtest';
import {armyId,battleId,reportId,resolutionId,sequenceKey,type EventId,type FactionId} from './ids';
import type {FormalCity,FormalEvent,FormalReport,FormalWorld,Resources} from './model';
import {resourceKeys,zeroResources} from './model';
import type {BattleParticipant,BattleReportPayload,BattleState,MissionArmy,ResolutionReceipt} from './combatModel';
import {initialCombat,isMissionArmy,type ConquestReason} from './combatModel';
import {ensureBattleProgress,battleLog,SIEGE_ROUND_LIMIT,CONQUEST_REASON_LABELS} from './battleProgress';
import {applySupplyLoss,effectiveCount,exchange,makePools,type CombatPool} from './combatResolver';
import {carryCapacity,effectiveUnit,scoutPower,baseUnit} from './combatModifiers';
import {raidable} from './catalogB3';
import {addStock,enqueue,settleCity,settleFaction} from './economy';
import {developmentLevels,finalizeSiegeHousing,finishConquest,resolveSiege,wonderBombardment,durabilityPrecision} from './siege';
import {spatial,invalidateSpatial} from './spatial';
import {canReinforce,hostileAllowed,removeArmy,returnArmy} from './armies';
import {clearWild,respawnWild} from './wildLifecycle';
import type {EventScheduler} from './scheduler';
export const tacticalRoundWorldMs=(speed:number)=>300000*speed/Math.min(speed,10);
const rid=(id:BattleState['id'],suffix:string)=>resolutionId(`${id.slice(7)}.${suffix}`);
function commitReceipt(w:FormalWorld,r:ResolutionReceipt){const state=w.combat??=initialCombat();if(state.receipts.some(x=>x.resolutionId===r.resolutionId))return false;state.receipts.push(r);return true;}
function playerScope(w:FormalWorld,owners:readonly (FactionId|null)[]){const player=w.factions.find(f=>f.id===w.playerFactionId)!;return owners.some(id=>id===player.id||id!==null&&!!legionOf(w,player.id)&&legionOf(w,id)?.id===legionOf(w,player.id)?.id||id!==null&&player.empireId!==null&&w.factions.find(f=>f.id===id)?.empireId===player.empireId);}
function battleReport(w:FormalWorld,p:BattleReportPayload):FormalReport[]{
 rememberBattle(w,p);
 if(p.mission==='scout'&&p.intel&&!p.attackers.some(a=>a.ownerFactionId===w.playerFactionId))return[];
  if(!playerScope(w,[...p.attackers,...p.defenders].map(x=>x.ownerFactionId)))return[];const sequence=w.sequences.report++;
 const labels:Record<BattleReportPayload['outcome'],string>={'wonder-destroyed':'奇觀破壞成功','wonder-held':'奇觀破壞失敗','raid-return':'掠奪結束',conquered:'征服成功',held:'征服未成','mutual-destruction':'雙方主戰兵全滅','wild-cleared':'野外據點擊破','wild-held':'野外據點守住','no-target':'目標已改變','scout-success':'偵察情報送達','scout-failed':'偵察失敗'};
 const visible=structuredClone(p);if(p.mission==='scout')visible.wallBefore=visible.wallAfter=visible.populationBefore=visible.populationAfter=0;if(p.mission==='scout'&&!p.intel&&playerScope(w,p.attackers.map(g=>g.ownerFactionId)))visible.defenders=p.target.kind==='city'?[{ownerFactionId:p.ownerBefore,armyId:null,cityId:p.target.cityId,before:{},after:{}}]:[];return[{id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:w.playerFactionId,at:w.time,category:p.mission==='scout'?'scout':'battle',title:`${p.mission==='scout'&&p.outcome==='scout-failed'&&p.defenders.some(d=>d.ownerFactionId===w.playerFactionId)?'反偵察成功':p.conquestReason?CONQUEST_REASON_LABELS[p.conquestReason]:labels[p.outcome]}｜${p.targetName}`,text:`${p.rounds} ${p.mission==='conquest'?'主戰回合':'回合'}；${p.conquestReason?CONQUEST_REASON_LABELS[p.conquestReason]:labels[p.outcome]}。`,battle:visible}];
}
function recordStatistics(w:FormalWorld,p:BattleReportPayload){const stats=w.combat!.statistics;stats.resolved++;if(p.mission==='scout')stats.scouts++;else if(p.target.kind==='wild')stats.wild++;else if(p.mission==='raid')stats.raids++;else if(p.mission==='wonder-destruction')stats.wonderDestructions=(stats.wonderDestructions??0)+1;else stats.conquests++;}
function finishReceipt(w:FormalWorld,p:BattleReportPayload,eventId:EventId){const before=w.factions.find(f=>f.id===p.ownerBefore),after=w.factions.find(f=>f.id===p.ownerAfter);const ok=commitReceipt(w,{battleId:p.battleId,resolutionId:p.resolutionId,eventId,at:w.time,round:p.rounds,kind:'final',...(p.targetPoint?{targetPoint:{...p.targetPoint}}:{}),mission:p.mission,outcome:p.outcome,ownerBefore:p.ownerBefore,ownerAfter:p.ownerAfter,qualificationBefore:before?.modernQualification,qualificationAfter:after?.modernQualification});if(ok){recordStatistics(w,p);recordModernConquest(w,p);}return ok;}
function participant(w:FormalWorld,units:Record<string,number>,owner:FactionId|null,city:FormalCity['id']|null,army:MissionArmy['id']|null):BattleParticipant{return{...(owner&&legionOf(w,owner)?{legionName:legionOf(w,owner)!.name}:{}),...(owner&&empireOf(w,owner)?{empireName:empireOf(w,owner)!.name}:{}),ownerFactionId:owner,cityId:city,armyId:army,before:{...units},after:{...units}};}
function stationed(w:FormalWorld,c:FormalCity){return w.armies.filter(isMissionArmy).filter(a=>a.status==='stationed'&&a.target.kind==='city'&&a.target.cityId===c.id&&canReinforce(w,a.ownerFactionId,c.ownerFactionId));}
function defensiveGroups(w:FormalWorld,c:FormalCity){return[{units:c.military?.units??{},owner:c.ownerFactionId,source:c.id,army:null as MissionArmy|null},...stationed(w,c).map(a=>({units:a.units,owner:a.ownerFactionId,source:a.originCityId,army:a}))];}
function poolsFor(w:FormalWorld,units:Record<string,number>,owner:FactionId|null,source:FormalCity['id']|null,a:MissionArmy|null){return makePools(units,owner,source,a?.id??null,w.factions.find(f=>f.id===owner));}
function writePools(w:FormalWorld,c:FormalCity|null,pools:readonly CombatPool[]){for(const p of pools){const units=p.armyId?w.armies.find(a=>a.id===p.armyId)?.units:c?.military?.units;if(!units)continue;if(p.count)units[p.unitId]=p.count;else delete units[p.unitId];}}
function syncPools(w:FormalWorld,old:CombatPool[],groups:ReturnType<typeof defensiveGroups>,participants:BattleParticipant[]){
 const fresh:CombatPool[]=[];for(const g of groups){const known=participants.some(p=>p.armyId===(g.army?.id??null)&&p.cityId===g.source);if(!known)participants.push(participant(w,g.units,g.owner,g.source,g.army?.id??null));for(const p of poolsFor(w,g.units,g.owner,g.source,g.army)){const prior=old.find(x=>x.key===p.key);if(prior&&prior.ownerFactionId===p.ownerFactionId){const added=p.count-prior.count,hp=prior.hpPerUnit===p.hpPerUnit?prior.hp:prior.hp*p.hpPerUnit/prior.hpPerUnit;fresh.push({...prior,hpPerUnit:p.hpPerUnit,count:p.count,hp:added>=0?hp+added*p.hpPerUnit:Math.min(hp,p.count*p.hpPerUnit),initialCount:prior.initialCount+Math.max(0,added)});if(added>0){const item=participants.find(x=>x.armyId===(g.army?.id??null)&&x.cityId===g.source)!;item.before[p.unitId]=(item.before[p.unitId]??0)+added;}}else{fresh.push(p);if(known){const item=participants.find(x=>x.armyId===(g.army?.id??null)&&x.cityId===g.source)!;item.before[p.unitId]=(item.before[p.unitId]??0)+p.count;}}}}
 return fresh;
}
function updateParticipants(w:FormalWorld,c:FormalCity|null,items:BattleParticipant[]){return items.map(p=>p.departedAt!==undefined?p:({...p,after:{...(p.armyId?w.armies.find(a=>a.id===p.armyId)?.units:c?.military?.units??{})}}));}
/** Carry allocation conserves each resource and uses only surviving units, in stable ArmyId order. */
export function takeLoot(available:Resources,capacity:number){const total=resourceKeys.reduce((n,r)=>n+available[r],0),budget=Math.min(total,Math.max(0,Math.floor(capacity))),out=zeroResources();if(!total)return out;for(const r of resourceKeys)out[r]=Math.floor(available[r]*budget/total);let remainder=budget-resourceKeys.reduce((n,r)=>n+out[r],0);for(const r of resourceKeys){const extra=Math.min(remainder,available[r]-out[r]);out[r]+=extra;remainder-=extra;}return out;}
function distributeLoot(w:FormalWorld,armies:MissionArmy[],available:Resources,proportional=false){const result=zeroResources(),remaining={...available};for(const a of [...armies].sort((a,b)=>a.id<b.id?-1:1)){const capacity=carryCapacity(a.units,w.factions.find(f=>f.id===a.ownerFactionId)),cargo=proportional?proportionalResources(remaining,Math.min(resourceKeys.reduce((n,r)=>n+remaining[r],0),Math.max(0,Math.floor(capacity)))):takeLoot(remaining,capacity);a.cargo=cargo;for(const r of resourceKeys){remaining[r]-=cargo[r];result[r]+=cargo[r];}}return result;}
function applyBaggage(a:MissionArmy,won:boolean){applySupplyLoss(a.units,a.initialUnits,won);}
function basePayload(w:FormalWorld,a:MissionArmy,name:string,c:FormalCity|null):BattleReportPayload{return{battleId:a.battleId,resolutionId:rid(a.battleId,'final'),mission:a.mission==='scout'?'scout':a.mission==='conquest'?'conquest':a.mission==='wonder-destruction'?'wonder-destruction':'raid',target:{...a.target},targetName:name,targetPoint:c?{x:c.x,y:c.y}:{...a.position},...(a.target.kind==='wild'?{targetResource:w.worldLayer?.wildSites.find(site=>a.target.kind==='wild'&&site.id===a.target.siteId)?.resource}:{}),startedAt:w.time,resolvedAt:w.time,rounds:0,outcome:'no-target',attackers:[participant(w,a.initialUnits,a.ownerFactionId,a.originCityId,a.id)],defenders:[],loot:zeroResources(),wallBefore:c?.wallLevel??0,wallAfter:c?.wallLevel??0,siege:[],ownerBefore:c?.ownerFactionId??null,ownerAfter:c?.ownerFactionId??null,populationBefore:c?.population??0,populationAfter:c?.population??0,returnedTrainingPopulation:0};}
function awarenessExchange(w:FormalWorld,id:BattleState['id'],e:FormalEvent,round:number,a:readonly CombatPool[],d:readonly CombatPool[],wall=0){
 const result=exchange(a,d,w.factions,wall,f=>effectiveAwareness(w,f));
 recordModernRound(w,id,e.id,round,a,d,result.attacking,result.defending);return result;
}
function singleRaid(w:FormalWorld,a:MissionArmy,c:FormalCity,e:FormalEvent,s:EventScheduler){
 settleFaction(w,a.ownerFactionId);settleCity(w,c);const groups=defensiveGroups(w,c),p=basePayload(w,a,c.name,c);p.defenders=groups.map(g=>participant(w,g.units,g.owner,g.source,g.army?.id??null));for(const g of groups)settleFaction(w,g.owner);
 const ongoing=w.combat!.battles.find(b=>b.cityId===c.id);const defenders=ongoing?syncPools(w,ongoing.defenders,groups,ongoing.participants):groups.flatMap(g=>poolsFor(w,g.units,g.owner,g.source,g.army));const exchangeResult=awarenessExchange(w,a.battleId,e,1,poolsFor(w,a.units,a.ownerFactionId,a.originCityId,a),defenders,c.wallLevel??0);if(ongoing)ongoing.defenders=exchangeResult.defending;
 writePools(w,null,exchangeResult.attacking);writePools(w,c,exchangeResult.defending);applyBaggage(a,effectiveCount(exchangeResult.attacking)>0);for(let i=0;i<groups.length;i++){const g=groups[i];applySupplyLoss(g.units,p.defenders[i].before,Object.keys(g.units).some(id=>effectiveUnit(id)&&g.units[id]>0));}
 p.rounds=1;p.outcome=effectiveCount(exchangeResult.attacking)>0?'raid-return':'held';if(p.outcome==='raid-return'){p.loot=distributeLoot(w,[a],raidable(c));for(const r of resourceKeys)c.stock[r]-=p.loot[r];}
 p.attackers=updateParticipants(w,null,p.attackers);p.defenders=updateParticipants(w,c,p.defenders);p.populationAfter=c.population;finishReceipt(w,p,e.id);returnArmy(w,a,s);return battleReport(w,p);
}
function wildBattle(w:FormalWorld,a:MissionArmy,e:FormalEvent,s:EventScheduler){
 const target=a.target;if(target.kind!=='wild')throw new Error('Wild target mismatch');const site=spatial(w).sites.get(target.siteId);if(!site||site.generation!==target.generation){const p=basePayload(w,a,'野外據點',null);finishReceipt(w,p,e.id);returnArmy(w,a,s);return battleReport(w,p);}
 settleFaction(w,a.ownerFactionId);let attackers=poolsFor(w,a.units,a.ownerFactionId,a.originCityId,a),defenders=poolsFor(w,site.defenders??{},null,null,null),rounds=0;const exile=w.extinction?.sites.find(s=>s.id===site.id),exileBefore={...site.defenders};const p=basePayload(w,a,exile?'流亡軍隊（流）':wildSiteName(site),null);p.defenders=[participant(w,site.defenders??{},null,null,null)];
 while(effectiveCount(attackers)>0&&effectiveCount(defenders)>0){const result=awarenessExchange(w,a.battleId,e,rounds+1,attackers,defenders);attackers=result.attacking;defenders=result.defending;rounds++;}
 writePools(w,null,attackers);site.defenders=Object.fromEntries(defenders.filter(p=>p.count).map(p=>[p.unitId,p.count]));const won=effectiveCount(attackers)>0&&effectiveCount(defenders)===0;applyBaggage(a,won);p.rounds=rounds;p.outcome=won?'wild-cleared':'wild-held';if(won){p.loot=distributeLoot(w,[a],site.loot??zeroResources(),site.resource==='bandit');if(exile){if(defeatExile(w,exile as ExileSite,a,exileBefore))p.exileReward={units:Object.fromEntries(Object.entries(exileUnits(exileBefore)).map(([id,n])=>[id,Math.floor(n*.25)]).filter(([,n])=>Number(n)>0)),craftsmanCivilizationId:exile.civilizationId};}else clearWild(w,site,s);}p.attackers=updateParticipants(w,null,p.attackers);p.defenders[0].after={...site.defenders};finishReceipt(w,p,e.id);returnArmy(w,a,s);return battleReport(w,p);
}
/** Wild compositions contain no counter-scouts. Observe the bound generation without changing its lifecycle. */
function wildScout(w:FormalWorld,a:MissionArmy,e:FormalEvent,s:EventScheduler){
 const target=a.target;if(target.kind!=='wild')throw new Error('Wild target mismatch');
 const site=spatial(w).sites.get(target.siteId),p=basePayload(w,a,site?wildSiteName(site):'野外據點',null);
 if(!site||site.generation!==target.generation){finishReceipt(w,p,e.id);returnArmy(w,a,s);return battleReport(w,p);}
 settleFaction(w,a.ownerFactionId);
 a.pendingIntel={observedAt:w.time,siteId:site.id,generation:site.generation,units:{...site.defenders!},resources:{...site.loot!}};
 p.rounds=1;p.outcome='scout-success';p.attackers=updateParticipants(w,null,p.attackers);finishReceipt(w,p,e.id);a.pendingReport=p;
 returnArmy(w,a,s);return [];
}
function scoutBattle(w:FormalWorld,a:MissionArmy,c:FormalCity,e:FormalEvent,s:EventScheduler){
 settleFaction(w,a.ownerFactionId);settleCity(w,c);const groups=defensiveGroups(w,c),count=scoutCount(a.units),defenderCount=groups.reduce((n,g)=>n+scoutCount(g.units),0),attack=scoutPower(a.units,w.factions.find(f=>f.id===a.ownerFactionId)),defense=groups.reduce((n,g)=>n+scoutPower(g.units,w.factions.find(f=>f.id===g.owner),true),0),success=attack>defense,observedUnits=groups.reduce<Record<string,number>>((out,g)=>{for(const [id,n] of Object.entries(g.units))out[id]=(out[id]??0)+n;return out;},{}),p=basePayload(w,a,c.name,c);p.defenders=groups.map(g=>participant(w,g.units,g.owner,g.source,g.army?.id??null));p.rounds=1;
 // Snapshot all permitted city intelligence before counter-scout casualties. Never copy interior or queue data.
 const intel={observedAt:w.time,cityId:c.id,units:observedUnits,resources:{...c.stock},garrison:{...c.military!.units},reinforcements:groups.filter(g=>g.army).map(g=>({ownerFactionId:g.owner,originCityId:g.source,units:{...g.units}})),wallLevel:c.wallLevel??0,defenses:Object.fromEntries(Object.entries(c.buildings).filter(([key])=>key.startsWith('bunker.')||key==='castle'))};
 p.wallBefore=p.wallAfter=p.populationBefore=p.populationAfter=0;
 if(success){const loss=Math.round(count*.5*(defense/attack));removeScouts(a.units,loss);for(const g of groups)removeScouts(g.units,scoutCount(g.units));a.pendingIntel=intel;
 }else{removeScouts(a.units,count);let loss=defense?Math.round(defenderCount*.5*(attack/defense)):0;for(const g of groups){const removed=Math.min(loss,scoutCount(g.units));removeScouts(g.units,removed);loss-=removed;}}
 p.outcome=success?'scout-success':'scout-failed';p.attackers=updateParticipants(w,null,p.attackers);p.defenders=updateParticipants(w,c,p.defenders).map(g=>({...g,before:scoutUnits(g.before),after:scoutUnits(g.after)}));finishReceipt(w,p,e.id);
 const reports:FormalReport[]=[];if(success){const m=memoryFor(w,c.ownerFactionId,a.ownerFactionId);if(m){m.hatred=Math.min(1,m.hatred+.08);m.at=w.time;}a.pendingReport=p;if(playerScope(w,[c.ownerFactionId])){const sequence=w.sequences.report++;reports.push({id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:w.playerFactionId,at:w.time,category:'system',title:'遭到偵察',text:`${c.name} 的反偵察未能阻止敵方斥候；情報於本次抵達時被觀察。`});}}else reports.push(...battleReport(w,p));
 returnArmy(w,a,s);return reports;
}
function evacuateCitySurvivors(w:FormalWorld,c:FormalCity,oldOwner:FactionId,s:EventScheduler){const units={...c.military!.units};c.military!.units={};if(!Object.keys(units).length)return;const key=sequenceKey(w.sequences.project++),a:MissionArmy={id:armyId(key),battleId:battleId(key),commandId:w.commandReceipts.find(r=>r.issuerId===oldOwner&&r.disposition==='applied')?.commandId??w.commandReceipts.find(r=>r.disposition==='applied')!.commandId,creationKind:'evacuation',ownerFactionId:oldOwner,originCityId:c.id,units,initialUnits:{...units},mission:'reinforce',target:{kind:'city',cityId:c.id},status:'stationed',path:[{x:c.x,y:c.y}],segmentTimes:[0],marchSecondsPerTile:1,position:{x:c.x,y:c.y},departedAt:w.time,arrivalAt:w.time,movementEventId:null,returnCityId:null,cargo:zeroResources()};w.armies.push(a);returnArmy(w,a,s);}
function finishBattle(w:FormalWorld,state:BattleState,c:FormalCity,e:FormalEvent,s:EventScheduler,reason:ConquestReason){
 const b=ensureBattleProgress(state,c.wallLevel??0),attacking=w.armies.filter(isMissionArmy).filter(a=>a.status==='engaged'&&a.battleId===b.id),attackCount=effectiveCount(b.attackers),defenseCount=effectiveCount(b.defenders),first=attacking[0];if(!first)throw new Error('Battle has no attacker');
 const recipient=reason==='conquered'?conquestOwner(w,b.jointId?w.politics?.joints.find(j=>j.id===b.jointId)?.initiator??b.attackerFactionId:b.attackerFactionId,attacking):null;
 // No legally controlled occupiers remain; preserve damage/final and let B7 convert survivors.
 if(reason==='conquered'&&!recipient)reason='no-occupiers';
 const p=basePayload(w,first,c.name,c);p.battleId=b.id;p.resolutionId=rid(b.id,'final');p.startedAt=b.startedAt;p.rounds=b.round;p.wallBefore=b.wallBefore;p.ownerBefore=b.ownerBefore;p.populationBefore=b.populationBefore;p.conquestReason=reason;p.siegeRounds=b.siegeRound;p.siegeHistory=structuredClone(b.siegeHistory);p.history=structuredClone(b.history);p.historyOmitted=b.historyOmitted;p.siege=structuredClone(b.siegeChanges);p.outcome=b.mission==='wonder-destruction'?(reason==='wonder-destroyed'?'wonder-destroyed':'wonder-held'):reason==='mutual-destruction'?'mutual-destruction':'held';if(b.wonder)p.wonder=structuredClone(b.wonder);
 p.attackers=b.participants.filter(p=>p.armyId!==null&&attacking.some(a=>a.id===p.armyId));p.defenders=b.participants.filter(item=>!p.attackers.includes(item));
 // A stationed army may have legally retrofitted before joining this battle.
 // Use its battle-entry composition, preserving the original dispatch history.
 for(const a of attacking){if(b.mission==='wonder-destruction'&&!Object.keys(a.initialUnits).some(effectiveUnit)){if(!Object.keys(a.units).some(id=>baseUnit(id)==='catapult'&&a.units[id]>0))for(const id of Object.keys(a.units).filter(isSupplyUnit))delete a.units[id];}else applyBaggage(a,attackCount>0);}for(const a of stationed(w,c))applySupplyLoss(a.units,p.defenders.find(d=>d.armyId===a.id)?.before??a.initialUnits,defenseCount>0);
 if(defenseCount===0&&c.military)for(const id of Object.keys(c.military.units).filter(isSupplyUnit))delete c.military.units[id];
 if(reason==='conquered'){
  if(attackCount===0||defenseCount!==0||(c.wallLevel??0)!==0)throw new Error('Conquest hard conditions not met');
  const oldOwner=c.ownerFactionId,pop=finishConquest(w,c,recipient!,b.developmentLost,b.developmentBefore,s);p.outcome='conquered';p.ownerAfter=c.ownerFactionId;p.populationBefore=pop.populationBefore;p.populationAfter=pop.populationAfter;p.returnedTrainingPopulation=pop.returnedTrainingPopulation;
  p.defenders=updateParticipants(w,c,p.defenders);evacuateCitySurvivors(w,c,oldOwner,s);for(const a of w.armies.filter(isMissionArmy).filter(a=>a.status==='stationed'&&a.target.kind==='city'&&a.target.cityId===c.id))if(!canReinforce(w,a.ownerFactionId,c.ownerFactionId))returnArmy(w,a,s);
 }else if(b.catapultBatchDone)finalizeSiegeHousing(c);
 p.attackers=updateParticipants(w,null,p.attackers);if(p.outcome!=='conquered')p.defenders=updateParticipants(w,c,p.defenders);p.populationAfter=c.population;p.wallAfter=c.wallLevel??0;
 finishReceipt(w,p,e.id);w.combat!.battles=w.combat!.battles.filter(x=>x.id!==b.id);for(const a of attacking)returnArmy(w,a,s);reconcileWonders(w,s);invalidateSpatial(w);return battleReport(w,p);
}
/** Training/arrival events refresh durable pools and phase, but never run damage out of scheduler order. */
export function refreshBattleDefense(w:FormalWorld,c:FormalCity){
 const state=w.combat?.battles.find(b=>b.cityId===c.id);if(!state)return;
 const b=ensureBattleProgress(state,c.wallLevel??0),before=effectiveCount(b.defenders);
 b.defenders=syncPools(w,b.defenders,defensiveGroups(w,c),b.participants);
 if(effectiveCount(b.defenders)>before)battleLog(b,{at:w.time,kind:'reinforcement',ownerFactionId:c.ownerFactionId});
 if(b.phase==='siege'&&effectiveCount(b.defenders)>0){b.phase='combat';battleLog(b,{at:w.time,kind:'combat-resumed'});}
}
export function resolveCombatRound(w:FormalWorld,state:BattleState,e:FormalEvent,s:EventScheduler):FormalReport[]{
 // A stale/direct replay cannot advance a detached battle object or consume another round.
 if(!w.combat!.battles.includes(state))return[];
 const c=spatial(w).cities.get(state.cityId)!,b=ensureBattleProgress(state,c.wallLevel??0);
 const attackers=w.armies.filter(isMissionArmy).filter(a=>a.status==='engaged'&&a.battleId===b.id);for(const owner of new Set([c.ownerFactionId,...attackers.map(a=>a.ownerFactionId),...stationed(w,c).map(a=>a.ownerFactionId)]))settleFaction(w,owner);
 b.attackers=syncPools(w,b.attackers,attackers.map(a=>({units:a.units,owner:a.ownerFactionId,source:a.originCityId,army:a})),b.participants);refreshBattleDefense(w,c);
 if(protectedFaction(w,c.ownerFactionId))return finishBattle(w,b,c,e,s,'protected-target');
 if(b.mission==='wonder-destruction'?!b.attackers.some(p=>baseUnit(p.unitId)==='catapult'&&p.count>0):effectiveCount(b.attackers)===0)return finishBattle(w,b,c,e,s,'no-occupiers');
 if(b.phase==='combat'){
  const round=b.round+1,resolution=rid(b.id,`round-${round}`);if(w.combat!.receipts.some(r=>r.resolutionId===resolution))return[];
  if(effectiveCount(b.defenders)>0){const result=awarenessExchange(w,b.id,e,round,b.attackers,b.defenders,c.wallLevel??0);b.attackers=result.attacking;b.defenders=result.defending;writePools(w,null,b.attackers);writePools(w,c,b.defenders);}
  b.round=round;commitReceipt(w,{battleId:b.id,resolutionId:resolution,eventId:e.id,at:w.time,round,kind:'round'});
  if(round%5===0)battleLog(b,{at:w.time,kind:'combat-summary'});
  if(b.mission==='wonder-destruction'?!b.attackers.some(p=>baseUnit(p.unitId)==='catapult'&&p.count>0):effectiveCount(b.attackers)===0)return finishBattle(w,b,c,e,s,effectiveCount(b.defenders)===0?'mutual-destruction':'attacker-defeated');
  if(effectiveCount(b.defenders)===0){b.phase='siege';battleLog(b,{at:w.time,kind:'siege-start'});}
 }
 if(b.phase==='siege'&&(b.mission==='wonder-destruction'||b.wonderPriority)){
  const wonder=w.largeProjects.find(p=>p.wonder&&p.wonder.phase!=='funding'&&p.initiatingCityId===c.id);
  if(b.mission==='wonder-destruction'&&!wonder)return finishBattle(w,b,c,e,s,'no-catapult');
  if(wonder){
   settleWonderDurability(w,wonder);const d=wonder.wonder!.durability;
   if(d){b.wonder??={projectId:wonder.projectId,before:d.current,after:d.current,damage:0};
    const amount=wonderBombardment(w,b.attackers);
    if(amount>0&&d.current>0){const lost=applyWonderDamage(w,wonder.projectId,e,rid(b.id,`wonder-${b.siegeRound+1}`),amount,s);b.wonder.damage=durabilityPrecision(b.wonder.damage+lost);}
    b.wonder.after=d.current;
   }
  }
  if(b.mission==='wonder-destruction'){
   const round=b.siegeRound+1,wallBefore=c.wallLevel??0,result=resolveSiege(w,c,b.attackers,b.id,{wallDamage:b.wallDamage,wallDamageLevel:b.wallDamageLevel,catapultBatch:false});
   b.catapultBatchDone=true;b.siegeRound=round;b.wallDamage=result.wallDamage;b.wallDamageLevel=result.wallDamageLevel;b.siegeHistory.push({round,at:w.time,wallBefore,wallAfter:c.wallLevel??0});
   for(const change of result.changes){const prior=b.siegeChanges.find(x=>x.target.kind==='wall');if(prior)prior.after=change.after;else b.siegeChanges.push(change);}
   commitReceipt(w,{battleId:b.id,resolutionId:rid(b.id,`siege-${round}`),eventId:e.id,at:w.time,round,kind:'siege-round'});
   if(wonder?.wonder?.integrity==='ruins')return finishBattle(w,b,c,e,s,'wonder-destroyed');
   if(!b.attackers.some(p=>baseUnit(p.unitId)==='catapult'&&p.count>0))return finishBattle(w,b,c,e,s,'no-catapult');
   if(round>=SIEGE_ROUND_LIMIT)return finishBattle(w,b,c,e,s,'wonder-timeout');
   b.nextRoundAt=w.time+300000;b.roundEventId=enqueue(w,s,{type:'combat.round',battleId:b.id,at:b.nextRoundAt});return[];
  }
 }
 if(b.phase==='siege'){
  // First batch is executed once even on a Lv0 wall. Later arrivals cannot earn another batch.
  if(!b.catapultBatchDone){const result=resolveSiege(w,c,b.attackers,b.id,{damageWall:false,catapultBatch:!b.wonderPriority});b.catapultBatchDone=true;b.developmentLost+=result.lost;b.siegeChanges.push(...result.changes);battleLog(b,{at:w.time,kind:'catapult-batch'});}
  if((c.wallLevel??0)===0)return finishBattle(w,b,c,e,s,'conquered');
  if(b.siegeRound>=SIEGE_ROUND_LIMIT)return finishBattle(w,b,c,e,s,'siege-timeout');
  const round=b.siegeRound+1,resolution=rid(b.id,`siege-${round}`);if(w.combat!.receipts.some(r=>r.resolutionId===resolution))return[];
  const wallBefore=c.wallLevel??0,result=resolveSiege(w,c,b.attackers,b.id,{wallDamage:b.wallDamage,wallDamageLevel:b.wallDamageLevel,catapultBatch:false});
  b.wallDamage=result.wallDamage;b.wallDamageLevel=result.wallDamageLevel;b.siegeRound=round;
  b.siegeHistory.push({round,at:w.time,wallBefore,wallAfter:c.wallLevel??0});
  for(const change of result.changes){const previous=b.siegeChanges.find(x=>x.target.kind==='wall');if(previous)previous.after=change.after;else b.siegeChanges.push(change);}
  commitReceipt(w,{battleId:b.id,resolutionId:resolution,eventId:e.id,at:w.time,round,kind:'siege-round'});
  if(wallBefore!==c.wallLevel)battleLog(b,{at:w.time,kind:'wall-breached',wallBefore,wallAfter:c.wallLevel??0});
  if(round%5===0)battleLog(b,{at:w.time,kind:'siege-summary'});
  if((c.wallLevel??0)===0)return finishBattle(w,b,c,e,s,'conquered');
  finalizeSiegeHousing(c);
  if(round===SIEGE_ROUND_LIMIT)return finishBattle(w,b,c,e,s,'siege-timeout');
 }
 b.nextRoundAt=w.time+tacticalRoundWorldMs(effectiveSpeed(w));b.roundEventId=enqueue(w,s,{type:'combat.round',battleId:b.id,at:b.nextRoundAt});return[];
}
export function handleCombatEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler):FormalReport[]|null{
 if(!['army.depart','army.arrive','army.return','combat.round','wild.respawn'].includes(e.type))return null;w.combat??=initialCombat();
 if(e.type==='wild.respawn'){const site=w.worldLayer?.wildSites.find(site=>site.id===e.siteId);if(site?.phase==='cooldown'&&site.generation===e.generation&&site.respawnEventId===e.id&&site.respawnAt===e.at)respawnWild(w,site);return[];}
 if(e.type==='combat.round'){const b=w.combat.battles.find(b=>b.id===e.battleId);if(!b||b.roundEventId!==e.id||b.nextRoundAt!==e.at)return[];b.roundEventId=null;return resolveCombatRound(w,b,e,s);}
 if(e.type==='army.depart'){const a=w.armies.find(a=>a.id===e.armyId);if(a&&isMissionArmy(a)&&a.status==='waiting'&&a.movementEventId===e.id&&a.departedAt===e.at){
  if(!w.cities.some(c=>c.id===a.originCityId&&c.ownerFactionId===a.ownerFactionId)||w.extinction?.extinct.includes(a.ownerFactionId)){discardCapturedArmies(w,[a],s);return[];}
  a.status='outbound';a.movementEventId=enqueue(w,s,{type:'army.arrive',armyId:a.id,at:a.arrivalAt});invalidateSpatial(w);
 }return[];}
 if(e.type!=='army.arrive'&&e.type!=='army.return')return[];
 const a=w.armies.find(a=>a.id===e.armyId);if(!a||!isMissionArmy(a)||a.movementEventId!==e.id||a.arrivalAt!==e.at)return[];a.position={...a.path.at(-1)!};a.movementEventId=null;
 if(e.type==='army.return'){const c=a.returnCityId&&spatial(w).cities.get(a.returnCityId);const original=spatial(w).cities.get(a.originCityId);if(!c||c.ownerFactionId!==a.ownerFactionId||a.returnCityId!==a.originCityId&&original?.ownerFactionId===a.ownerFactionId){returnArmy(w,a,s);return[];}settleFaction(w,a.ownerFactionId);for(const [id,n] of Object.entries(a.units))c.military!.units[id]=(c.military!.units[id]??0)+n;addStock(c,a.cargo);const returnedToOrigin=c.id===a.originCityId;a.originCityId=c.id;const reports:FormalReport[]=[];
  if(a.pendingReport&&a.pendingIntel&&scoutCount(a.units)>0&&(a.target.kind==='wild'||returnedToOrigin)){const resolution=rid(a.battleId,'delivery');if(commitReceipt(w,{battleId:a.battleId,resolutionId:resolution,eventId:e.id,at:w.time,round:1,kind:'scout-delivery'})){const p={...a.pendingReport,resolutionId:resolution,intel:structuredClone(a.pendingIntel)};reports.push(...battleReport(w,p));}}deliverCraftsmen(w,a,c);removeArmy(w,a);return reports;
 }
 if(a.target.kind==='wild')return a.mission==='scout'?wildScout(w,a,e,s):wildBattle(w,a,e,s);
 const c=spatial(w).cities.get(a.target.cityId);if(!c||a.mission!=='reinforce'&&protectedFaction(w,c.ownerFactionId)||!(a.mission==='reinforce'?canReinforce(w,a.ownerFactionId,c.ownerFactionId):hostileAllowed(w,a.ownerFactionId,c.ownerFactionId))){if(a.mission==='reinforce'){returnArmy(w,a,s);return[];}const p=basePayload(w,a,c?.name??'城市',c??null);finishReceipt(w,p,e.id);returnArmy(w,a,s);return battleReport(w,p);}
 if(a.mission==='reinforce'){const trust=memoryFor(w,c.ownerFactionId,a.ownerFactionId);if(trust){trust.trust=Math.min(1,trust.trust+.1);trust.at=w.time;}a.status='stationed';refreshBattleDefense(w,c);invalidateSpatial(w);return[];}
 if(a.mission==='scout')return scoutBattle(w,a,c,e,s);
 if(a.mission==='raid')return singleRaid(w,a,c,e,s);
 const existing=w.combat.battles.find(b=>b.cityId===c.id);if(existing){if((existing.mission??'conquest')!==a.mission||!!existing.wonderPriority!==!!a.wonderPriority||existing.attackerFactionId!==a.ownerFactionId&&!(a.jointId&&a.jointId===existing.jointId)){const p=basePayload(w,a,c.name,c);finishReceipt(w,p,e.id);returnArmy(w,a,s);return battleReport(w,p);}a.battleId=existing.id;a.status='engaged';const progress=ensureBattleProgress(existing,c.wallLevel??0);battleLog(progress,{at:w.time,kind:'reinforcement',ownerFactionId:a.ownerFactionId});invalidateSpatial(w);return[];}
 a.status='engaged';
 if(a.jointId){const simultaneous=w.armies.filter(isMissionArmy).filter(x=>x!==a&&x.jointId===a.jointId&&x.status==='outbound'&&x.arrivalAt===w.time&&x.target.kind==='city'&&x.target.cityId===c.id&&hostileAllowed(w,x.ownerFactionId,c.ownerFactionId));const events=new Set(simultaneous.map(x=>x.movementEventId));const retained=s.snapshot().filter(e=>!events.has(e.id));while(s.pop()){};for(const e of retained)s.push(e);for(const x of simultaneous){x.position={...x.path.at(-1)!};x.status='engaged';x.movementEventId=null;x.battleId=a.battleId;}}
 settleCity(w,c);const b:BattleState={id:a.battleId,mission:a.mission==='wonder-destruction'?'wonder-destruction':'conquest',...(a.wonderPriority?{wonderPriority:true}:{}),...(a.jointId?{jointId:a.jointId}:{}),cityId:c.id,attackerFactionId:a.ownerFactionId,startedAt:w.time,round:0,nextRoundAt:w.time,roundEventId:null,attackers:[],defenders:[],participants:[],wallBefore:c.wallLevel??0,populationBefore:c.population,ownerBefore:c.ownerFactionId,developmentBefore:developmentLevels(c)};w.combat.battles.push(b);invalidateSpatial(w);return resolveCombatRound(w,b,e,s);
}
