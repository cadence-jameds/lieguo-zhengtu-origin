import {militaryRanking} from './militaryPower';
import type {FormalEvent,FormalReport,FormalWorld} from './model';
import type {EventId,FactionId} from './ids';
import {reportId,sequenceKey} from './ids';
import {empireOf} from './politics';
import {hostileAllowed} from './armies';
import {enqueue,growPopulation} from './economy';
import {HOUR} from './time';
import type {EventScheduler} from './scheduler';
export type VictoryKind='conquest'|'hegemony';
export type VictoryCandidate={scope:string;kind:VictoryKind;startedAt:number;eventId:EventId};
export type VictoryResult={name:string;scope:string;kind:VictoryKind;at:number;eventId:EventId;members:FactionId[]};
export type VictoryState={candidates:VictoryCandidate[];result:VictoryResult|null};
export const victoryScope=(w:FormalWorld,id:FactionId)=>empireOf(w,id)?.id??id;
export const VICTORY_DURATION={conquest:12*HOUR,hegemony:24*HOUR} as const;
/** Aggregate lawful ownership and same-world-time population projections.
 * Only public totals/rank are returned; private military ledgers remain internal. */
export function campStatistics(w:FormalWorld){
 const populationAt=(c:FormalWorld['cities'][number])=>Math.floor(c.economy?growPopulation(c.population,c.housing,c.buildings.monastery??0,Math.max(0,w.time-c.economy.lastSettledAt)/HOUR):c.population);
 const scopes=new Map<FactionId,string>(),cityCounts=new Map<string,{cities:number;population:number}>(),groups=new Map<string,{scope:string;leader:FactionId;members:FactionId[]}>();
 for(const f of w.factions){const scope=victoryScope(w,f.id),e=empireOf(w,f.id);scopes.set(f.id,scope);if(!groups.has(scope))groups.set(scope,{scope,leader:e?.leader??f.id,members:[]});groups.get(scope)!.members.push(f.id);}
 let cities=0,population=0;for(const c of w.cities){const scope=scopes.get(c.ownerFactionId)!,n=cityCounts.get(scope)??{cities:0,population:0};n.cities++;n.population+=populationAt(c);cityCounts.set(scope,n);cities++;population+=populationAt(c);}
 const military=militaryRanking(w),alive=new Set(w.cities.map(c=>c.ownerFactionId)),extinct=new Set(w.extinction?.extinct??[]);
 return [...groups.values()].map(g=>{const n=cityCounts.get(g.scope)??{cities:0,population:0},e=empireOf(w,g.leader);return{...g,...n,cityShare:n.cities/Math.max(1,cities),populationShare:n.population/Math.max(1,population),empire:e,activeLords:g.members.filter(id=>alive.has(id)&&!extinct.has(id)).length,legions:e?.legions.filter(id=>w.politics!.legions.find(l=>l.id===id)?.members.some(id=>alive.has(id)&&!extinct.has(id))).length??0,militaryRank:e?military.ranks.get(e.id):undefined,uniqueMilitaryFirst:military.uniqueFirst===g.scope};});
}
export function victoryConditions(w:FormalWorld){const camps=campStatistics(w);return camps.filter(c=>c.cities>0).map(c=>{
 const hostileEmpire=camps.some(e=>e.empire&&e.scope!==c.scope&&e.cityShare>=.15&&hostileAllowed(w,c.leader,e.leader));
 const conquest=c.cityShare>=.7&&c.populationShare>=.7&&!hostileEmpire;
 const hegemony=!!c.empire&&c.legions===3&&(c.activeLords??0)>=15&&c.cityShare>=.45&&c.populationShare>=.45&&c.militaryRank===1&&c.uniqueMilitaryFirst;
 return{...c,hostileEmpire,conquest,hegemony};});}
/** A single world result; permanent modern qualifications never enter either condition. */
export function reconcileVictory(w:FormalWorld,s:EventScheduler){
 if(w.victory?.result)return;const old=w.victory?.candidates??[],next:VictoryCandidate[]=[];
 for(const c of victoryConditions(w))for(const kind of ['conquest','hegemony'] as const)if(c[kind]){const found=old.find(x=>x.scope===c.scope&&x.kind===kind);next.push(found??{scope:c.scope,kind,startedAt:w.time,eventId:enqueue(w,s,{type:'victory.complete',scope:c.scope,kind,at:w.time+VICTORY_DURATION[kind]})});}
 const retained=new Set(next.map(c=>c.eventId));s.discard(new Set(old.filter(c=>!retained.has(c.eventId)).map(c=>c.eventId)));
 if(next.length||w.victory)w.victory={candidates:next,result:null};
}
export function handleVictoryEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler,reports:FormalReport[]){
 if(e.type!=='victory.complete')return false;if(w.victory?.result)return true;
 reconcileVictory(w,s);const candidate=w.victory?.candidates.find(c=>c.eventId===e.id&&c.scope===e.scope&&c.kind===e.kind);if(!candidate||candidate.startedAt+VICTORY_DURATION[e.kind]!==w.time)return true;
 const camp=victoryConditions(w).find(c=>c.scope===e.scope&&c[e.kind]);if(!camp)return true;
 s.discard(new Set(w.victory!.candidates.map(c=>c.eventId)));w.victory={candidates:[],result:{name:camp.empire?.name??w.factions.find(f=>f.id===camp.leader)!.name,scope:e.scope,kind:e.kind,at:w.time,eventId:e.id,members:[...camp.members].sort()}};
 const sequence=w.sequences.report++;reports.push({id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:w.playerFactionId,at:w.time,category:'system',title:e.kind==='conquest'?'正式征服勝利':'正式帝國霸權勝利',text:`${w.factions.find(f=>f.id===camp.leader)!.name} 所屬陣營已連續維持全部條件 ${VICTORY_DURATION[e.kind]/HOUR} 世界小時。`});return true;
}
