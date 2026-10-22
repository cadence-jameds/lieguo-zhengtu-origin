import type {ArmyId,CityId,FactionId} from './ids';
import type {FormalFaction} from './model';
import {UNIT_CATALOG,isSupplyUnit} from './unitCatalog';
import {combatStats,counterMultiplier,effectiveUnit,EXPOSURE,hitDamage,baseUnit,splashWeights} from './combatModifiers';
export type CombatPool={key:string;armyId:ArmyId|null;ownerFactionId:FactionId|null;sourceCityId:CityId|null;unitId:string;count:number;initialCount:number;hp:number;hpPerUnit:number;contacted:boolean};
export function makePools(units:Record<string,number>,owner:FactionId|null,source:CityId|null,army:ArmyId|null,f?:FormalFaction):CombatPool[]{return Object.entries(units).filter(([id,n])=>n>0&&UNIT_CATALOG[id].hp>0).map(([id,count])=>({key:`${army??source??'wild'}/${id}`,armyId:army,ownerFactionId:owner,sourceCityId:source,unitId:id,count,initialCount:count,hp:count*combatStats(id,f).hp,hpPerUnit:combatStats(id,f).hp,contacted:false}));}
export const effectiveCount=(pools:readonly CombatPool[])=>pools.reduce((n,p)=>n+(effectiveUnit(p.unitId)?p.count:0),0);
export function poolUnits(pools:readonly CombatPool[]){const units:Record<string,number>={};for(const p of pools)if(p.count)units[p.unitId]=(units[p.unitId]??0)+p.count;return units;}
/** Both damage vectors use the same immutable round-start snapshot. Work is O(unit groups²), never O(soldiers²). */
export function exchange(attacking:readonly CombatPool[],defending:readonly CombatPool[],factions:readonly FormalFaction[],wall=0){
 const lookup=(id:FactionId|null)=>factions.find(f=>f.id===id);
 function damage(from:readonly CombatPool[],to:readonly CombatPool[],defenseWall:number){const output=new Map<string,number>();const alive=to.filter(p=>p.count>0),total=alive.reduce((n,p)=>n+p.count,0);
  for(const a of from.filter(p=>p.count>0)){const f=lookup(a.ownerFactionId),interval=combatStats(a.unitId,f).interval;if(!interval)continue;
   const weights=alive.map(p=>p.count*(1+(counterMultiplier(a.unitId,p.unitId)-1)*.5)),sum=weights.reduce((n,x)=>n+x,0);if(!sum)continue;
   const splash=baseUnit(a.unitId)==='catapult'?splashWeights(f).slice(0,total).reduce((n,x)=>n+x,0):1;
   for(let i=0;i<alive.length;i++){const d=alive[i],value=a.count*EXPOSURE/interval*weights[i]/sum*hitDamage(a.unitId,d.unitId,f,lookup(d.ownerFactionId),defenseWall,!a.contacted,splash);output.set(d.key,(output.get(d.key)??0)+value);}
  }return output;
 }
 const toDefenders=damage(attacking,defending,wall),toAttackers=damage(defending,attacking,0);
 const apply=(pools:readonly CombatPool[],vector:Map<string,number>)=>pools.map(p=>{const hp=Math.max(0,p.hp-(vector.get(p.key)??0));return{...p,hp,count:hp>1e-9?Math.min(p.count,Math.ceil((hp-1e-9)/p.hpPerUnit)):0,contacted:true};});
 return{attacking:apply(attacking,toAttackers),defending:apply(defending,toDefenders)};
}
export function baggageLoss(units:Record<string,number>,initial:Record<string,number>,won:boolean,supplyId='baggage'){const before=Object.entries(initial).reduce((n,[id,c])=>n+(effectiveUnit(id)?c*UNIT_CATALOG[id].population:0),0),after=Object.entries(units).reduce((n,[id,c])=>n+(effectiveUnit(id)?c*UNIT_CATALOG[id].population:0),0),count=initial[supplyId]??0;return won&&after>0?Math.round(count*Math.pow(Math.max(0,1-after/Math.max(1,before)),1.2)):count;}
export function applySupplyLoss(units:Record<string,number>,initial:Record<string,number>,won:boolean){for(const id of Object.keys(initial).filter(isSupplyUnit)){const left=Math.min(units[id]??0,Math.max(0,initial[id]-baggageLoss(units,initial,won,id)));if(left)units[id]=left;else delete units[id];}}
