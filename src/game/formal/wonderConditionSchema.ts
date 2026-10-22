import {z} from 'zod';
import type {CommandId,EventId,ProjectId} from './ids';
import type {FormalWorld} from './model';
import {resourceKeys} from './model';
import type {WonderRepair} from './wonderCondition';
import {repairQuote,repairWork,wonderAvailable} from './wonderCondition';
import {canonicalJSON} from './canonical';
const int=z.number().int().nonnegative().safe(),id=<T extends string>(prefix:string)=>z.string().regex(new RegExp(`^${prefix}:[A-Za-z0-9_.-]{1,100}$`)) as unknown as z.ZodType<T>;
export const repairSchema:z.ZodType<WonderRepair>=z.object({creationCommandId:id<CommandId>('command'),wonderProjectId:id<ProjectId>('project'),missingSnapshot:z.number().finite().positive().max(120000),phase:z.enum(['funding','building','paused','completed']),workMs:int,activeSince:int.nullable(),completionEventId:id<EventId>('event').nullable(),completedAt:int.nullable(),restored:z.number().finite().nonnegative().max(120000).nullable(),combatInterrupted:z.literal(true).optional()}).strict();
export function validateRepairs(w:FormalWorld,fail:(message:string)=>void){
 const active=new Set<string>();
 for(const p of w.largeProjects){const r=p.repair;if(!r)continue;
  const wonder=w.largeProjects.find(q=>q.projectId===r.wonderProjectId&&q.wonder),quote=repairQuote(r.missingSnapshot),creation=w.commandReceipts.find(q=>q.commandId===r.creationCommandId),full=resourceKeys.every(k=>p.poolResources[k]===p.requiredResources[k]);
  if(p.owner.kind!=='empire'||wonder?.owner.kind!=='empire'||p.owner.empireId!==wonder.owner.empireId||p.initiatingCityId!==wonder.initiatingCityId||p.createdAt>w.time||p.durationMs!==quote.durationMs||resourceKeys.some(k=>p.requiredResources[k]!==quote.resources[k]))fail('Wonder repair prerequisite/quote invalid');
  if(!creation||creation.disposition!=='applied')fail('Wonder repair creation receipt missing');else try{const o=JSON.parse(creation.fingerprint);if(o.campaignId!==w.campaignId||o.issuerId!==creation.issuerId||o.payload.type!=='wonder.repair.start'||o.payload.projectId!==r.wonderProjectId)fail('Wonder repair creation binding invalid');}catch{fail('Wonder repair creation invalid');}
  if(r.phase!=='completed'){if(active.has(r.wonderProjectId))fail('Duplicate active wonder repair');active.add(r.wonderProjectId);}
  if(repairWork(w,p)>p.durationMs||r.activeSince!==null&&(r.activeSince<p.createdAt||r.activeSince>w.time))fail('Wonder repair work invalid');
  const battle=w.combat?.battles.some(b=>b.cityId===p.initiatingCityId),fundedAt=Math.max(p.createdAt,...p.shipments.map(t=>t.phase==='arrived'?t.arrivedAt:0));
  if(r.phase==='paused'&&wonder&&wonderAvailable(w,wonder)&&!battle)fail('Wonder repair pause reason missing');
  if(r.phase==='building'){
   if(!full||r.activeSince===null||r.activeSince<fundedAt||r.combatInterrupted&&!!battle||!r.completionEventId||!wonder||!wonderAvailable(w,wonder)||r.completedAt!==null||!w.events.some(e=>e.type==='wonder.repair.complete'&&e.id===r.completionEventId&&e.projectId===p.projectId&&e.at===r.activeSince!+p.durationMs-r.workMs))fail('Wonder repair clock invalid');
  }else if(r.activeSince!==null||r.phase!=='completed'&&r.completionEventId!==null)fail('Inactive wonder repair clock running');
  if(r.phase==='funding'&&(full||r.workMs!==0)||r.phase!=='completed'&&(r.completedAt!==null||r.restored!==null))fail('Wonder repair funding/completion invalid');
  if(r.phase==='completed'&&(!full||r.workMs!==p.durationMs||r.completedAt===null||r.completedAt>w.time||r.restored===null||r.restored>r.missingSnapshot||!wonder?.wonder?.durability?.ledger.some(x=>x.kind==='repair'&&x.eventId===r.completionEventId&&x.at===r.completedAt&&x.amount===r.missingSnapshot&&x.after-x.before===r.restored)))fail('Wonder repair completion receipt invalid');
  for(const k of resourceKeys)if(p.shipments.reduce((n,t)=>n+(t.phase==='returned'?0:t.resources[k]),0)>p.requiredResources[k])fail('Wonder repair demand overbooked');
  for(const t of p.shipments){const receipt=t.commandId&&w.commandReceipts.find(q=>q.commandId===t.commandId),live=w.logistics?.find(q=>q.shipmentId===t.shipmentId);
   if(!receipt||receipt.disposition!=='applied'||receipt.issuerId!==t.sourceFactionId||receipt.fingerprint!==canonicalJSON({campaignId:w.campaignId,issuerId:t.sourceFactionId,payload:{type:'wonder.repair.ship',cityId:t.sourceCityId,projectId:p.projectId,resources:t.resources}})||t.dispatchedAt>w.time||resourceKeys.every(k=>t.resources[k]===0))fail('Wonder repair payment invalid');
   if(t.phase==='in-transit'&&(!live||live.phase!=='outbound')||t.phase!=='in-transit'&&(t.arrivedAt>w.time||w.events.some(e=>e.id===t.arrivalEventId)||live&&live.phase!=='returning'))fail('Wonder repair shipment phase invalid');
   if(live&&(live.projectId!==p.projectId||live.commandId!==t.commandId||live.sourceFactionId!==t.sourceFactionId||live.sourceCityId!==t.sourceCityId||live.destinationCityId!==t.destinationCityId||live.dispatchedAt!==t.dispatchedAt||JSON.stringify(live.authorizationSnapshot)!==JSON.stringify(t.authorizationSnapshot)||resourceKeys.some(k=>live.resources[k]!==t.resources[k])||t.phase!=='in-transit'&&(live.arrivalAt!==t.arrivedAt||live.arrivalEventId!==t.arrivalEventId||resourceKeys.some(k=>(live.returnCargo?.[k]??0)!==(t.phase==='returned'?t.resources[k]:0)))))fail('Wonder repair logistics mismatch');
  }
 }
 for(const e of w.events)if(e.type==='wonder.repair.complete'&&!w.largeProjects.some(p=>p.projectId===e.projectId&&p.repair?.phase==='building'&&p.repair.completionEventId===e.id))fail('Dangling wonder repair event');
}
