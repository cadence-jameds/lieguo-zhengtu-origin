import {durabilityPrecision} from './siege';
import type {FormalCity,FormalEvent,FormalOrder,FormalReport,FormalWorld,LargeProject,Resources} from './model';
import {resourceKeys,zeroResources} from './model';
import {projectId,reportId,resolutionId,sequenceKey,type ProjectId} from './ids';
import {dispatchLogistics,enqueue,projectShipmentRecord,requireRule} from './economy';
import {empireOf} from './politics';
import {wonderIntegrity,wonderProgress,wonderRemaining,WONDER_MAX_DURABILITY,WONDER_FULL_REPAIR_COST,WONDER_FULL_REPAIR_DURATION} from './wonder';
import {reconcileBreakthroughs} from './breakthrough';
import type {EventScheduler} from './scheduler';
export type RepairCommand={type:'wonder.repair.start';cityId:FormalCity['id'];projectId:ProjectId}|{type:'wonder.repair.ship';cityId:FormalCity['id'];projectId:ProjectId;resources:Resources};
export type WonderRepair={creationCommandId:FormalOrder['commandId'];wonderProjectId:ProjectId;missingSnapshot:number;phase:'funding'|'building'|'paused'|'completed';workMs:number;activeSince:number|null;completionEventId:FormalEvent['id']|null;completedAt:number|null;restored:number|null;combatInterrupted?:true};
export function wonderAvailable(w:FormalWorld,p:LargeProject){return !p.wonder?.recaptureRequired&&p.owner.kind==='empire'&&empireOf(w,w.cities.find(c=>c.id===p.initiatingCityId)!.ownerFactionId)?.id===p.owner.empireId;}
export function settleWonderDurability(w:FormalWorld,p:LargeProject){
 const b=p.wonder;if(!b||b.phase==='funding')return;
 const max=durabilityPrecision(WONDER_MAX_DURABILITY*wonderProgress(w,p)/100),d=b.durability;
 // Old enum-only test/integration states have no recoverable numeric HP. Never guess damaged HP.
 if(!d){if(b.integrity&&b.integrity!=='intact')return;b.durability={maximum:max,current:max,ledger:[]};}
 else if(max>d.maximum){d.current=durabilityPrecision(d.current+max-d.maximum);d.maximum=max;}
 if(b.durability)b.integrity=wonderIntegrity(b.durability.current,b.durability.maximum);
}
const funded=(p:LargeProject)=>resourceKeys.every(r=>p.poolResources[r]===p.requiredResources[r]);
export function repairWork(w:FormalWorld,p:LargeProject){const r=p.repair!;return r.workMs+(r.activeSince===null?0:w.time-r.activeSince);}
export function repairQuote(missing:number){
 requireRule(Number.isFinite(missing)&&missing>0&&missing<=WONDER_MAX_DURABILITY,'奇觀缺損耐久不合法。');
 const resources=Object.fromEntries(resourceKeys.map(k=>[k,Math.round(WONDER_FULL_REPAIR_COST[k]*missing/WONDER_MAX_DURABILITY)])) as Resources;
 // Preserve the largest cost component when an exceptionally small nonzero wound rounds all four to zero.
 if(resourceKeys.every(k=>resources[k]===0))resources.stone=1;
 return{resources,durationMs:Math.max(1,Math.ceil(WONDER_FULL_REPAIR_DURATION*missing/WONDER_MAX_DURABILITY))};
}
export function reconcileWonders(w:FormalWorld,s:EventScheduler,transfer?:{city:FormalCity;previousOwner:FormalCity['ownerFactionId'];reason:'conquest'|'receive'}){
 for(const p of w.largeProjects){const b=p.wonder;if(!b)continue;
  if(b.phase==='building'&&!b.clock)b.clock={workMs:0,activeSince:b.startedAt};
  settleWonderDurability(w,p);
  if(transfer?.city.id===p.initiatingCityId&&transfer.previousOwner!==transfer.city.ownerFactionId&&p.owner.kind==='empire'){
   if(empireOf(w,transfer.city.ownerFactionId)?.id!==p.owner.empireId)b.recaptureRequired=true;else if(transfer.reason==='conquest')delete b.recaptureRequired;
  }
  if(b.phase==='building'&&b.clock){
   if(b.ruinsRequireRestoration&&b.integrity==='intact')delete b.ruinsRequireRestoration;
   const blocked=!wonderAvailable(w,p)||b.integrity==='ruins'||!!b.ruinsRequireRestoration;
   if(blocked&&b.clock.activeSince!==null){b.clock.workMs=Math.min(p.durationMs,b.clock.workMs+w.time-b.clock.activeSince);b.clock.activeSince=null;if(b.completionEventId)s.discard(new Set([b.completionEventId]));b.completionEventId=null;}
   else if(!blocked&&b.clock.activeSince===null){b.clock.activeSince=w.time;b.completionEventId=enqueue(w,s,{type:'wonder.complete',projectId:p.projectId,at:w.time+p.durationMs-b.clock.workMs});}
  }
 }
 for(const p of w.largeProjects){const r=p.repair;if(!r||r.phase==='completed')continue;const wonder=w.largeProjects.find(q=>q.projectId===r.wonderProjectId)!;
  const battle=w.combat?.battles.some(b=>b.cityId===p.initiatingCityId),blocked=!wonderAvailable(w,wonder)||!!battle&&(r.phase!=='building'||!!r.combatInterrupted);
  if(!battle)delete r.combatInterrupted;
  if(blocked){if(r.activeSince!==null){r.workMs+=w.time-r.activeSince;r.activeSince=null;}if(r.completionEventId)s.discard(new Set([r.completionEventId]));r.completionEventId=null;r.phase='paused';}
  else if(funded(p)&&r.activeSince===null){r.phase='building';r.activeSince=w.time;r.completionEventId=enqueue(w,s,{type:'wonder.repair.complete',projectId:p.projectId,at:w.time+p.durationMs-r.workMs});}
  else if(!funded(p))r.phase='funding';
 }
 reconcileBreakthroughs(w,s);
}
export function applyWonderDamage(w:FormalWorld,id:ProjectId,e:FormalEvent,key:import('./ids').ResolutionId,damage:number,s:EventScheduler){
 const p=w.largeProjects.find(p=>p.projectId===id&&p.kind==='world-wonder'),b=p?.wonder;
 requireRule(b&&b.phase!=='funding','奇觀尚無可破壞的實體耐久。');requireRule(Number.isFinite(damage)&&damage>=0&&damage<=Number.MAX_SAFE_INTEGER,'奇觀傷害不合法。');
 const prior=b.durability?.ledger.find(r=>r.key===key);
 if(prior){requireRule(prior.kind==='damage'&&prior.eventId===e.id&&prior.at===e.at&&prior.amount===damage,'奇觀傷害收據衝突。');return 0;}
 requireRule(e.at===w.time&&!b.durability?.ledger.some(r=>r.eventId===e.id),'奇觀傷害事件時間或收據不合法。');
 settleWonderDurability(w,p);requireRule(b.durability,'缺少受損奇觀的真實耐久紀錄。');const d=b.durability,before=d.current;
 d.current=durabilityPrecision(Math.max(0,before-damage));d.ledger.push({key,eventId:e.id,at:w.time,kind:'damage',amount:damage,maximum:d.maximum,before,after:d.current});b.integrity=wonderIntegrity(d.current,d.maximum);if(b.phase==='building'&&before>0&&d.current===0)b.ruinsRequireRestoration=true;
 if(d.current<before)for(const q of w.largeProjects)if(q.repair?.wonderProjectId===id&&q.repair.phase==='building')q.repair.combatInterrupted=true;
 reconcileWonders(w,s);return before-d.current;
}
export function applyRepairCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,q:RepairCommand,s:EventScheduler){
 const empire=empireOf(w,o.issuerId);requireRule(empire,'奇觀修復需要原帝國成員資格。');
 if(q.type==='wonder.repair.start'){
  const wonder=w.largeProjects.find(p=>p.projectId===q.projectId&&p.wonder&&p.owner.kind==='empire'&&p.owner.empireId===empire.id);requireRule(wonder&&wonderAvailable(w,wonder),'原帝國必須真正收復奇觀城市後才能修復。');settleWonderDurability(w,wonder);
  const d=wonder.wonder!.durability;requireRule(d&&d.maximum>d.current,'奇觀沒有可修復的數值缺損。');requireRule(!w.largeProjects.some(p=>p.repair?.wonderProjectId===wonder.projectId&&p.repair.phase!=='completed'),'奇觀已有修復工程。');
  const missing=d.maximum-d.current,quote=repairQuote(missing);
  w.largeProjects.push({projectId:projectId(sequenceKey(w.sequences.project++)),kind:'wonder-repair',owner:{kind:'empire',empireId:empire.id},legalContributors:{kind:'current-empire-members',empireId:empire.id},paymentMode:'physical-shipment',initiatingCityId:wonder.initiatingCityId,requiredResources:quote.resources,poolResources:zeroResources(),shipments:[],createdAt:w.time,durationMs:quote.durationMs,repair:{creationCommandId:o.commandId,wonderProjectId:wonder.projectId,missingSnapshot:missing,phase:'funding',workMs:0,activeSince:null,completionEventId:null,completedAt:null,restored:null}});return;
 }
 const p=w.largeProjects.find(p=>p.projectId===q.projectId&&p.repair&&p.owner.kind==='empire'&&p.owner.empireId===empire.id),wonder=p&&w.largeProjects.find(x=>x.projectId===p.repair!.wonderProjectId);
 requireRule(p&&wonder&&p.repair!.phase!=='completed'&&!funded(p)&&wonderAvailable(w,wonder),'奇觀修復工程不可投入。');requireRule(resourceKeys.every(k=>q.resources[k]<=wonderRemaining(p)[k]),'修復投入超過需求（包含在途資源）。');
 dispatchLogistics(w,c,o,p.initiatingCityId,q.resources,s,p.projectId);p.shipments.push(projectShipmentRecord(w.logistics!.at(-1)!,p.projectId));
}
export function handleRepairEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler,reports:FormalReport[]=[]){
 if(e.type==='logistics.arrive'){
  const t=w.logistics?.find(t=>t.shipmentId===e.shipmentId),p=t?.projectId&&w.largeProjects.find(p=>p.projectId===t.projectId&&p.repair);if(!t||!p)return false;if(t.phase!=='outbound'||t.arrivalEventId!==e.id)return true;
  const r=p.shipments.find(r=>r.shipmentId===t.shipmentId);requireRule(r?.phase==='in-transit','奇觀修復物流紀錄不一致。');
  const wonder=w.largeProjects.find(x=>x.projectId===p.repair!.wonderProjectId)!,rejected=!wonderAvailable(w,wonder)||p.repair!.phase==='completed';
  p.shipments[p.shipments.indexOf(r)]={...r,phase:rejected?'returned':'arrived',arrivedAt:w.time,arrivalEventId:e.id};t.phase='returning';t.returnCargo=rejected?{...t.resources}:zeroResources();if(!rejected)for(const k of resourceKeys)p.poolResources[k]+=t.resources[k];reconcileWonders(w,s);return true;
 }
 if(e.type!=='wonder.repair.complete')return false;const p=w.largeProjects.find(p=>p.projectId===e.projectId),r=p?.repair;
 if(!p||r?.phase!=='building'||r.completionEventId!==e.id)return true;reconcileWonders(w,s);if(r.phase!=='building'||r.completionEventId!==e.id)return true;
 const wonder=w.largeProjects.find(p=>p.projectId===r.wonderProjectId)!;settleWonderDurability(w,wonder);const b=wonder.wonder!,d=b.durability!;
 requireRule(repairWork(w,p)===p.durationMs,'修復施工工時不一致。');const before=d.current;d.current=durabilityPrecision(Math.min(d.maximum,before+r.missingSnapshot));
 d.ledger.push({key:resolutionId('repair-'+p.projectId.slice(8)),eventId:e.id,at:w.time,kind:'repair',amount:r.missingSnapshot,maximum:d.maximum,before,after:d.current});b.integrity=wonderIntegrity(d.current,d.maximum);
 r.workMs=p.durationMs;r.activeSince=null;r.phase='completed';r.completedAt=w.time;r.restored=d.current-before;delete r.combatInterrupted;
 reconcileWonders(w,s);const seq=w.sequences.report++,leader=p.owner.kind==='empire'?w.politics?.empires.find(e=>p.owner.kind==='empire'&&e.id===p.owner.empireId)?.leader:undefined;
 if(leader)reports.push({id:reportId(sequenceKey(seq)),sequence:seq,campaignId:w.campaignId,ownerFactionId:leader,at:w.time,category:'system',title:'世界奇觀修復完成',text:`本輪恢復 ${r.restored} 耐久；後續新增傷害須另行支付修復。`});return true;
}
