import {canonicalJSON} from './canonical';
import type {FormalWorld} from './model';
import {resourceKeys} from './model';
import {WONDER_COST,WONDER_DURATION,WONDER_MAX_DURABILITY,wonderIntegrity,wonderProgress} from './wonder';
/** Strict wire invariants are reused by Save, Load, Recovery and Runtime validation. */
export function validateWonders(w:FormalWorld,fail:(message:string)=>void){
 const empires=new Set<string>(),shipments=new Set<string>(),commands=new Set<string>(),events=new Set<string>(),receipts=new Map(w.commandReceipts.map(r=>[r.commandId as string,r])),logistics=new Map(w.logistics?.map(t=>[t.shipmentId,t]));
 const applied=(id:string,issuer:string)=>receipts.get(id)?.issuerId===issuer&&receipts.get(id)?.disposition==='applied';
 for(const p of w.largeProjects){
  if(p.kind!=='world-wonder')continue;
  const state=p.wonder,owner=p.owner.kind==='empire'?p.owner.empireId:null,host=w.cities.find(c=>c.id===p.initiatingCityId);
  if(!state||!owner||!host){fail('Wonder host/state missing');continue;}
  if(state.ruinsRequireRestoration&&(state.phase!=='building'||state.integrity==='intact'||state.clock?.activeSince!==null))fail('Construction ruin restoration latch invalid');
  if(state.durability){
   const d=state.durability,ids=new Set<string>(),eventIds=new Set<string>();let gap=0,at=p.createdAt,maximum=0;
   if(state.phase==='funding'||state.integrity!==wonderIntegrity(d.current,d.maximum)||d.current>d.maximum)fail('Wonder numeric durability/integrity invalid');
   for(const r of d.ledger){
    const expected=r.kind==='damage'?Math.max(0,r.before-r.amount):Math.min(r.maximum,r.before+r.amount);
    if(ids.has(r.key)||eventIds.has(r.eventId)||r.at<at||r.at>w.time||r.maximum<maximum||r.before>r.maximum||Math.abs(r.before-Math.max(0,r.maximum-gap))>1e-6||Math.abs(r.after-expected)>1e-6)fail('Wonder durability receipt invalid');
    ids.add(r.key);eventIds.add(r.eventId);gap=r.maximum-r.after;at=r.at;maximum=r.maximum;
   }
   const expectedMaximum=state.phase==='completed'?WONDER_MAX_DURABILITY:WONDER_MAX_DURABILITY*wonderProgress(w,p)/100;
   if(Math.abs(d.current-Math.max(0,d.maximum-gap))>1e-6||Math.abs(d.maximum-expectedMaximum)>1e-6)fail('Wonder durability ledger mismatch');
  }
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
   if(!full||state.startedAt===null||state.startedAt<p.createdAt||state.startedAt>w.time||!state.completionEventId&&(!state.clock||state.clock.activeSince!==null))fail('Wonder construction clock invalid');
   const end=state.clock?(state.phase==='completed'?state.completedAt!:state.clock.activeSince===null?Infinity:state.clock.activeSince+p.durationMs-state.clock.workMs):(state.startedAt??0)+p.durationMs;
   if(state.phase==='building'&&(end<w.time||state.completedAt!==null||Number.isFinite(end)&&!w.events.some(e=>e.type==='wonder.complete'&&e.projectId===p.projectId&&e.id===state.completionEventId&&e.at===end)))fail('Wonder completion event missing');
   if(state.clock&&(state.clock.workMs>p.durationMs||state.clock.workMs>w.time-(state.startedAt??w.time)||state.clock.activeSince!==null&&(state.clock.activeSince>w.time||state.clock.activeSince<(state.startedAt??0))||state.phase==='completed'&&(state.clock.workMs!==p.durationMs||state.clock.activeSince!==null)||state.phase==='building'&&state.clock.activeSince===null&&state.completionEventId!==null))fail('Wonder construction work invalid');
   if(state.phase==='completed'&&(state.completedAt!==end||state.completedAt>w.time||state.completedAt!<(state.startedAt??0)+p.durationMs||w.events.some(e=>e.id===state.completionEventId)))fail('Wonder completion receipt invalid');
   if(state.startedAt!==Math.max(...p.shipments.map(t=>t.phase==='arrived'?t.arrivedAt:0)))fail('Wonder clock must start at final arrival');
   if(state.completionEventId){if(events.has(state.completionEventId))fail('Duplicate wonder completion');events.add(state.completionEventId);}
  }
  for(const r of resourceKeys)if(p.shipments.reduce((n,t)=>n+(t.phase==='returned'?0:t.resources[r]),0)>p.requiredResources[r])fail('Wonder demand overbooked');
  for(const record of p.shipments){
   if(shipments.has(record.shipmentId))fail('Duplicate project shipment');shipments.add(record.shipmentId);
   const t=logistics.get(record.shipmentId);
   if(!w.cities.some(c=>c.id===record.sourceCityId)||!w.factions.some(f=>f.id===record.sourceFactionId)||resourceKeys.every(r=>record.resources[r]===0)||record.dispatchedAt>w.time)fail('Wonder shipment source/cargo invalid');
   if(!record.commandId||commands.has(record.commandId))fail('Duplicate wonder payment command');else commands.add(record.commandId);
   const receipt=record.commandId?receipts.get(record.commandId):undefined;
   if(!receipt||receipt.disposition!=='applied'||receipt.issuerId!==record.sourceFactionId||receipt.fingerprint!==canonicalJSON({campaignId:w.campaignId,issuerId:record.sourceFactionId,payload:{type:'wonder.ship',cityId:record.sourceCityId,projectId:p.projectId,resources:record.resources}}))fail('Wonder shipment payment receipt missing');
   const serial=Number(record.shipmentId.slice(9));if(Number.isSafeInteger(serial)&&serial>=w.sequences.project)fail('Wonder shipment sequence would reuse ID');
   if(record.phase==='in-transit'&&(!t||t.phase!=='outbound')||record.phase!=='in-transit'&&(record.arrivedAt>w.time||t&&t.phase!=='returning'))fail('Wonder shipment phase invalid');
   if(record.phase!=='in-transit'){if(w.events.some(e=>e.id===record.arrivalEventId)||events.has(record.arrivalEventId))fail('Duplicate wonder arrival receipt');events.add(record.arrivalEventId);}
   if(t&&(t.commandId!==record.commandId||t.projectId!==p.projectId||t.sourceCityId!==record.sourceCityId||t.destinationCityId!==record.destinationCityId||t.sourceFactionId!==record.sourceFactionId||t.dispatchedAt!==record.dispatchedAt||JSON.stringify(t.authorizationSnapshot)!==JSON.stringify(record.authorizationSnapshot)||resourceKeys.some(r=>t.resources[r]!==record.resources[r])||record.phase!=='in-transit'&&(record.arrivedAt!==t.arrivalAt||record.arrivalEventId!==t.arrivalEventId)))fail('Wonder logistics ledger mismatch');
  }
 }
 for(const t of w.logistics??[]){
  if(!t.projectId){if(t.path.length<2||t.distance<=0||t.sourceCityId===t.destinationCityId)fail('Ordinary logistics route invalid');continue;}
  const p=w.largeProjects.find(p=>p.projectId===t.projectId);
  if(!p||!['world-wonder','civilization-breakthrough'].includes(p.kind)&&!p.catchup&&!p.repair||!p.shipments.some(r=>r.shipmentId===t.shipmentId)||t.reservedResources||t.returnCargo&&resourceKeys.some(r=>t.returnCargo![r]!==0)&&!p?.shipments.some(r=>r.shipmentId===t.shipmentId&&r.phase==='returned')||!applied(t.commandId,t.sourceFactionId))fail('Project logistics binding invalid');
  const source=w.cities.find(c=>c.id===t.sourceCityId),dest=w.cities.find(c=>c.id===t.destinationCityId);
  if(!source||!dest||t.path[0].x!==source.x||t.path[0].y!==source.y||t.path.at(-1)!.x!==dest.x||t.path.at(-1)!.y!==dest.y||t.sourceCityId===t.destinationCityId&&(t.distance!==0||t.path.length!==1)||t.sourceCityId!==t.destinationCityId&&(t.distance<=0||t.path.length<2))fail('Wonder transport route invalid');
 }
 for(const e of w.events)if(e.type==='wonder.complete'&&!w.largeProjects.some(p=>p.kind==='world-wonder'&&p.projectId===e.projectId&&p.wonder?.phase==='building'&&p.wonder.completionEventId===e.id&&e.at===(p.wonder.clock?p.wonder.clock.activeSince!+p.durationMs-p.wonder.clock.workMs:p.wonder.startedAt!+p.durationMs)))fail('Dangling wonder event');
}
