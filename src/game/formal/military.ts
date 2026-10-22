import {modernUnitAuthorized} from './modernAwareness';
import type {FormalCity,FormalEvent,FormalOrder,FormalWorld,MilitaryCommand,Resources,TrainingJob} from './model';
import {resourceKeys} from './model';
import {buildingLevel} from './catalogB3';
import {ELITE_VARIANTS,producerMultiplier,UNIT_CATALOG,isModernUnit,modernizationTarget,type UnitDefinition} from './unitCatalog';
import {baseUnit,hasTech} from './combatModifiers';
import {EventScheduler} from './scheduler';
import {enqueue,requireRule,settleCity,spend,addStock,QUEUE_CAPACITY} from './economy';
import {spatial} from './spatial';
import {isMissionArmy} from './combatModel';
export const initialMilitary=()=>({units:{},queue:[],unpaidFood:0});
export function unitTrainingDuration(w:FormalWorld,c:FormalCity,u:UnitDefinition){
 if(u.id==='scout')return 90000;
 const f=w.factions.find(f=>f.id===c.ownerFactionId)!,battle=['infantry','ranged','cavalry','mounted-ranged'].includes(u.combatClass);
 let m=producerMultiplier(buildingLevel(c,u.producer));if(battle&&f.techIds.includes('military.conscription'))m*=.9;
 if(f.techIds.includes('civilization.knighthood')&&u.producer==='stable'||f.techIds.includes('civilization.archer-levy')&&u.combatClass==='ranged'||f.techIds.includes('civilization.mobilization')&&u.combatClass==='infantry')m/=1.12;
 if(isModernUnit(u.id)&&hasTech(f,'modern.mobilization'))m*=.85;
 return Math.round(u.baseDurationMs*m);
}
export function unitRecruitCost(w:FormalWorld,c:FormalCity,u:UnitDefinition):Resources {const cost={...u.cost},f=w.factions.find(f=>f.id===c.ownerFactionId)!;if(f.techIds.includes('civilization.themes')&&['spearman','skirmisher'].includes(baseUnit(u.id)))for(const r of resourceKeys)cost[r]=Math.round(cost[r]*.88);if(['modern.light-cavalry','modern.knight'].includes(u.id)&&hasTech(f,'modern.civ_frankia.exclusive'))for(const r of resourceKeys)cost[r]=Math.round(cost[r]*.88);return cost;}
export function unitModernizationCost(target:UnitDefinition):Resources {const cost={...target.cost};for(const r of resourceKeys)cost[r]=Math.round(cost[r]*.1);return cost;}
export function armyUpkeep(w:FormalWorld,c:FormalCity){const f=w.factions.find(f=>f.id===c.ownerFactionId)!,rations=f.techIds.includes('logistics.rations')?.95:1;return Object.entries({...c.military?.units}).reduce((n,[id,count])=>{const u=UNIT_CATALOG[id],mounted=u.combatClass==='cavalry'||u.combatClass==='mounted-ranged',nomad=mounted&&f.techIds.includes('civilization.nomadic')?.9:1;return n+count*u.upkeepPerHour*rations*nomad*(isModernUnit(id)&&hasTech(f,'modern.supply-system')?.92:1);},0)+(w.settlements??[]).filter(p=>p.sourceCityId===c.id&&p.phase==='travelling').reduce((total,p)=>total+Object.entries(p.escort??{}).reduce((n,[id,count])=>{const u=UNIT_CATALOG[id],mounted=u.combatClass==='cavalry'||u.combatClass==='mounted-ranged',nomad=mounted&&f.techIds.includes('civilization.nomadic')?.9:1;return n+count*u.upkeepPerHour*rations*nomad*(isModernUnit(id)&&hasTech(f,'modern.supply-system')?.92:1);},0),0)+w.armies.filter(isMissionArmy).filter(a=>a.ownerFactionId===c.ownerFactionId&&(spatial(w).cities.get(a.originCityId)?.ownerFactionId===a.ownerFactionId?a.originCityId===c.id:spatial(w).owned(a.ownerFactionId).sort((a,b)=>a.id<b.id?-1:1)[0]?.id===c.id)).reduce((sum,a)=>sum+Object.entries(a.units).reduce((n,[id,count])=>{const u=UNIT_CATALOG[id],mounted=u.combatClass==='cavalry'||u.combatClass==='mounted-ranged',nomad=mounted&&f.techIds.includes('civilization.nomadic')?.9:1;return n+count*u.upkeepPerHour*rations*nomad*(isModernUnit(id)&&hasTech(f,'modern.supply-system')?.92:1);},0),0);}
export function applyMilitaryCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,p:MilitaryCommand,s:EventScheduler){
 requireRule(c.military&&c.economy,'此操作需要正式軍事城市。');const m=c.military,f=w.factions.find(f=>f.id===o.issuerId)!;
 if(p.type==='military.modernize'){
  const target=modernizationTarget(p.unitId);requireRule(target,'此兵員沒有合法現代化對應。');requireRule(modernUnitAuthorized(f,target.id),'需要完整現代資格或此兵種線逆向工程。');
  const army=p.armyId?w.armies.filter(isMissionArmy).find(a=>a.id===p.armyId):undefined;
  requireRule(!p.armyId||army&&army.ownerFactionId===o.issuerId&&army.status==='stationed'&&army.target.kind==='city'&&army.target.cityId===c.id&&army.position.x===c.x&&army.position.y===c.y,'只能改裝本方城市內合法靜止的所屬部隊。');
  requireRule(!w.combat?.battles.some(b=>b.cityId===c.id),'交戰或攻城中的部隊不能改裝。');
  const units=army?.units??m.units;requireRule((units[p.unitId]??0)>=p.count,'實際存活兵員不足。');
  settleCity(w,c);const cost=unitModernizationCost(target);for(const r of resourceKeys)cost[r]*=p.count;spend(c,cost);
  units[p.unitId]-=p.count;if(!units[p.unitId])delete units[p.unitId];units[target.id]=(units[target.id]??0)+p.count;return;
 }
 if(p.type==='military.cancel'){
  const job=m.queue.find(j=>j.commandId===p.trainingCommandId);requireRule(job,'訓練項目不存在。');settleCity(w,c);c.population=Math.max(c.population,Math.min(c.housing,c.population+job.remaining*job.populationPerUnit));
  const refund={...job.unitCost};for(const r of resourceKeys)refund[r]=Math.floor(refund[r]*job.remaining*.8);addStock(c,refund);
  m.queue=m.queue.filter(j=>j.commandId!==job.commandId);const events=s.snapshot().filter(e=>e.id!==job.eventId);while(s.size)s.pop();for(const e of events)s.push(e);
  // Promote waiting jobs immediately; preserve active unit duration and paid cost snapshots.
  for(const lane of [0,1]){let end=w.time;for(const j of m.queue.filter(j=>j.lane===lane)){if(j.startsAt<=w.time){end=j.nextAt+(j.remaining-1)*j.durationMs;}else{const old=j.eventId;j.startsAt=end;j.nextAt=end+j.durationMs;end=j.nextAt+(j.remaining-1)*j.durationMs;const all=s.snapshot().filter(e=>e.id!==old);while(s.size)s.pop();for(const e of all)s.push(e);s.push({id:old,type:'military.train',cityId:c.id,at:j.nextAt});}}}
  return;
 }
 if(p.type==='military.disband'){
  const u=UNIT_CATALOG[p.unitId];requireRule(u&&(m.units[p.unitId]??0)>=p.count,'所屬城內存活部隊不足。');settleCity(w,c);m.units[p.unitId]-=p.count;if(!m.units[p.unitId])delete m.units[p.unitId];c.population=Math.max(c.population,Math.min(c.housing,c.population+u.population*p.count));return;
 }
 let u=UNIT_CATALOG[p.unitId];requireRule(u,'兵種不存在。');
 const elite=ELITE_VARIANTS[u.id]&&UNIT_CATALOG[ELITE_VARIANTS[u.id]];if(elite&&f.techIds.includes(elite.eliteTech!)&&c.economy.milestones.includes(elite.milestone))u=elite;
 requireRule(!isModernUnit(u.id)||modernUnitAuthorized(f,u.id),'需要完整現代軍事資格。');requireRule((isModernUnit(u.id)||(f.age??0)>=u.age)&&buildingLevel(c,u.producer)>=1,'時代或兵種生產建築不足。');requireRule(!u.civilizationId||u.civilizationId===(c.castleCivilizationId??f.civilizationId),'此城堡無外文明生產資格。');if(u.eliteTech)requireRule(f.techIds.includes(u.eliteTech)&&c.economy.milestones.includes(u.milestone),'該城市尚未取得精銳生產資格。');
 requireRule(m.queue.length<QUEUE_CAPACITY,'部隊訓練已達 5 項上限。');
 const end=(l:number)=>Math.max(w.time,...m.queue.filter(j=>j.lane===l).map(j=>j.nextAt+(j.remaining-1)*j.durationMs));
 const lane=p.lane??(c.economy.milestones.includes(20000)&&end(1)<end(0)?1:0);requireRule(lane===0||c.economy.milestones.includes(20000),'尚未取得第二軍事佇列。');const population=u.population*p.count;requireRule(Number.isSafeInteger(population)&&c.population>=population,'徵兵人口不足。');requireRule(c.housing>=c.population,'住房不足，請先改善住房。');
 const unitCost=unitRecruitCost(w,c,u),cost={...unitCost};for(const r of resourceKeys)cost[r]*=p.count;spend(c,cost);c.population-=population;
 const durationMs=unitTrainingDuration(w,c,u),prior=m.queue.filter(j=>j.lane===lane),startsAt=Math.max(w.time,...prior.map(j=>j.nextAt+(j.remaining-1)*j.durationMs));requireRule(Number.isSafeInteger(startsAt+durationMs*p.count),'訓練時間超出可表示範圍。');
 const eventId=enqueue(w,s,{type:'military.train',cityId:c.id,at:startsAt+durationMs});const job:TrainingJob={commandId:o.commandId,eventId,ownerFactionId:o.issuerId,unitId:u.id,producer:u.producer,producerLevelSnapshot:buildingLevel(c,u.producer),lane,lanePreference:p.lane,count:p.count,remaining:p.count,populationPerUnit:u.population,unitCost,durationMs,startsAt,nextAt:startsAt+durationMs};m.queue.push(job);
}
export function handleMilitaryEvent(w:FormalWorld,e:Extract<FormalEvent,{type:'military.train'}>,s:EventScheduler){
 const c=spatial(w).cities.get(e.cityId),job=c?.military?.queue.find(j=>j.eventId===e.id);if(!c||!job)return;settleCity(w,c);c.military!.units[job.unitId]=(c.military!.units[job.unitId]??0)+1;job.remaining--;
 if(job.remaining){job.nextAt=e.at+job.durationMs;job.eventId=enqueue(w,s,{type:'military.train',cityId:c.id,at:job.nextAt});}else c.military!.queue=c.military!.queue.filter(j=>j!==job);
}
