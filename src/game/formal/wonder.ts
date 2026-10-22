import type {FormalCity,FormalEvent,FormalOrder,FormalReport,FormalWorld,LargeProject,WonderCommand} from './model';
import {resourceKeys,zeroResources} from './model';
import {projectId,reportId,sequenceKey,type EmpireId} from './ids';
import {dispatchLogistics,enqueue,projectShipmentRecord,requireRule} from './economy';
import {empireOf} from './politics';
import type {EventScheduler} from './scheduler';
import {HOUR} from './time';
import {applyRepairCommand,settleWonderDurability,wonderAvailable} from './wonderCondition';
export const WONDER_COST=Object.freeze({food:4000000,wood:7000000,stone:9000000,gold:4000000});
export const WONDER_DURATION=24*HOUR;
export const WONDER_MAX_DURABILITY=120000;
export const WONDER_FULL_REPAIR_COST=Object.freeze({food:1000000,wood:1750000,stone:2250000,gold:1000000});
export const WONDER_FULL_REPAIR_DURATION=12*HOUR;
export const wonderIntegrity=(current:number,maximum:number)=>current===0&&maximum>0?'ruins' as const:current<maximum?'damaged' as const:'intact' as const;
export const empireWonder=(w:FormalWorld,id:EmpireId)=>w.largeProjects.find(p=>p.kind==='world-wonder'&&p.owner.kind==='empire'&&p.owner.empireId===id);
export function wonderRemaining(p:LargeProject){return Object.fromEntries(resourceKeys.map(r=>[r,p.requiredResources[r]-p.shipments.reduce((n,t)=>n+(t.phase==='returned'?0:t.resources[r]),0)])) as typeof p.poolResources;}
export function wonderProgress(w:FormalWorld,p:LargeProject){const state=p.wonder;if(state?.clock)return Math.min(100,(state.clock.workMs+(state.clock.activeSince===null?0:w.time-state.clock.activeSince))/p.durationMs*100);if(state?.phase==='completed')return 100;if(state?.phase!=='building'||state.startedAt===null)return 0;return Math.min(100,Math.max(0,(w.time-state.startedAt)/p.durationMs*100));}
export function applyWonderCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,q:WonderCommand,s:EventScheduler){
 const empire=empireOf(w,o.issuerId);requireRule(empire,'世界奇觀需要合法帝國成員資格。');
 if(q.type==='wonder.repair.start'||q.type==='wonder.repair.ship')return applyRepairCommand(w,c,o,q,s);
 if(q.type==='wonder.start'){
  requireRule(empire.leader===o.issuerId,'由帝國領袖指定世界奇觀承載城市。');
  requireRule(w.factions.find(f=>f.id===o.issuerId)?.age===3,'啟動世界奇觀需要完成帝王時代。');
  const host=w.cities.find(c=>c.id===q.hostCityId);
  requireRule(host?.economy&&empireOf(w,host.ownerFactionId)?.id===empire.id,'承載城市必須屬於目前帝國成員。');
  requireRule(!empireWonder(w,empire.id),'每個帝國同時只能指定一座世界奇觀。');
  w.largeProjects.push({projectId:projectId(sequenceKey(w.sequences.project++)),kind:'world-wonder',owner:{kind:'empire',empireId:empire.id},legalContributors:{kind:'current-empire-members',empireId:empire.id},paymentMode:'physical-shipment',initiatingCityId:host.id,requiredResources:{...WONDER_COST},poolResources:zeroResources(),shipments:[],createdAt:w.time,durationMs:WONDER_DURATION,wonder:{creationCommandId:o.commandId,hostOwnerFactionId:host.ownerFactionId,phase:'funding',startedAt:null,completionEventId:null,completedAt:null}});return;
 }
 const p=empireWonder(w,empire.id);
 requireRule(p?.projectId===q.projectId&&p.wonder?.phase==='funding','此奇觀工程不可投入。');
 const host=w.cities.find(c=>c.id===p.initiatingCityId);requireRule(host&&empireOf(w,host.ownerFactionId)?.id===empire.id,'奇觀承載城市已不屬於原帝國。');
 const remaining=wonderRemaining(p);requireRule(resourceKeys.every(r=>q.resources[r]<=remaining[r]),'投入量超過工程需求（包含在途資源）。');
 dispatchLogistics(w,c,o,p.initiatingCityId,q.resources,s,p.projectId);
 p.shipments.push(projectShipmentRecord(w.logistics!.at(-1)!,p.projectId));
}
/** Arrival, not dispatch, credits the project. Phase + stable event identity make retries inert. */
export function handleWonderEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler,reports:FormalReport[]):boolean{
 if(e.type==='logistics.arrive'){
  const t=w.logistics?.find(t=>t.shipmentId===e.shipmentId);if(!t?.projectId||!w.largeProjects.some(p=>p.projectId===t.projectId&&p.kind==='world-wonder'))return false;
  if(t.phase!=='outbound'||t.arrivalEventId!==e.id)return true;
  const p=w.largeProjects.find(p=>p.projectId===t.projectId),record=p?.shipments.find(t=>t.shipmentId===e.shipmentId);
  requireRule(p?.kind==='world-wonder'&&p.wonder&&record?.phase==='in-transit','奇觀運輸工程紀錄不一致。');
  const rejected=!wonderAvailable(w,p);
  p.shipments[p.shipments.indexOf(record)]={...record,phase:rejected?'returned':'arrived',arrivedAt:w.time,arrivalEventId:e.id};
  if(!rejected)for(const r of resourceKeys)p.poolResources[r]+=t.resources[r];
  t.phase='returning';t.returnCargo=rejected?{...t.resources}:zeroResources();
  if(p.wonder.phase==='funding'&&resourceKeys.every(r=>p.poolResources[r]===p.requiredResources[r])){
   p.wonder.phase='building';p.wonder.startedAt=w.time;
   p.wonder.completionEventId=enqueue(w,s,{type:'wonder.complete',projectId:p.projectId,at:w.time+p.durationMs});
  }
  return true;
 }
 if(e.type!=='wonder.complete')return false;
 const p=w.largeProjects.find(p=>p.projectId===e.projectId),state=p?.wonder;
 if(!p||state?.phase!=='building'||state.completionEventId!==e.id)return true;
 settleWonderDurability(w,p);if(state.clock&&state.clock.activeSince===null)return true;
 state.phase='completed';state.completedAt=w.time;if(state.clock){state.clock.workMs=p.durationMs;state.clock.activeSince=null;}
 state.durability??={maximum:WONDER_MAX_DURABILITY,current:WONDER_MAX_DURABILITY,ledger:[]};state.integrity=wonderIntegrity(state.durability.current,state.durability.maximum);
 const empireId=p.owner.kind==='empire'?p.owner.empireId:null,ownerId=w.politics?.empires.find(e=>e.id===empireId)?.leader??state.hostOwnerFactionId;
 reports.push({id:reportId(sequenceKey(w.sequences.report)),sequence:w.sequences.report++,campaignId:w.campaignId,ownerFactionId:ownerId,at:w.time,category:'system',title:'世界奇觀完成',text:'帝國世界奇觀工程已完成。此事件不代表遊戲勝利，也不會自動取得現代軍事資格。'});
 return true;
}
