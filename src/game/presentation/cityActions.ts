import {buildingRequirements} from '../formal/buildingDetailData';
import type {FormalCity,FormalWorld} from '../formal/model';
import {resourceKeys,zeroResources} from '../formal/model';
import {BUILDING_CATALOG,buildingKind,buildingLevel,buildingCost,buildingDuration,fieldCost,fieldDuration} from '../formal/catalogB3';
import {QUEUE_CAPACITY} from '../formal/economy';
import {AGE_NAMES,LABELS} from './artMap';
import {submitFormalOrder} from '../formal/reducer';
import {commandId} from '../formal/ids';
export const BUILDING_CATEGORIES=[
 {id:'civil',name:'民生',kinds:['residence','townhall','embassy','monastery']},
 {id:'economy',name:'經濟',kinds:['warehouse','bunker','market','mill','lumbermill','masonry','mint']},
 {id:'military',name:'軍事',kinds:['barracks','archery','stable','workshop','castle']},
 {id:'research',name:'科技',kinds:['academy','blacksmith']},
] as const;
export function availableBuildings(c:FormalCity,category:string){return BUILDING_CATEGORIES.find(cat=>cat.id===category)?.kinds.filter(kind=>kind==='warehouse'||kind==='bunker'||!Object.hasOwn(c.buildings,kind))??[];}
export const BUILDING_DESCRIPTIONS:Record<string,string>={wall:'環繞城市的固定防線，不占自由建築槽；升級提高守軍有效防禦。',center:'城邦的中心，等級提升能縮短其他建設工期。',residence:'為居民提供住房，讓城市有空間繼續成長。',warehouse:'增加每類資源的儲存容量，可在多塊空地建造。',bunker:'把物資藏入地底，提供各類資源的保護額度。',market:'提供商隊，讓自己的城市互相運送資源。',townhall:'整備城市行政，作為重要建築及城市晉升的前置。',embassy:'領主往來的場所；軍團與外交功能將於後續開放。',mill:'磨製穀物，提高本城農田的產量。',lumbermill:'加工木材，提高本城林地的產量。',masonry:'整備採石工藝，提高本城石場的產量。',mint:'集中冶煉鑄造，提高本城金礦的產量。',barracks:'招募徒步近戰部隊，是軍事建設的起點。',archery:'訓練遠程部隊，為前線提供射擊支援。',stable:'訓練騎兵，整備城邦的機動力量。',workshop:'製造攻城器械與輜重車。',castle:'生產本文明的衛隊與特殊非戰鬥拓殖隊。',blacksmith:'開啟軍事裝備研究，強化部隊。',academy:'研究科技，提升學院等級能縮短適用研究的時間。',monastery:'支持居民自然成長，讓城邦逐漸繁盛。'};
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
 if(e.construction.length>=QUEUE_CAPACITY)reasons.push('已排滿3項工程');
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
 for(const r of buildingRequirements(w,c,kind,next))if(!r.met)reasons.push(r.kind==='age'?AGE_NAMES[+r.required]+'時代':r.kind==='field'?(next===1?'至少一座對應資源田Lv'+r.required:'對應資源田平均等級 '+r.required):LABELS[r.id]+' Lv'+r.required);
 if(kind!=='center'&&kind!=='wall'&&e.slots[target.key]===undefined&&Object.keys(e.slots).length>=15)reasons.push('15塊空地已使用');
 const cost=buildingCost(kind,next);for(const r of resourceKeys)if(c.stock[r]<cost[r])reasons.push(LABELS[r]+'不足');
 return {next,cost,duration:buildingDuration(kind,next,center),reasons};
}

/** Actual recruitment scheduler preview on a draft, including the chosen training lane. */
export function recruitmentPreview(w:FormalWorld,c:FormalCity,unitId:string,count:number){
 return cachedPreview(w,JSON.stringify(['recruitment',c.id,unitId,count]),()=>{
 const id=commandId('presentation-recruit-preview');
 const t=submitFormalOrder(w,{commandId:id,campaignId:w.campaignId,issuerId:c.ownerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'military.recruit',cityId:c.id,unitId,count}});
 return t.ack?.status==='committed'?t.world.cities.find(n=>n.id===c.id)?.military?.queue.find(j=>j.commandId===id):undefined;
 });
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
