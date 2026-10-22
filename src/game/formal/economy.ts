import {invalidateMilitaryPower} from './militaryPower';
import {reconcileVictory} from './victory';
import {reconcileWonders} from './wonderCondition';
import {reconcileBreakthroughs} from './breakthrough';
import {QUEUE_CAPACITY} from './queueCapacity';
import {finishCraftsmanCastle,craftsmanForConstruction,reconcileCityCraftsmen,clearCapturedNoncombatants} from './extinction';
import {canReinforce} from './armies';
import {buildingRequirements,castleSource} from './buildingDetailData';
import {startDemolition,completeDemolition} from './demolition';
import {developerStock,refillDeveloperStock} from './playtest';
import {reconcileSiegeStorage} from './siege';
import type {CityId,FactionId,ProjectId} from './ids';
import {eventId,sequenceKey,shipmentId} from './ids';
import type {Construction,EconomyCommand,FormalCity,FormalEvent,FormalOrder,FormalWorld,LogisticsShipment,Resources,Shipment} from './model';
import {resourceKeys,zeroResources} from './model';
import {BUILDING_CATALOG,buildingCost,buildingDuration,buildingKind,buildingLevel,FIELD_PRODUCTION,fieldCost,fieldDuration,HOUSING,storageCapacity,resourceBoostMultiplier,monasteryMultiplier} from './catalogB3';
import {EventScheduler} from './scheduler';
import {spatial} from './spatial';
import {route} from './routing';
import {armyUpkeep} from './military';
import {HOUR} from './time';
export {HOUR} from './time';
export const CITY_PROMOTION={population:10000,housing:10000,townhall:5,cost:{food:12000,wood:18000,stone:18000,gold:12000},durationMs:6*HOUR,fieldMinLevel:11,fieldMaxLevel:15} as const;
export const CARAVAN_CAPACITY=2000;
export function promotionConditions(c:FormalCity){return [c.population>=CITY_PROMOTION.population,c.housing>=CITY_PROMOTION.housing,buildingLevel(c,'townhall')>=CITY_PROMOTION.townhall];}
export function caravanStatus(w:FormalWorld,c:FormalCity){const total=buildingLevel(c,'market'),inTransit=(w.logistics??[]).filter(t=>t.sourceCityId===c.id).reduce((n,t)=>n+t.caravans,0);return {total,inTransit,available:Math.max(0,total-inTransit)};}
export const MILESTONES=[10000,15000,20000,22000,25000,30000] as const;
export class RuleViolation extends Error {}
export function requireRule(ok:unknown,message:string):asserts ok {if(!ok)throw new RuleViolation(message);}
export type EventSpec = {[K in FormalEvent['type']]:Omit<Extract<FormalEvent,{type:K}>,'id'>}[FormalEvent['type']];
export function enqueue(w:FormalWorld,s:EventScheduler,e:EventSpec){const id=eventId(sequenceKey(w.sequences.event++));s.push({...e,id} as FormalEvent);return id;}
export function initializeCityEconomy(w:FormalWorld,c:FormalCity,s:EventScheduler){
 if(developerStock(w,c))c.developerResources=true;
 const settlementEventId=enqueue(w,s,{type:'economy.settle',cityId:c.id,at:w.time+HOUR});
 c.economy={lastSettledAt:w.time,productionRemainder:zeroResources(),milestones:[],slots:{},construction:[],promotion:null,reservedIncoming:zeroResources(),settlementEventId};
}
export function initializeEconomy(w:FormalWorld){const s=new EventScheduler(w.events);w.logistics=[];for(const c of w.cities)initializeCityEconomy(w,c,s);w.events=s.snapshot();}
export const ADMINISTRATION_MAX_NODES=15;
export function administrationMultiplier(w:FormalWorld,owner:FactionId){const count=spatial(w).owned(owner).filter(c=>buildingLevel(c,'townhall')>=1).length;return Math.max(.3,1-Math.min(count,ADMINISTRATION_MAX_NODES)*(.7/ADMINISTRATION_MAX_NODES));}
export function cityTitle(population:number){return population>=30000?'世界級都會':population>=20000?'都會':population>=15000?'大城市':population>=10000?'城市':population>=2000?'城鎮':population>=500?'村莊':'聚落';}
/** Piecewise exact exponential integration, splitting every scale/housing boundary. */
export function growPopulation(population:number,housing:number,monastery:number,hours:number):number {
 if(population>=housing)return population;
 let p=population,left=hours;
 while(left>1e-12&&p<housing-1e-9){
  const size=p<10000-1e-9?1:p<15000-1e-9?.75:p<20000-1e-9?.65:p<25000-1e-9?.55:.45;
  const pressure=p<housing*.8-1e-9?1:p<housing*.9-1e-9?.75:p<housing*.95-1e-9?.5:.25;
  const k=.008*size*pressure*monasteryMultiplier(monastery),next=Math.min(housing,...[10000,15000,20000,25000,housing*.8,housing*.9,housing*.95].filter(v=>v>p+1e-8));
  const time=Math.log((next+5000)/(p+5000))/k;
  if(time<=left+1e-12){p=next;left=Math.max(0,left-time);}else{p=(p+5000)*Math.exp(k*left)-5000;left=0;}
 }
 return Math.min(housing,p);
}
export function productionPerHour(w:FormalWorld,c:FormalCity):Resources {
 const out=zeroResources(),boost={food:'mill',wood:'lumbermill',stone:'masonry',gold:'mint'},f=w.factions.find(f=>f.id===c.ownerFactionId)!;
 for(const p of c.fields??[])out[p.resource]+=FIELD_PRODUCTION[p.level];
 for(const r of resourceKeys){const tier=[1,2,3].filter(n=>f.techIds.includes(`economy.${r}.${n}`)).length;out[r]*=resourceBoostMultiplier(buildingLevel(c,boost[r]))*(1+tier*.03);}
 return out;
}
/** Anchored lazy settlement; only dirty/command/event cities are touched, never a per-minute world scan. */
export function settleCity(w:FormalWorld,c:FormalCity,at=w.time){
 const e=c.economy;if(!e)return;if(c.population<=c.housing)delete c.housingShortage;refillDeveloperStock(c);requireRule(at>=e.lastSettledAt,'經濟時間不可倒退。');const hours=(at-e.lastSettledAt)/HOUR;
 if(!hours)return;
 const rates=productionPerHour(w,c),integration=c.integrationWorkHours??0,mult=administrationMultiplier(w,c.ownerFactionId),penaltyHours=Math.min(hours,integration*mult),effectiveHours=hours-penaltyHours*.6;
 c.integrationWorkHours=Math.max(0,integration-hours/mult);
 const cap=storageCapacity(c),upkeep=armyUpkeep(w,c);
 for(const r of resourceKeys){const max=cap-e.reservedIncoming[r],exact=c.stock[r]+e.productionRemainder[r]+rates[r]*effectiveHours-(r==='food'?upkeep*hours:0),amount=Math.floor(exact+1e-9);if(exact<0){c.stock[r]=0;e.productionRemainder[r]=0;if(r==='food'&&c.military)c.military.unpaidFood+=-exact;}else if(amount>=max){c.stock[r]=Math.max(0,max);e.productionRemainder[r]=0;}else{c.stock[r]=Math.max(0,amount);e.productionRemainder[r]=Math.max(0,exact-amount);}}
 c.population=growPopulation(c.population,c.housing,buildingLevel(c,'monastery'),hours);
 for(const n of MILESTONES)if(c.population+1e-8>=n&&!e.milestones.includes(n))e.milestones.push(n);e.milestones.sort((a,b)=>a-b);e.lastSettledAt=at;
}
export function citySnapshot(w:FormalWorld,id:CityId){const original=spatial(w).cities.get(id);if(!original)return undefined;const c=structuredClone(original);settleCity(w,c);return c;}
export function settleFaction(w:FormalWorld,owner:FactionId,at=w.time){for(const c of spatial(w).owned(owner))settleCity(w,c,at);}
/** B5/B6 interface only: no combat or conquest command is implemented here. */
export function changeCityOwner(w:FormalWorld,c:FormalCity,owner:FactionId,reason:'conquest'|'receive',scheduler?:EventScheduler){
 requireRule(w.factions.some(f=>f.id===owner),'勢力不存在。');const old=c.ownerFactionId;if(buildingLevel(c,'castle')>0&&!c.castleCivilizationId)c.castleCivilizationId=w.factions.find(f=>f.id===old)!.civilizationId;settleFaction(w,old);settleFaction(w,owner);spatial(w).transfer(c,owner);invalidateMilitaryPower(w);if(developerStock(w,c)){c.developerResources=true;refillDeveloperStock(c);}else if(c.developerResources){delete c.developerResources;reconcileSiegeStorage(w,c);}c.integrationWorkHours=reason==='conquest'||reason==='receive'?18:0;c.integrationTotalWorkHours=c.integrationWorkHours;
 if(w.largeProjects.some(p=>(p.kind==='civilization-breakthrough'||p.kind==='world-wonder')&&p.initiatingCityId===c.id)){const s=scheduler??new EventScheduler(w.events);reconcileWonders(w,s,{city:c,previousOwner:old,reason});reconcileBreakthroughs(w,s,{city:c,previousOwner:old,reason});if(!scheduler)w.events=s.snapshot();}
 {const s=scheduler??new EventScheduler(w.events);reconcileVictory(w,s);if(!scheduler)w.events=s.snapshot();}
 if(old!==owner&&(reason==='conquest'||w.extinction?.craftsmen.length||c.economy?.construction.some(j=>j.castleCivilizationId))){const s=scheduler??new EventScheduler(w.events);reconcileCityCraftsmen(w,c,s);if(reason==='conquest')clearCapturedNoncombatants(w,c,s);if(!scheduler)w.events=s.snapshot();}
}
export function spend(c:FormalCity,resources:Resources){requireRule(resourceKeys.every(r=>Number.isSafeInteger(resources[r])&&resources[r]>=0&&c.stock[r]>=resources[r]),'城市實際庫存不足。');for(const r of resourceKeys)c.stock[r]-=resources[r];}
export function addStock(c:FormalCity,resources:Resources){const cap=storageCapacity(c);for(const r of resourceKeys)c.stock[r]=Math.min(cap-(c.economy?.reservedIncoming[r]??0),c.stock[r]+resources[r]);}
export {QUEUE_CAPACITY} from './queueCapacity';
export const constructionConcurrency=(c:FormalCity)=>c.economy?.milestones.includes(15000)?2:1;
export const militaryConcurrency=(c:FormalCity)=>c.economy?.milestones.includes(20000)?2:1;
/** Fill newly unlocked execution capacity. Existing active work and all payment/time snapshots stay fixed. */
export function promoteCityQueues(w:FormalWorld,c:FormalCity,s:EventScheduler){
 const replacements:FormalEvent[]=[],removed=new Set<string>(),build=c.economy?.construction??[];
 if(constructionConcurrency(c)===2){
  const ends=[0,1].map(l=>Math.max(w.time,...build.filter(j=>j.lane===l&&j.startsAt<=w.time).map(j=>j.startsAt+j.durationMs)));
  for(let i=0;i<build.length;i++){
   const j=build[i];if(j.startsAt<=w.time)continue;
   const previous=build.slice(0,i).filter(q=>q.target.kind===j.target.kind&&(q.target.kind==='field'?j.target.kind==='field'&&q.target.slot===j.target.slot:j.target.kind==='building'&&q.target.key===j.target.key)).at(-1);
   const lane=previous?.lane??j.lanePreference??(ends[1]<ends[0]?1:0),startsAt=Math.max(w.time,ends[lane],previous?previous.startsAt+previous.durationMs:0);
   if(j.startsAt!==startsAt||j.lane!==lane){j.startsAt=startsAt;j.lane=lane;removed.add(j.eventId);replacements.push({id:j.eventId,type:'construction.complete',cityId:c.id,at:startsAt+j.durationMs});}
   ends[lane]=startsAt+j.durationMs;
  }
 }
 const train=c.military?.queue??[];
 if(c.economy?.milestones.includes(20000)){
  const ends=[0,1].map(l=>Math.max(w.time,...train.filter(j=>j.lane===l&&j.startsAt<=w.time).map(j=>j.nextAt+(j.remaining-1)*j.durationMs)));
  for(const j of train){if(j.startsAt<=w.time)continue;const lane=j.lanePreference??(ends[1]<ends[0]?1:0),startsAt=ends[lane];
   if(j.startsAt!==startsAt||j.lane!==lane){j.lane=lane;j.startsAt=startsAt;j.nextAt=startsAt+j.durationMs;removed.add(j.eventId);replacements.push({id:j.eventId,type:'military.train',cityId:c.id,at:j.nextAt});}ends[lane]=j.nextAt+(j.remaining-1)*j.durationMs;
  }
 }
 if(removed.size){const events=s.snapshot().filter(e=>!removed.has(e.id));while(s.size)s.pop();for(const e of [...events,...replacements])s.push(e);}
}
function replaceEvents(s:EventScheduler,removed:Set<string>,jobs:Construction[],cityId:CityId){
 const events=s.snapshot().filter(e=>!removed.has(e.id));while(s.size)s.pop();for(const e of events)s.push(e);
 for(const j of jobs)s.push({id:j.eventId,type:'construction.complete',cityId,at:j.startsAt+j.durationMs});
}
export function cancelConstruction(w:FormalWorld,c:FormalCity,command:string,s:EventScheduler){
 const e=c.economy!,job=e.construction.find(j=>j.commandId===command);requireRule(job,'工程不存在。');
 const same=(j:Construction)=>j.target.kind===job.target.kind&&(j.target.kind==='field'?job.target.kind==='field'&&j.target.slot===job.target.slot:job.target.kind==='building'&&j.target.key===job.target.key);
 const cancelled=e.construction.filter(j=>j===job||same(j)&&j.fromLevel>=job.toLevel),refund=zeroResources();
 for(const j of cancelled){if(j.action==='demolish')continue;const t=j.target;const cost=j.paidResources??(t.kind==='field'?fieldCost(c.fields!.find(f=>f.slot===t.slot)!.resource,j.toLevel):buildingCost(buildingKind(t.key)!,j.toLevel)),ratio=w.time<j.startsAt?1:.5;for(const r of resourceKeys)refund[r]+=Math.floor(cost[r]*ratio);}
 const remaining=e.construction.filter(j=>!cancelled.includes(j)),removed=new Set(e.construction.map(j=>j.eventId));
 for(const lane of [0,1]){let end=w.time;for(const j of remaining.filter(j=>j.lane===lane)){if(j.startsAt<=w.time){end=j.startsAt+j.durationMs;}else{j.startsAt=end;end+=j.durationMs;}}}
 e.construction=remaining;for(const craft of w.extinction?.craftsmen??[])if(cancelled.some(j=>j.commandId===craft.constructionCommandId))craft.constructionCommandId=null;
 if(job.target.kind==='building'&&(c.buildings[job.target.key]??0)===0){delete c.buildings[job.target.key];delete e.slots[job.target.key];}
 addStock(c,refund);replaceEvents(s,removed,remaining,c.id);
}
export function applyEconomyCommand(w:FormalWorld,c:FormalCity,order:FormalOrder,p:EconomyCommand,s:EventScheduler){
 requireRule(c.economy,'此操作需要正式城市經濟。');settleCity(w,c);const e=c.economy;
 if(p.type==='building.demolish'){startDemolition(w,c,order,p.key,s);return;}
 if(p.type==='construction.cancel'){cancelConstruction(w,c,p.constructionCommandId,s);return;}
 if(p.type==='city.promote'){
  requireRule(!c.cityPromotionCompleted&&!e.promotion&&promotionConditions(c).every(Boolean),'City 晉升條件未達成或已啟動。');
  spend(c,{...CITY_PROMOTION.cost});const durationMs=CITY_PROMOTION.durationMs,eventId=enqueue(w,s,{type:'city.promote.complete',cityId:c.id,at:w.time+durationMs});e.promotion={eventId,commandId:order.commandId,startedAt:w.time,durationMs,populationSnapshot:c.population,housingSnapshot:c.housing,townhallSnapshot:buildingLevel(c,'townhall')};return;
 }
 if(p.type==='logistics.dispatch'){
  dispatchLogistics(w,c,order,p.destinationCityId,p.resources,s);return;
 }
 requireRule(e.construction.length<QUEUE_CAPACITY,'建造工程已達 5 項上限。');
 let lane=p.lane;requireRule(lane!==1||e.milestones.includes(15000),'尚未取得第二施工佇列。');
 const previous=e.construction.filter(j=>p.type==='field.upgrade'?j.target.kind==='field'&&j.target.slot===p.slot:j.target.kind==='building'&&j.target.key===p.key);
 requireRule(!previous.some(j=>j.action==='demolish'),'此建築正在拆除，不能排入升級。');
 if(previous.length)lane=previous.at(-1)!.lane;
 if(lane===undefined){const end=(l:number)=>Math.max(w.time,...e.construction.filter(j=>j.lane===l).map(j=>j.startsAt+j.durationMs));lane=constructionConcurrency(c)===2&&end(1)<end(0)?1:0;}
 let target:Construction['target'],fromLevel:number,durationMs:number,paidResources:Resources;
 if(p.type==='field.upgrade'){
  const field=c.fields?.find(f=>f.slot===p.slot);requireRule(field,'資源田不存在。');fromLevel=previous.at(-1)?.toLevel??field.level;requireRule(fromLevel<15,'資源田已滿級。');
  if(fromLevel>=10)requireRule(e.milestones.includes(10000)&&c.cityPromotionCompleted&&c.housing>=10000,'高階資源田需要永久人口／City 資格與當下住房。');
  paidResources=fieldCost(field.resource,fromLevel+1);spend(c,paidResources);durationMs=fieldDuration(field.resource,fromLevel+1,buildingLevel(c,'center'));target={kind:'field',slot:p.slot};
 }else{
  const kind=buildingKind(p.key);requireRule(kind,'建築種類或 identity 無效。');const d=BUILDING_CATALOG[kind];fromLevel=previous.at(-1)?.toLevel??(kind==='wall'?buildingLevel(c,'wall'):c.buildings[p.key]??0);requireRule(fromLevel<d.maxLevel,'建築已滿級。');
  if(kind==='wall')requireRule(p.slot===undefined,'城牆為固定設施，不使用一般建築槽。');
  for(const requirement of buildingRequirements(w,c,kind,fromLevel+1))requireRule(requirement.met,'建築前置未達成：'+requirement.id);
  if(kind!=='center'&&kind!=='wall'&&e.slots[p.key]===undefined){const slot=p.slot??Array.from({length:15},(_,i)=>i).find(i=>!Object.values(e.slots).includes(i));requireRule(slot!==undefined&&!Object.values(e.slots).includes(slot),'自由建築槽已滿或該位置已使用。');e.slots[p.key]=slot;c.buildings[p.key]=0;}
  const craftOrder=order.payload.type==='craftsman.castle'?order.payload:undefined;
  if(craftOrder)requireRule(kind==='castle'&&fromLevel===0&&w.extinction?.craftsmen.some(t=>t.id===craftOrder.craftsmanId&&t.ownerFactionId===order.issuerId&&t.cityId===c.id&&!t.carrierArmyId&&!t.eventId&&!t.constructionCommandId),'工匠城堡授權已失效。');
  // The original validated command, never a public building payload flag, authorizes Lv1 only.
  paidResources=craftOrder?zeroResources():buildingCost(kind,fromLevel+1);spend(c,paidResources);durationMs=buildingDuration(kind,fromLevel+1,buildingLevel(c,'center'));target={kind:'building',key:p.key};
 }
 const laneJobs=e.construction.filter(j=>j.lane===lane),startsAt=Math.max(w.time,...laneJobs.map(j=>j.startsAt+j.durationMs),...previous.map(j=>j.startsAt+j.durationMs));
 const id=enqueue(w,s,{type:'construction.complete',cityId:c.id,at:startsAt+durationMs});e.construction.push({eventId:id,commandId:order.commandId,lane,lanePreference:p.lane,target,fromLevel,toLevel:fromLevel+1,createdAt:w.time,startsAt,durationMs,qualificationHousing:c.housing,paidResources});
}
export function handleEconomyEvent(w:FormalWorld,event:FormalEvent,s:EventScheduler):boolean {
 if(event.type==='economy.settle'){
  const c=spatial(w).cities.get(event.cityId);if(!c?.economy||c.economy.settlementEventId!==event.id)return true;settleCity(w,c);c.economy.settlementEventId=enqueue(w,s,{type:'economy.settle',cityId:c.id,at:event.at+HOUR});return true;
 }
 if(event.type==='construction.complete'){
  const c=spatial(w).cities.get(event.cityId),job=c?.economy?.construction.find(j=>j.eventId===event.id);if(!c||!job)return true;settleCity(w,c);
  if(job.castleCivilizationId&&!craftsmanForConstruction(w,c,job)){reconcileCityCraftsmen(w,c,s);return true;}
  if(job.action==='demolish'){completeDemolition(w,c,job);}
  else if(job.target.kind==='field'){const slot=job.target.slot;c.fields!.find(f=>f.slot===slot)!.level=job.toLevel;}
  else if(job.target.key==='wall'){c.wallLevel=job.toLevel;}
  else {if(job.target.key==='townhall')settleFaction(w,c.ownerFactionId);c.buildings[job.target.key]=job.toLevel;if(job.target.key==='castle'){if(job.castleCivilizationId)c.castleCivilizationId=job.castleCivilizationId;if(!c.castleCivilizationId)c.castleCivilizationId=castleSource(w,c);finishCraftsmanCastle(w,c,job.commandId);}if(job.target.key==='residence')c.housing=400+HOUSING[job.toLevel];}
  c.economy!.construction=c.economy!.construction.filter(j=>j.eventId!==event.id);return true;
 }
 if(event.type==='city.promote.complete'){const c=spatial(w).cities.get(event.cityId);if(c?.economy?.promotion?.eventId===event.id){settleCity(w,c);c.cityPromotionCompleted=true;c.economy.promotion=null;}return true;}
 if(event.type==='logistics.arrive'||event.type==='logistics.return'){
  const t=w.logistics?.find(t=>t.shipmentId===event.shipmentId);if(!t)return true;
  if(event.type==='logistics.arrive'){if(t.phase!=='outbound'||t.arrivalEventId!==event.id)return true;const c=spatial(w).cities.get(t.destinationCityId)!;settleCity(w,c);t.returnCargo=zeroResources();for(const r of resourceKeys){const booked=(t.reservedResources??t.resources)[r];c.economy!.reservedIncoming[r]-=booked;const accepted=Math.min(t.resources[r],Math.max(0,storageCapacity(c)-c.economy!.reservedIncoming[r]-c.stock[r]));c.stock[r]+=accepted;t.returnCargo[r]=t.resources[r]-accepted;}t.phase='returning';}
  else{requireRule(t.phase==='returning'&&t.returnEventId===event.id,'商隊返程事件不一致。');const source=spatial(w).cities.get(t.sourceCityId);if(source?.ownerFactionId===t.sourceFactionId&&t.returnCargo){settleCity(w,source);addStock(source,t.returnCargo);}w.logistics=w.logistics!.filter(x=>x.shipmentId!==t.shipmentId);}return true;
 }
 return false;
}
/** Shared B1 physical-shipment record adapter. Project eligibility, pool arrivals and completion belong to B9. */
export function projectShipmentRecord(t:LogisticsShipment,projectId:ProjectId):Shipment {
 return{commandId:t.commandId,shipmentId:t.shipmentId,projectId,sourceFactionId:t.sourceFactionId,sourceCityId:t.sourceCityId,destinationCityId:t.destinationCityId,resources:{...t.resources},dispatchedAt:t.dispatchedAt,authorizationSnapshot:{...t.authorizationSnapshot},phase:'in-transit'};
}

/** Shared market dispatch: the B9 caller authorizes and reserves project demand first. */
export function dispatchLogistics(w:FormalWorld,c:FormalCity,order:FormalOrder,destinationCityId:CityId,resources:Resources,s:EventScheduler,projectId?:ProjectId){
 requireRule(c.economy,'此操作需要正式城市經濟。');settleCity(w,c);
  const dest=spatial(w).cities.get(destinationCityId);requireRule(dest&&(projectId!==undefined||dest.id!==c.id)&&canReinforce(w,order.issuerId,dest.ownerFactionId)&&dest.economy,'目的地必須是自己或合法友方的另一座城市。');settleCity(w,dest);
  const total=resourceKeys.reduce((n,r)=>n+resources[r],0),caravans=Math.ceil(total/CARAVAN_CAPACITY),busy=(w.logistics??[]).filter(t=>t.sourceCityId===c.id).reduce((n,t)=>n+t.caravans,0);
  requireRule(total>0&&caravans<=buildingLevel(c,'market')-busy,'市場可用商隊不足。');const cap=storageCapacity(dest);if(!projectId)requireRule(resourceKeys.every(r=>resources[r]+dest.stock[r]+dest.economy!.reservedIncoming[r]<=cap),'目的地容量不足或已預約。');
  const path=route(w,c,dest),f=w.factions.find(f=>f.id===order.issuerId)!,duration=Math.max(1,Math.ceil(path.distance*60000*(f.techIds.includes('logistics.dispatch')?.9:1))),arrivalAt=w.time+duration,returnAt=arrivalAt+duration;
  spend(c,resources);if(!projectId)for(const r of resourceKeys)dest.economy.reservedIncoming[r]+=resources[r];
  const id=shipmentId(sequenceKey(w.sequences.project++)),arrivalEventId=enqueue(w,s,{type:'logistics.arrive',shipmentId:id,at:arrivalAt}),returnEventId=enqueue(w,s,{type:'logistics.return',shipmentId:id,at:returnAt});
  (w.logistics??=[]).push({shipmentId:id,...(projectId?{projectId}:{}),commandId:order.commandId,sourceFactionId:order.issuerId,sourceCityId:c.id,destinationCityId:dest.id,resources:{...resources},caravans,path:path.path,distance:path.distance,dispatchedAt:w.time,arrivalAt,returnAt,arrivalEventId,returnEventId,phase:'outbound',authorizationSnapshot:{sourceCityOwnerFactionId:c.ownerFactionId,contributorEmpireId:f.empireId,checkedAt:w.time}});return;
}
