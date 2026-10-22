import type {BattleId,EventId,FactionId} from './ids';
import type {FormalWorld,FormalFaction} from './model';
import type {CombatPool} from './combatResolver';
import type {BattleReportPayload} from './combatModel';
import {UNIT_CATALOG,isModernUnit} from './unitCatalog';
import {empireOf} from './politics';
import {requireRule} from './economy';

export type AwarenessPool={value:number;significantEncounter:boolean;encountered:string[]};
export type AwarenessBattle={battleId:BattleId;pool:string;events:string[];killedPopulation:number;battleAward:number;conquestAward:boolean};
export type ModernAwareness={pools:Record<string,AwarenessPool>;battles:AwarenessBattle[]};
export const awarenessScope=(w:FormalWorld,id:FactionId)=>empireOf(w,id)?.id??id;
export const awarenessPool=(w:FormalWorld,id:FactionId):Readonly<AwarenessPool>=>w.modernAwareness?.pools[awarenessScope(w,id)]??{value:0,significantEncounter:false,encountered:[]};
export const effectiveAwareness=(w:FormalWorld,id:FactionId)=>awarenessPool(w,id).value;
export const modernUnitAuthorized=(f:FormalFaction,id:string)=>f.modernQualification==='full'||!!f.reverseEngineering?.includes(id);
export const modernCombatUnit=(id:string)=>isModernUnit(id)&&UNIT_CATALOG[id].hp>0;
const population=(p:CombatPool)=>modernCombatUnit(p.unitId)?p.count*UNIT_CATALOG[p.unitId].population:0;
function state(w:FormalWorld,key:string,battleId:BattleId){
 const a=w.modernAwareness??={pools:{},battles:[]};
 const pool=a.pools[key]??={value:0,significantEncounter:false,encountered:[]};
 let battle=a.battles.find(b=>b.pool===key&&b.battleId===battleId);
 if(!battle){battle={battleId,pool:key,events:[],killedPopulation:0,battleAward:0,conquestAward:false};a.battles.push(battle);}
 return{pool,battle};
}
/** Called only around an actual damage exchange. Round-start forces are simultaneous,
 * never accumulated across rounds to satisfy the 50-population encounter threshold. */
export function recordModernRound(w:FormalWorld,battleId:BattleId,eventId:EventId,round:number,attack:readonly CombatPool[],defense:readonly CombatPool[],afterAttack:readonly CombatPool[],afterDefense:readonly CombatPool[]){
 const event=`${eventId}/${round}`;
 for(const [own,enemy,after] of [[attack,defense,afterDefense],[defense,attack,afterAttack]] as const){
  const keys=new Set(own.filter(p=>p.count>0&&UNIT_CATALOG[p.unitId].hp>0&&p.ownerFactionId).map(p=>awarenessScope(w,p.ownerFactionId!)));
  const seen=[...new Set(enemy.filter(p=>population(p)>0).map(p=>p.unitId))];if(!seen.length)continue;
  for(const key of keys){
   const {pool,battle}=state(w,key,battleId);if(battle.events.includes(event))continue;battle.events.push(event);
   let award=0;
   if(!pool.significantEncounter&&enemy.reduce((n,p)=>n+population(p),0)>=50){pool.significantEncounter=true;award+=2;}
   for(const id of seen)if(!pool.encountered.includes(id)){pool.encountered.push(id);award+=2;}
   const killed=enemy.reduce((n,p)=>n+Math.max(0,population(p)-population(after.find(a=>a.key===p.key)??{...p,count:0})),0);
   award+=Math.floor((battle.killedPopulation+killed)/50)-Math.floor(battle.killedPopulation/50);battle.killedPopulation+=killed;
   const granted=Math.min(10-battle.battleAward,award);battle.battleAward+=granted;pool.value=Math.min(100,pool.value+granted);
  }
 }
}
/** Ownership must have really changed; qualification is sampled at the conquest event. */
export function recordModernConquest(w:FormalWorld,p:BattleReportPayload){
 if(p.mission!=='conquest'||p.outcome!=='conquered'||!p.ownerBefore||!p.ownerAfter||p.ownerBefore===p.ownerAfter||w.factions.find(f=>f.id===p.ownerBefore)?.modernQualification!=='full')return;
 const {pool,battle}=state(w,awarenessScope(w,p.ownerAfter),p.battleId);
 if(battle.conquestAward)return;battle.conquestAward=true;pool.value=Math.min(100,pool.value+15);
}
export function selectReverseEngineering(w:FormalWorld,id:FactionId,unitId:string){
 const f=w.factions.find(f=>f.id===id)!,pool=awarenessPool(w,id),limit=pool.value>=80?2:pool.value>=60?1:0;
 requireRule(f.modernQualification!=='full'&&modernCombatUnit(unitId)&&pool.encountered.includes(unitId),'只能逆向工程實際交戰遭遇過的現代兵種線。');
 requireRule((f.reverseEngineering?.length??0)<limit&&!f.reverseEngineering?.includes(unitId),'逆向工程名額不足或兵種線已選擇。');
 (f.reverseEngineering??=[]).push(unitId);
}
