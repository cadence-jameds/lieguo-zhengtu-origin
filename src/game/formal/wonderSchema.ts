import {canonicalJSON} from './canonical';
import type {FormalWorld} from './model';
import {resourceKeys} from './model';
import {WONDER_COST,WONDER_DURATION} from './wonder';
/** Strict wire invariants are reused by Save, Load, Recovery and Runtime validation. */
export function validateWonders(w:FormalWorld,fail:(message:string)=>void){
 const empires=new Set<string>(),shipments=new Set<string>(),commands=new Set<string>(),events=new Set<string>(),receipts=new Map(w.commandReceipts.map(r=>[r.commandId as string,r])),logistics=new Map(w.logistics?.map(t=>[t.shipmentId,t]));
 const applied=(id:string,issuer:string)=>receipts.get(id)?.issuerId===issuer&&receipts.get(id)?.disposition==='applied';
 for(const p of w.largeProjects){
  if(p.kind!=='world-wonder')continue;
  const state=p.wonder,owner=p.owner.kind==='empire'?p.owner.empireId:null,host=w.cities.find(c=>c.id===p.initiatingCityId);
  if(!state||!owner||!host){fail('Wonder host/state missing');continue;}
  // An original empire may later disappear through conquest/extinction. Preserve its historical
  // project identity; never attach it to a conqueror or grant qualifications here.
  if(empires.has(owner)||p.durationMs!==WONDER_DURATION||p.createdAt>w.time||!w.factions.some(f=>f.id===state.hostOwnerFactionId)||!w.commandReceipts.some(r=>{if(r.commandId!==state.creationCommandId||r.disposition!=='applied')return false;try{const command=JSON.parse(r.fingerprint);return command.campaignId===w.campaignId&&command.issuerId===r.issuerId&&command.payload.type==='wonder.start'&&command.payload.hostCityId===host.id;}catch{return false;}}))fail('Wonder identity/creation invalid');
  empires.add(owner);if(commands.has(state.creationCommandId))fail('Duplicate wonder creation command');commands.add(state.creationCommandId);
  const suffix=Number(p.projectId.slice(8));if(Number.isSafeInteger(suffix)&&suffix>=w.sequences.project)fail('Wonder project sequence would reuse ID');
  if(resourceKeys.some(r=>p.requiredResources[r]!==WONDER_COST[r]))fail('Wonder cost invalid');
  const full=resourceKeys.every(r=>p.poolResources[r]===p.requiredResources[r]);
  if(state.phase==='funding'){
   if(full||state.startedAt!==null||state.completionEventId!==null||state.completedAt!==null)fail('Wonder funding clock invalid');
  }else{
   if(!full||state.startedAt===null||state.startedAt<p.createdAt||state.startedAt>w.time||!state.completionEventId)fail('Wonder construction clock invalid');
   const end=(state.startedAt??0)+p.durationMs;
   if(state.phase==='building'&&(end<=w.time||state.completedAt!==null||!w.events.some(e=>e.type==='wonder.complete'&&e.projectId===p.projectId&&e.id===state.completionEventId&&e.at===end)))fail('Wonder completion event missing');
   if(state.phase==='completed'&&(state.completedAt!==end||state.completedAt>w.time||w.events.some(e=>e.id===state.completionEventId)))fail('Wonder completion receipt invalid');
   if(state.startedAt!==Math.max(...p.shipments.map(t=>t.phase==='arrived'?t.arrivedAt:Infinity)))fail('Wonder clock must start at final arrival');
   if(state.completionEventId){if(events.has(state.completionEventId))fail('Duplicate wonder completion');events.add(state.completionEventId);}
  }
  for(const r of resourceKeys)if(p.shipments.reduce((n,t)=>n+t.resources[r],0)>p.requiredResources[r])fail('Wonder demand overbooked');
  for(const record of p.shipments){
   if(shipments.has(record.shipmentId))fail('Duplicate project shipment');shipments.add(record.shipmentId);
   const t=logistics.get(record.shipmentId);
   if(!w.cities.some(c=>c.id===record.sourceCityId)||!w.factions.some(f=>f.id===record.sourceFactionId)||resourceKeys.every(r=>record.resources[r]===0)||record.dispatchedAt>w.time)fail('Wonder shipment source/cargo invalid');
   if(!record.commandId||commands.has(record.commandId))fail('Duplicate wonder payment command');else commands.add(record.commandId);
   const receipt=record.commandId?receipts.get(record.commandId):undefined;
   if(!receipt||receipt.disposition!=='applied'||receipt.issuerId!==record.sourceFactionId||receipt.fingerprint!==canonicalJSON({campaignId:w.campaignId,issuerId:record.sourceFactionId,payload:{type:'wonder.ship',cityId:record.sourceCityId,projectId:p.projectId,resources:record.resources}}))fail('Wonder shipment payment receipt missing');
   const serial=Number(record.shipmentId.slice(9));if(Number.isSafeInteger(serial)&&serial>=w.sequences.project)fail('Wonder shipment sequence would reuse ID');
   if(record.phase==='in-transit'&&(!t||t.phase!=='outbound')||record.phase==='arrived'&&(record.arrivedAt>w.time||t&&t.phase!=='returning'))fail('Wonder shipment phase invalid');
   if(record.phase==='arrived'){if(w.events.some(e=>e.id===record.arrivalEventId)||events.has(record.arrivalEventId))fail('Duplicate wonder arrival receipt');events.add(record.arrivalEventId);}
   if(t&&(t.commandId!==record.commandId||t.projectId!==p.projectId||t.sourceCityId!==record.sourceCityId||t.destinationCityId!==record.destinationCityId||t.sourceFactionId!==record.sourceFactionId||t.dispatchedAt!==record.dispatchedAt||JSON.stringify(t.authorizationSnapshot)!==JSON.stringify(record.authorizationSnapshot)||resourceKeys.some(r=>t.resources[r]!==record.resources[r])||record.phase==='arrived'&&(record.arrivedAt!==t.arrivalAt||record.arrivalEventId!==t.arrivalEventId)))fail('Wonder logistics ledger mismatch');
  }
 }
 for(const t of w.logistics??[]){
  if(!t.projectId){if(t.path.length<2||t.distance<=0||t.sourceCityId===t.destinationCityId)fail('Ordinary logistics route invalid');continue;}
  const p=w.largeProjects.find(p=>p.projectId===t.projectId);
  if(!p||!['world-wonder','civilization-breakthrough'].includes(p.kind)&&!p.catchup||!p.shipments.some(r=>r.shipmentId===t.shipmentId)||t.reservedResources||t.returnCargo&&resourceKeys.some(r=>t.returnCargo![r]!==0)&&!p?.shipments.some(r=>r.shipmentId===t.shipmentId&&r.phase==='returned')||!applied(t.commandId,t.sourceFactionId))fail('Project logistics binding invalid');
  const source=w.cities.find(c=>c.id===t.sourceCityId),dest=w.cities.find(c=>c.id===t.destinationCityId);
  if(!source||!dest||t.path[0].x!==source.x||t.path[0].y!==source.y||t.path.at(-1)!.x!==dest.x||t.path.at(-1)!.y!==dest.y||t.sourceCityId===t.destinationCityId&&(t.distance!==0||t.path.length!==1)||t.sourceCityId!==t.destinationCityId&&(t.distance<=0||t.path.length<2))fail('Wonder transport route invalid');
 }
 for(const e of w.events)if(e.type==='wonder.complete'&&!w.largeProjects.some(p=>p.kind==='world-wonder'&&p.projectId===e.projectId&&p.wonder?.phase==='building'&&p.wonder.completionEventId===e.id&&e.at===p.wonder.startedAt!+p.durationMs))fail('Dangling wonder event');
}
