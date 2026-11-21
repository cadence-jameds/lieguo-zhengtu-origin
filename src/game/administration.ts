import type {PresentationWorld,WorldRead} from './presentationModel';
import type {CityId} from './formal/ids';
import type {CommandAck,FormalCity} from './formal/model';
import {resourceKeys} from './formal/model';
import {buildingLevel,storageCapacity} from './formal/catalogB3';
import {GOVERNANCE_POLICIES,type GovernanceCommand,type GovernancePolicy} from './formal/governance';
import {governanceBase,type GovernanceBase} from './governanceAdmission';

export const ADMIN_COORDINATION='administration.coordination', TERRITORY_REGISTER='administration.register';
export const ADMIN_POLICY_LABELS={balanced:'均衡',economy:'經濟',population:'人口',military:'軍事',reserve:'資源儲備'};
export const GOVERNANCE_BATCH_LIMIT=20, GOVERNANCE_TEMPLATE_LIMIT=8;
export type GovernanceTemplate={name:string;policy:GovernancePolicy;budget:number;reserve:number};
export function hasAdministration(w:WorldRead,id:string){
 return !!w.factions.find(f=>f.id===w.playerFactionId)?.techIds.includes(id);
}
export function isGovernanceTemplate(v:unknown):v is GovernanceTemplate{
 if(!v||typeof v!=='object')return false;
 const t=v as GovernanceTemplate;
 return typeof t.name==='string'&&t.name.trim().length>0&&t.name.trim().length<=24&&GOVERNANCE_POLICIES.includes(t.policy)&&
  Number.isSafeInteger(t.budget)&&t.budget>=0&&Number.isSafeInteger(t.reserve)&&t.reserve>=0;
}
export function getTemplates(storage:Storage,key:string):GovernanceTemplate[]{
 try{const values:unknown=JSON.parse(storage.getItem(key)??'[]');return Array.isArray(values)?values.filter(isGovernanceTemplate).slice(0,GOVERNANCE_TEMPLATE_LIMIT):[];}catch{return[];}
}
export const templateKey=(w:WorldRead)=>'governance-templates-v1:'+w.campaignId+':'+w.playerFactionId;
export function governanceCityEligible(w:WorldRead,c:FormalCity){return c.ownerFactionId===w.playerFactionId&&!!c.economy&&buildingLevel(c,'townhall')>=1;}
export function governanceEligible(w:WorldRead,id:CityId){
 const c=w.cities.find(c=>c.id===id);return !!c&&governanceCityEligible(w,c);
}
export function batchGovernancePlan(w:PresentationWorld,cityIds:CityId[],t:GovernanceTemplate){
 if(!hasAdministration(w,ADMIN_COORDINATION)||!isGovernanceTemplate(t)||cityIds.length<1||cityIds.length>GOVERNANCE_BATCH_LIMIT||new Set(cityIds).size!==cityIds.length)
  throw Error('需要完成行政統籌，並選擇 1 至 20 座不同城市。');
 const targets=cityIds.map(id=>{
  if(!governanceEligible(w,id))throw Error('所選城市包含未達市政廳條件或非自有的城市。');
  const gov=w.governors?.find(g=>g.cityId===id&&g.ownerFactionId===w.playerFactionId);
  return {payload:{type:'governance.set',cityId:id,enabled:!!gov?.enabled,policy:t.policy,budget:t.budget,reserve:t.reserve} satisfies GovernanceCommand,
   reviewed:governanceBase(w,id).fingerprint};
 });
 return {context:context(w),targets};
}
export const context=(w:PresentationWorld)=>[w.campaignId,w.playerFactionId,w.projection.branch,w.projection.writerEpoch,w.projection.sessionId].join('/');
export type GovernanceBatchPlan=ReturnType<typeof batchGovernancePlan>;
export type GovernanceBatchResult={status:'applied'|'changed'|'uncertain'|'failed'|'unsent';cityId:CityId};
interface BatchAdapter{
 world:()=>PresentationWorld|null;
 send:(p:GovernanceCommand,base:GovernanceBase)=>Promise<CommandAck|undefined>;
 waitProjection:(revision:number)=>Promise<boolean>;
}
/** One click, serialized standard commands. Compare each city's reviewed intent,
 * then use its live revision. No pending command is issued a different identity. */
export async function runGovernanceBatch(plan:GovernanceBatchPlan,adapter:BatchAdapter):Promise<GovernanceBatchResult[]>{
 const results:GovernanceBatchResult[]=[];
 let stop=false;
 for(const {payload,reviewed} of plan.targets){
  const cityId=payload.cityId,w=adapter.world();
  if(stop||!w||context(w)!==plan.context||!hasAdministration(w,ADMIN_COORDINATION)){stop=true;results.push({cityId,status:'unsent'});continue;}
  if(!governanceEligible(w,cityId)){results.push({cityId,status:'changed'});continue;}
  const base=governanceBase(w,cityId);
  if(base.fingerprint!==reviewed){results.push({cityId,status:'changed'});continue;}
  const ack=await adapter.send(payload,base);
  if(!ack){stop=true;results.push({cityId,status:'uncertain'});continue;}
  if(ack.status!=='committed'&&ack.status!=='duplicate'){stop=true;results.push({cityId,status:ack.requiresConfirmation?'changed':'failed'});continue;}
  results.push({cityId,status:'applied'});
  if(!await adapter.waitProjection(ack.revision))stop=true;
 }
 return results;
}
export const RESOURCE_LABELS={food:'糧食',wood:'木材',stone:'石材',gold:'黃金'};
export function registerAlerts(w:WorldRead,minStockOverride?:number){
 if(!hasAdministration(w,TERRITORY_REGISTER))return [];
 const governors=new Map(w.governors?.filter(g=>g.ownerFactionId===w.playerFactionId).map(g=>[g.cityId,g]));
 return w.cities.filter(c=>c.ownerFactionId===w.playerFactionId).map(c=>{
  const minimum=Number.isSafeInteger(minStockOverride)&&minStockOverride!>=0?minStockOverride!:governors.get(c.id)?.reserve??180,capacity=storageCapacity(c);
  const low=resourceKeys.filter(k=>c.stock[k]<minimum);
  const full=resourceKeys.filter(k=>c.stock[k]+(c.economy?.reservedIncoming[k]??0)>=capacity*.9);
  const idle=[...(c.economy&&!c.economy.construction.length&&!c.economy.promotion?['建造']:[]),...(c.military&&!c.military.queue.length?['訓練']:[])];
  return {cityId:c.id,name:c.name,minimum,low,full,idle,housing:c.housing>0&&c.population>=c.housing*.9};
 });
}
