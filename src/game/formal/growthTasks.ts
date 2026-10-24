import type {CityId,CommandId} from './ids';
import type {Construction,FormalCity,FormalCommand,FormalEvent,FormalOrder,FormalReport,FormalWorld,LogisticsShipment,Resources,Settlement} from './model';
import {resourceKeys,zeroResources} from './model';
import {GROWTH_TASKS,GROWTH_TASK_BY_ID,GROWTH_FACT_LIMITS,type GrowthTask} from './growthTaskCatalog';
import {buildingKind,buildingLevel,storageCapacity} from './catalogB3';
import {citySnapshot,growPopulation,requireRule} from './economy';
import {HOUR} from './time';
import {TECH_CATALOG} from './techCatalog';
import {UNIT_CATALOG,isModernUnit} from './unitCatalog';
import {baseUnit,effectiveUnit} from './combatModifiers';
import {empireOf,legionOf} from './politics';
import {isMissionArmy,type MissionArmy} from './combatModel';
import {spatial} from './spatial';

export type GrowthClaim={commandId:CommandId;cityId:CityId;at:number;accepted:Resources;lost:Resources;capacity:number;stockBefore:Resources;reserved:Resources};
export type GrowthTaskState={version:1;startedAt:number;recordedThrough:number;facts:Record<string,number>;completed:Record<string,number>;claimed:Record<string,GrowthClaim>;settledCities:CityId[];autoShipments:string[]};
export type GrowthClaimCommand={type:'tasks.claim';cityId:CityId;taskId:string;expectedResources:Resources};
const emptyState=(time:number):GrowthTaskState=>({version:1,startedAt:time,recordedThrough:time,facts:{},completed:{},claimed:{},settledCities:[],autoShipments:[]});
function fact(w:FormalWorld,key:string,value=1,at=w.time){
 const limit=GROWTH_FACT_LIMITS.get(key);if(!limit||value<=0)return;
 const bounded=Math.min(limit,Math.floor(value)),prior=w.growthTasks;
 if(prior&&(prior.facts[key]??0)>=bounded&&GROWTH_TASKS.every(t=>t.fact!==key||(prior.facts[key]??0)<t.target||prior.completed[t.id]!==undefined))return;
 const state=w.growthTasks??=emptyState(at);state.recordedThrough=Math.max(state.recordedThrough,at);state.startedAt=Math.min(state.startedAt,at);state.facts[key]=Math.max(state.facts[key]??0,bounded);
 for(const task of GROWTH_TASKS)if(task.fact===key&&state.facts[key]>=task.target&&state.completed[task.id]===undefined)state.completed[task.id]=at;
}
/** Only enduring authoritative state is reconciled. Buildings/troops never imply past completion events. */
export function syncGrowthTasks(w:FormalWorld){
 const f=w.factions.find(f=>f.id===w.playerFactionId);if(!f)return;
 fact(w,'age',f.age??0);
 for(const id of f.techIds){const t=TECH_CATALOG[id];if(t?.scope==='traditional'&&!t.civilizationId)fact(w,'technology:common');fact(w,'technology:'+id);if(id==='elite.ranged'||id==='elite.cavalry')fact(w,'technology:elite.ranged-or-cavalry');}
 if(legionOf(w,f.id))fact(w,'legion');if(empireOf(w,f.id))fact(w,'empire');
 for(const u of w.colonizationUnits??[])if(u.ownerFactionId===f.id&&w.settlements?.some(p=>p.projectId===u.projectId&&p.ownerFactionId===f.id&&p.phase!=='preparing'))fact(w,'colonization-ready');
 for(const t of w.logistics??[])if(t.sourceFactionId===f.id&&!t.projectId&&t.phase==='returning'&&t.returnCargo&&t.sourceCityId!==t.destinationCityId&&spatial(w).cities.get(t.destinationCityId)?.ownerFactionId===f.id&&resourceKeys.some(r=>t.resources[r]>t.returnCargo![r])){fact(w,'logistics-delivered');if(w.growthTasks?.autoShipments.includes(t.shipmentId))fact(w,'auto-logistics-delivered');}

 for(const c of spatial(w).owned(f.id)){
  const pop=c.economy?growPopulation(c.population,c.housing,buildingLevel(c,'monastery'),Math.max(0,w.time-c.economy.lastSettledAt)/HOUR):c.population;
  recordGrowthPopulation(w,c,c.population,c.economy?.lastSettledAt??w.time,w.time,pop);
  if(w.growthTasks?.settledCities.includes(c.id)&&(c.integrationWorkHours??0)===0)fact(w,'colonization-integrated');
 }
}
/** Same authoritative lazy-growth function; locate the actual threshold crossing,
 * so short foreground advances and one long offline advance record the same milestone. */
export function recordGrowthPopulation(w:FormalWorld,c:FormalCity,before:number,from:number,to:number,after:number){
 if(c.ownerFactionId!==w.playerFactionId||spatial(w).cities.get(c.id)!==c||after<500)return;
 const missing=GROWTH_TASKS.filter(t=>t.fact==='population'&&after+1e-8>=t.target&&w.growthTasks?.completed[t.id]===undefined);
 if(!missing.length)return;
 // Persist crossed milestones and their actual event times, not incidental samples.
 // Live display uses ownedPopulationProgress; Recovery retains real achievements.
 const crossings=missing.map(t=>{let lo=Math.min(from,to),hi=to;
  if(before+1e-8<t.target)while(lo<hi){const mid=Math.floor((lo+hi)/2),pop=growPopulation(before,c.housing,buildingLevel(c,'monastery'),(mid-from)/HOUR);if(pop+1e-8>=t.target)hi=mid;else lo=mid+1;}
  return {task:t,at:lo};
 });
 fact(w,'population',Math.max(...missing.map(t=>t.target)),Math.max(...crossings.map(c=>c.at)));
 for(const {task,at}of crossings){const state=w.growthTasks!;state.completed[task.id]=at;state.startedAt=Math.min(state.startedAt,at);}
}
/** Rendering reads committed task history only; legacy recognition runs in the backend. */
export function growthTaskState(w:FormalWorld){return w.growthTasks??emptyState(w.time);}
export function growthTaskStatus(state:GrowthTaskState,task:GrowthTask){return state.claimed[task.id]?'claimed':state.completed[task.id]!==undefined?'claimable':'incomplete';}
/** Display progress only; completion still requires the backend's persisted completed ID. */
export function ownedPopulationProgress(w:FormalWorld){return Math.floor(Math.max(0,...spatial(w).owned(w.playerFactionId).map(c=>c.economy?growPopulation(c.population,c.housing,buildingLevel(c,'monastery'),Math.max(0,w.time-c.economy.lastSettledAt)/HOUR):c.population)));}
export function claimableGrowthCount(w:FormalWorld){const s=growthTaskState(w);return GROWTH_TASKS.filter(t=>growthTaskStatus(s,t)==='claimable').length;}
export function quoteGrowthReward(w:FormalWorld,c:FormalCity,task:GrowthTask){
 const current=citySnapshot(w,c.id)??c,capacity=storageCapacity(current),reserved={...(current.economy?.reservedIncoming??zeroResources())},accepted=zeroResources(),lost=zeroResources();
 for(const r of resourceKeys){accepted[r]=Math.min(task.reward[r],Math.max(0,Math.floor(capacity-reserved[r]-current.stock[r])));lost[r]=task.reward[r]-accepted[r];}
 return {capacity,stockBefore:{...current.stock},reserved,accepted,lost};
}
export function claimGrowthReward(w:FormalWorld,c:FormalCity,o:FormalOrder,p:GrowthClaimCommand){
 requireRule(o.issuerId===w.playerFactionId&&w.factions.find(f=>f.id===o.issuerId)?.role!=='ai','只有玩家可以領取成長任務獎勵。');
 requireRule(c.ownerFactionId===o.issuerId,'領獎城市已非玩家所有。');const task=GROWTH_TASK_BY_ID.get(p.taskId);requireRule(task,'任務不存在。');syncGrowthTasks(w);
 const state=w.growthTasks;requireRule(state&&state.completed[task.id]!==undefined,'任務尚未完成。');requireRule(!state.claimed[task.id],'此任務已領取。');
 const quote=quoteGrowthReward(w,c,task);requireRule(resourceKeys.every(r=>p.expectedResources[r]===quote.accepted[r]),'城市容量或庫存已改變，請重新核對實收與損失。');
 for(const r of resourceKeys)c.stock[r]+=quote.accepted[r];state.recordedThrough=Math.max(state.recordedThrough,w.time);state.claimed[task.id]={commandId:o.commandId,cityId:c.id,at:w.time,...quote};
}
function appliedCityCommand(w:FormalWorld,id:CommandId,cityId:CityId,playerOnly=true){const r=w.commandReceipts.find(r=>r.commandId===id&&(!playerOnly||r.issuerId===w.playerFactionId)&&r.disposition==='applied');if(!r)return false;try{const p=JSON.parse(r.fingerprint);return p.issuerId===r.issuerId&&p.payload.cityId===cityId;}catch{return false;}}
function constructionFact(w:FormalWorld,prefix:string,level:number){
 for(const t of GROWTH_TASKS)if(t.fact.startsWith(prefix+':')&&level<=t.target)fact(w,t.fact,level);
}
export type TaskEventObservation={construction?:{cityId:CityId;job:Construction;resource?:string};training?:{cityId:CityId;unitId:string;before:number};promotion?:CityId;settlement?:Settlement;army?:MissionArmy;shipment?:LogisticsShipment;autoBefore?:Set<string>;jointArmies:Set<string>;jointPlayers:Set<string>};
/** Capture immutable provenance before a real scheduled handler consumes its jobs/armies. */
export function captureGrowthEvent(w:FormalWorld,e:FormalEvent):TaskEventObservation{
 const out:TaskEventObservation={jointArmies:new Set(),jointPlayers:new Set()};
 if('cityId'in e){const c=spatial(w).cities.get(e.cityId);if(c?.ownerFactionId===w.playerFactionId){
  if(e.type==='construction.complete'){const job=c.economy?.construction.find(j=>j.eventId===e.id&&j.startsAt+j.durationMs===e.at);if(job&&job.action!=='demolish'&&appliedCityCommand(w,job.commandId,c.id,false))out.construction={cityId:c.id,job:structuredClone(job),resource:job.target.kind==='field'?c.fields?.find(f=>f.slot===(job.target as {kind:'field';slot:number}).slot)?.resource:undefined};}
  if(e.type==='military.train'){const j=c.military?.queue.find(j=>j.eventId===e.id&&j.nextAt===e.at&&j.ownerFactionId===w.playerFactionId);if(j&&appliedCityCommand(w,j.commandId,c.id))out.training={cityId:c.id,unitId:j.unitId,before:c.military!.units[j.unitId]??0};}
  if(e.type==='city.promote.complete'&&c.economy?.promotion?.eventId===e.id&&appliedCityCommand(w,c.economy.promotion.commandId,c.id,false))out.promotion=c.id;
  if(e.type==='economy.settle')out.autoBefore=new Set(w.logistics?.map(t=>t.shipmentId));
 }}
 if(e.type==='settlement.ready'||e.type==='settlement.arrive'){const p=w.settlements?.find(p=>p.projectId===e.projectId&&p.ownerFactionId===w.playerFactionId&&(e.type==='settlement.ready'?p.prepEventId===e.id:p.arrivalEventId===e.id));if(p)out.settlement=structuredClone(p);}
 if(e.type==='army.arrive'||e.type==='army.return'){const a=w.armies.find(a=>a.id===e.armyId&&isMissionArmy(a)&&a.ownerFactionId===w.playerFactionId&&a.movementEventId===e.id&&a.arrivalAt===e.at);if(a&&isMissionArmy(a))out.army=structuredClone(a);}
 if(e.type==='logistics.arrive'||e.type==='logistics.return'){const t=w.logistics?.find(t=>t.shipmentId===e.shipmentId&&t.sourceFactionId===w.playerFactionId&&(e.type==='logistics.arrive'?t.arrivalEventId===e.id:t.returnEventId===e.id));if(t){out.shipment=structuredClone(t);if(e.type==='logistics.return')out.autoBefore=new Set(w.logistics?.map(t=>t.shipmentId));}}
 const battle=e.type==='combat.round'?w.combat?.battles.find(b=>b.roundEventId===e.id):undefined;
 const arriving=e.type==='army.arrive'?w.armies.find(a=>a.id===e.armyId):undefined;
 const jointId=battle?.jointId??(arriving&&isMissionArmy(arriving)?arriving.jointId:undefined),group=jointId?w.politics?.joints.find(j=>j.id===jointId):undefined;
 if(group&&group.armyIds.length>=1){for(const id of group.armyIds)out.jointArmies.add(id);if(battle){const participants=battle.participants.filter(p=>p.armyId&&group.armyIds.includes(p.armyId));if(participants.length>=1&&participants.some(p=>p.ownerFactionId===w.playerFactionId))out.jointPlayers.add(battle.id);}}
 return out;
}
/** Observe only successful authoritative effects. No mail, report, economy or AI rule is added here. */
export function recordGrowthEvent(w:FormalWorld,e:FormalEvent,b:TaskEventObservation,reports:readonly FormalReport[]){
 if(b.construction){const {job,cityId,resource}=b.construction,c=spatial(w).cities.get(cityId);if(c?.ownerFactionId===w.playerFactionId&&!c.economy?.construction.some(j=>j.eventId===e.id)){
  if(job.target.kind==='field'&&c.fields?.find(f=>f.slot===(job.target as {kind:'field';slot:number}).slot)?.level===job.toLevel&&resource){constructionFact(w,'field:'+resource,job.toLevel);constructionFact(w,'field:any',job.toLevel);}
  if(job.target.kind==='building'){const kind=buildingKind(job.target.key);if(kind&&(kind==='wall'?c.wallLevel:c.buildings[job.target.key])===job.toLevel){constructionFact(w,'building:'+kind,job.toLevel);if(kind==='castle'&&job.castleCivilizationId&&job.castleCivilizationId!==w.factions.find(f=>f.id===w.playerFactionId)?.civilizationId)fact(w,'foreign-castle');}}
 }}
 if(b.training){const c=spatial(w).cities.get(b.training.cityId),id=b.training.unitId;if(c?.ownerFactionId===w.playerFactionId&&(c.military?.units[id]??0)>b.training.before){if(effectiveUnit(id))fact(w,'training:combat',(w.growthTasks?.facts['training:combat']??0)+1);if(!isModernUnit(id)){fact(w,'training:'+baseUnit(id));if(UNIT_CATALOG[id]?.civilizationId===w.factions.find(f=>f.id===w.playerFactionId)?.civilizationId&&baseUnit(id).startsWith('guard.'))fact(w,'training:guard');}}}
 if(b.promotion&&spatial(w).cities.get(b.promotion)?.cityPromotionCompleted)fact(w,'city-promoted');
 if(b.settlement){const p=b.settlement;if(e.type==='settlement.ready'&&w.colonizationUnits?.some(u=>u.projectId===p.projectId&&u.ownerFactionId===w.playerFactionId&&u.phase==='ready'))fact(w,'colonization-ready');if(e.type==='settlement.arrive'&&p.target){const c=spatial(w).at(p.target.x,p.target.y).city;if(c?.ownerFactionId===w.playerFactionId&&!w.settlements?.some(s=>s.projectId===p.projectId)){fact(w,'colonization-city');const state=w.growthTasks!;if(!state.settledCities.includes(c.id))state.settledCities.push(c.id);}}}
 if(b.army){const a=b.army;if(e.type==='army.return'&&!w.armies.some(x=>x.id===a.id)&&a.returnCityId&&spatial(w).cities.get(a.returnCityId)?.ownerFactionId===w.playerFactionId&&Object.values(a.units).some(n=>n>0)&&a.mission==='raid'&&a.target.kind==='city'&&resourceKeys.some(r=>a.cargo[r]>0)&&w.combat?.receipts.some(r=>r.battleId===a.battleId&&r.kind==='final'&&r.outcome==='raid-return'))fact(w,'raid-delivered');
  if(e.type==='army.arrive'&&a.mission==='reinforce'&&a.target.kind==='city'&&w.armies.some(x=>x.id===a.id&&x.status==='stationed'))fact(w,'reinforce-arrived');}
 if(b.shipment&&e.type==='logistics.arrive'){const t=w.logistics?.find(t=>t.shipmentId===b.shipment!.shipmentId);if(t?.phase==='returning'&&!t.projectId&&t.sourceCityId!==t.destinationCityId&&spatial(w).cities.get(t.destinationCityId)?.ownerFactionId===w.playerFactionId&&resourceKeys.some(r=>t.resources[r]>(t.returnCargo?.[r]??0))){fact(w,'logistics-delivered');if(w.growthTasks?.autoShipments.includes(t.shipmentId))fact(w,'auto-logistics-delivered');}}
 if(b.autoBefore)for(const t of w.logistics??[])if(t.sourceFactionId===w.playerFactionId&&!t.projectId&&!b.autoBefore.has(t.shipmentId)){const state=w.growthTasks??=emptyState(w.time);if(!state.autoShipments.includes(t.shipmentId))state.autoShipments.push(t.shipmentId);}
 for(const report of reports){const p=report.battle;if(!p||!p.attackers.some(a=>a.ownerFactionId===w.playerFactionId)&&!b.jointPlayers.has(p.battleId))continue;
  if(e.type==='army.return'&&p.mission==='scout'&&p.target.kind==='city'&&p.outcome==='scout-success'&&p.intel&&w.combat?.receipts.some(r=>r.resolutionId===p.resolutionId&&r.kind==='scout-delivery'))fact(w,'scout-delivered');
  if(p.outcome==='wild-cleared'&&p.target.kind==='wild'){fact(w,'wild-cleared');if(p.exileReward)fact(w,'exile-reward');}
  if(p.outcome==='conquered'&&p.ownerBefore!==p.ownerAfter){if(p.ownerAfter===w.playerFactionId)fact(w,'conquest');const participating=p.attackers.filter(a=>a.armyId&&b.jointArmies.has(a.armyId));if(b.jointPlayers.has(p.battleId)||participating.length>=1&&participating.some(a=>a.ownerFactionId===w.playerFactionId))fact(w,'joint-conquest');}
 }
 if(w.growthTasks){if(b.autoBefore||b.shipment)w.growthTasks.autoShipments=w.growthTasks.autoShipments.filter(id=>w.logistics?.some(t=>t.shipmentId===id));if(w.growthTasks.settledCities.length&&w.growthTasks.completed.C12!==undefined)w.growthTasks.settledCities=[];}
 if(b.construction||b.training||b.promotion||b.settlement||b.army||b.shipment||e.type==='age.complete'&&e.factionId===w.playerFactionId||e.type==='research.complete'&&w.researchProjects.find(p=>p.projectId===e.projectId)?.ownerFactionId===w.playerFactionId)syncGrowthTasks(w);
}
export function recordGrowthCommand(w:FormalWorld,issuer:string,p:FormalCommand){if(issuer!==w.playerFactionId&&p.type!=='politics')return;if(issuer===w.playerFactionId&&p.type==='governance.set')fact(w,'governance-set');syncGrowthTasks(w);}
