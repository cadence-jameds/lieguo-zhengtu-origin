import {TECH_CATALOG} from '../formal/techCatalog';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import type {FormalCity,FormalWorld,Construction} from '../formal/model';
/** Visual aliases never change formal IDs or enter a save. */
export const CIV_ART:Record<string,string>={civ_zhongguo:'civ_zhongguo',civ_byzantium:'civ_byzantion',civ_frankia:'civ_frankia',civ_britannia:'civ_britannia',civ_japan:'civ_japan',civ_mongolia:'civ_mongol'};
export const CIV_NAMES:Record<string,string>={civ_zhongguo:'中國',civ_byzantium:'拜占庭',civ_frankia:'法蘭克',civ_britannia:'不列顛',civ_japan:'日本',civ_mongolia:'蒙古'};
export const CIV_ORDER=Object.keys(CIV_ART);
export function civilizationArt(id:string){const a=CIV_ART[id];if(!a)throw new Error('Unknown formal civilization: '+id);return a;}
export function civilizationIndex(id:string){civilizationArt(id);return CIV_ORDER.indexOf(id);}
export const visualAge=(age:number):0|1|2=>age<=0?0:age===1?1:2;
/** Permanent City promotion art is independent of faction era/population. */
export const cityArtAge=(w:FormalWorld,c:FormalCity):0|1|2=>c.cityPromotionCompleted?2:visualAge(w.factions.find(f=>f.id===c.ownerFactionId)?.age??0);
export const AGE_NAMES=['黑暗','封建','城堡','帝王'];
export const BUILDING_ALIAS:Record<string,string>={wall:'wall',center:'hall',residence:'house',warehouse:'warehouse',bunker:'cellar',market:'market',barracks:'barracks',archery:'range',stable:'stable',academy:'academy',workshop:'workshop',castle:'castle'};
export const NEW_BUILDINGS=['townhall','monastery','mill','lumbermill','masonry','mint','blacksmith','embassy'] as const;
export const LABELS:Record<string,string>={wall:'城牆',food:'穀',wood:'木',stone:'石',gold:'金',bandit:'盜賊',center:'城市中心',residence:'民居',warehouse:'倉庫',bunker:'地庫',market:'市場',townhall:'市政廳',monastery:'修道院',mill:'磨坊',lumbermill:'鋸木場',masonry:'石匠工坊',mint:'鑄幣所',barracks:'兵營',archery:'射箭場',stable:'馬廄',blacksmith:'鐵匠鋪',academy:'學院',workshop:'攻城工坊',castle:'城堡',embassy:'使館'};
export const FIELD_ALIAS={food:'farm',wood:'lumber',stone:'quarry',gold:'mine'} as const;
export const SITE_INDEX={food:0,wood:1,stone:2,gold:3,bandit:6} as const;
// Exact feet anchors from v0.30.2 TownScene / OutskirtsScene.
export const TOWN_ANCHORS:readonly (readonly [number,number])[]=[[50.5,50],[17,29],[33,29],[67,27],[84,29],[15,44],[35,43],[64,43],[78,43],[88,45],[14,65],[35,62],[72,61],[89,64],[25,73],[68,76]];
export const FIELD_ANCHORS:readonly (readonly [number,number])[]=[[14,27],[34,16],[54,15],[73,20],[88,33],[74,43],[89,57],[74,66],[68,85],[48,86],[30,85],[14,78],[23,43],[10,55],[24,65],[40,74],[57,74],[87,78]];
export type ArtSpec={path:string;sheet?:'units'|'guards'|'technologies'|'emblems';index?:number;badge?:string;category?:string;civ?:string;origin:'reused'|'new'|'derived'};
const unitBases:Record<string,{sheet?:ArtSpec['sheet'];index?:number;path?:string;badge?:string}>={militia:{sheet:'units',index:0},spearman:{sheet:'units',index:1},archer:{sheet:'units',index:2},skirmisher:{path:'art/formal/unit-skirmisher.webp'},scout:{sheet:'units',index:5},'light-cavalry':{sheet:'units',index:3,badge:'輕騎'},knight:{sheet:'units',index:3,badge:'騎士'},ram:{sheet:'units',index:4},catapult:{path:'art/formal/unit-catapult.webp'},baggage:{sheet:'technologies',index:3,badge:'輜重'}};
const eliteBases:Record<string,string>={swordsman:'militia',pikeman:'spearman',crossbowman:'archer','heavy-skirmisher':'skirmisher',ranger:'light-cavalry','heavy-knight':'knight'};
export function unitArt(id:string):ArtSpec {
 const u=UNIT_CATALOG[id];if(!u)throw new Error('Unknown formal unit');
 if(id.includes('guard.'))return {path:'art/catalog-guards.webp',sheet:'guards',index:civilizationIndex(u.civilizationId!),badge:u.eliteTech?'ELITE':undefined,origin:u.eliteTech?'derived':'reused'};
 const base=unitBases[eliteBases[id]??id];if(!base)throw new Error('Unmapped formal unit: '+id);
 return {...base,path:base.path??`art/catalog-${base.sheet}.webp`,badge:u.eliteTech?['ELITE',base.badge].filter(Boolean).join(' · '):base.badge,origin:base.path?(u.eliteTech?'derived':'new'):u.eliteTech||base.badge?'derived':'reused'};
}
export const TECH_CATEGORIES=['intel','drill','horse','conscription','logistics','engineering','siege','administration','elite','cooperation'] as const;
export function techArt(id:string):ArtSpec {
 const t=TECH_CATALOG[id];if(!t)throw new Error('Unknown formal technology');
 let index:number|undefined,category:string|undefined;
 if(id.startsWith('blacksmith.'))index=id.endsWith('.3')?5:2;
 else if(id.startsWith('economy.food.'))index=id.endsWith('.3')?4:0;
 else if(id.startsWith('economy.wood.'))index=1;
 else if(id.startsWith('economy.stone.'))category='engineering';
 else if(id.startsWith('economy.gold.'))category='administration';
 else if(id.startsWith('intel.'))category='intel';
 else if(id==='military.drill')category='drill';
 else if(id==='military.conscription')category='conscription';
 else if(id.startsWith('military.'))category='horse';
 else if(id.startsWith('logistics.')){index=3;category='logistics';}
 else if(id.startsWith('engineering.'))category='engineering';
 else if(id.startsWith('siege.'))category='siege';
 else if(id.startsWith('administration.'))category='administration';
 else if(id.startsWith('elite.'))category='elite';
 else if(id==='research.cooperation')category='cooperation';
 else if(t.civilizationId)category=/charge|nomadic|knighthood/.test(id)?'horse':/crossbow|archer|sling/.test(id)?'drill':/siege|warwolf/.test(id)?'siege':/mobilization/.test(id)?'conscription':'administration';
 else category='cooperation'; // modern ledger interface only; gameplay remains B9.
 const level=/\.([123])$/.exec(id)?.[1];
 return{path:index===undefined?`art/formal/tech-${category}.svg`:'art/catalog-technologies.webp',sheet:index===undefined?undefined:'technologies',index,category,badge:level?['I','II','III'][+level-1]:t.category==='elite'?'ELITE':undefined,civ:t.civilizationId??undefined,origin:'derived'};
}
export function cityPresentation(w:FormalWorld,c:FormalCity){
 const faction=w.factions.find(f=>f.id===c.ownerFactionId)!;const age=faction.age??0;
 const jobs=c.economy?.construction??[];
 const lots=TOWN_ANCHORS.map((anchor,i)=>{const key=i===0?'center':Object.keys(c.economy?.slots??{}).find(k=>c.economy!.slots[k]===i-1);return{anchor,slot:i-1,key,kind:key?.split('.')[0],level:key?c.buildings[key]??0:0,job:key?jobs.find(j=>j.target.kind==='building'&&j.target.key===key):undefined};});
 const fields=(c.fields??[]).map(field=>({...field,anchor:FIELD_ANCHORS[field.slot],job:jobs.find(j=>j.target.kind==='field'&&j.target.slot===field.slot)}));
 return{civ:civilizationArt(faction.civilizationId),formalCiv:faction.civilizationId,age,visualAge:visualAge(age),imperial:age===3,lots,fields,wall:c.wallLevel??0,wallJob:jobs.find(j=>j.target.kind==='building'&&j.target.key==='wall')};
}
export const constructionPercent=(j:Construction,time:number)=>Math.max(0,Math.min(100,(time-j.startsAt)/Math.max(1,j.durationMs)*100));
export const assetURL=(path:string)=>globalThis.__FORMAL_EMBEDDED_ASSETS?.[path]??import.meta.env.BASE_URL+path;

export const FIELD_NAMES={food:'農田',wood:'林地',stone:'石場',gold:'金礦'} as const;
