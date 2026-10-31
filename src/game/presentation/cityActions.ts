import {buildingRequirements,boostFieldRequirementText} from '../formal/buildingDetailData';
import type {FormalCity,FormalWorld} from '../formal/model';
import {resourceKeys,zeroResources} from '../formal/model';
import {BUILDING_CATALOG,buildingKind,buildingLevel,buildingCost,buildingDuration,fieldCost,fieldDuration} from '../formal/catalogB3';
import {QUEUE_CAPACITY} from '../formal/economy';
import {AGE_NAMES,LABELS} from './artMap';
import {submitFormalOrder} from '../formal/reducer';
import {commandId} from '../formal/ids';
import {UNIT_CATALOG,ELITE_VARIANTS} from '../formal/unitCatalog';
import {unitRecruitCost,unitTrainingDuration} from '../formal/military';
import {modernUnitAuthorized} from '../formal/modernAwareness';
export const BUILDING_CATEGORIES=[
 {id:'civil',name:'民生',kinds:['residence','townhall','embassy','monastery']},
 {id:'economy',name:'經濟',kinds:['warehouse','bunker','market','mill','lumbermill','masonry','mint']},
 {id:'military',name:'軍事',kinds:['barracks','archery','stable','workshop','castle']},
 {id:'research',name:'科技',kinds:['academy','blacksmith']},
] as const;
export function availableBuildings(c:FormalCity,category:string){return BUILDING_CATEGORIES.find(cat=>cat.id===category)?.kinds.filter(kind=>kind==='warehouse'||kind==='bunker'||!Object.hasOwn(c.buildings,kind))??[];}
export const BUILDING_DESCRIPTIONS:Record<string,string>={wall:'環繞城市的固定防線，不占自由建築槽；升級提高守軍有效防禦。',center:'城邦的中心，等級提升能縮短其他建設工期。',residence:'為居民提供住房，讓城市有空間繼續成長。',warehouse:'增加每類資源的儲存容量，可在多塊空地建造。',bunker:'把物資藏入地底，提供各類資源的保護額度。',market:'提供商隊，讓自己的城市互相運送資源。',townhall:'整備城市行政，作為重要建築及城市晉升的前置。',embassy:'領主往來的場所；提供軍團、帝國與外交資格。',mill:'磨製穀物，提高本城農田的產量。',lumbermill:'加工木材，提高本城林地的產量。',masonry:'整備採石工藝，提高本城石場的產量。',mint:'集中冶煉鑄造，提高本城金礦的產量。',barracks:'招募徒步近戰部隊，是軍事建設的起點。',archery:'訓練遠程部隊，為前線提供射擊支援。',stable:'訓練騎兵，整備城邦的機動力量。',workshop:'製造攻城器械與輜重車。',castle:'生產本文明的衛隊與特殊非戰鬥拓殖隊。',blacksmith:'開啟軍事裝備研究，強化部隊。',academy:'研究科技，提升學院等級能縮短適用研究的時間。',monastery:'每級人口自然成長 +2%，並按本城實際人口產生信仰奉獻黃金。'};
export function newBuildingKey(c:FormalCity,kind:string){
 if(kind!=='warehouse'&&kind!=='bunker')return kind;
 return kind+'.'+Array.from({length:16},(_,i)=>i).find(i=>!Object.hasOwn(c.buildings,kind+'.'+i));
}
const previewCache=new WeakMap<FormalWorld,Map<string,unknown>>();
function cachedPreview<T>(w:FormalWorld,key:string,calculate:()=>T):T{let cache=previewCache.get(w);if(!cache){cache=new Map();previewCache.set(w,cache);}if(cache.has(key))return cache.get(key) as T;const result=calculate();cache.set(key,result);return result;}
/** Preview the actual Formal scheduler on a pure draft, without committing or writing a save. */
export function constructionPreview(w:FormalWorld,c:FormalCity,target:{key:string}|{field:number},slot?:number){
 return cachedPreview(w,JSON.stringify(['construction',c.id,target,slot]),()=>{
 const id=commandId('presentation-preview');
 const payload='field' in target?{type:'field.upgrade' as const,cityId:c.id,slot:target.field}:{type:'building.upgrade' as const,cityId:c.id,key:target.key,...(slot===undefined?{}:{slot})};
 const t=submitFormalOrder(w,{commandId:id,campaignId:w.campaignId,issuerId:c.ownerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload});
 return t.ack?.status==='committed'?t.world.cities.find(n=>n.id===c.id)?.economy?.construction.find(j=>j.commandId===id):undefined;
 });
}
/** Display-only eligibility. The Formal command always validates the same inputs again. */
export function constructionAction(w:FormalWorld,c:FormalCity,target:{key:string}|{field:number}){
 const reasons:string[]=[],e=c.economy!,center=buildingLevel(c,'center');
 if(e.construction.length>=QUEUE_CAPACITY)reasons.push(`已排滿 ${QUEUE_CAPACITY} 項工程`);
 if('field' in target){
  const field=c.fields!.find(f=>f.slot===target.field)!,next=Math.max(field.level,...e.construction.filter(j=>j.target.kind==='field'&&j.target.slot===field.slot).map(j=>j.toLevel))+1;
  if(next>15)return {next,cost:null,duration:0,reasons:['已滿級']};
  if(next>10&&(!e.milestones.includes(10000)||!c.cityPromotionCompleted||c.housing<10000))reasons.push('曾達人口10,000、City晉升完成且當下住房10,000');
  const cost=fieldCost(field.resource,next);for(const r of resourceKeys)if(c.stock[r]<cost[r])reasons.push(LABELS[r]+'不足');
  return {next,cost,duration:fieldDuration(field.resource,next,center),reasons};
 }
 if(e.construction.some(j=>j.action==='demolish'&&j.target.kind==='building'&&j.target.key===target.key))return {next:0,cost:null,duration:0,reasons:['此建築正在拆除']};
 const kind=buildingKind(target.key)! ,d=BUILDING_CATALOG[kind],next=Math.max(kind==='wall'?buildingLevel(c,'wall'):c.buildings[target.key]??0,...e.construction.filter(j=>j.target.kind==='building'&&j.target.key===target.key).map(j=>j.toLevel))+1;
 if(next>d.maxLevel)return {next,cost:null,duration:0,reasons:['已滿級']};
 for(const r of buildingRequirements(w,c,kind,next))if(!r.met)reasons.push(r.kind==='age'?AGE_NAMES[+r.required]+'時代':r.kind==='field'?boostFieldRequirementText(r):LABELS[r.id]+' Lv'+r.required);
 if(kind!=='center'&&kind!=='wall'&&e.slots[target.key]===undefined&&Object.keys(e.slots).length>=15)reasons.push('15塊空地已使用');
 const cost=buildingCost(kind,next);for(const r of resourceKeys)if(c.stock[r]<cost[r])reasons.push(LABELS[r]+'不足');
 return {next,cost,duration:buildingDuration(kind,next,center),reasons};
}

/** Read-only UI arithmetic; the Worker remains the sole recruitment authority. */
export function recruitmentConditions(w:FormalWorld,c:FormalCity,unitId:string,count:number){
 const f=w.factions.find(f=>f.id===c.ownerFactionId)!,base=UNIT_CATALOG[unitId],elite=ELITE_VARIANTS[unitId]&&UNIT_CATALOG[ELITE_VARIANTS[unitId]];
 const d=elite&&f.techIds.includes(elite.eliteTech!)&&c.economy?.milestones.includes(elite.milestone)?elite:base;
 const unitCost=unitRecruitCost(w,c,d),cost={...unitCost},valid=Number.isSafeInteger(count)&&count>=1&&count<=100000,reasons:string[]=[];
 for(const r of resourceKeys)cost[r]*=valid?count:1;
 if(d.era==='modern'&&!modernUnitAuthorized(f,d.id))reasons.push('需要完整現代軍事資格或此線逆向工程');
 if(d.era!=='modern'&&(f.age??0)<d.age)reasons.push(AGE_NAMES[d.age]+'時代');
 if(buildingLevel(c,d.producer)<1)reasons.push('需要'+LABELS[d.producer]);
 if(d.civilizationId&&d.civilizationId!==(c.castleCivilizationId??f.civilizationId))reasons.push('此城堡無外文明生產資格');
 if(d.eliteTech&&(!f.techIds.includes(d.eliteTech)||!c.economy?.milestones.includes(d.milestone)))reasons.push('本城尚未取得精銳生產資格');
 if((c.military?.queue.length??0)>=QUEUE_CAPACITY)reasons.push('訓練佇列已滿');
 if(!valid)reasons.push('請輸入1～100000名');
 if(c.population<d.population*count)reasons.push('居民不足');
 if(c.population>c.housing)reasons.push('住房不足');
 if(resourceKeys.some(r=>!Number.isSafeInteger(cost[r])||c.stock[r]<cost[r]))reasons.push('資源不足');
 return {d,unitCost,cost,reasons,population:d.population*count,durationMs:unitTrainingDuration(w,c,d)};
}
/** At most five local jobs; no command simulation, world clone, schema parse or mutation. */
export function recruitmentPreview(w:FormalWorld,c:FormalCity,unitId:string,count:number){
 const info=recruitmentConditions(w,c,unitId,count);if(info.reasons.length)return undefined;
 const queue=c.military?.queue??[],end=(lane:number)=>Math.max(w.time,...queue.filter(j=>j.lane===lane).map(j=>j.nextAt+(j.remaining-1)*j.durationMs));
 const lane=c.economy?.milestones.includes(20000)&&end(1)<end(0)?1:0,startsAt=end(lane),durationMs=info.durationMs;
 if(!Number.isSafeInteger(startsAt+durationMs*count))return undefined;
 return {remaining:count,lane,startsAt,nextAt:startsAt+durationMs,durationMs};
}

/** The real craftsman command on a private draft: ordinary castle payment is irrelevant. */
export function craftsmanCastleAction(w:FormalWorld,c:FormalCity,craftsmanId:string){
 return cachedPreview(w,JSON.stringify(['craftsman.castle',c.id,craftsmanId]),()=>{
  const id=commandId('presentation-craftsman-preview');
  const result=submitFormalOrder(w,{commandId:id,campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'craftsman.castle',cityId:c.id,craftsmanId}});
  const job=result.ack?.status==='committed'?result.world.cities.find(city=>city.id===c.id)?.economy?.construction.find(job=>job.commandId===id):undefined;
  return {allowed:!!job,cost:job?.paidResources??zeroResources(),duration:job?.durationMs??buildingDuration('castle',1,buildingLevel(c,'center')),reason:job?'符合工匠建堡資格':result.ack?.reason??'工匠建堡資格已變更，請重新確認。'};
 });
}
