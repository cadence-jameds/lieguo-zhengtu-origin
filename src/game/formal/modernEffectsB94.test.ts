import {it,expect} from 'vitest';
import {make,researchCity,order} from './developmentTestSupport';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {combatStats,hitDamage,counterMultiplier,marchSeconds,carryCapacity,scoutPower,modernSiegeMultiplier} from './combatModifiers';
import {unitRecruitCost,unitModernizationCost,unitTrainingDuration,armyUpkeep} from './military';
import {UNIT_CATALOG} from './unitCatalog';
import {resourceKeys} from './model';
import {makePools} from './combatResolver';
import {resolveSiege} from './siege';
import {battleId} from './ids';
import {incomingAlerts} from './aiKnowledge';
import {submitFormalOrder} from './reducer';
const common=['infantry-weapons','personal-protection','composite-armor','digital-fire-control','mechanized-logistics','supply-system','mobilization','siege-engineering','data-link'].map(id=>'modern.'+id);
const foot=['militia','spearman','archer','skirmisher','guard.civ_zhongguo','guard.civ_frankia','guard.civ_britannia','guard.civ_japan'];
const armored=['light-cavalry','knight','guard.civ_byzantium'];
const ranged=['archer','skirmisher','catapult','guard.civ_zhongguo','guard.civ_britannia','guard.civ_mongolia'];
it('B9-4D common combat technologies affect exactly their modern recipients and preserve traditional values',()=>{
 const w=make(),f=w.factions[0];for(const id of Object.keys(UNIT_CATALOG)){const before=combatStats(id,f);f.techIds=[...common];const after=combatStats(id,f),modern=id.startsWith('modern.'),line=id.slice(7);expect(after.attack).toBeCloseTo(before.attack*(modern&&foot.includes(line)?1.08:1));expect(after.hp).toBeCloseTo(before.hp*(modern&&foot.includes(line)?1.08:modern&&armored.includes(line)?1.1:1));expect(after.interval).toBeCloseTo(before.interval*(modern&&ranged.includes(line)?.94:1));f.techIds=[];}
});
it('B9-4D Chinese fire network multiplies old crossbow and digital fire control on exactly three modern lines',()=>{
 const w=make(),f=w.factions[0];f.civilizationId='civ_zhongguo';f.techIds=['civilization.crossbow','modern.digital-fire-control','modern.civ_zhongguo.exclusive'];expect(combatStats('modern.guard.civ_zhongguo',f).interval).toBeCloseTo(1.2*.92*.94*.92);expect(combatStats('modern.archer',f).interval).toBeCloseTo(2*.92*.94*.92);expect(combatStats('modern.skirmisher',f).interval).toBeCloseTo(2.2*.94*.92);expect(combatStats('archer',f).interval).toBeCloseTo(2*.92);expect(combatStats('modern.guard.civ_britannia',f).interval).toBeCloseTo(1.55*.94);f.civilizationId='civ_japan';expect(combatStats('modern.archer',f).interval).toBeCloseTo(2*.94);
});
it('B9-4D Byzantine active protection multiplies breeding/blacksmith/composite HP and never removes anti-armour counter',()=>{
 const w=make(),f=w.factions[0];f.civilizationId='civ_byzantium';f.techIds=['military.breeding','blacksmith.cavalry-armor.1','blacksmith.cavalry-armor.2','blacksmith.cavalry-armor.3','modern.composite-armor','modern.civ_byzantium.exclusive'];for(const line of armored)expect(combatStats('modern.'+line,f).hp).toBeCloseTo(UNIT_CATALOG['modern.'+line].hp*1.12*1.08*1.1*1.12);expect(combatStats('modern.guard.civ_mongolia',f).hp).toBeCloseTo(135*1.12*1.08);expect(counterMultiplier('modern.spearman','modern.guard.civ_byzantium')).toBe(2.8);expect(combatStats('knight',f).hp).toBeCloseTo(UNIT_CATALOG.knight.hp*1.12*1.08);
});
it('B9-4D Frank armored production spends rounded -12% costs but the exact 10% retrofit remains undiscounted and deduplicated',()=>{
 let w=make();const c=researchCity(w,true);w.factions[0].civilizationId='civ_frankia';w.factions[0].techIds.push('modern.civ_frankia.exclusive');c.military!.units={knight:2};const pop=c.population;
 for(const id of ['modern.light-cavalry','modern.knight']){const u=UNIT_CATALOG[id];for(const r of resourceKeys){expect(unitRecruitCost(w,c,u)[r]).toBe(Math.round(u.cost[r]*.88));expect(unitModernizationCost(u)[r]).toBe(Math.round(u.cost[r]*.1));}}expect(unitRecruitCost(w,c,UNIT_CATALOG['modern.guard.civ_byzantium'])).toEqual(UNIT_CATALOG['modern.guard.civ_byzantium'].cost);
 const before={...c.stock},cmd=order(w,{type:'military.modernize',cityId:c.id,unitId:'knight',count:1},'frank-retrofit');w=submitFormalOrder(w,cmd).world;for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(before[r]-Math.round(UNIT_CATALOG['modern.knight'].cost[r]*.1));expect(w.cities[0].population).toBe(pop);expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');const stock={...w.cities[0].stock};w=issue(w,{type:'military.recruit',cityId:c.id,unitId:'modern.knight',count:1}).world;for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(stock[r]-Math.round(UNIT_CATALOG['modern.knight'].cost[r]*.88));
});
it.each(['modern.militia','modern.spearman','modern.archer','modern.skirmisher','modern.guard.civ_zhongguo','modern.guard.civ_japan','modern.guard.civ_mongolia'])('B9-4D British precision doctrine applies final ×1.20 to personnel %s after counters/defense',target=>{
 const w=make(),f=w.factions[0];f.civilizationId='civ_britannia';const before=hitDamage('modern.guard.civ_britannia',target,f,undefined,7,false,.5);f.techIds=['modern.civ_britannia.exclusive'];expect(hitDamage('modern.guard.civ_britannia',target,f,undefined,7,false,.5)).toBeCloseTo(before*1.2);
});
it.each(['militia','spearman','archer','skirmisher','guard.civ_japan','modern.light-cavalry','modern.knight','modern.guard.civ_byzantium','modern.ram','modern.catapult'])('B9-4D British precision doctrine does not affect excluded/traditional %s',target=>{
 const w=make(),f=w.factions[0];f.civilizationId='civ_britannia';const before=hitDamage('modern.guard.civ_britannia',target,f,undefined);f.techIds=['modern.civ_britannia.exclusive'];expect(hitDamage('modern.guard.civ_britannia',target,f,undefined)).toBe(before);
});
it('B9-4D Japanese doctrine replaces guard ×1.40 with ×1.60, adds assault ×1.20 and uses max instead of multiplication',()=>{
 const w=make(),f=w.factions[0];f.civilizationId='civ_japan';f.techIds=['modern.civ_japan.exclusive'];for(const civ of ['zhongguo','byzantium','frankia','britannia','japan','mongolia'])expect(counterMultiplier('modern.guard.civ_japan','modern.guard.civ_'+civ,f)).toBe(1.6);expect(counterMultiplier('modern.militia','modern.guard.civ_japan',f)).toBe(1.2);expect(counterMultiplier('militia','modern.guard.civ_japan',f)).toBe(1);expect(counterMultiplier('modern.guard.civ_japan','guard.civ_japan',f)).toBe(1);expect(counterMultiplier('modern.militia','modern.skirmisher',f)).toBe(1.3);expect(counterMultiplier('modern.spearman','modern.guard.civ_mongolia',f)).toBe(2.8);
});
it('B9-4D training multiplies conscription ×.90 and mobilization ×.85; scout/siege/supply receive modern mobilization too',()=>{
 const w=make(),c=researchCity(w,true),f=w.factions[0];f.techIds.push('military.conscription');for(const u of Object.values(UNIT_CATALOG)){const before=unitTrainingDuration(w,c,u);f.techIds.push('modern.mobilization');const after=unitTrainingDuration(w,c,u);expect(after).toBe(Math.round(before*(u.era==='modern'?.85:1)));f.techIds.pop();}f.techIds.push('modern.mobilization');expect(unitTrainingDuration(w,c,UNIT_CATALOG['modern.militia'])).toBe(Math.round(300000*.5*.9*.85));
});
it('B9-4D Mongol convoy and mechanized logistics multiply inherited movement and supply carry; mixed army keeps actual slowest unit',()=>{
 const w=make(),f=w.factions[0];f.civilizationId='civ_mongolia';f.techIds=['military.horsemanship','military.drill','civilization.swift-siege','modern.mechanized-logistics','modern.civ_mongolia.exclusive','logistics.baggage'];expect(marchSeconds({'modern.catapult':1},f)).toBeCloseTo(18*.8*.9*.85);expect(marchSeconds({'modern.knight':1},f)).toBeCloseTo(8*.95*.9*.85);expect(marchSeconds({'modern.guard.civ_mongolia':1},f)).toBeCloseTo(5*.95*.9*.85);expect(marchSeconds({'modern.militia':1},f)).toBeCloseTo(12*.95*.9);expect(marchSeconds({'modern.scout':1},f)).toBeCloseTo(5*.9);expect(marchSeconds({'modern.knight':1,baggage:1},f)).toBe(UNIT_CATALOG.baggage.secondsPerTile);expect(carryCapacity({'modern.baggage':2},f)).toBeCloseTo(2*6000*1.2*1.15);expect(carryCapacity({baggage:2},f)).toBe(2*UNIT_CATALOG.baggage.carry*1.15);
});
it('B9-4D supply -8% multiplies existing rations only for modern garrison and real marching troops',()=>{
 let w=battlefield();w.factions[0].civilizationId='civ_mongolia';w.cities[0].military!.units={militia:10,'modern.militia':10,'modern.knight':2};w=dispatch(w,'raid',{militia:5,'modern.militia':5,'modern.knight':1}).world;const c=w.cities[0],f=w.factions[0];f.techIds=['logistics.rations','civilization.nomadic'];const before=armyUpkeep(w,c);f.techIds.push('modern.supply-system');const expected=10*UNIT_CATALOG.militia.upkeepPerHour*.95+10*UNIT_CATALOG['modern.militia'].upkeepPerHour*.95*.92+2*UNIT_CATALOG['modern.knight'].upkeepPerHour*.95*.9*.92;expect(armyUpkeep(w,c)).toBeCloseTo(expected);expect(armyUpkeep(w,c)).toBeLessThan(before);
});
it('B9-4D modern siege engineering changes actual wall and development damage and exposes only a future wonder modifier',()=>{
 const w=make(),f=w.factions[0],c=w.cities[1];c.wallLevel=15;const p=makePools({'modern.ram':1},f.id,w.cities[0].id,null,f),normal=resolveSiege(w,structuredClone(c),p,battleId('wall'));f.techIds=['modern.siege-engineering'];const boosted=resolveSiege(w,structuredClone(c),p,battleId('wall'));expect(boosted.wallDamage).toBeCloseTo(normal.wallDamage*1.2);expect(modernSiegeMultiplier('modern.catapult',f,'wonder')).toBe(1.2);expect(modernSiegeMultiplier('catapult',f,'wonder')).toBe(1);
 c.buildings={center:1,barracks:1,archery:1};c.fields=c.fields!.map(field=>({...field,level:0}));c.wallLevel=0;c.economy!.slots={barracks:0,archery:1};const cp=makePools({'modern.catapult':1},f.id,w.cities[0].id,null,f);f.techIds=[];const a=resolveSiege(w,structuredClone(c),cp,battleId('development'));f.techIds=['modern.siege-engineering'];const b=resolveSiege(w,structuredClone(c),cp,battleId('development'));expect(a.lost).toBe(1);expect(b.lost).toBe(2);
});
it('B9-4D modern scout and counter-scout +25% affect actual success without granting battlefield cognition',()=>{
 for(const defending of [false,true]){let w=battlefield();w.cities[0].military!.units=defending?{scout:7}:{'modern.scout':5};w.cities[1].military!.units=defending?{'modern.scout':5}:{scout:5};const f=w.factions[defending?1:0];f.techIds=['modern.data-link'];expect(scoutPower({'modern.scout':4,scout:4},f,defending)).toBe((defending?12:10)*9);w=arrive(dispatch(w,'scout',{...w.cities[0].military!.units}).world).world;expect(!!w.armies[0]?.pendingIntel).toBe(!defending);expect(w.modernAwareness).toBeUndefined();}
});
it('B9-4D data link reveals only top two actual incoming troop lines to an already authorized recipient, never map-wide intel',()=>{
 let w=battlefield();w.cities[0].military!.units={'modern.knight':10,militia:20,'modern.catapult':1,scout:100};w=dispatch(w,'raid',{...w.cities[0].military!.units}).world;const target=w.factions[1].id;expect(incomingAlerts(w,target)[0].composition).toBeUndefined();w.factions[1].techIds=['modern.data-link'];expect(incomingAlerts(w,target)[0].composition).toEqual(['modern.knight','militia']);w.factions[2].techIds=['modern.data-link'];expect(incomingAlerts(w,w.factions[2].id)).toEqual([]);expect(w.modernAwareness).toBeUndefined();
});
it('B9-4D modern attack and HP research change actual raid casualties through the existing resolver',()=>{
 const before=battlefield();before.cities[0].military!.units={'modern.militia':100};before.cities[1].military!.units={'modern.militia':100};const upgraded=structuredClone(before);upgraded.factions[0].techIds=['modern.infantry-weapons','modern.personal-protection'];const a=arrive(dispatch(before,'raid',{'modern.militia':100}).world).reports[0].battle!,b=arrive(dispatch(upgraded,'raid',{'modern.militia':100}).world).reports[0].battle!;expect(b.attackers[0].after['modern.militia']).toBeGreaterThan(a.attackers[0].after['modern.militia']);expect(b.defenders[0].after['modern.militia']).toBeLessThan(a.defenders[0].after['modern.militia']);
});
