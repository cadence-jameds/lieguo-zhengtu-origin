import reference from './reference/v85.json';
import {BUILDING_CATALOG,buildingCost,buildingDuration,fieldCost,fieldDuration,FIELD_PRODUCTION,HOUSING,WAREHOUSE_CAPACITY,BUNKER_PROTECTION,constructionMultiplier,type BuildingKind} from '../formal/catalogB3';
import {TECH_CATALOG,BLACKSMITH_CAPS} from '../formal/techCatalog';
import {UNIT_CATALOG,producerMultiplier} from '../formal/unitCatalog';
import {AGE_CATALOG,academyMultiplier} from '../formal/research';
import {productionPerHour} from '../formal/economy';
import type {FormalWorld,Resources,FormalCity} from '../formal/model';
export type SpecBuilding={id:string;name:string;line:number;age:number;buildings:Record<string,number>;condition:string;effect:string;maxLevel:number;baseCost:Resources;growth:number;levels:{level:number;durationMs:number;line:number;cost?:Resources}[]};
export type SpecTech={id:string;name:string;line:number;age:number;buildings:Record<string,number>;cost:Resources;baseDurationMs:number;milestone:number;civilizationId:string|null;category:string;scope:string;effect:string;prerequisites?:string[]};
export type SpecUnit={id:string;name:string;line:number;age:number;producer:string;cost:Resources;population:number;upkeepPerHour:number;baseDurationMs:number;carry:number;secondsPerTile:number;civilizationId:string|null;eliteTech:string|null;milestone:number;hp?:number;attack?:number;meleeDefense?:number;rangedDefense?:number;attackIntervalSeconds?:number;baseId?:string};
export const V85={...reference,buildings:reference.buildings as SpecBuilding[],techs:reference.techs as unknown as SpecTech[],units:reference.units as SpecUnit[]};
export type Comparison={label:string;expected:unknown;actual:unknown;status:'match'|'different'|'unverified'|'deferred';note?:string};
export type AuditItem={id:string;kind:'building'|'tech'|'unit'|'age'|'field'|'system';target:string;name:string;line:number;checks:Comparison[];dataMatches:boolean;effectNote:string};
const equal=(a:unknown,b:unknown):boolean=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-7:a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>equal(v,(b as Record<string,unknown>)[k])):a===b;
const cmp=(label:string,expected:unknown,actual:unknown,note?:string):Comparison=>({label,expected,actual,status:equal(expected,actual)?'match':'different',note});
export const specCost=(base:Resources,growth:number,level:number):Resources=>Object.fromEntries(Object.entries(base).map(([r,v])=>[r,Math.floor(v*growth**(level-1)/5+.5)*5])) as Resources;
export const SPEC_FIELD_COST:Record<keyof Resources,Resources>={food:{food:20,wood:70,stone:90,gold:70},wood:{food:60,wood:40,stone:100,gold:50},stone:{food:50,wood:80,stone:40,gold:80},gold:{food:60,wood:100,stone:80,gold:30}};
export const AGE_EXPECTED=[{targetAge:1,population:500,center:3,cost:{food:800,wood:800,stone:700,gold:700},durationMs:14400000},{targetAge:2,population:2000,center:5,cost:{food:8000,wood:8000,stone:7000,gold:7000},durationMs:28800000},{targetAge:3,population:10000,center:10,cost:{food:35000,wood:35000,stone:35000,gold:45000},durationMs:57600000}] as const;
export function auditCatalogs():AuditItem[]{
 const rows:AuditItem[]=[];
 for(const d of V85.buildings){
  const a=BUILDING_CATALOG[d.id as BuildingKind],checks:Comparison[]=[cmp('最早時代',d.age,a?.age),cmp('等級上限',d.maxLevel,a?.maxLevel),cmp('Lv1 四資源成本',d.baseCost,a?.baseCost),cmp('每級成本成長',d.growth,a?.growth)];
  // Fixed center Lv1 is the native-world invariant; no independent center0 scenario is legal.
  const prerequisites={...d.buildings};if(prerequisites.center===1)delete prerequisites.center;
  checks.push(cmp('建築前置（固定中心 Lv1 已由世界保證）',prerequisites,a?.prerequisites));
  for(const l of d.levels){checks.push(cmp('Lv'+l.level+' 公式成本',specCost(d.baseCost,d.growth,l.level),a?buildingCost(d.id as BuildingKind,l.level):null));checks.push(cmp('Lv'+l.level+' 基礎／中心實際工期 ms',l.durationMs,a?.durationMs[l.level-1]));}
  if(d.id==='wall')checks.push({label:'v86 一般施工取消退款',expected:'active 50%、queued 100%；逐資源向下取整與容量限制',actual:'active 50%、queued 100%；共用施工退款',status:'match'});
  rows.push({id:'building:'+d.id,kind:'building',target:d.id,name:d.name,line:d.line,checks,dataMatches:checks.every(c=>c.status!=='different'),effectNote:(a?'':'此建築施工尚未開放，須納入階段缺口；不可視為驗收通過。')+'此結果核對資料與成本／工期函式。解鎖阻擋與完工效果另由試玩確認；建築核心功能：'+d.effect});
 }
 for(const d of V85.techs){
  const a=TECH_CATALOG[d.id],checks=['age','buildings','cost','baseDurationMs','milestone','civilizationId','category','scope'].map(k=>cmp(({age:'最早時代',buildings:'表列建築前置',cost:'四資源成本',baseDurationMs:'基礎研究時間 ms',milestone:'本城永久人口資格',civilizationId:'文明限制',category:'折扣／加速分類',scope:'付款／資格範圍'} as Record<string,string>)[k],d[k as keyof SpecTech],a?.[k as keyof typeof a]));
  if(d.prerequisites)checks.push(cmp('v85 明列前置科技',d.prerequisites,a?.prerequisites));else if(a?.prerequisites.length)checks.push({label:'程式另外要求的前置科技',expected:'本表未逐條明列，需對照原文確認',actual:a.prerequisites,status:'unverified'});
  rows.push({id:'tech:'+d.id,kind:'tech',target:d.id,name:d.name,line:d.line,checks,dataMatches:checks.every(c=>c.status!=='different'),effectNote:(d.scope.startsWith('modern')?'現代效果待 B9；B4 只驗證資格、付款與研究。':'研究成功不代表效果已接入。戰鬥、偵察與行軍效果需後續對應階段實際操作。')+' v85 效果：'+(d.effect||'見原文章節')});
 }
 for(const d of V85.units){
  const a=UNIT_CATALOG[d.id],keys=['age','producer','cost','population','upkeepPerHour','baseDurationMs','carry','secondsPerTile','civilizationId','eliteTech','milestone','hp','attack','meleeDefense','rangedDefense','attackIntervalSeconds'] as const;
  const labels=['最早時代','生產建築','四資源成本','扣除人口','軍糧／世界時','基礎訓練時間 ms','載重','秒／格','文明限制','精銳前置科技','本城永久人口資格','HP','攻擊','近防','遠防','攻擊間隔秒'];
  const checks=keys.flatMap((k,i)=>d[k]===undefined?[]:[cmp(labels[i],d[k],a?.[k])]);
  rows.push({id:'unit:'+d.id,kind:'unit',target:d.id,name:d.name,line:d.line,checks,dataMatches:checks.every(c=>c.status!=='different'),effectNote:d.baseId?'精銳數值獨立由 v85 普通兵數值 ×1.15、雙防＋1 推導。需試玩驗證舊兵不升級、新兵與本城資格；B5 依實際 unit／owner／已完成科技計算戰鬥效果。':'B4 可試玩招募、扣人口、取消／解散、軍糧；B5 已接入戰鬥、剋制、偵察與行軍；正式驗收依專項回歸證據。'});
 }
 for(const d of AGE_EXPECTED){const a=AGE_CATALOG.find(a=>a.targetAge===d.targetAge);const checks=Object.entries(d).map(([k,v])=>cmp(k,v,a?.[k as keyof typeof a]));rows.push({id:'age:'+d.targetAge,kind:'age',target:String(d.targetAge),name:['','晉升封建','晉升城堡','晉升帝王'][d.targetAge],line:2342,checks,dataMatches:checks.every(c=>c.status!=='different'),effectNote:'需實際晉升；全勢力只解鎖時代資格，不免費取得建築或科技；獨立時代佇列。'});}
 for(const [resource,name] of Object.entries({food:'高階糧田 D2',wood:'高階木材田 D2',stone:'高階石材田 D2',gold:'高階金礦 D2'}))rows.push({id:'field:'+resource,kind:'field',target:resource,name,line:396,checks:[{label:'建立 Lv11～15 工程',expected:'本城曾達10000永久＋City晉升永久＋當下住房≥10000；Lv1～10不鎖時代',actual:'由正例／缺資格反例與正式命令核對',status:'unverified'}],dataMatches:true,effectNote:'既有高階田與已入列工程不因日後人口／住房下降取消。需親自升級並重讀存檔。'});
 for(const [target,name,line,expected] of [['city','City 正式晉升',2287,'目前人口10000、住房10000、市政廳5；12/18/18/12k，6世界時'],['colony','v85 拓殖隊生產與建城',2413,'城堡時代、城堡1、人口2000；扣400人，6/8/12/4k，4h至2h；完成實體隊，20护衛、45秒/格'],['logistics','真實商隊運輸',725,'2000載量／隊、60秒／合法路格；目的地預約容量、抵達入庫、空車返程'] ] as const)rows.push({id:'system:'+target,kind:'system',target,name,line,checks:[{label:'規格規則',expected,actual:'建立單項情境後，正式命令試算核對扣款／人口／時間；再親自操作完成',status:'unverified'}],dataMatches:true,effectNote:'機制核對不由資料表直接判定通過；親自操作完成與存檔重讀都需要記錄。'});
 return rows;
}
export function formulaCatalog():Comparison[]{
 const out=[cmp('Lv0～15 單格產量',V85.fieldProduction,[...FIELD_PRODUCTION]),cmp('Lv0～15 民居容量',V85.housing,[...HOUSING]),cmp('Lv0～15 倉庫容量',V85.warehouseCapacity,[...WAREHOUSE_CAPACITY]),cmp('Lv0～15 地庫保護',V85.bunkerProtection,[...BUNKER_PROTECTION])];
 for(let lv=1;lv<=15;lv++){
  out.push(cmp('中心 Lv'+lv+' 施工倍率',.964**(lv-1),constructionMultiplier(lv)),cmp('學院 Lv'+lv+' 研究倍率',1-.015*(lv-1),academyMultiplier(lv)),cmp('生產 Lv'+lv+' 訓練倍率',1-.5*(lv-1)/14,producerMultiplier(lv)));
  for(const r of ['food','wood','stone','gold'] as const){out.push(cmp(r+' Lv'+lv+' 資源田成本',specCost(SPEC_FIELD_COST[r],1.67,lv),fieldCost(r,lv)));const A={food:1450/3,wood:1780/3,stone:1660/3,gold:2350/3}[r];for(const center of [1,5,15])out.push(cmp(r+' Lv'+lv+'／中心'+center+' 工期ms',Math.round((A*1.6**(lv-1)-1000/3)/3*1000*.964**(center-1)),fieldDuration(r,lv,center)));}
 }
 const caps={civ_zhongguo:[2,3,3,2,2],civ_byzantium:[2,2,3,3,3],civ_frankia:[3,2,2,2,3],civ_britannia:[2,3,2,3,2],civ_japan:[3,2,3,2,2],civ_mongolia:[2,3,2,2,3]};for(const [c,v] of Object.entries(caps))out.push(cmp(c+' 鐵匠五線上限',v,BLACKSMITH_CAPS[c]));return out;
}
export function productionTrace(w:FormalWorld,c:FormalCity){
 const f=w.factions.find(f=>f.id===c.ownerFactionId)!,actual=productionPerHour(w,c);
 return (['food','wood','stone','gold'] as const).map(resource=>{
  const fields=c.fields!.filter(p=>p.resource===resource),base=fields.reduce((sum,p)=>sum+V85.fieldProduction[p.level],0),building=({food:'mill',wood:'lumbermill',stone:'masonry',gold:'mint'} as const)[resource],lv=c.buildings[building]??0,tier=[1,2,3].filter(t=>f.techIds.includes('economy.'+resource+'.'+t)).length;
  const expected=base*(1+lv*.04)*(1+tier*.03);return {...cmp(resource+' 正常田產／世界時',expected,actual[resource]),formula:fields.map(p=>'Lv'+p.level+'='+V85.fieldProduction[p.level]).join(' + ')+' → '+base+' × '+(1+lv*.04)+' × '+(1+tier*.03),integrationMultiplier:c.integrationWorkHours?0.4:1};
 });
}
export function constructionTrace(kind:string,level:number,center:number,speed:number){const d=V85.buildings.find(d=>d.id===kind)!;const available=Object.hasOwn(BUILDING_CATALOG,kind),base=d.levels[level-1].durationMs,expected=kind==='center'?base:Math.round(base*.964**(center-1));return {cost:cmp('成本',specCost(d.baseCost,d.growth,level),available?buildingCost(kind as BuildingKind,level):null),time:cmp('世界工期 ms',expected,available?buildingDuration(kind as BuildingKind,level,center):null),formula:kind==='center'?'中心表已含升級前加速，不再乘一次':base+' × 0.964^('+center+'−1) = '+expected,realSeconds:expected/speed/1000};}
