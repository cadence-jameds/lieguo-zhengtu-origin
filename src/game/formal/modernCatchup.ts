import type {FormalCity,FormalEvent,FormalOrder,FormalWorld,LargeProject,FormalCommand} from './model';
import {resourceKeys,zeroResources} from './model';
import {projectId,sequenceKey,type EmpireId} from './ids';
import {empireOf} from './politics';
import {effectiveAwareness} from './modernAwareness';
import {caravanStatus,dispatchLogistics,enqueue,projectShipmentRecord,requireRule} from './economy';
import type {EventScheduler} from './scheduler';
import {wonderRemaining} from './wonder';
import {HOUR} from './time';
export const EMERGENCY_COST=Object.freeze({food:8100000,wood:9400000,stone:8100000,gold:10400000});
export const EMERGENCY_DURATION=24*HOUR;
export type CatchupConstruction={creationCommandId:FormalOrder['commandId'];initiatorId:FormalOrder['issuerId'];eligibilitySnapshot:{scope:string;awareness:number;sourceProjectId:LargeProject['projectId']};phase:'funding'|'building'|'completed'|'cancelled';startedAt:number|null;completionEventId:FormalEvent['id']|null;completedAt:number|null;qualifiedFactionIds:FormalOrder['issuerId'][]};
export type CatchupCommand={type:'modern.emergency.start';cityId:FormalCity['id']}|{type:'modern.project.ship';cityId:FormalCity['id'];projectId:LargeProject['projectId'];resources:LargeProject['poolResources']};
export function completedEmpireModernization(w:FormalWorld,id:EmpireId){return w.largeProjects.some(p=>p.owner.kind==='empire'&&p.owner.empireId===id&&(p.breakthrough?.phase==='completed'||p.kind==='emergency-modernization'&&p.catchup?.phase==='completed'));}
export function emergencyEligibility(w:FormalWorld,id:FormalOrder['issuerId']):string|null{
 const f=w.factions.find(f=>f.id===id)!,empire=empireOf(w,id);
 if(f.modernQualification==='full')return '已取得完整現代軍事資格。';
 if(empire&&empire.leader!==id)return '帝國工程由帝國領袖啟動。';
 if(effectiveAwareness(w,id)<100)return '有效現代軍事認知須達100。';
 if(!w.largeProjects.some(p=>p.breakthrough?.phase==='completed'&&p.owner.kind==='empire'&&p.owner.empireId!==empire?.id))return '須先有其他政治陣營完成文明突破。';
 if(empire&&completedEmpireModernization(w,empire.id))return '本帝國已現代化，後加入者須技術移轉。';
 if(w.largeProjects.some(p=>p.kind==='emergency-modernization'&&p.catchup?.phase!=='cancelled'&&(empire?p.owner.kind==='empire'&&p.owner.empireId===empire.id:p.owner.kind==='faction'&&p.owner.factionId===id)))return '此陣營已有緊急現代化工程。';
 return null;
}
export function catchupContributor(w:FormalWorld,p:LargeProject,id:FormalOrder['issuerId']){return p.owner.kind==='faction'?p.owner.factionId===id:empireOf(w,id)?.id===p.owner.empireId;}
export function createCatchup(w:FormalWorld,c:FormalCity,o:FormalOrder,kind:LargeProject['kind'],cost:LargeProject['requiredResources'],durationMs:number,owner:LargeProject['owner'],eligibilitySnapshot:CatchupConstruction['eligibilitySnapshot']){
 const p:LargeProject={projectId:projectId(sequenceKey(w.sequences.project++)),kind,owner,legalContributors:owner.kind==='empire'?{kind:'current-empire-members',empireId:owner.empireId}:{kind:'same-faction',factionId:owner.factionId},paymentMode:'physical-shipment',initiatingCityId:c.id,requiredResources:{...cost},poolResources:zeroResources(),shipments:[],createdAt:w.time,durationMs,catchup:{creationCommandId:o.commandId,initiatorId:o.issuerId,eligibilitySnapshot,phase:'funding',startedAt:null,completionEventId:null,completedAt:null,qualifiedFactionIds:[]}};
 w.largeProjects.push(p);return p;
}
export function applyCatchupCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,q:CatchupCommand,s:EventScheduler){
 if(q.type==='modern.emergency.start'){
  requireRule(!emergencyEligibility(w,o.issuerId),emergencyEligibility(w,o.issuerId)??'');const empire=empireOf(w,o.issuerId);
  createCatchup(w,c,o,'emergency-modernization',EMERGENCY_COST,EMERGENCY_DURATION,empire?{kind:'empire',empireId:empire.id}:{kind:'faction',factionId:o.issuerId},{scope:empire?.id??o.issuerId,awareness:effectiveAwareness(w,o.issuerId),sourceProjectId:w.largeProjects.find(p=>p.breakthrough?.phase==='completed'&&p.owner.kind==='empire'&&p.owner.empireId!==empire?.id)!.projectId});return;
 }
 const p=w.largeProjects.find(p=>p.projectId===q.projectId);
 requireRule(p?.catchup?.phase==='funding'&&catchupContributor(w,p,o.issuerId),'此追趕工程不可投入或非合法付款者。');
 requireRule(resourceKeys.every(r=>q.resources[r]<=wonderRemaining(p)[r]),'投入超過工程需求（包含在途）。');
 dispatchLogistics(w,c,o,p.initiatingCityId,q.resources,s,p.projectId);p.shipments.push(projectShipmentRecord(w.logistics!.at(-1)!,p.projectId));
}
export function reconcileCatchup(w:FormalWorld,s:EventScheduler){
 for(const p of w.largeProjects){const b=p.catchup;if(!b||b.phase==='completed'||b.phase==='cancelled')continue;
  if(p.owner.kind==='empire'&&!w.politics?.empires.some(e=>p.owner.kind==='empire'&&e.id===p.owner.empireId)||p.owner.kind==='faction'&&!w.cities.some(c=>p.owner.kind==='faction'&&c.ownerFactionId===p.owner.factionId)){
   b.phase='cancelled';if(b.completionEventId)s.discard(new Set([b.completionEventId]));b.completionEventId=null;
  }
 }
}
export function handleCatchupEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler):boolean{
 if(e.type==='logistics.arrive'){
  const t=w.logistics?.find(t=>t.shipmentId===e.shipmentId),p=t?.projectId&&w.largeProjects.find(p=>p.projectId===t.projectId&&p.catchup);
  if(!t||!p)return false;if(t.phase!=='outbound'||t.arrivalEventId!==e.id)return true;
  const record=p.shipments.find(t=>t.shipmentId===e.shipmentId);requireRule(record?.phase==='in-transit','追趕工程貨運紀錄不一致。');
  const rejected=p.catchup!.phase!=='funding';
  p.shipments[p.shipments.indexOf(record)]={...record,phase:rejected?'returned':'arrived',arrivedAt:w.time,arrivalEventId:e.id};
  t.phase='returning';t.returnCargo=rejected?{...t.resources}:zeroResources();
  if(!rejected){for(const r of resourceKeys)p.poolResources[r]+=t.resources[r];if(resourceKeys.every(r=>p.poolResources[r]===p.requiredResources[r])){
   p.catchup!.phase='building';p.catchup!.startedAt=w.time;p.catchup!.completionEventId=enqueue(w,s,{type:'modern.project.complete',projectId:p.projectId,at:w.time+p.durationMs});
  }}return true;
 }
 if(e.type!=='modern.project.complete')return false;
 const p=w.largeProjects.find(p=>p.projectId===e.projectId),b=p?.catchup;
 if(!p||b?.phase!=='building'||b.completionEventId!==e.id)return true;
 requireRule(b.startedAt!==null&&w.time===b.startedAt+p.durationMs,'追趕工程工期不一致。');
 b.phase='completed';b.completedAt=w.time;b.qualifiedFactionIds=w.factions.filter(f=>catchupContributor(w,p,f.id)).map(f=>f.id).sort();
 for(const id of b.qualifiedFactionIds)w.factions.find(f=>f.id===id)!.modernQualification='full';return true;
}
export function catchupDecision(w:FormalWorld,c:FormalCity):FormalCommand|undefined{
 const p=w.largeProjects.find(p=>p.catchup?.phase==='funding'&&catchupContributor(w,p,c.ownerFactionId));
 if(!p)return emergencyEligibility(w,c.ownerFactionId)?undefined:{type:'modern.emergency.start',cityId:c.id};
 let left=caravanStatus(w,c).available*2000;const resources=zeroResources(),remaining=wonderRemaining(p);
 for(const r of resourceKeys){resources[r]=Math.min(left,remaining[r],Math.floor(Math.max(0,c.stock[r]-600)*.2));left-=resources[r];}
 return resourceKeys.some(r=>resources[r]>0)?{type:'modern.project.ship',cityId:c.id,projectId:p.projectId,resources}:undefined;
}
