import type {BattleId} from './ids';
import type {FormalWorld} from './model';
import {isMissionArmy} from './combatModel';
import {SIEGE_ROUND_LIMIT} from './battleProgress';
/** A minimal presentation projection. Enemy pools, HP and wall damage never leave this boundary. */
export function liveBattleView(w:FormalWorld,id:BattleId){
 const b=w.combat?.battles.find(x=>x.id===id);if(!b)return null;
 const own=b.participants.filter(p=>p.ownerFactionId===w.playerFactionId);
 if(!own.length&&b.ownerBefore!==w.playerFactionId&&b.attackerFactionId!==w.playerFactionId)return null;
 const initial:Record<string,number>={},alive:Record<string,number>={},departed:Record<string,number>={};
 const add=(out:Record<string,number>,units:Record<string,number>)=>{for(const [unit,n] of Object.entries(units))out[unit]=(out[unit]??0)+n;};
 for(const p of own){add(initial,p.before);if(p.departedAt!==undefined){add(departed,p.after);continue;}const source=p.armyId?w.armies.find(a=>a.id===p.armyId):w.cities.find(c=>c.id===p.cityId);if(source?.ownerFactionId===w.playerFactionId)add(alive,p.armyId?source&&'units' in source?source.units??{}:{}:source&&'military' in source?source.military?.units??{}:{});}
 // An attacking army that arrived between rounds is already legally participating.
 for(const a of w.armies.filter(isMissionArmy).filter(a=>a.battleId===id&&a.status==='engaged'&&a.ownerFactionId===w.playerFactionId&&!own.some(p=>p.armyId===a.id))){add(initial,a.initialUnits);add(alive,a.units);}
 const casualties=Object.fromEntries(Object.entries(initial).map(([unit,n])=>[unit,Math.max(0,n-(alive[unit]??0)-(departed[unit]??0))]));
 const city=w.cities.find(c=>c.id===b.cityId)!;
 return{battleId:b.id,cityId:b.cityId,targetName:city.name,defending:b.ownerBefore===w.playerFactionId,phase:b.phase??'combat',combatRound:b.round,siegeRound:b.siegeRound??0,siegeLimit:SIEGE_ROUND_LIMIT,remainingSiegeRounds:SIEGE_ROUND_LIMIT-(b.siegeRound??0),nextRoundAt:b.nextRoundAt,wallBefore:b.wallBefore,wallLevel:city.wallLevel??0,initial,alive,casualties,departed,history:(b.history??[]).map(entry=>({...entry,...(entry.forces?{forces:entry.forces.filter(f=>f.ownerFactionId===w.playerFactionId)}:{})})),historyOmitted:b.historyOmitted??0};
}
