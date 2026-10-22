import type {FormalFaction} from './model';
import {BLACKSMITH_CAPS,BLACKSMITH_LINES} from './techCatalog';
import {ELITE_VARIANTS,UNIT_CATALOG,isModernUnit,isSupplyUnit} from './unitCatalog';
export const EXPOSURE=5;
export const baseUnit=(id:string)=>isModernUnit(id)?id.slice(7):Object.keys(ELITE_VARIANTS).find(k=>ELITE_VARIANTS[k]===id)??id;
export const eraMultiplier=(attacker:string,target:string)=>isModernUnit(attacker)===isModernUnit(target)?1:isModernUnit(attacker)?3:.35;
export const effectiveUnit=(id:string)=>!!UNIT_CATALOG[id]&&['infantry','ranged','cavalry','mounted-ranged'].includes(UNIT_CATALOG[id].combatClass);
export const rangedUnit=(id:string)=>['ranged','mounted-ranged'].includes(UNIT_CATALOG[id].combatClass)||baseUnit(id)==='catapult';
export const mountedUnit=(id:string)=>['cavalry','mounted-ranged'].includes(UNIT_CATALOG[id].combatClass);
const civTech:Record<string,string>={...Object.fromEntries(['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'].map(c=>['modern.'+c+'.exclusive',c])),'civilization.crossbow':'civ_zhongguo','civilization.charge':'civ_frankia','civilization.warwolf':'civ_britannia','civilization.sling':'civ_japan','civilization.swift-siege':'civ_mongolia','civilization.imperial-wall':'civ_byzantium'};
export function hasTech(f:FormalFaction|undefined,id:string){return !!f?.techIds.includes(id)&&(!civTech[id]||civTech[id]===f.civilizationId);}
function tier(f:FormalFaction|undefined,line:typeof BLACKSMITH_LINES[number]){if(!f)return 0;const cap=BLACKSMITH_CAPS[f.civilizationId]?.[BLACKSMITH_LINES.indexOf(line)]??0;return Math.min(cap,[1,2,3].filter(n=>f.techIds.includes(`blacksmith.${line}.${n}`)).length);}
export const modernArmored=(id:string)=>['modern.light-cavalry','modern.knight','modern.guard.civ_byzantium'].includes(id);
export const modernFoot=(id:string)=>isModernUnit(id)&&effectiveUnit(id)&&!mountedUnit(id);
export const modernVehicle=(id:string)=>isModernUnit(id)&&(mountedUnit(id)||['ram','catapult','baggage'].includes(baseUnit(id)));
/** B9-5 wonder targeting must use this same destruction multiplier; no targeting or durability flow is added here. */
export const modernSiegeMultiplier=(id:string,f:FormalFaction|undefined,target:'wall'|'development'|'wonder')=>hasTech(f,'modern.siege-engineering')&&(target==='wall'?id==='modern.ram':id==='modern.catapult')?1.2:1;
export function scoutPower(units:Record<string,number>,f:FormalFaction|undefined,defending=false){return Object.entries(units).reduce((n,[id,count])=>n+(['scout','modern.scout'].includes(id)?count*(defending?12:10)*(id==='modern.scout'&&hasTech(f,'modern.data-link')?1.25:1):0),0);}
export function combatStats(id:string,f?:FormalFaction){
 const u=UNIT_CATALOG[id],b=baseUnit(id),battle=effectiveUnit(id),weapon=rangedUnit(id)?'ranged':'melee',armor=mountedUnit(id)?'cavalry-armor':u.combatClass==='ranged'?'ranged-armor':'infantry-armor';
 let hp=u.hp*(battle?1+.04*tier(f,armor):1),attack=u.attack*(battle?1+.04*tier(f,weapon):1),interval=u.attackIntervalSeconds;
 if(mountedUnit(id)&&hasTech(f,'military.breeding'))hp*=1.08;
 if(u.combatClass==='siege')hp*=1+.08*[1,2].filter(n=>hasTech(f,`siege.frame.${n}`)).length;
 if(hasTech(f,'civilization.crossbow')&&['archer','guard.civ_zhongguo'].includes(b))interval*=.92;
 if(b==='catapult'&&hasTech(f,'civilization.sling'))interval*=.88;
 if(modernFoot(id)){if(hasTech(f,'modern.infantry-weapons'))attack*=1.08;if(hasTech(f,'modern.personal-protection'))hp*=1.08;}
 if(modernArmored(id)){if(hasTech(f,'modern.composite-armor'))hp*=1.1;if(hasTech(f,'modern.civ_byzantium.exclusive'))hp*=1.12;}
 if(isModernUnit(id)&&rangedUnit(id)&&hasTech(f,'modern.digital-fire-control'))interval*=.94;
 if(['modern.archer','modern.skirmisher','modern.guard.civ_zhongguo'].includes(id)&&hasTech(f,'modern.civ_zhongguo.exclusive'))interval*=.92;
 return{hp,attack,interval,meleeDefense:u.meleeDefense,rangedDefense:u.rangedDefense};
}
/** Tags are unit identity, including both mounted and ranged for Mongol guards. Highest counter wins. */
export function counterMultiplier(attacker:string,target:string,owner?:FormalFaction){
 const a=baseUnit(attacker),t=baseUnit(target),u=UNIT_CATALOG[target],values=[1];
 const add=(ok:boolean,n:number)=>{if(ok)values.push(n);};
 const infantry=u.combatClass==='infantry',ranged=['ranged','mounted-ranged'].includes(u.combatClass),footRanged=u.combatClass==='ranged',mounted=mountedUnit(target);
 if(a==='militia')add(t==='skirmisher',1.3);
 if(a==='spearman')add(mounted,2.8);
 if(a==='archer'){add(infantry&&t!=='spearman',1.8);add(t==='spearman',1.5);}
 if(a==='skirmisher'){add(ranged,1.8);add(t==='spearman',1.5);}
 if(a==='light-cavalry'){add(ranged,1.45);add(t==='skirmisher',1.55);add(t==='catapult',1.5);}
 if(a==='knight'){add(infantry&&t!=='spearman',1.25);add(ranged,1.5);add(t==='skirmisher',1.6);add(t==='catapult',1.4);}
 if(a==='catapult'){add(infantry,1.4);add(footRanged,2);}
 if(a==='guard.civ_zhongguo')add(infantry,1.35);
 if(a==='guard.civ_byzantium')add(infantry&&t!=='spearman',1.3);
 if(a==='guard.civ_frankia'){add(t==='spearman',1.5);add(infantry&&t!=='spearman',1.25);}
 if(a==='guard.civ_britannia'&&!isModernUnit(attacker)){add(t==='spearman',1.6);add(infantry&&t!=='spearman',1.8);}
 if(a==='guard.civ_japan')add(!!u.civilizationId&&(!isModernUnit(attacker)||isModernUnit(target)),attacker==='modern.guard.civ_japan'&&hasTech(owner,'modern.civ_japan.exclusive')?1.6:1.4);
 if(attacker==='modern.militia'&&hasTech(owner,'modern.civ_japan.exclusive'))add(!!u.civilizationId,1.2);
 if(attacker==='modern.guard.civ_britannia'&&isModernUnit(target)){add(t==='militia'||t==='spearman',2);add(t==='archer'||t==='skirmisher',1.8);add(!!u.civilizationId&&!mountedUnit(target),1.5);}
 if(a==='guard.civ_mongolia'){add(footRanged,1.35);add(infantry,1.5);}
 return Math.max(...values);
}
export const wallDefenseMultiplier=(level:number)=>1+level*.03;
export const damageFormula=(attack:number,counter:number,defense:number,special=1,splash=1)=>Math.max(1,attack*counter-defense)*special*splash;
export function hitDamage(a:string,d:string,owner:FormalFaction|undefined,defender:FormalFaction|undefined,wall=0,firstContact=false,splash=1,awareness=0){
 const x=combatStats(a,owner),y=combatStats(d,defender),defense=(rangedUnit(a)?y.rangedDefense:y.meleeDefense)*wallDefenseMultiplier(wall);
 let special=baseUnit(a)==='ram'?.25:1;
 if(baseUnit(d)==='ram'&&rangedUnit(a))special*=baseUnit(a)==='catapult'?.6:.2;
 if(firstContact&&baseUnit(a)==='knight'&&hasTech(owner,'civilization.charge'))special*=1.08;
 if(a==='modern.guard.civ_britannia'&&isModernUnit(d)&&(['militia','spearman','archer','skirmisher'].includes(baseUnit(d))||!!UNIT_CATALOG[d].civilizationId&&!modernArmored(d))&&hasTech(owner,'modern.civ_britannia.exclusive'))special*=1.2;
 return damageFormula(x.attack,counterMultiplier(a,d,owner),defense,special,splash)*(awareness>=40&&!isModernUnit(a)&&isModernUnit(d)&&counterMultiplier(a,d,owner)>1?.5:eraMultiplier(a,d));
}
export function splashWeights(f?:FormalFaction){return hasTech(f,'civilization.warwolf')?[1,...Array(6).fill(.5),...Array(10).fill(.25)]:[1,...Array(4).fill(.5),...Array(8).fill(.25)];}
export function marchSeconds(units:Record<string,number>,f:FormalFaction){return Math.max(...Object.entries(units).filter(([,n])=>n>0).map(([id])=>{const u=UNIT_CATALOG[id];let t=u.secondsPerTile;if(effectiveUnit(id)&&hasTech(f,mountedUnit(id)?'military.horsemanship':'military.drill'))t*=.95;if(u.combatClass==='siege'&&hasTech(f,'civilization.swift-siege'))t*=.8;if(isModernUnit(id)&&hasTech(f,'modern.mechanized-logistics'))t*=.9;if(modernVehicle(id)&&hasTech(f,'modern.civ_mongolia.exclusive'))t*=.85;return t;}));}
export function carryCapacity(units:Record<string,number>,f?:FormalFaction){return Object.entries(units).reduce((n,[id,count])=>n+count*(id==='modern.baggage'?(hasTech(f,'modern.mechanized-logistics')?6000:5000)*(hasTech(f,'modern.civ_mongolia.exclusive')?1.2:1):UNIT_CATALOG[id].carry)*(isSupplyUnit(id)?(hasTech(f,'logistics.baggage')?1.15:1):(effectiveUnit(id)&&hasTech(f,'logistics.transport')?1.05:1)),0);}
