import type {BreakthroughCommand,FormalCity,FormalEvent,FormalOrder,FormalReport,FormalWorld,LargeProject} from './model';
import {resourceKeys,zeroResources} from './model';
import {projectId,reportId,sequenceKey,type EmpireId} from './ids';
import {caravanStatus,dispatchLogistics,enqueue,projectShipmentRecord,requireRule} from './economy';
import {empireOf} from './politics';
import {empireWonder,wonderRemaining} from './wonder';
import type {EventScheduler} from './scheduler';
import {HOUR} from './time';
export const BREAKTHROUGH_COST=Object.freeze({food:15000000,wood:15000000,stone:10000000,gold:20000000});
export const BREAKTHROUGH_DURATION=48*HOUR;
export const empireBreakthrough=(w:FormalWorld,id:EmpireId)=>w.largeProjects.find(p=>p.kind==='civilization-breakthrough'&&p.owner.kind==='empire'&&p.owner.empireId===id);
export const breakthroughStoredWork=(p:LargeProject)=>p.breakthrough!.workPeriods.reduce((n,s)=>n+s.endedAt-s.startedAt,0)-p.breakthrough!.discardedWorkMs;
export function breakthroughWork(w:FormalWorld,p:LargeProject){const b=p.breakthrough!;return breakthroughStoredWork(p)+(b.activeSince===null?0:Math.max(0,w.time-b.activeSince));}
export function breakthroughPauseReason(w:FormalWorld,p:LargeProject):'host-lost'|'wonder-unavailable'|null{
 const city=w.cities.find(c=>c.id===p.initiatingCityId),owner=p.owner.kind==='empire'?p.owner.empireId:null;
 if(p.breakthrough?.recaptureRequired||!owner||!city||empireOf(w,city.ownerFactionId)?.id!==owner)return 'host-lost';
 const wonder=w.largeProjects.find(q=>q.projectId===p.breakthrough?.wonderProjectId);
 return wonder?.wonder?.phase==='completed'&&(!wonder.wonder.integrity||wonder.wonder.integrity==='intact')?null:'wonder-unavailable';
}
const full=(p:LargeProject)=>resourceKeys.every(r=>p.poolResources[r]===p.requiredResources[r]);
/** Shared ownership/condition boundary. Combat calls it at the actual city transfer time.
 * Future wonder combat/repair must publish integrity changes through the same boundary;
 * this module implements no attack, damage calculation, repair command or repair cost. */
export function reconcileBreakthroughs(w:FormalWorld,s:EventScheduler,transfer?:{city:FormalCity;previousOwner:FormalCity['ownerFactionId'];reason:'conquest'|'receive'}){
 for(const p of w.largeProjects){const b=p.breakthrough;if(p.kind!=='civilization-breakthrough'||!b||b.phase==='completed')continue;
  // Only an actual conquest back into the original empire clears a recorded loss.
  // Diplomatic membership changes never constitute recapture.
  if(transfer?.city.id===p.initiatingCityId&&transfer.previousOwner!==transfer.city.ownerFactionId&&p.owner.kind==='empire'){
   if(empireOf(w,transfer.city.ownerFactionId)?.id!==p.owner.empireId)b.recaptureRequired=true;
   else if(transfer.reason==='conquest')delete b.recaptureRequired;
  }
  const reason=breakthroughPauseReason(w,p);
  if(reason){
   if(b.activeSince!==null){b.workPeriods.push({startedAt:b.activeSince,endedAt:w.time});b.activeSince=null;}
   if(b.completionEventId)s.discard(new Set([b.completionEventId]));b.completionEventId=null;b.phase='paused';
   const wonder=w.largeProjects.find(q=>q.projectId===b.wonderProjectId);
   if(wonder?.wonder?.integrity==='ruins'){const work=breakthroughStoredWork(p),step=p.durationMs/4;b.discardedWorkMs+=work-Math.min(3,Math.floor(work/step))*step;}
  }else if(b.phase==='paused'||b.phase==='funding'&&full(p)){
   if(full(p)){b.phase='building';b.activeSince=w.time;b.completionEventId=enqueue(w,s,{type:'breakthrough.complete',projectId:p.projectId,at:w.time+p.durationMs-breakthroughStoredWork(p)});}
   else b.phase='funding';
  }
 }
}
export function applyBreakthroughCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,q:BreakthroughCommand,s:EventScheduler){
 const empire=empireOf(w,o.issuerId);requireRule(empire,'文明突破需要合法帝國成員資格。');
 if(q.type==='breakthrough.start'){
  requireRule(empire.leader===o.issuerId,'文明突破由帝國領袖啟動。');
  const wonder=empireWonder(w,empire.id);requireRule(wonder?.wonder?.phase==='completed','文明突破需要已完成的世界奇觀。');
  requireRule(!empireBreakthrough(w,empire.id),'此帝國已經有文明突破工程。');
  const p:LargeProject={projectId:projectId(sequenceKey(w.sequences.project++)),kind:'civilization-breakthrough',owner:{kind:'empire',empireId:empire.id},legalContributors:{kind:'current-empire-members',empireId:empire.id},paymentMode:'physical-shipment',initiatingCityId:wonder.initiatingCityId,requiredResources:{...BREAKTHROUGH_COST},poolResources:zeroResources(),shipments:[],createdAt:w.time,durationMs:BREAKTHROUGH_DURATION,breakthrough:{creationCommandId:o.commandId,wonderProjectId:wonder.projectId,phase:'funding',workPeriods:[],discardedWorkMs:0,activeSince:null,completionEventId:null,completedAt:null,qualifiedFactionIds:[]}};
  requireRule(!breakthroughPauseReason(w,p),'奇觀城市失守或奇觀狀態不允許文明突破。');w.largeProjects.push(p);return;
 }
 const p=empireBreakthrough(w,empire.id);requireRule(p?.projectId===q.projectId&&p.breakthrough?.phase==='funding'&&!breakthroughPauseReason(w,p),'此文明突破工程不可投入或已暫停。');
 requireRule(resourceKeys.every(r=>q.resources[r]<=wonderRemaining(p)[r]),'投入量超過文明突破需求（包含在途資源）。');
 dispatchLogistics(w,c,o,p.initiatingCityId,q.resources,s,p.projectId);p.shipments.push(projectShipmentRecord(w.logistics!.at(-1)!,p.projectId));
}
export function handleBreakthroughEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler,reports:FormalReport[]):boolean{
 if(e.type==='logistics.arrive'){
  const t=w.logistics?.find(t=>t.shipmentId===e.shipmentId),p=t?.projectId&&w.largeProjects.find(p=>p.projectId===t.projectId&&p.kind==='civilization-breakthrough');if(!t||!p)return false;
  if(t.phase!=='outbound'||t.arrivalEventId!==e.id)return true;
  const record=p.shipments.find(r=>r.shipmentId===t.shipmentId);requireRule(record?.phase==='in-transit','文明突破運輸紀錄不一致。');
  const rejected=!!breakthroughPauseReason(w,p)||p.breakthrough!.phase==='paused';
  p.shipments[p.shipments.indexOf(record)]={...record,phase:rejected?'returned':'arrived',arrivedAt:w.time,arrivalEventId:e.id};
  t.returnCargo=rejected?{...t.resources}:zeroResources();t.phase='returning';if(!rejected)for(const r of resourceKeys)p.poolResources[r]+=t.resources[r];
  reconcileBreakthroughs(w,s);return true;
 }
 if(e.type!=='breakthrough.complete')return false;
 const p=w.largeProjects.find(p=>p.projectId===e.projectId),b=p?.breakthrough;
 if(!p||b?.phase!=='building'||b.completionEventId!==e.id)return true;
 if(breakthroughPauseReason(w,p)){reconcileBreakthroughs(w,s);return true;}
 requireRule(breakthroughWork(w,p)===p.durationMs&&b.activeSince!==null,'文明突破施工時間不一致。');
 b.workPeriods.push({startedAt:b.activeSince,endedAt:w.time});b.activeSince=null;b.phase='completed';b.completedAt=w.time;
 const owner=p.owner.kind==='empire'?p.owner.empireId:null;
 b.qualifiedFactionIds=w.factions.filter(f=>empireOf(w,f.id)?.id===owner).map(f=>f.id).sort();
 for(const id of b.qualifiedFactionIds)w.factions.find(f=>f.id===id)!.modernQualification='full';
 const leader=w.politics!.empires.find(e=>e.id===owner)!.leader,sequence=w.sequences.report++;
 reports.push({id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:leader,at:w.time,category:'system',title:'文明突破完成',text:'完成當下的帝國成員已永久取得完整現代軍事資格。文明突破不代表勝利，也沒有勝利倒數。'});return true;
}
export function breakthroughDecision(w:FormalWorld,c:FormalCity,active:boolean){
 if(!active)return;const empire=empireOf(w,c.ownerFactionId);if(!empire)return;const wonder=empireWonder(w,empire.id);if(wonder?.wonder?.phase!=='completed')return;
 const p=empireBreakthrough(w,empire.id);
 if(!p){const host=w.cities.find(c=>c.id===wonder.initiatingCityId);return empire.leader===c.ownerFactionId&&host&&empireOf(w,host.ownerFactionId)?.id===empire.id&&(!wonder.wonder.integrity||wonder.wonder.integrity==='intact')?{type:'breakthrough.start' as const,cityId:c.id}:undefined;}
 if(p.breakthrough?.phase!=='funding'||breakthroughPauseReason(w,p))return;
 let left=caravanStatus(w,c).available*2000;const resources=zeroResources(),needed=wonderRemaining(p);
 for(const r of resourceKeys){resources[r]=Math.min(left,needed[r],Math.floor(Math.max(0,c.stock[r]-600)*.2));left-=resources[r];}
 if(!resourceKeys.some(r=>resources[r]>0))return;return{type:'breakthrough.ship' as const,cityId:c.id,projectId:p.projectId,resources};
}

/** Integration-only condition signal. No battle targeting or repair gameplay is exposed. */
export function updateWonderIntegrity(w:FormalWorld,id:import('./ids').ProjectId,integrity:'intact'|'damaged'|'ruins',s:EventScheduler){
 const wonder=w.largeProjects.find(p=>p.projectId===id&&p.kind==='world-wonder');requireRule(wonder?.wonder,'世界奇觀不存在。');wonder.wonder.integrity=integrity;reconcileBreakthroughs(w,s);
}
