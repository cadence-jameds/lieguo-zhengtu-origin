import {breakthroughDecision} from './breakthrough';
import {empireWonder,wonderRemaining} from './wonder';
import {caravanStatus} from './economy';
import {portion,originalCityAttack,pickAttackStrategy,executeAttackStrategy} from './aiAttackStrategies';
export {portion} from './aiAttackStrategies';
import type {FormalCity,FormalCommand,FormalWorld} from './model';
import {resourceKeys,zeroResources} from './model';
import type {Agent} from './autonomyModel';
import {aiRandom} from './autonomyModel';
import {legionOf,empireOf,embassy,politicalLeader,canCoordinate,diplomaticRelation} from './politics';
import {incomingAlerts,publicSituation,memoryFor,HOUR} from './aiKnowledge';
import {isMissionArmy} from './combatModel';
import {effectiveUnit,marchSeconds} from './combatModifiers';
import {spatial} from './spatial';
import {buildable,terrainAt} from './terrain';
import {buildingLevel} from './catalogB3';
import {SETTLEMENT_COST} from './settlement';
export function politicalDecision(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand|undefined{if(!a.active)return;const me=a.factionId,f=w.factions.find(f=>f.id===me)!,random=(n:number)=>aiRandom(w.seed,me,a.decisions+n),l=legionOf(w,me),e=empireOf(w,me),p=w.politics;if((f.age??0)<1||embassy(w,me)<1)return;
 const q=p?.requests.find(r=>r.to===me&&(r.kind!=='empire'||r.empireIntent!==undefined));if(q){const trust=a.memory.find(m=>m.factionId===q.from)?.trust??0;return{type:'politics',cityId:c.id,action:random(101)<Math.max(.05,.2+.55*a.traits.diplomacy+.15*a.traits.loyalty+trust*.2)?'request-accept':'request-reject',requestId:q.id};}
 if(random(103)>.18+a.traits.diplomacy*.35)return;
 const peers=w.factions.filter(f=>f.id!==me&&(f.age??0)>=1&&embassy(w,f.id)>0&&w.cities.some(c=>c.ownerFactionId===f.id));if(!peers.length)return;const peer=peers[Math.floor(random(104)*peers.length)];
 if(!l){const groups=p?.legions.filter(g=>g.members.length<Math.min(10,embassy(w,g.leader)))??[];if(groups.length&&random(105)<.6)return{type:'politics',cityId:c.id,action:'legion-apply',target:groups[Math.floor(random(106)*groups.length)].leader};if(embassy(w,me)>=3&&random(107)<.4)return{type:'politics',cityId:c.id,action:'legion-create',name:f.name.slice(0,16)+'軍團'};return;}
 if(l.leader!==me){if(random(108)<.003*(1-a.traits.loyalty))return{type:'politics',cityId:c.id,action:'legion-leave'};return;}
 if(!legionOf(w,peer.id)&&l.members.length<Math.min(10,embassy(w,me))&&!p?.requests.some(r=>r.from===me&&r.to===peer.id))return{type:'politics',cityId:c.id,action:'legion-invite',target:peer.id};
 const otherLeader=peers.find(t=>legionOf(w,t.id)?.leader===t.id&&!empireOf(w,t.id)&&t.age!>=2&&!p?.requests.some(r=>r.from===me&&r.to===t.id));if(f.age!>=2&&otherLeader&&(!e&&embassy(w,me)>=11||e?.leader===me&&e.legions.length<3))return{type:'politics',cityId:c.id,action:'empire-propose',target:otherLeader.id,name:f.name.slice(0,16)+'帝國'};
 if(politicalLeader(w,me)!==me)return;const target=politicalLeader(w,peer.id);if(target===me)return;const relation=diplomaticRelation(w,me,target),m=a.memory.find(m=>m.factionId===target);
 if(relation==='friendly'){if(random(109)<.001*(1-a.traits.loyalty))return{type:'politics',cityId:c.id,action:'friendly-end',target};}
 else if(relation==='war'){if(random(110)<.25&&((m?.threat??0)>.4||a.traits.diplomacy>.6))return{type:'politics',cityId:c.id,action:'peace',target};}
 else if(!p?.requests.some(r=>r.from===me&&r.to===target))return{type:'politics',cityId:c.id,action:(m?.hatred??0)>.4&&a.traits.military>.5?'war':'friendly-propose',target};
}
export function militaryDecision(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand[]{const ownUnits=c.military?.units??{},total=Object.entries(ownUnits).reduce((n,[id,count])=>n+(effectiveUnit(id)?count:0),0),ownThreat=incomingAlerts(w,a.factionId).some(t=>t.ownerFactionId===a.factionId),alerts=incomingAlerts(w,a.factionId);
 // Own legal stationed reserves may be recalled; no mid-combat retreat contract is introduced.
 const stationed=w.armies.filter(isMissionArmy).find(t=>t.ownerFactionId===a.factionId&&t.status==='stationed'&&ownThreat);if(stationed)return[{type:'army.recall',cityId:c.id,armyId:stationed.id}];
 const assistance=alerts.find(t=>t.ownerFactionId!==a.factionId&&canCoordinate(w,a.factionId,t.ownerFactionId,13)&&Math.hypot(t.x-c.x,t.y-c.y)<=24&&w.time+Math.hypot(t.x-c.x,t.y-c.y)*marchSeconds(portion(c,.3),w.factions.find(f=>f.id===a.factionId)!)*1000<=t.arrivalAt);
 if(assistance&&!ownThreat&&total>=40&&a.traits.defense+a.traits.loyalty>.9&&aiRandom(w.seed,a.factionId,a.decisions+310)<.75){return[{type:'defense.set',cityId:c.id,enabled:true,units:portion(c,.3),keep:Math.max(10,Math.floor(total*.5))},{type:'defense.dispatch',cityId:c.id,targetCityId:assistance.cityId}];}
 if(!a.active||ownThreat||w.time-a.lastWarAt<HOUR||w.armies.filter(t=>t.ownerFactionId===a.factionId&&t.originCityId===c.id).length>=3)return[];
 if(aiRandom(w.seed,a.factionId,a.decisions+311)>.15+a.traits.military*.55)return[];
 const group=w.politics?.joints.find(j=>j.initiator!==a.factionId&&canCoordinate(w,a.factionId,j.initiator,14)&&!j.armyIds.some(id=>w.armies.find(t=>t.id===id)?.ownerFactionId===a.factionId));if(group&&total>=40&&a.traits.loyalty>.3)return[{type:'joint.join',cityId:c.id,jointId:group.id,units:portion(c,.25)}];
 const candidate=originalCityAttack(w,c,a);
 if(candidate.commands.some(p=>p.type!=='army.dispatch')||total<10)return candidate.commands;
 return executeAttackStrategy(w,c,a,pickAttackStrategy(w,a),candidate);
}
export function expansionDecision(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand|undefined{if(!a.active||incomingAlerts(w,a.factionId).some(t=>t.ownerFactionId===a.factionId)||aiRandom(w.seed,a.factionId,a.decisions+400)>.08+a.traits.expansion*.3)return;const existing=w.settlements?.find(p=>p.sourceCityId===c.id&&p.phase!=='travelling');
 if(existing?.phase==='ready'){const escort=portion(c,.5);if(Object.values(escort).reduce((n,v)=>n+v,0)<20)return;const index=spatial(w);for(let i=0;i<32;i++){const angle=aiRandom(w.seed,a.factionId,a.decisions+410+i)*2*Math.PI,radius=3+i%8,x=Math.round(c.x+Math.cos(angle)*radius),y=Math.round(c.y+Math.sin(angle)*radius);if(x<0||x>383||y<0||y>383||!buildable(terrainAt(w,x,y)))continue;const cell=index.at(x,y);if(!cell.city&&!cell.site&&!cell.reservation)return{type:'settlement.dispatch',cityId:c.id,x,y,name:'新城'+(w.sequences.project%10000),escort};}}
 else if(!existing&&(w.factions.find(f=>f.id===a.factionId)?.age??0)>=2&&buildingLevel(c,'castle')>=1&&c.population>=2400&&resourceKeys.every(r=>c.stock[r]>=SETTLEMENT_COST[r]+100))return{type:'settlement.prepare',cityId:c.id};
}
export function updatePublicMemory(w:FormalWorld,a:Agent,c:FormalCity){for(const n of publicSituation(w,a,c)){const m=memoryFor(w,a.factionId,n.ownerFactionId);if(m){m.threat=Math.min(1,n.population/Math.max(1,c.population)*.08+w.cities.filter(c=>c.ownerFactionId===n.ownerFactionId).length*.025);if(n.relation==='friendly')m.trust=Math.min(1,m.trust+.002);m.at=w.time;}}for(const info of a.intel)if(w.time-info.at>24*HOUR)info.units={};}

/** Only the agent's own empire pool is consulted. Spending and routing still pass the reducer. */
export function wonderDecision(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand|undefined{
 if(!a.active)return;const empire=empireOf(w,a.factionId);if(!empire)return;
 const capacity=caravanStatus(w,c).available*2000;if(capacity<=0)return;
 const project=empireWonder(w,empire.id);
 if(!project)return empire.leader===a.factionId&&w.factions.find(f=>f.id===a.factionId)?.age===3?{type:'wonder.start',cityId:c.id,hostCityId:c.id}:undefined;
 if(project.wonder?.phase==='completed')return breakthroughDecision(w,c,a.active);
 if(project.wonder?.phase!=='funding')return;
 const host=w.cities.find(c=>c.id===project.initiatingCityId);if(!host||empireOf(w,host.ownerFactionId)?.id!==empire.id)return;
 const needed=wonderRemaining(project),resources=zeroResources();let left=capacity;
 for(const r of resourceKeys){const amount=Math.min(left,needed[r],Math.floor(Math.max(0,c.stock[r]-600)*.2));resources[r]=amount;left-=amount;}
 if(left===capacity)return;
 return{type:'wonder.ship',cityId:c.id,projectId:project.projectId,resources};
}
