import type {FormalWorld} from './model';
import {resourceKeys} from './model';
import {canonicalJSON} from './canonical';
import {EMERGENCY_COST,EMERGENCY_DURATION} from './modernCatchup';
export function validateCatchup(w:FormalWorld,fail:(message:string)=>void){
 const commands=new Map(w.commandReceipts.map(r=>[r.commandId,r])),seen=new Set<string>(),events=new Set<string>(),owners=new Set<string>();
 for(const p of w.largeProjects){const b=p.catchup;if(!b)continue;
  if(p.kind!=='emergency-modernization'||p.durationMs!==EMERGENCY_DURATION||resourceKeys.some(r=>p.requiredResources[r]!==EMERGENCY_COST[r]))fail('Catchup cost/duration/kind invalid');
  const source=w.largeProjects.find(q=>q.projectId===b.eligibilitySnapshot.sourceProjectId);
  if(source?.breakthrough?.phase!=='completed'||source.breakthrough.completedAt!>p.createdAt||b.eligibilitySnapshot.awareness!==100||source.owner.kind!=='empire'||source.owner.empireId===b.eligibilitySnapshot.scope||b.eligibilitySnapshot.scope!==(p.owner.kind==='empire'?p.owner.empireId:p.owner.factionId))fail('Emergency qualification snapshot invalid');
  if(b.phase!=='completed'&&b.phase!=='cancelled'&&(p.owner.kind==='empire'?!w.politics?.empires.some(e=>p.owner.kind==='empire'&&e.id===p.owner.empireId):!w.cities.some(c=>p.owner.kind==='faction'&&c.ownerFactionId===p.owner.factionId)))fail('Catchup active owner invalid');
  const key=p.kind+'/'+JSON.stringify(p.owner);if(b.phase!=='cancelled'){if(owners.has(key))fail('Duplicate catchup project');owners.add(key);}
  const creation=commands.get(b.creationCommandId),payload={type:'modern.emergency.start',cityId:p.initiatingCityId};
  if(!creation||creation.disposition!=='applied'||creation.issuerId!==b.initiatorId||creation.fingerprint!==canonicalJSON({campaignId:w.campaignId,issuerId:b.initiatorId,payload})||!w.factions.some(f=>f.id===b.initiatorId)||!w.cities.some(c=>c.id===p.initiatingCityId)||p.createdAt>w.time)fail('Catchup creation identity invalid');
  if(seen.has(b.creationCommandId))fail('Duplicate catchup creation');seen.add(b.creationCommandId);
  const full=resourceKeys.every(r=>p.requiredResources[r]===p.poolResources[r]),fundedAt=Math.max(p.createdAt,...p.shipments.filter(t=>t.phase==='arrived').map(t=>t.phase==='arrived'?t.arrivedAt:0));
  if(b.phase==='funding'&&(full||b.startedAt!==null||b.completionEventId!==null)||b.phase==='building'&&(!full||b.startedAt!==fundedAt||!b.completionEventId||!w.events.some(e=>e.type==='modern.project.complete'&&e.id===b.completionEventId&&e.projectId===p.projectId&&e.at===b.startedAt!+p.durationMs&&e.at>w.time)))fail('Catchup funded clock invalid');
  if(b.phase==='completed'&&(!full||b.startedAt!==fundedAt||b.completedAt!==b.startedAt!+p.durationMs||b.completedAt>w.time||!b.completionEventId||!b.qualifiedFactionIds.length||new Set(b.qualifiedFactionIds).size!==b.qualifiedFactionIds.length||b.qualifiedFactionIds.some(id=>!w.factions.some(f=>f.id===id&&f.modernQualification==='full'))))fail('Catchup qualification receipt invalid');
  if(b.phase!=='completed'&&(b.completedAt!==null||b.qualifiedFactionIds.length)||b.phase==='cancelled'&&b.completionEventId!==null)fail('Premature catchup qualification');
  if(b.completionEventId){if(events.has(b.completionEventId)||b.phase==='completed'&&w.events.some(e=>e.id===b.completionEventId))fail('Duplicate catchup completion');events.add(b.completionEventId);}
  for(const r of resourceKeys)if(p.shipments.reduce((n,t)=>n+(t.phase==='returned'?0:t.resources[r]),0)>p.requiredResources[r])fail('Catchup demand overbooked');
  for(const record of p.shipments){const receipt=record.commandId&&commands.get(record.commandId),t=w.logistics?.find(t=>t.shipmentId===record.shipmentId);
   if(!record.commandId||seen.has(record.commandId)||seen.has(record.shipmentId))fail('Duplicate catchup payment/shipment');else{seen.add(record.commandId);seen.add(record.shipmentId);}
   if(!receipt||receipt.disposition!=='applied'||receipt.issuerId!==record.sourceFactionId||receipt.fingerprint!==canonicalJSON({campaignId:w.campaignId,issuerId:record.sourceFactionId,payload:{type:'modern.project.ship',cityId:record.sourceCityId,projectId:p.projectId,resources:record.resources}})||record.dispatchedAt>w.time||!w.cities.some(c=>c.id===record.sourceCityId)||resourceKeys.every(r=>record.resources[r]===0))fail('Catchup payment binding invalid');
   if(record.phase==='in-transit'&&(!t||t.phase!=='outbound')||record.phase!=='in-transit'&&(record.arrivedAt>w.time||w.events.some(e=>e.id===record.arrivalEventId)||t&&t.phase!=='returning'))fail('Catchup shipment phase invalid');
   if(record.phase!=='in-transit'){if(events.has(record.arrivalEventId))fail('Duplicate catchup arrival');events.add(record.arrivalEventId);}
   if(t&&(t.projectId!==p.projectId||t.commandId!==record.commandId||t.sourceFactionId!==record.sourceFactionId||t.sourceCityId!==record.sourceCityId||t.destinationCityId!==p.initiatingCityId||t.dispatchedAt!==record.dispatchedAt||JSON.stringify(t.authorizationSnapshot)!==JSON.stringify(record.authorizationSnapshot)||resourceKeys.some(r=>t.resources[r]!==record.resources[r])||record.phase!=='in-transit'&&(t.arrivalAt!==record.arrivedAt||t.arrivalEventId!==record.arrivalEventId||resourceKeys.some(r=>(t.returnCargo?.[r]??0)!==(record.phase==='returned'?record.resources[r]:0)))))fail('Catchup logistics ledger mismatch');
  }
 }
 for(const e of w.events)if(e.type==='modern.project.complete'&&!w.largeProjects.some(p=>p.projectId===e.projectId&&p.catchup?.phase==='building'&&p.catchup.completionEventId===e.id&&e.at===p.catchup.startedAt!+p.durationMs))fail('Dangling catchup completion event');
}
