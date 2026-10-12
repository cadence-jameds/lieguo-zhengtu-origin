import type {FormalOrder,FormalWorld} from './formal/model';
import {buildingLevel} from './formal/catalogB3';

export type GovernanceBase={revision:number;fingerprint:string};
/** Compare only intent-relevant state; receipts prevent an ABA setting write. */
export function governanceBase(world:FormalWorld,cityId:string):GovernanceBase{
 const city=world.cities.find(c=>c.id===cityId),g=world.governors?.find(g=>g.cityId===cityId);
 let lastWrite:unknown=null,lastRevision=-1;
 for(const r of world.commandReceipts){if(r.disposition!=='applied'||r.committedRevision<=lastRevision)continue;try{const p=JSON.parse(r.fingerprint).payload;if(p?.type==='governance.set'&&p.cityId===cityId){lastWrite=[r.commandId,r.committedRevision];lastRevision=r.committedRevision;}}catch{lastWrite=[r.commandId,r.committedRevision,r.fingerprint];lastRevision=r.committedRevision;}}
 return {revision:world.revision,fingerprint:JSON.stringify([world.campaignId,world.playerFactionId,city?.ownerFactionId,city?buildingLevel(city,'townhall'):null,!!city?.economy,g?[g.ownerFactionId,g.enabled,g.policy,g.budget,g.reserve]:null,lastWrite])};
}
/** A UI snapshot carries a compare-and-set precondition for governance only.
 * This is one admission, never a retry loop; current rules still validate it. */
export function governanceWithBase(world:FormalWorld,order:FormalOrder,base?:GovernanceBase,branchRevision=0):FormalOrder{
 if(!base||order.payload.type!=='governance.set'||base.revision!==order.expectedRevision||!Number.isSafeInteger(base.revision)||base.revision<branchRevision||base.revision>=world.revision||order.campaignId!==world.campaignId||order.issuerId!==world.playerFactionId||!Number.isSafeInteger(order.issuedWorldTime)||order.issuedWorldTime<0||order.issuedWorldTime>world.time||world.commandReceipts.some(r=>r.commandId===order.commandId))return order;
 if(base.fingerprint!==governanceBase(world,order.payload.cityId).fingerprint)return order;
 return {...order,expectedRevision:world.revision,issuedWorldTime:world.time};
}

/** Only bridge events caught up inside this serialized command admission.
 * Already-stale orders never enter this path. Configuration writes (including
 * ABA changes) and lost qualification still require a fresh player decision.
 * The reducer and persistence retain their strict revision/CAS checks. */
export function governanceAfterCatchup(before:FormalWorld,after:FormalWorld,order:FormalOrder):FormalOrder{
 if(order.payload.type!=='governance.set'||order.expectedRevision!==before.revision||order.campaignId!==before.campaignId||before.campaignId!==after.campaignId||order.issuerId!==before.playerFactionId||after.playerFactionId!==before.playerFactionId||!Number.isSafeInteger(order.issuedWorldTime)||order.issuedWorldTime<0||order.issuedWorldTime>before.time||after.time<before.time||after.revision<=before.revision)return order;
 const cityId=order.payload.cityId,a=before.cities.find(c=>c.id===cityId),b=after.cities.find(c=>c.id===cityId);
 if(!a||!b||a.ownerFactionId!==order.issuerId||b.ownerFactionId!==order.issuerId||!a.economy||!b.economy||buildingLevel(a,'townhall')!==buildingLevel(b,'townhall'))return order;
 const config=(w:FormalWorld)=>{const g=w.governors?.find(g=>g.cityId===cityId);return g?[g.ownerFactionId,g.enabled,g.policy,g.budget,g.reserve]:null;};
 if(JSON.stringify(config(before))!==JSON.stringify(config(after)))return order;
 const prior=new Set(before.commandReceipts.map(r=>r.commandId));
 for(const receipt of after.commandReceipts){
  if(receipt.commandId===order.commandId)return order;
  if(prior.has(receipt.commandId)||receipt.disposition!=='applied')continue;
  try{const p=JSON.parse(receipt.fingerprint).payload;if(p?.type==='governance.set'&&p.cityId===cityId)return order;}catch{return order;}
 }
 return {...order,expectedRevision:after.revision,issuedWorldTime:after.time};
}
