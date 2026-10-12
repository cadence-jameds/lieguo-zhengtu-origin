import {HOUR} from './time';
import {researchRequirements,researchQuote} from './buildingDetailData';
import {researchProjectId,sequenceKey} from './ids';
import type {FormalCity,FormalEvent,FormalOrder,FormalWorld,ResearchProject} from './model';
import {zeroResources} from './model';
import {buildingLevel} from './catalogB3';
import {TECH_CATALOG} from './techCatalog';
import {enqueue,requireRule,settleCity,spend} from './economy';
import {EventScheduler} from './scheduler';
export const AGE_CATALOG=[
 {targetAge:1,population:500,center:3,cost:{food:800,wood:800,stone:700,gold:700},durationMs:4*HOUR},
 {targetAge:2,population:2000,center:5,cost:{food:8000,wood:8000,stone:7000,gold:7000},durationMs:8*HOUR},
 {targetAge:3,population:10000,center:10,cost:{food:35000,wood:35000,stone:35000,gold:45000},durationMs:16*HOUR},
] as const;
export const academyMultiplier=(level:number)=>1-.015*(Math.max(1,level)-1);
/** This predicate is the B9 production/refit interface; cooperation never gates base modern capability. */
export const hasModernMilitaryCapability=(f:FormalWorld['factions'][number])=>f.modernQualification==='full';
export function startResearch(w:FormalWorld,c:FormalCity,order:FormalOrder,techId:string,s:EventScheduler){
 const f=w.factions.find(f=>f.id===order.issuerId)!,d=TECH_CATALOG[techId];requireRule(d,'科技不存在。');requireRule(!f.researchQueue&&!f.techIds.includes(techId),'勢力唯一科技佇列已占用或科技已完成。');
 for(const r of researchRequirements(w,c,d))requireRule(r.met,'科研前置未達成：'+r.id);
 const direct=d.scope==='modern-common'||d.scope==='modern-civilization';
 if(d.scope!=='traditional')requireRule(hasModernMilitaryCapability(f),'尚未取得完整現代軍事資格。');
 if(direct)requireRule(f.researchCooperation&&f.techIds.includes('research.cooperation'),'須先完成科研協同體系。');
 const {cost,multiplier,durationMs}=researchQuote(w,c,d),id=researchProjectId(sequenceKey(w.sequences.project++));
 const base={projectId:id,techId,technologyScope:d.scope,ownerFactionId:f.id,initiatingCityId:c.id,paymentMode:direct?'same-faction-direct' as const:'single-city' as const,requiredResources:cost,contributedResources:zeroResources(),contributions:[],createdAt:w.time,qualificationSnapshot:{checkedAt:w.time,cityId:c.id,ownerFactionId:f.id,academyLevel:buildingLevel(c,'academy'),buildingLevels:{...c.buildings},prerequisiteTechIds:[...f.techIds],fullModernQualification:hasModernMilitaryCapability(f),researchCooperation:f.researchCooperation},durationSnapshot:{baseDurationMs:d.baseDurationMs,academyMultiplier:multiplier,durationMs},creationCommandId:order.commandId,fundingTransitionCommandId:null,completionEventId:null};
 let project:ResearchProject;
 if(direct)project={...base,phase:'funding'};
 else{settleCity(w,c);spend(c,cost);const completionEventId=enqueue(w,s,{type:'research.complete',projectId:id,at:w.time+durationMs});project={...base,phase:'researching',startedAt:w.time,contributedResources:{...cost},contributions:[{commandId:order.commandId,sourceFactionId:f.id,sourceCityId:c.id,resources:{...cost},at:w.time}],fundingTransitionCommandId:order.commandId,completionEventId};}
 f.researchQueue=id;w.researchProjects.push(project);
}
export function startAge(w:FormalWorld,c:FormalCity,order:FormalOrder,s:EventScheduler){
 const f=w.factions.find(f=>f.id===order.issuerId)!,d=AGE_CATALOG.find(d=>d.targetAge===(f.age??0)+1);requireRule(d&&!f.ageQueue,'時代晉升已在進行或已達帝王。');requireRule(c.population>=d.population&&buildingLevel(c,'center')>=d.center,'發起城市人口或城市中心不足。');
 spend(c,{...d.cost});const eventId=enqueue(w,s,{type:'age.complete',factionId:f.id,at:w.time+d.durationMs});f.ageQueue={eventId,commandId:order.commandId,initiatingCityId:c.id,targetAge:d.targetAge,startedAt:w.time,durationMs:d.durationMs,populationSnapshot:c.population,centerSnapshot:buildingLevel(c,'center')};
}
export function completeAge(w:FormalWorld,e:Extract<FormalEvent,{type:'age.complete'}>){const f=w.factions.find(f=>f.id===e.factionId);if(!f?.ageQueue||f.ageQueue.eventId!==e.id)return;f.age=f.ageQueue.targetAge;f.ageQueue=null;}
