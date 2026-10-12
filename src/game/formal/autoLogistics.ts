import {commandId,sequenceKey} from './ids';
import type {AutoLogistics,FormalCity,FormalOrder,FormalWorld} from './model';
import {resourceKeys,zeroResources} from './model';
import {canonicalJSON} from './canonical';
import {EventScheduler} from './scheduler';
import {buildingLevel,storageCapacity} from './catalogB3';
import {applyEconomyCommand,requireRule,RuleViolation,settleCity} from './economy';
import {spatial} from './spatial';
export function setAutoLogistics(w:FormalWorld,c:FormalCity,rules:AutoLogistics[]){const f=w.factions.find(f=>f.id===c.ownerFactionId)!;requireRule(f.techIds.includes('logistics.auto')&&buildingLevel(c,'market')>0,'須先完成商路管理並有市場。');for(const r of rules){const dest=spatial(w).cities.get(r.destinationCityId);requireRule(dest&&dest.id!==c.id&&dest.ownerFactionId===c.ownerFactionId,'自動運輸目的地必須是自己的另一座城市。');}c.autoLogistics=structuredClone(rules);}
/** Scheduler-driven intents use the same dispatch stock/capacity/caravan/routing rules as manual commands. */
export function runAutoLogistics(w:FormalWorld,c:FormalCity,s:EventScheduler){
 if(!c.autoLogistics?.length||!w.factions.find(f=>f.id===c.ownerFactionId)?.techIds.includes('logistics.auto'))return;
 settleCity(w,c);
 for(const rule of c.autoLogistics){const dest=spatial(w).cities.get(rule.destinationCityId);if(!dest?.economy||dest.ownerFactionId!==c.ownerFactionId)continue;settleCity(w,dest);
  const busy=(w.logistics??[]).filter(t=>t.sourceCityId===c.id).reduce((n,t)=>n+t.caravans,0),free=Math.min(rule.maxCaravans,buildingLevel(c,'market')-busy);if(free<=0)continue;
  let capacity=free*2000;const resources=zeroResources();for(const r of resourceKeys){resources[r]=Math.max(0,Math.min(c.stock[r]-rule.reserve[r],storageCapacity(dest)-dest.stock[r]-dest.economy.reservedIncoming[r],capacity));capacity-=resources[r];}
  if(resourceKeys.every(r=>resources[r]===0))continue;
  const o:FormalOrder={commandId:commandId('auto-'+sequenceKey(w.sequences.project++)),campaignId:w.campaignId,issuerId:c.ownerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'logistics.dispatch',cityId:c.id,destinationCityId:dest.id,resources}};
  try{applyEconomyCommand(w,c,o,o.payload as Extract<FormalOrder['payload'],{type:'logistics.dispatch'}>,s);w.commandReceipts.push({commandId:o.commandId,issuerId:o.issuerId,fingerprint:canonicalJSON({campaignId:o.campaignId,issuerId:o.issuerId,payload:o.payload}),committedRevision:w.revision+1,disposition:'applied'});}catch(error){if(!(error instanceof RuleViolation))throw error;}
 }
}
