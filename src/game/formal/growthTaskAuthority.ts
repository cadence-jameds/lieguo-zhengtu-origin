import type {FormalWorld} from './model';
import type {GrowthTaskState} from './growthTasks';
import {canonicalJSON} from './canonical';
/** Task achievements/claims are irreversible campaign history, including manual Recovery.
 * Restoring inventory never reissues rewards. This ledger shares the existing CAS transaction. */
export function reconcileGrowthAuthority(w:FormalWorld,prior:GrowthTaskState|undefined,restore:boolean){
 if(!prior)return;
 const current=w.growthTasks;
 if(!restore){
  if(!current||Object.entries(prior.facts).some(([k,n])=>(current.facts[k]??0)<n)||Object.entries(prior.completed).some(([id,at])=>current.completed[id]!==at)||Object.entries(prior.claimed).some(([id,c])=>canonicalJSON(current.claimed[id])!==canonicalJSON(c)))throw Error('Durable growth task history cannot be dropped or rewritten');
  return;
 }
 const next=structuredClone(current??prior);next.startedAt=Math.min(next.startedAt,prior.startedAt);next.recordedThrough=Math.max(next.recordedThrough,prior.recordedThrough);
 for(const [k,n]of Object.entries(prior.facts))next.facts[k]=Math.max(next.facts[k]??0,n);
 for(const [id,at]of Object.entries(prior.completed))next.completed[id]=at;
 for(const [id,c]of Object.entries(prior.claimed))next.claimed[id]=structuredClone(c);
 next.settledCities=[...new Set([...next.settledCities,...prior.settledCities])];
 next.autoShipments=[...new Set([...next.autoShipments,...prior.autoShipments])].filter(id=>w.logistics?.some(t=>t.shipmentId===id));w.growthTasks=next;
}
