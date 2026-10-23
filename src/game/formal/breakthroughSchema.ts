import type {FormalWorld} from './model';
import {resourceKeys} from './model';
import {canonicalJSON} from './canonical';
import {BREAKTHROUGH_COST,BREAKTHROUGH_DURATION,breakthroughStoredWork,breakthroughPauseReason} from './breakthrough';
export function validateBreakthroughs(w:FormalWorld,fail:(message:string)=>void){
 if(!w.largeProjects.some(p=>p.kind==='civilization-breakthrough'))return;
 const empires=new Set<string>(),shipmentIds=new Set<string>(),receiptIds=new Set<string>(),commands=new Set<string>(),payments=new Map(w.commandReceipts.map(r=>[r.commandId,r]));
 for(const p of w.largeProjects)for(const t of p.shipments){if(shipmentIds.has(t.shipmentId))fail('Duplicate engineering shipment');shipmentIds.add(t.shipmentId);if(t.phase!=='in-transit'){if(receiptIds.has(t.arrivalEventId))fail('Duplicate engineering arrival');receiptIds.add(t.arrivalEventId);}}
 for(const p of w.largeProjects){if(p.kind!=='civilization-breakthrough')continue;const b=p.breakthrough,empire=p.owner.kind==='empire'?p.owner.empireId:null;
  if(!b||!empire){fail('Breakthrough state/owner missing');continue;}
  const wonder=w.largeProjects.find(q=>q.projectId===b.wonderProjectId);
  if(!wonder||wonder.kind!=='world-wonder'||wonder.wonder?.phase!=='completed'||wonder.owner.kind!=='empire'||wonder.owner.empireId!==empire||wonder.initiatingCityId!==p.initiatingCityId||wonder.wonder.completedAt!>p.createdAt||empires.has(empire)||p.createdAt>w.time||p.durationMs!==BREAKTHROUGH_DURATION||resourceKeys.some(r=>p.requiredResources[r]!==BREAKTHROUGH_COST[r]))fail('Breakthrough prerequisite/identity/cost invalid');
  empires.add(empire);const creation=payments.get(b.creationCommandId);
  if(!creation||creation.disposition!=='applied')fail('Breakthrough creation receipt missing');else{try{const o=JSON.parse(creation.fingerprint);if(o.campaignId!==w.campaignId||o.issuerId!==creation.issuerId||o.payload.type!=='breakthrough.start'||!w.cities.some(c=>c.id===o.payload.cityId))fail('Breakthrough creation binding invalid');}catch{fail('Breakthrough creation fingerprint invalid');}}
  if(commands.has(b.creationCommandId))fail('Duplicate breakthrough command');commands.add(b.creationCommandId);
  const serial=Number(p.projectId.slice(8));if(Number.isSafeInteger(serial)&&serial>=w.sequences.project)fail('Breakthrough project sequence would repeat');
  const full=resourceKeys.every(r=>p.poolResources[r]===p.requiredResources[r]),work=breakthroughStoredWork(p),reason=breakthroughPauseReason(w,p),fundedAt=Math.max(0,...p.shipments.map(t=>t.phase==='arrived'?t.arrivedAt:0));let end=p.createdAt;
  for(const period of b.workPeriods){if(period.startedAt<end||period.startedAt<fundedAt||period.endedAt<period.startedAt||period.endedAt>w.time)fail('Breakthrough work period invalid');end=period.endedAt;}
  if(b.phase==='paused'&&wonder?.wonder?.integrity==='ruins'&&(work%(p.durationMs/4)!==0||work>p.durationMs*.75))fail('Ruined wonder checkpoint invalid');
  if(work<0||work>p.durationMs||!full&&(b.workPeriods.length>0||b.discardedWorkMs>0))fail('Breakthrough work accounting invalid');
  if(b.phase==='building'){
   if(!full||reason||b.activeSince===null||b.activeSince<end||b.activeSince<fundedAt||b.activeSince>w.time||b.completedAt!==null||!b.completionEventId||!w.events.some(e=>e.type==='breakthrough.complete'&&e.projectId===p.projectId&&e.id===b.completionEventId&&e.at===b.activeSince!+p.durationMs-work&&e.at>=w.time))fail('Breakthrough active clock invalid');
  }else if(b.activeSince!==null)fail('Breakthrough inactive clock running');
  if(b.phase==='funding'&&(full||reason||work!==0)||b.phase==='paused'&&!reason)fail('Breakthrough funding/pause mismatch');
  if(b.phase==='completed'){
   if(!full||work!==p.durationMs||b.completedAt!==end||end>w.time||!b.completionEventId||w.events.some(e=>e.id===b.completionEventId)||b.qualifiedFactionIds.length===0||new Set(b.qualifiedFactionIds).size!==b.qualifiedFactionIds.length||b.qualifiedFactionIds.some(id=>!w.factions.some(f=>f.id===id&&f.modernQualification==='full')))fail('Breakthrough qualification receipt invalid');
  }else if(b.completedAt!==null||b.qualifiedFactionIds.length>0||b.phase!=='building'&&b.completionEventId!==null)fail('Premature breakthrough qualification/completion');
  if(b.completionEventId){if(receiptIds.has(b.completionEventId))fail('Duplicate breakthrough completion identity');receiptIds.add(b.completionEventId);}
  for(const r of resourceKeys)if(p.shipments.reduce((n,t)=>n+(t.phase==='returned'?0:t.resources[r]),0)>p.requiredResources[r])fail('Breakthrough demand overbooked');
  for(const record of p.shipments){
   const receipt=record.commandId&&payments.get(record.commandId),t=w.logistics?.find(t=>t.shipmentId===record.shipmentId);
   if(!record.commandId||commands.has(record.commandId))fail('Duplicate breakthrough payment');else commands.add(record.commandId);
   if(!receipt||receipt.disposition!=='applied'||receipt.issuerId!==record.sourceFactionId||receipt.fingerprint!==canonicalJSON({campaignId:w.campaignId,issuerId:record.sourceFactionId,payload:{type:'breakthrough.ship',cityId:record.sourceCityId,projectId:p.projectId,resources:record.resources}})||!w.cities.some(c=>c.id===record.sourceCityId)||record.dispatchedAt>w.time||resourceKeys.every(r=>record.resources[r]===0))fail('Breakthrough shipment payment/source invalid');
   if(record.phase==='in-transit'&&(!t||t.phase!=='outbound')||record.phase!=='in-transit'&&(record.arrivedAt>w.time||w.events.some(e=>e.id===record.arrivalEventId)||t&&t.phase!=='returning'))fail('Breakthrough shipment phase invalid');
   if(t&&(t.projectId!==p.projectId||t.commandId!==record.commandId||t.sourceFactionId!==record.sourceFactionId||t.sourceCityId!==record.sourceCityId||t.destinationCityId!==record.destinationCityId||t.dispatchedAt!==record.dispatchedAt||JSON.stringify(t.authorizationSnapshot)!==JSON.stringify(record.authorizationSnapshot)||resourceKeys.some(r=>t.resources[r]!==record.resources[r])||record.phase!=='in-transit'&&(record.arrivedAt!==t.arrivalAt||record.arrivalEventId!==t.arrivalEventId||resourceKeys.some(r=>(t.returnCargo?.[r]??0)!==(record.phase==='returned'?record.resources[r]:0)))))fail('Breakthrough logistics ledger mismatch');
  }
 }
 for(const e of w.events)if(e.type==='breakthrough.complete'&&!w.largeProjects.some(p=>p.kind==='civilization-breakthrough'&&p.projectId===e.projectId&&p.breakthrough?.phase==='building'&&p.breakthrough.completionEventId===e.id&&e.at===p.breakthrough.activeSince!+p.durationMs-breakthroughStoredWork(p)))fail('Dangling breakthrough event');
}
