import type {FormalWorld,FormalCommand} from './model';
import type {FactionId,CityId} from './ids';
import type {BattleReportPayload} from './combatModel';
import {hostileAllowed} from './armies';
import {isMissionArmy} from './combatModel';
import {legionOf,empireOf,embassy,diplomaticRelation,politicalScope} from './politics';
import {UNIT_CATALOG} from './unitCatalog';
import type {Agent,Intelligence,RelationshipMemory} from './autonomyModel';
export const HOUR=3600000;
const clamp=(v:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
export function memoryFor(w:FormalWorld,owner:FactionId,other:FactionId):RelationshipMemory|undefined{const a=w.autonomy?.agents.find(a=>a.factionId===owner);if(!a||owner===other)return;let m=a.memory.find(m=>m.factionId===other);if(!m){m={factionId:other,trust:0,hatred:0,threat:0,at:w.time};a.memory.push(m);if(a.memory.length>32)a.memory.shift();}return m;}
function signal(_w:FormalWorld,a:Agent,id:string){const seen=a.seenSignals??=[];if(seen.includes(id))return false;seen.push(id);if(seen.length>64)seen.shift();return true;}
export function addIntel(_w:FormalWorld,a:Agent,info:Intelligence){a.intel=a.intel.filter(i=>i.cityId!==info.cityId);a.intel.push(info);if(a.intel.length>32)a.intel.shift();}
export function intelFor(a:Agent,cityId:CityId,at:number){const i=a.intel.find(i=>i.cityId===cityId);if(!i)return;const age=at-i.at;return{ownerFactionId:i.ownerFactionId,coarse:i.coarse,confidence:age<=12*HOUR?1:age<=24*HOUR?.5:0,units:age<=24*HOUR?{...i.units}:undefined};}
/** No road composition: only destination owner's existing incoming alert, optionally authorized political sharing. */
export function incomingAlerts(w:FormalWorld,id:FactionId){const l=legionOf(w,id),e=empireOf(w,id);return w.armies.filter(isMissionArmy).filter(a=>a.status==='outbound'&&a.target.kind==='city'&&a.mission!=='reinforce'&&a.mission!=='scout').flatMap(a=>{if(a.target.kind!=='city')return[];const targetId=a.target.cityId;const c=w.cities.find(c=>c.id===targetId);if(!c||!hostileAllowed(w,a.ownerFactionId,c.ownerFactionId)||a.departedAt>w.time)return[];const visible=c.ownerFactionId===id||!!l&&legionOf(w,c.ownerFactionId)?.id===l.id&&embassy(w,l.leader)>=12||!!e&&empireOf(w,c.ownerFactionId)?.id===e.id&&embassy(w,e.leader)>=15;return visible?[{armyId:a.id,from:a.ownerFactionId,cityId:c.id,ownerFactionId:c.ownerFactionId,x:c.x,y:c.y,arrivalAt:a.arrivalAt}]:[];});}
function aggregate(groups:BattleReportPayload['defenders']){const out:Record<string,number>={};for(const g of groups)for(const [id,n] of Object.entries(g.after))out[id]=(out[id]??0)+n;return out;}
function coarse(units:Record<string,number>):Intelligence['coarse']{const v={personnel:0,armor:0,siege:0};for(const [id,n] of Object.entries(units)){const c=UNIT_CATALOG[id]?.combatClass;v[c==='siege'?'siege':c==='cavalry'||c==='mounted-ranged'?'armor':'personnel']+=n;}return v.siege>v.personnel&&v.siege>v.armor?'siege':v.armor>v.personnel?'armor':'personnel';}
/** Invoked on real resolver output before player-only report persistence filtering. */
export function rememberBattle(w:FormalWorld,p:BattleReportPayload){const attack=p.attackers.flatMap(g=>g.ownerFactionId?[g.ownerFactionId]:[]),defend=p.defenders.flatMap(g=>g.ownerFactionId?[g.ownerFactionId]:[]),participants=[...attack,...defend];
 for(const a of w.autonomy?.agents??[]){if(p.mission==='scout'&&p.intel&&!p.attackers.some(g=>g.ownerFactionId===a.factionId))continue;const own=participants.includes(a.factionId),legion=legionOf(w,a.factionId),empire=empireOf(w,a.factionId);const shared=participants.some(id=>!!legion&&legionOf(w,id)?.id===legion.id&&embassy(w,legion.leader)>=12||!!empire&&empireOf(w,id)?.id===empire.id&&embassy(w,empire.leader)>=15);if(!own&&!shared||!signal(w,a,p.resolutionId))continue;
  const friendlyAttack=attack.some(id=>id===a.factionId||politicalScope(w,id)===politicalScope(w,a.factionId));const opponents=friendlyAttack?defend:attack;
  for(const id of opponents){const m=memoryFor(w,a.factionId,id);if(m){m.hatred=clamp(m.hatred+(p.mission==='scout'?.05:.15)*(1+a.traits.revenge));m.threat=clamp(m.threat+.15);m.trust=clamp(m.trust-.12,-1,1);m.at=w.time;}}
  for(const id of participants.filter(id=>!opponents.includes(id))){const m=memoryFor(w,a.factionId,id);if(m){m.trust=clamp(m.trust+.08,-1,1);m.at=w.time;}}
  // Successful spying provides precise intel only once the actual scouts return alive.
  if(p.mission==='scout'&&!p.intel)continue;
  if(p.target.kind==='city'&&friendlyAttack&&p.ownerBefore&&own){const units=p.intel?.units??aggregate(p.defenders);addIntel(w,a,{cityId:p.target.cityId,ownerFactionId:p.ownerBefore,at:p.intel?.observedAt??p.resolvedAt,source:own?p.intel?'scout':'battle':'shared',units:{...units},coarse:coarse(units)});}
 }
}
export function politicalMemory(w:FormalWorld,owner:FactionId,p:FormalCommand){if(p.type!=='politics')return;const other=p.target??w.politics?.requests.find(r=>r.id===p.requestId)?.from;if(p.action==='friendly-end'){for(const a of w.autonomy?.agents??[]){if(a.factionId===owner)continue;const m=memoryFor(w,a.factionId,owner);if(m){m.trust=clamp(m.trust-.25,-1,1);m.at=w.time;}}}else if(other){const m=memoryFor(w,owner,other);if(m){m.trust=clamp(m.trust+(p.action==='war'?-.2:.05),-1,1);m.at=w.time;}}}
/** Public city/ownership snapshots and already acquired intel, never enemy ledgers/HP/technology. */
export function publicSituation(w:FormalWorld,a:Agent,c:{x:number;y:number}){const ids=new Map(w.factions.map(f=>[f.id,f]));return w.cities.filter(n=>n.ownerFactionId!==a.factionId&&Math.hypot(n.x-c.x,n.y-c.y)<=48).map(n=>({id:n.id,ownerFactionId:n.ownerFactionId,x:n.x,y:n.y,population:n.population,modern:ids.get(n.ownerFactionId)?.modernQualification==='full',relation:diplomaticRelation(w,a.factionId,n.ownerFactionId),intel:intelFor(a,n.id,w.time),memory:a.memory.find(m=>m.factionId===n.ownerFactionId)}));}
