/** Shared Formal construction admission and time/payment snapshots. No world, history or I/O. */
import type {Construction,FormalCity,EconomyCommand} from './model';
import {resourceKeys,zeroResources} from './model';
import type {Resources} from './model';
import {BUILDING_CATALOG,buildingCost,buildingDuration,buildingKind,buildingLevel,fieldCost,fieldDuration} from './catalogB3';
import {constructionRequirements} from './buildingDetailData';
import {QUEUE_CAPACITY} from './queueCapacity';
import {requireRule} from './ruleViolation';
export type BuildPayload=Extract<EconomyCommand,{type:'field.upgrade'|'building.upgrade'}>;
export function quoteConstruction(time:number,c:FormalCity,age:number,p:BuildPayload,craft?:{authorized:boolean}){
 requireRule(c.economy,'此操作需要正式城市經濟。');const e=c.economy;
 requireRule(e.construction.length<QUEUE_CAPACITY,`建造工程已達 ${QUEUE_CAPACITY} 項上限。`);
 let lane=p.lane;requireRule(lane!==1||e.milestones.includes(15000),'尚未取得第二施工佇列。');
 const previous=e.construction.filter(j=>p.type==='field.upgrade'?j.target.kind==='field'&&j.target.slot===p.slot:j.target.kind==='building'&&j.target.key===p.key);
 requireRule(!previous.some(j=>j.action==='demolish'),'此建築正在拆除，不能排入升級。');
 if(previous.length)lane=previous.at(-1)!.lane;
 if(lane===undefined){const end=(l:number)=>Math.max(time,...e.construction.filter(j=>j.lane===l).map(j=>j.startsAt+j.durationMs));lane=e.milestones.includes(15000)&&end(1)<end(0)?1:0;}
 let allocatedSlot:number|undefined;
 let target:Construction['target'],fromLevel:number,durationMs:number,paidResources:Resources;
 if(p.type==='field.upgrade'){
  const field=c.fields?.find(f=>f.slot===p.slot);requireRule(field,'資源田不存在。');fromLevel=previous.at(-1)?.toLevel??field.level;requireRule(fromLevel<15,'資源田已滿級。');
  if(fromLevel>=10)requireRule(e.milestones.includes(10000)&&c.cityPromotionCompleted&&c.housing>=10000,'高階資源田需要永久人口／City 資格與當下住房。');
  paidResources=fieldCost(field.resource,fromLevel+1);requireRule(resourceKeys.every(r=>Number.isSafeInteger(paidResources[r])&&paidResources[r]>=0&&c.stock[r]>=paidResources[r]),'城市實際庫存不足。');durationMs=fieldDuration(field.resource,fromLevel+1,buildingLevel(c,'center'));target={kind:'field',slot:p.slot};
 }else{
  const kind=buildingKind(p.key);requireRule(kind,'建築種類或 identity 無效。');const d=BUILDING_CATALOG[kind];fromLevel=previous.at(-1)?.toLevel??(kind==='wall'?buildingLevel(c,'wall'):c.buildings[p.key]??0);requireRule(fromLevel<d.maxLevel,'建築已滿級。');
  if(kind==='wall')requireRule(p.slot===undefined,'城牆為固定設施，不使用一般建築槽。');
  for(const requirement of constructionRequirements(c,kind,fromLevel+1,age))requireRule(requirement.met,'建築前置未達成：'+requirement.id);
  if(kind!=='center'&&kind!=='wall'&&e.slots[p.key]===undefined){const slot=p.slot??Array.from({length:15},(_,i)=>i).find(i=>!Object.values(e.slots).includes(i));requireRule(slot!==undefined&&!Object.values(e.slots).includes(slot),'自由建築槽已滿或該位置已使用。');allocatedSlot=slot;}
  const craftOrder=craft;
  if(craftOrder)requireRule(kind==='castle'&&fromLevel===0&&craftOrder.authorized,'工匠城堡授權已失效。');
  // The original validated command, never a public building payload flag, authorizes Lv1 only.
  paidResources=craftOrder?zeroResources():buildingCost(kind,fromLevel+1);requireRule(resourceKeys.every(r=>Number.isSafeInteger(paidResources[r])&&paidResources[r]>=0&&c.stock[r]>=paidResources[r]),'城市實際庫存不足。');durationMs=buildingDuration(kind,fromLevel+1,buildingLevel(c,'center'));target={kind:'building',key:p.key};
 }
 const laneJobs=e.construction.filter(j=>j.lane===lane),startsAt=Math.max(time,...laneJobs.map(j=>j.startsAt+j.durationMs),...previous.map(j=>j.startsAt+j.durationMs));
 return {lane,lanePreference:p.lane,target,fromLevel,toLevel:fromLevel+1,createdAt:time,startsAt,durationMs,qualificationHousing:c.housing,paidResources,allocatedSlot};
}

/** Operates only on the caller's private city draft. Returns changed snapshots for Formal event rescheduling. */
export function promoteConstructionJobs(time:number,c:FormalCity){
 const build=c.economy?.construction??[],changed:Construction[]=[];
 if(c.economy?.milestones.includes(15000)){
  const ends=[0,1].map(l=>Math.max(time,...build.filter(j=>j.lane===l&&j.startsAt<=time).map(j=>j.startsAt+j.durationMs)));
  for(let i=0;i<build.length;i++){
   const j=build[i];if(j.startsAt<=time)continue;
   const previous=build.slice(0,i).filter(q=>q.target.kind===j.target.kind&&(q.target.kind==='field'?j.target.kind==='field'&&q.target.slot===j.target.slot:j.target.kind==='building'&&q.target.key===j.target.key)).at(-1);
   const lane=previous?.lane??j.lanePreference??(ends[1]<ends[0]?1:0),startsAt=Math.max(time,ends[lane],previous?previous.startsAt+previous.durationMs:0);
   if(j.startsAt!==startsAt||j.lane!==lane){j.startsAt=startsAt;j.lane=lane;changed.push(j);}
   ends[lane]=startsAt+j.durationMs;
  }
 }
 return changed;
}

export function requireCraftsmanCastle(c:FormalCity,authorized:boolean){
 requireRule(authorized,'工匠團不在此城待命。');
 requireRule(!Object.keys(c.buildings).some(k=>k==='castle'||k.startsWith('castle.'))&&!c.economy?.construction.some(j=>j.target.kind==='building'&&j.target.key==='castle'),'每城只可建一座城堡。');
}
