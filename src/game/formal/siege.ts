import {canAcquireConquest} from './politics';
import type {BattleId} from './ids';
import type {FormalCity,FormalWorld} from './model';
import {resourceKeys,zeroResources} from './model';
import type {CombatPool} from './combatResolver';
import type {SiegeChange} from './combatModel';
import {baseUnit,combatStats,effectiveUnit,hasTech,modernSiegeMultiplier} from './combatModifiers';
import {UNIT_CATALOG} from './unitCatalog';
import {HOUSING,storageCapacity} from './catalogB3';
import {requireRule,changeCityOwner,settleCity,settleFaction} from './economy';
import type {EventScheduler} from './scheduler';
import {seedHash} from './terrain';
export const WALL_DURABILITY=[0,30,35,40,45,50,60,70,80,90,105,120,140,160,185,210];
export const DEVELOPMENT_DURABILITY=[0,25,30,35,40,45,50,60,70,80,90,105,120,140,160,180];
export const developmentLevels=(c:FormalCity)=>Object.values(c.buildings).reduce((n,x)=>n+x,0)+(c.fields??[]).reduce((n,x)=>n+x.level,0);
export const conquestLossRate=(lost:number,before:number)=>Math.min(.8,.05+.75*Math.min(1,lost/Math.max(1,before)));
/** Rebase future work onto damaged completed levels; keep paid/time/qualification/EventId snapshots. */
export function reconcileSiegeQueues(c:FormalCity){const next=new Map<string,number>();for(const j of c.economy?.construction??[]){const target=j.target,key=target.kind==='field'?`field:${target.slot}`:`building:${target.key}`;let level=next.get(key);if(level===undefined)level=target.kind==='field'?c.fields!.find(f=>f.slot===target.slot)!.level:target.key==='wall'?(c.wallLevel??0):(c.buildings[target.key]??0);j.fromLevel=level;j.toLevel=j.action==='demolish'?0:level+1;next.set(key,j.toLevel);}}
/** Reservations are bookings, not cargo. Shrinking warehouses rebooks bounded arrival capacity. */
export function reconcileSiegeStorage(w:FormalWorld,c:FormalCity){
 const cap=storageCapacity(c),reserved=zeroResources();for(const t of (w.logistics??[]).filter(t=>!t.projectId&&t.phase==='outbound'&&t.destinationCityId===c.id).sort((a,b)=>a.arrivalAt-b.arrivalAt||(a.shipmentId<b.shipmentId?-1:1))){t.reservedResources??={...t.resources};for(const r of resourceKeys){t.reservedResources[r]=Math.min(t.reservedResources[r],Math.max(0,cap-reserved[r]));reserved[r]+=t.reservedResources[r];}}
 if(c.economy)c.economy.reservedIncoming=reserved;for(const r of resourceKeys){c.stock[r]=Math.min(c.stock[r],cap-reserved[r]);if(c.economy&&c.stock[r]===cap-reserved[r])c.economy.productionRemainder[r]=0;}
}
export function resolveSiege(w:FormalWorld,c:FormalCity,pools:readonly CombatPool[],id:BattleId,options:{wallDamage?:number;wallDamageLevel?:number;damageWall?:boolean;catapultBatch?:boolean}={}){
 settleCity(w,c);const defending=w.factions.find(f=>f.id===c.ownerFactionId),changes:SiegeChange[]=[],before=developmentLevels(c);let wallPower=0,buildingPower=0;
 for(const p of pools){if(!p.count)continue;const f=w.factions.find(f=>f.id===p.ownerFactionId),base=baseUnit(p.unitId),tiers=(prefix:string)=>[1,2].filter(n=>hasTech(f,`${prefix}.${n}`)).length;
  if(base==='ram')wallPower+=p.count*60*(1+.1*tiers('siege.ram'))*modernSiegeMultiplier(p.unitId,f,'wall');
  else if(base==='catapult')buildingPower+=p.count*30*1.5*(1+.1*tiers('siege.projection'))*modernSiegeMultiplier(p.unitId,f,'development');
  else if(effectiveUnit(p.unitId)){const cls=UNIT_CATALOG[p.unitId].combatClass,coefficient=cls==='infantry'?.03:cls==='ranged'?.005:.01;wallPower+=p.count*combatStats(p.unitId,f).attack*coefficient;}
 }
 const wallBefore=c.wallLevel??0,mult=hasTech(defending,'civilization.imperial-wall')?1.2:1;
 // A construction event can change the level: its new level never inherits damage from another level.
 if(options.damageWall===false)wallPower=0;
 else wallPower+=options.wallDamageLevel===wallBefore?(options.wallDamage??0):0;
 while((c.wallLevel??0)>0&&wallPower+1e-9>=WALL_DURABILITY[c.wallLevel!]*mult){wallPower-=WALL_DURABILITY[c.wallLevel!]*mult;c.wallLevel!--;}
 if(wallBefore!==c.wallLevel)changes.push({target:{kind:'wall'},before:wallBefore,after:c.wallLevel??0});
 const durability=1+.1*Number(hasTech(defending,'engineering.masonry'))+.1*Number(hasTech(defending,'engineering.architecture'));
 if(options.catapultBatch===false)buildingPower=0;
 let step=0;const salt=Array.from(id).reduce((n,ch)=>Math.imul(n,31)+ch.charCodeAt(0),0)>>>0;
 while(buildingPower>0){const candidates=[...Object.keys(c.buildings).filter(k=>c.buildings[k]>(k==='center'?1:0)).map(key=>({kind:'building' as const,key})),...(c.fields??[]).filter(f=>f.level>0).map(f=>({kind:'field' as const,slot:f.slot}))];if(!candidates.length)break;
  const target=candidates[seedHash(w.seed,salt,step++,501)%candidates.length],level=target.kind==='field'?c.fields!.find(f=>f.slot===target.slot)!.level:c.buildings[target.key],cost=DEVELOPMENT_DURABILITY[level]*durability;
  if(buildingPower+1e-9<cost)break;buildingPower-=cost;
  if(target.kind==='field')c.fields!.find(f=>f.slot===target.slot)!.level--;else c.buildings[target.key]--;
  const previous=changes.find(x=>x.target.kind===target.kind&&(target.kind==='field'?x.target.kind==='field'&&x.target.slot===target.slot:x.target.kind==='building'&&x.target.key===target.key));if(previous)previous.after=level-1;else changes.push({target,before:level,after:level-1});
 }
 // Housing is finalized after training population has entered the conquest loss base.
 reconcileSiegeQueues(c);reconcileSiegeStorage(w,c);return{changes,developmentBefore:before,lost:before-developmentLevels(c),wallDamage:c.wallLevel?Math.max(0,wallPower):0,wallDamageLevel:c.wallLevel??0};
}
export function finishConquest(w:FormalWorld,c:FormalCity,owner:FormalCity['ownerFactionId'],lost:number,before:number,s:EventScheduler){
 requireRule(canAcquireConquest(w,owner),'已滅國或無合法城市的勢力不能接收征服城市。');
 settleFaction(w,c.ownerFactionId);settleFaction(w,owner);const queue=c.military?.queue??[],returnedTrainingPopulation=queue.reduce((n,j)=>n+j.remaining*j.populationPerUnit,0),cancelled=new Set(queue.map(j=>j.eventId));
 const events=s.snapshot().filter(e=>!cancelled.has(e.id));while(s.size)s.pop();for(const e of events)s.push(e);
 if(c.military)c.military.queue=[];
 const populationBefore=c.population+returnedTrainingPopulation,rate=conquestLossRate(lost,before);c.housing=400+HOUSING[c.buildings.residence??0];c.population=Math.min(c.housing,Math.max(0,populationBefore*(1-rate)));c.autoLogistics=[];
 changeCityOwner(w,c,owner,'conquest',s);return{populationBefore,populationAfter:c.population,returnedTrainingPopulation,rate};
}
export function finalizeSiegeHousing(c:FormalCity){c.housing=400+HOUSING[c.buildings.residence??0];c.population=Math.min(c.population,c.housing);}
