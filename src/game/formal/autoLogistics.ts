import {empireOf} from './politics';
import {applyWonderCommand,empireWonder,wonderRemaining} from './wonder';
import {commandId,sequenceKey} from './ids';
import type {AutoLogistics,FormalCity,FormalOrder,FormalWorld,Resources} from './model';
import {resourceKeys,zeroResources} from './model';
import {canonicalJSON} from './canonical';
import {EventScheduler} from './scheduler';
import {buildingLevel,storageCapacity} from './catalogB3';
import {dispatchLogistics,requireRule,RuleViolation,settleCity} from './economy';
import {spatial} from './spatial';
import {logisticsAllocation,logisticsAvailable,logisticsReserve,type LogisticsSettings} from './logisticsAllocation';
export function setAutoLogistics(w:FormalWorld,c:FormalCity,rules:AutoLogistics[],settings?:LogisticsSettings){
 const f=w.factions.find(f=>f.id===c.ownerFactionId)!;
 requireRule(!rules.length||f.techIds.includes('logistics.auto')&&buildingLevel(c,'market')>0,'須先完成商路管理並有市場。');
 requireRule(new Set(rules.map(r=>r.destinationCityId)).size===rules.length,'每個目的城市只能分配一條固定路線。');
 for(const r of rules){const dest=spatial(w).cities.get(r.destinationCityId);requireRule(dest&&dest.id!==c.id&&dest.ownerFactionId===c.ownerFactionId,'自動運輸目的地必須是自己的另一座城市。');}
 if(settings?.wonder?.enabled){const empire=empireOf(w,c.ownerFactionId),p=empire&&empireWonder(w,empire.id);requireRule(c.ownerFactionId===w.playerFactionId&&p?.projectId===settings.wonder.projectId&&p.wonder?.phase==='funding'&&settings.wonder.maxCaravans>0,'自動補給需要玩家目前帝國的籌資中奇觀及專用商隊。');const host=p&&spatial(w).cities.get(p.initiatingCityId);requireRule(host&&empireOf(w,host.ownerFactionId)?.id===empire?.id,'奇觀承載城市已不屬於原帝國。');}
 const candidate={...c,autoLogistics:rules,...(settings?{logisticsSettings:settings}:{})};
 requireRule(logisticsAllocation(candidate).allocated<=Math.min(15,buildingLevel(c,'market')),'一般物流、奇觀補給及手動預留總額超過市場容量。');
 c.autoLogistics=structuredClone(rules);if(settings)c.logisticsSettings=structuredClone(settings);
}
export function automaticOrder(w:FormalWorld,c:FormalCity,payload:FormalOrder['payload']):FormalOrder{return{commandId:commandId('auto-'+sequenceKey(w.sequences.project++)),campaignId:w.campaignId,issuerId:c.ownerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload};}
export function recordAutomatic(w:FormalWorld,o:FormalOrder){w.commandReceipts.push({commandId:o.commandId,issuerId:o.issuerId,fingerprint:canonicalJSON({campaignId:o.campaignId,issuerId:o.issuerId,payload:o.payload}),committedRevision:w.revision+1,disposition:'applied'});}
/** Pack whole caravans; scarce production waits rather than spending a reserved vehicle. */
export function fullCargo(available:Resources,capacity:number){const out=zeroResources();let left=Math.min(capacity,Math.floor(resourceKeys.reduce((n,r)=>n+available[r],0)/2000)*2000);for(const r of resourceKeys){out[r]=Math.min(available[r],left);left-=out[r];}return out;}
/** Runs only at existing settlement/return events, with no added polling events. */
export function runAutoLogistics(w:FormalWorld,c:FormalCity,s:EventScheduler){
 if(!c.autoLogistics?.length||!w.factions.find(f=>f.id===c.ownerFactionId)?.techIds.includes('logistics.auto'))return;
 settleCity(w,c);const reserve=logisticsReserve(c);
 for(const rule of c.autoLogistics){const dest=spatial(w).cities.get(rule.destinationCityId);if(!dest?.economy||dest.ownerFactionId!==c.ownerFactionId)continue;const free=logisticsAvailable(w,c,'general-auto',dest.id);if(free<=0)continue;settleCity(w,dest);
  const available=Object.fromEntries(resourceKeys.map(r=>[r,Math.max(0,Math.min(c.stock[r]-reserve[r],storageCapacity(dest)-dest.stock[r]-dest.economy!.reservedIncoming[r]))])) as Resources;
  const resources=fullCargo(available,free*2000);if(!resourceKeys.some(r=>resources[r]))continue;
  const o=automaticOrder(w,c,{type:'logistics.dispatch',cityId:c.id,destinationCityId:dest.id,resources});
  try{dispatchLogistics(w,c,o,dest.id,resources,s,undefined,'general-auto');recordAutomatic(w,o);}catch(error){if(!(error instanceof RuleViolation))throw error;}
 }
}

/** Player opt-in only; AI wonder contribution decisions are untouched. */
export function runWonderAutoSupply(w:FormalWorld,c:FormalCity,s:EventScheduler){
 const rule=c.logisticsSettings?.wonder;if(c.ownerFactionId!==w.playerFactionId||!rule?.enabled)return;
 const empire=empireOf(w,c.ownerFactionId),p=empire&&empireWonder(w,empire.id);
 if(p?.projectId!==rule.projectId||p.wonder?.phase!=='funding')return;
 const host=spatial(w).cities.get(p.initiatingCityId);if(!host||empireOf(w,host.ownerFactionId)?.id!==empire?.id)return;
 const free=logisticsAvailable(w,c,'wonder-auto');if(!free)return;
 settleCity(w,c);const reserve=logisticsReserve(c),remaining=wonderRemaining(p),available=Object.fromEntries(resourceKeys.map(r=>[r,Math.max(0,Math.min(remaining[r],c.stock[r]-reserve[r]))])) as Resources;
 let resources=fullCargo(available,free*2000);
 if(!resourceKeys.some(r=>resources[r])){
  // The exception is a whole final gap of a resource, never a partly stocked ordinary trip.
  resources=zeroResources();let capacity=free*2000;for(const r of resourceKeys)if(remaining[r]>0&&remaining[r]<2000&&available[r]===remaining[r]&&remaining[r]<=capacity){resources[r]=remaining[r];capacity-=resources[r];}
 }
 if(!resourceKeys.some(r=>resources[r]))return;
 const payload={type:'wonder.ship' as const,cityId:c.id,projectId:p.projectId,resources},o=automaticOrder(w,c,payload);
 try{applyWonderCommand(w,c,o,payload,s,'wonder-auto');recordAutomatic(w,o);}catch(error){if(!(error instanceof RuleViolation))throw error;}
}
