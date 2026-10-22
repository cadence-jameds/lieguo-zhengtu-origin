import type {FormalCity,FormalCommand,FormalWorld,LargeProject} from './model';
import {resourceKeys,zeroResources} from './model';
import type {Agent} from './autonomyModel';
import type {MissionArmy} from './combatModel';
import {isMissionArmy} from './combatModel';
import {UNIT_CATALOG,isModernUnit,isScoutUnit,isSupplyUnit} from './unitCatalog';
import {baseUnit,effectiveUnit,marchSeconds,counterMultiplier,carryCapacity} from './combatModifiers';
import {unitRecruitCost} from './military';
import {unitMilitaryPower,publicMilitaryRank} from './militaryPower';
import {empireOf,politicalScope,diplomaticRelation,canCoordinate} from './politics';
import {incomingAlerts,intelFor,publicSituation,HOUR} from './aiKnowledge';
import {wonderProgress,wonderRemaining,empireWonder} from './wonder';
import {breakthroughWork} from './breakthrough';
import {repairQuote,wonderAvailable} from './wonderCondition';
import {caravanStatus} from './economy';
import {spatial} from './spatial';
import {route} from './routing';
import {awarenessPool} from './modernAwareness';
export type ModernDirection='balanced'|'anti-armor'|'anti-personnel'|'anti-siege'|'anti-sniper';
export type ModernDoctrine={evaluatedAt:number;direction:ModernDirection;budgets:Record<string,number>};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function knownEnemyMix(w:FormalWorld,a:Agent){
 let personnel=0,armor=0,siege=0,guards=0,snipers=0,modern=0,total=0;const targets:Record<string,number>={},coarse={personnel:0,armor:0,siege:0};
 for(const i of a.intel){const city=spatial(w).cities.get(i.cityId);if(!city||city.ownerFactionId!==i.ownerFactionId||diplomaticRelation(w,a.factionId,i.ownerFactionId)==='friendly')continue;const info=intelFor(a,i.cityId,w.time);if(!info)continue;coarse[info.coarse]++;
  if(!info.confidence||!info.units)continue;
  for(const [id,n] of Object.entries(info.units)){const u=UNIT_CATALOG[id];if(!u||isScoutUnit(id)||isSupplyUnit(id))continue;const power=n*unitMilitaryPower(id)*info.confidence;total+=power;targets[id]=(targets[id]??0)+power;if(isModernUnit(id))modern+=power;
   if(u.combatClass==='siege')siege+=power;else if(['cavalry','mounted-ranged'].includes(u.combatClass))armor+=power;else personnel+=power;if(u.civilizationId)guards+=power;if(id==='modern.guard.civ_britannia')snipers+=power;
  }
 }
 const direction:ModernDirection=snipers/Math.max(1,total)>=.2?'anti-sniper':armor/Math.max(1,total)>=.4?'anti-armor':siege/Math.max(1,total)>=.2?'anti-siege':personnel/Math.max(1,total)>=.55?'anti-personnel':!total&&coarse.armor>coarse.personnel?'anti-armor':'balanced';
 return{personnel:personnel/Math.max(1,total),armor:armor/Math.max(1,total),siege:siege/Math.max(1,total),guards:guards/Math.max(1,total),modern:modern/Math.max(1,total),snipers:snipers/Math.max(1,total),total,targets,direction};
}
const DEFAULT_BUDGET={'modern.militia':.15,'modern.spearman':.15,'modern.archer':.1,'modern.skirmisher':.1,'modern.light-cavalry':.1,'modern.knight':.2,'modern.catapult':.1,guard:.1};
function desiredBudget(w:FormalWorld,a:Agent){
 const f=w.factions.find(f=>f.id===a.factionId)!,mix=knownEnemyMix(w,a),b:Record<string,number>={...DEFAULT_BUDGET};
 const shift=(to:string,from:string,n:number)=>{const amount=Math.min(n,b[from]);b[to]+=amount;b[from]-=amount;};
 if(f.civilizationId==='civ_zhongguo'){shift('modern.archer','modern.knight',.04);shift('guard','modern.knight',.04);shift('modern.skirmisher','modern.light-cavalry',.02);}
 if(f.civilizationId==='civ_byzantium'){shift('modern.knight','modern.archer',.04);shift('guard','modern.militia',.04);}
 if(f.civilizationId==='civ_frankia'){shift('modern.knight','modern.militia',.04);shift('modern.light-cavalry','modern.archer',.04);}
 if(f.civilizationId==='civ_britannia'){for(const id of ['modern.militia','modern.skirmisher','modern.archer','modern.catapult'])shift('guard',id,.05);}
 if(f.civilizationId==='civ_mongolia'){shift('modern.light-cavalry','modern.militia',.04);shift('modern.catapult','modern.archer',.03);shift('guard','modern.skirmisher',.03);}
 const personality=(a.traits.military-.5)*.05;shift(personality>=0?'modern.knight':'modern.spearman',personality>=0?'modern.spearman':'modern.knight',Math.abs(personality));
 if(mix.direction==='anti-armor'){for(const id of ['modern.archer','modern.skirmisher'])shift('modern.spearman',id,.05);shift('modern.knight','modern.militia',.03);if(f.civilizationId==='civ_britannia')shift('modern.spearman','guard',.1);}
 if(mix.direction==='anti-personnel'){shift('modern.skirmisher','modern.spearman',.05);shift('modern.archer','modern.spearman',.03);}
 if(mix.direction==='anti-siege'){shift('modern.light-cavalry','modern.militia',.06);shift('modern.knight','modern.skirmisher',.04);}
 if(mix.direction==='anti-sniper'){const move=(to:string,from:string[],amount:number)=>{for(const key of from){const n=Math.min(amount,b[key]);shift(to,key,n);amount-=n;}};move('modern.knight',['modern.archer','modern.skirmisher','guard'],.1);move('modern.light-cavalry',['modern.militia','modern.skirmisher','guard'],.1);if(f.civilizationId==='civ_japan')shift('guard','modern.skirmisher',.04);}
 if(f.civilizationId==='civ_japan'&&mix.guards>=.2)shift('guard','modern.archer',.06);
 return{budgets:b,direction:mix.direction};
}
export function modernDoctrine(w:FormalWorld,a:Agent){
 const live=w.autonomy?.agents.find(x=>x.factionId===a.factionId)??a,old=live.modernDoctrine;
 if(old&&w.time-old.evaluatedAt<6*HOUR&&(live.lastMajorDefeatAt??-1)<=old.evaluatedAt)return old;
 const desired=desiredBudget(w,live);let budgets=desired.budgets;
 if(old){const distance=Object.keys(budgets).reduce((n,k)=>n+Math.abs(budgets[k]-(old.budgets[k]??0)),0),fraction=Math.min(1,.4/Math.max(.000001,distance));budgets=Object.fromEntries(Object.keys(budgets).map(k=>[k,(old.budgets[k]??0)+(budgets[k]-(old.budgets[k]??0))*fraction]));}
 const next={evaluatedAt:w.time,direction:desired.direction,budgets};live.modernDoctrine=next;return next;
}
export function reverseLine(w:FormalWorld,a:Agent){const f=w.factions.find(f=>f.id===a.factionId)!,pool=awarenessPool(w,a.factionId),mix=knownEnemyMix(w,a),preferred=mix.direction==='anti-armor'||mix.direction==='balanced'?'modern.spearman':'modern.light-cavalry';
 const candidates=pool.encountered.filter(id=>isModernUnit(id)&&!isScoutUnit(id)&&!isSupplyUnit(id)&&!f.reverseEngineering?.includes(id));
 return candidates.sort((x,y)=>{const score=(id:string)=>(id===preferred?100:0)+(f.reverseEngineering?.includes('modern.spearman')&&['modern.light-cavalry','modern.knight'].includes(id)?30:0)+Object.entries(mix.targets).reduce((n,[target,power])=>n+counterMultiplier(id,target,f)*power/Math.max(1,mix.total),0);return score(y)-score(x)||x.localeCompare(y);})[0];
}
export function militaryBudgetScore(w:FormalWorld,c:FormalCity,a:Agent,id:string){
 if(!isModernUnit(id))return 0;const u=UNIT_CATALOG[id];if(u.combatClass==='scout')return (c.military?.units[id]??0)<5?2:0;if(isSupplyUnit(id))return Object.values(c.military?.units??{}).reduce((n,c)=>n+c,0)>=100?1.5:0;if(baseUnit(id)==='ram')return 1;
 const b=modernDoctrine(w,a).budgets,key=u.civilizationId?'guard':id,target=b[key]??0;let value=0,total=0;
 for(const [unit,n] of [...Object.entries(c.military?.units??{}),...(c.military?.queue??[]).map(q=>[q.unitId,q.remaining] as const)]){const own=UNIT_CATALOG[unit];if(!own||!isModernUnit(unit))continue;const bucket=own.civilizationId?'guard':unit;if(!(bucket in b))continue;const cost=Object.values(unitRecruitCost(w,c,own)).reduce((n,x)=>n+x,0)*n;total+=cost;if(bucket===key)value+=cost;}
 return 1+6*(target-value/Math.max(1,total));
}
export function modernResearchPriority(w:FormalWorld,c:FormalCity,a:Agent,id:string){
 if(!id.startsWith('modern.'))return 0;const pressure=incomingAlerts(w,a.factionId).length>0,own=spatial(w).owned(a.factionId),wonder=publicWonderThreats(w,c,a).some(t=>t.threat>=75&&t.stage!=='modernized');
 const order=pressure?['personal-protection','composite-armor','mobilization','supply-system']:wonder?['siege-engineering','mobilization','digital-fire-control','mechanized-logistics']:own.length>=5||own.some(t=>Math.hypot(t.x-c.x,t.y-c.y)>48)?['mechanized-logistics','supply-system','mobilization','data-link']:['mobilization','digital-fire-control','mechanized-logistics','siege-engineering'];
 const index=order.indexOf(id.slice(7)),mix=knownEnemyMix(w,a),base=index<0?.2:2-index*.3;return base+(id==='modern.infantry-weapons'&&mix.personnel>=.55?.8:id==='modern.data-link'&&pressure?.7:0);
}
export function publicWonderStage(w:FormalWorld,p:LargeProject){const breakthrough=w.largeProjects.find(q=>q.breakthrough?.wonderProjectId===p.projectId),b=breakthrough?.breakthrough;
 if(b?.phase==='completed')return{threat:100,stage:'modernized',progress:100};
 if(p.wonder?.phase==='completed'){const progress=breakthrough?Math.min(75,Math.floor(breakthroughWork(w,breakthrough)/breakthrough.durationMs*4)*25):0;return{threat:[80,86,92,97][progress/25],stage:'breakthrough',progress};}
 const progress=Math.min(80,Math.floor(wonderProgress(w,p)/20)*20);return{threat:[20,30,45,60,75][progress/20],stage:'wonder',progress};
}
export const invalidateEndgameIntel=(w:FormalWorld)=>{threatCache.delete(w);};
const threatCache=new WeakMap<FormalWorld,Map<string,ReturnType<typeof computeThreats>>>();
function computeThreats(w:FormalWorld,c:FormalCity,a:Agent){
 const ownEmpire=empireOf(w,a.factionId);if(!w.largeProjects.some(p=>p.wonder&&p.owner.kind==='empire'&&p.owner.empireId!==ownEmpire?.id))return [];
 const counts=new Map<string,{cities:number;population:number}>();let population=0;for(const city of w.cities){const scope=empireOf(w,city.ownerFactionId)?.id??city.ownerFactionId,n=counts.get(scope)??{cities:0,population:0};n.cities++;n.population+=city.population;population+=city.population;counts.set(scope,n);}
 const near=w.largeProjects.filter(p=>p.wonder&&p.owner.kind==='empire'&&p.owner.empireId!==ownEmpire?.id).map(p=>({p,city:spatial(w).cities.get(p.initiatingCityId)!,stage:publicWonderStage(w,p)})).filter(t=>t.city).sort((x,y)=>y.stage.threat-x.stage.threat||Math.hypot(x.city.x-c.x,x.city.y-c.y)-Math.hypot(y.city.x-c.x,y.city.y-c.y)).slice(0,4);
 return near.map(t=>{const owner=t.p.owner.kind==='empire'?t.p.owner.empireId:'',empire=w.politics?.empires.find(e=>e.id===owner),relation=diplomaticRelation(w,a.factionId,t.city.ownerFactionId),n=counts.get(owner),units=Object.fromEntries(Object.entries(c.military?.units??{}).filter(([id,count])=>count>0&&effectiveUnit(id))),seconds=Object.keys(units).length?marchSeconds(units,w.factions.find(f=>f.id===a.factionId)!):UNIT_CATALOG.militia.secondsPerTile;
  const members=ownEmpire?w.factions.filter(f=>empireOf(w,f.id)?.id===ownEmpire.id).map(f=>f.id):[a.factionId],border=members.flatMap(id=>spatial(w).owned(id)).sort((a,b)=>Math.hypot(a.x-t.city.x,a.y-t.city.y)-Math.hypot(b.x-t.city.x,b.y-t.city.y)).slice(0,8);
  let close=false;for(const from of border){if(Math.hypot(from.x-t.city.x,from.y-t.city.y)*seconds*1000>3*HOUR)continue;try{if(route(w,from,t.city).distance*seconds*1000<=3*HOUR){close=true;break;}}catch{/* unreachable border */}}
  const threat=clamp(t.stage.threat+(n&&(n.cities/w.cities.length>=.35||n.population/Math.max(1,population)>=.35)?8:0)+(publicMilitaryRank(w,owner)===1?6:0)+(relation==='war'?6:0)+(close?4:0)-(relation==='friendly'?10:0));
  return{projectId:t.p.projectId,cityId:t.city.id,ownerFactionId:t.city.ownerFactionId,leader:empire?.leader??t.city.ownerFactionId,stage:t.stage.stage,progress:t.stage.progress,relation,threat};
 });
}
export function publicWonderThreats(w:FormalWorld,c:FormalCity,a:Agent){let cache=threatCache.get(w);if(!cache){cache=new Map();threatCache.set(w,cache);}const key=[a.factionId,c.id,w.time,w.revision,a.decisions,w.largeProjects.length].join('/');let found=cache.get(key);if(!found){found=computeThreats(w,c,a);cache.set(key,found);}return found;}
export function endgameFriendlyEnd(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand|undefined{if(!a.active||empireOf(w,a.factionId)?.leader!==a.factionId)return;const t=publicWonderThreats(w,c,a).find(t=>t.relation==='friendly'&&t.threat>=85&&a.traits.military+a.traits.risk>1&&!w.politics?.relations.some(r=>(r.a===politicalScope(w,a.factionId)||r.b===politicalScope(w,a.factionId))&&r.endsAt!==undefined));if(t)return{type:'politics',cityId:c.id,action:'friendly-end',target:t.leader};}
export function repairDecision(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand|undefined{
 const empire=empireOf(w,a.factionId),wonder=empire&&empireWonder(w,empire.id);if(!wonder||!wonderAvailable(w,wonder)||!a.active)return;const d=wonder.wonder?.durability;if(!d||d.current===d.maximum)return;
 const repair=w.largeProjects.find(p=>p.repair?.wonderProjectId===wonder.projectId&&p.repair.phase!=='completed');if(!repair){repairQuote(d.maximum-d.current);return{type:'wonder.repair.start',cityId:c.id,projectId:wonder.projectId};}
 if(repair.repair!.phase==='building')return;const resources=zeroResources(),needed=wonderRemaining(repair);let capacity=caravanStatus(w,c).available*2000;
 for(const k of resourceKeys){resources[k]=Math.min(capacity,needed[k],Math.floor(Math.max(0,c.stock[k]-600)*.2));capacity-=resources[k];}if(resourceKeys.some(k=>resources[k]>0))return{type:'wonder.repair.ship',cityId:c.id,projectId:repair.projectId,resources};
}
export function ownCombatPower(w:FormalWorld,owner:Agent['factionId'],units:Record<string,number>){const f=w.factions.find(f=>f.id===owner);return Object.entries(units).reduce((n,[id,count])=>n+count*unitMilitaryPower(id,f),0);}
export function knownCombatPower(units:Record<string,number>){return Object.entries(units).reduce((n,[id,count])=>n+count*unitMilitaryPower(id),0);}
export function conquestAxes(w:FormalWorld,owner:Agent['factionId']){const empire=empireOf(w,owner),scope=politicalScope(w,owner),axes=new Set(w.armies.filter(isMissionArmy).filter(a=>a.mission==='conquest'&&['outbound','waiting','engaged'].includes(a.status)&&politicalScope(w,a.ownerFactionId)===scope).map(a=>a.jointId??a.battleId));const valid=empire?.legions.filter(id=>w.politics!.legions.find(l=>l.id===id)?.members.some(f=>spatial(w).ownedCount(f)>0&&!w.extinction?.extinct.includes(f))).length??1;return{count:axes.size,limit:Math.min(3,valid)};}
export function modernPressure(w:FormalWorld,c:FormalCity,a:Agent,target:ReturnType<typeof publicSituation>[number]){
 const full=w.factions.find(f=>f.id===a.factionId)?.modernQualification==='full',info=target.intel,units=info?.units,total=units?knownCombatPower(units):0,modern=units?knownCombatPower(Object.fromEntries(Object.entries(units).filter(([id])=>isModernUnit(id)))):0;
 const danger=incomingAlerts(w,a.factionId).length>0,wonder=empireOf(w,a.factionId),host=wonder&&empireWonder(w,wonder.id),homeThreat=host&&w.combat?.battles.some(b=>b.cityId===host.initiatingCityId);
 const counter=units?Object.entries(units).reduce((n,[id,count])=>n+(baseUnit(id)==='spearman'?count*unitMilitaryPower(id):0),0)/Math.max(1,total):0;
 return !!full&&!target.modern&&!!info?.confidence&&!!units&&(!total||modern/total<.5)&&counter<.4&&!danger&&!homeThreat&&c.stock.food>=200;
}
export function wonderDefense(w:FormalWorld,c:FormalCity,a:Agent):FormalCommand[]|undefined{const empire=empireOf(w,a.factionId),p=empire&&empireWonder(w,empire.id);if(!p||p.initiatingCityId===c.id||!a.active||!wonderAvailable(w,p)||wonderProgress(w,p)<60)return;
 const host=spatial(w).cities.get(p.initiatingCityId)!;if(!canCoordinate(w,a.factionId,host.ownerFactionId,13)||incomingAlerts(w,a.factionId).some(t=>t.cityId===c.id)||w.armies.some(x=>x.ownerFactionId===a.factionId&&x.mission==='reinforce'&&x.target?.kind==='city'&&x.target.cityId===host.id))return;
 const count=Object.entries(c.military?.units??{}).reduce((n,[id,x])=>n+(effectiveUnit(id)?x:0),0);if(count<40)return;
 const units=Object.fromEntries(Object.entries(c.military!.units).filter(([id])=>effectiveUnit(id)).map(([id,x])=>[id,Math.floor(x*.2)]).filter(([,x])=>Number(x)>0));try{if(route(w,c,host).distance*marchSeconds(units,w.factions.find(f=>f.id===a.factionId)!)*1000>3*HOUR)return;}catch{return;}
 return[{type:'defense.set',cityId:c.id,units,keep:Math.ceil(count*.7),enabled:true},{type:'defense.dispatch',cityId:c.id,targetCityId:host.id}];
}
export function endgamePriority(w:FormalWorld,c:FormalCity,a:Agent,command:FormalCommand|undefined){if(command?.type!=='army.dispatch'||command.target.kind!=='city')return 1;const id=command.target.cityId,t=publicWonderThreats(w,c,a).find(t=>t.cityId===id&&t.threat>=75&&t.stage!=='modernized');return t?t.threat>=90?2:1.5:command.mission==='conquest'&&w.factions.find(f=>f.id===a.factionId)?.modernQualification==='full'?1.25:1;}
export function chainDecision(w:FormalWorld,a:MissionArmy,agent:Agent):FormalCommand|undefined{
 if(!agent.active||!a.chain||a.chain.conquests>=3||a.chain.conquests<1||a.status!=='returning'||a.departedAt!==w.time||a.target.kind!=='city')return;
 const city=spatial(w).cities.get(a.target.cityId);if(!city||city.ownerFactionId!==a.ownerFactionId||ownCombatPower(w,a.ownerFactionId,a.units)<a.chain.initialPower*.55||carryCapacity(a.units,w.factions.find(f=>f.id===a.ownerFactionId))<=0)return;
 const options=publicSituation(w,agent,city).filter(t=>modernPressure(w,city,agent,t)&&t.intel?.units&&ownCombatPower(w,a.ownerFactionId,a.units)>=knownCombatPower(t.intel.units)*1.25).sort((x,y)=>y.population-x.population||Math.hypot(x.x-city.x,x.y-city.y)-Math.hypot(y.x-city.x,y.y-city.y));
 for(const t of options.slice(0,4))try{if(route(w,city,t).distance*marchSeconds(a.units,w.factions.find(f=>f.id===a.ownerFactionId)!)*1000<=HOUR)return{type:'army.advance',cityId:city.id,armyId:a.id,targetCityId:t.id};}catch{/* next lawful target */}
}

export function endgameDispatchReason(w:FormalWorld,issuer:Agent['factionId'],p:FormalCommand){
 if(!['army.dispatch','joint.create','joint.join'].includes(p.type))return;
 if(p.type!=='army.dispatch'&&p.type!=='joint.create'&&p.type!=='joint.join')return;
 const mission=p.type==='joint.join'?w.politics?.joints.find(j=>j.id===p.jointId)?.mission??'conquest':p.type==='joint.create'?p.mission??'conquest':p.mission;
 const f=w.factions.find(f=>f.id===issuer);if(f?.modernQualification!=='full'&&mission!=='wonder-destruction')return;
 const c=spatial(w).cities.get(p.cityId);if(!c)return 'AI departure city missing';
 const axes=conquestAxes(w,issuer);const activeJoint=p.type==='joint.join'&&w.politics?.joints.find(j=>j.id===p.jointId)?.armyIds.some(id=>w.armies.some(a=>a.id===id&&['waiting','outbound','engaged'].includes(a.status??'')));if(mission==='conquest'&&!activeJoint&&axes.count>=axes.limit)return 'AI conquest axes exhausted';
 const total=Object.entries(c.military?.units??{}).reduce((n,[id,count])=>n+(effectiveUnit(id)?count:0),0),used=Object.entries(p.units).reduce((n,[id,count])=>n+(effectiveUnit(id)?count:0),0),reserve=w.politics?.reserves.find(r=>r.cityId===c.id&&r.enabled)?.keep??0;
 const owned=w.armies.filter(a=>a.ownerFactionId===issuer&&a.originCityId===c.id),away=owned.filter(a=>a.mission!=='reinforce').reduce((n,a)=>n+Object.entries(a.units??{}).reduce((s,[id,count])=>s+(effectiveUnit(id)?count:0),0),0),defensive=owned.filter(a=>a.mission==='reinforce').reduce((n,a)=>n+Object.entries(a.units??{}).reduce((s,[id,count])=>s+(effectiveUnit(id)?count:0),0),0);
 if(total-used+defensive<Math.max(Math.ceil((total+away+defensive)*.3),reserve)||used+away>(total+away+defensive)*.6)return 'AI strategic reserve would be exhausted';
}

/** Per-origin real surviving combat power, including already committed detachments. */
export function mobilizationRatio(w:FormalWorld,c:FormalCity,desired:number,maximum:number){
 const power=(units:Record<string,number>)=>ownCombatPower(w,c.ownerFactionId,Object.fromEntries(Object.entries(units).filter(([id])=>effectiveUnit(id)))),current=power(c.military?.units??{}),deployed=w.armies.filter(a=>a.ownerFactionId===c.ownerFactionId&&a.originCityId===c.id&&a.mission!=='reinforce').reduce((n,a)=>n+power(a.units??{}),0);
 return Math.max(0,Math.min(desired,(maximum*(current+deployed)-deployed)/Math.max(1,current)));
}
