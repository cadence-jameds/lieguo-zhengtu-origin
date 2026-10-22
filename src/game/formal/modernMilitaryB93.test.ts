import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {make,rich,build,researchCity,order,reject} from './developmentTestSupport';
import {battlefield,issue,dispatch,arrive} from './combatTestSupport';
import {UNIT_CATALOG,modernizationTarget,isModernUnit,unitLine} from './unitCatalog';
import {resourceKeys} from './model';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {unitRecruitCost,unitModernizationCost,unitTrainingDuration} from './military';
import {hitDamage,counterMultiplier,eraMultiplier,marchSeconds,carryCapacity} from './combatModifiers';
import {makePools,baggageLoss,effectiveCount} from './combatResolver';
import {resolveSiege} from './siege';
import {changeCityOwner,settleCity} from './economy';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {validateFormalWorld} from './schema';
import {economicChoices,enableAutonomy} from './autonomy';
import {isMissionArmy} from './combatModel';
// Independent v94 acceptance table: source, HP/attack/defenses/interval, population,
// seconds/tile, carry, Lv1 minutes, four resources, producer.
const rows=[
 ['militia',65,8,2,1,2,1,12,120,5,180,80,80,260,'barracks'],
 ['spearman',60,7,1,1,2,1,12,100,6,180,80,180,280,'barracks'],
 ['archer',52,9,1,1,2,1,12,90,6,160,140,100,400,'archery'],
 ['skirmisher',58,5,1,3,2.2,1,12,100,5,150,180,110,200,'archery'],
 ['scout',0,0,0,0,0,1,5,0,1,100,120,180,300,'center'],
 ['light-cavalry',130,14,3,3,1.8,2,6,350,10,240,120,320,520,'stable'],
 ['knight',210,21,5,4,1.8,3,8,250,15,350,150,650,850,'stable'],
 ['ram',300,4,0,10,3,4,16,0,20,200,400,1200,1400,'workshop'],
 ['catapult',150,32,0,2,5,6,18,0,30,200,700,1400,2500,'workshop'],
 ['baggage',0,0,0,0,0,2,14,5000,8,200,800,500,1300,'workshop'],
 ['guard.civ_zhongguo',75,10,2,2,1.2,1,10,150,10,160,140,180,480,'castle'],
 ['guard.civ_byzantium',250,23,6,5,1.9,3,8,300,24,450,150,900,1200,'castle'],
 ['guard.civ_frankia',105,14,3,2,1.8,1,10,180,12,250,200,150,400,'castle'],
 ['guard.civ_britannia',70,18,1,1,1.55,1,10,150,14,210,280,210,700,'castle'],
 ['guard.civ_japan',90,15,4,2,1.65,1,10,170,14,300,160,220,600,'castle'],
 ['guard.civ_mongolia',135,12,2,3,1.55,2,5,400,14,320,180,400,700,'castle'],
] as const;
const modern=(source:string)=>'modern.'+source;
function ready(){const w=make();researchCity(w);w.factions[0].modernQualification='full';return w;}
for(const [source,hp,attack,meleeDefense,rangedDefense,attackIntervalSeconds,population,secondsPerTile,carry,minutes,food,wood,stone,gold,producer] of rows)it(`B9-3 ${source}: exact data, qualification, existing producer, stock and population`,()=>{
 let w=ready();const c=w.cities[0],u=UNIT_CATALOG[modern(source)];
 expect(u).toMatchObject({era:'modern',hp,attack,meleeDefense,rangedDefense,attackIntervalSeconds,population,secondsPerTile,carry,baseDurationMs:minutes*60000,cost:{food,wood,stone,gold},producer,eliteTech:null});
 if(u.civilizationId)c.castleCivilizationId=u.civilizationId;
 w.factions[0].modernQualification='none';reject(w,{type:'military.recruit',cityId:c.id,unitId:u.id,count:1});w.factions[0].modernQualification='full';
 c.buildings[producer]=0;reject(w,{type:'military.recruit',cityId:c.id,unitId:u.id,count:1});c.buildings[producer]=1;
 // Full qualification itself suffices; no modern technology/cooperation/elite prerequisite.
 w.factions[0].age=0;expect(w.factions[0].researchCooperation).toBe(false);expect(w.factions[0].techIds).toEqual([]);
 const before=structuredClone(c),cmd=order(w,{type:'military.recruit',cityId:c.id,unitId:u.id,count:1});w=submitFormalOrder(w,cmd).world;
 expect(w.cities[0].military!.queue[0]).toMatchObject({unitId:u.id,durationMs:minutes*60000,populationPerUnit:population,unitCost:{food,wood,stone,gold}});
 for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(before.stock[r]-u.cost[r]);expect(w.cities[0].population).toBe(before.population-population);
 expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');w=advanceFormal(w,minutes*60000).world;expect(w.cities[0].military!.units[u.id]).toBe(1);validateFormalWorld(w);
});
it('B9-3 16 modern identities retain 28 traditional units and six distinct castle sources; levels accelerate modern scouts too',()=>{
 expect(Object.values(UNIT_CATALOG).filter(u=>u.era==='modern')).toHaveLength(16);expect(Object.values(UNIT_CATALOG).filter(u=>!u.era)).toHaveLength(28);
 let w=ready();const c=w.cities[0];c.castleCivilizationId='civ_japan';reject(w,{type:'military.recruit',cityId:c.id,unitId:'modern.guard.civ_zhongguo',count:1});
 w=issue(w,{type:'military.recruit',cityId:c.id,unitId:'modern.guard.civ_japan',count:1}).world;expect(w.cities[0].military!.queue[0].unitId).toBe('modern.guard.civ_japan');
 expect(new Set(rows.slice(10).map(r=>r[2]+'/'+r[1]+'/'+r[5])).size).toBe(6);expect(unitLine('guard','civ_japan').modern).toHaveLength(6);
 const scout=UNIT_CATALOG['modern.scout'];c.buildings.center=1;expect(unitTrainingDuration(w,c,scout)).toBe(60000);c.buildings.center=15;expect(unitTrainingDuration(w,c,scout)).toBe(30000);
});
it('B9-3 all four era pairs multiply final damage by actual unit generation, independently of faction qualifications',()=>{
 const w=ready(),f=w.factions[0];for(const qualification of ['none','full'] as const){f.modernQualification=qualification;
  for(const [a,d,era,damage] of [['modern.militia','spearman',3,24],['militia','modern.spearman',.35,2.1],['modern.militia','modern.spearman',1,7],['militia','spearman',1,7]] as const){expect(eraMultiplier(a,d)).toBe(era);expect(hitDamage(a,d,f,f)).toBeCloseTo(damage);}
 }
 expect(hitDamage('modern.skirmisher','ram',undefined,undefined,15)).toBeCloseTo(.6);expect(hitDamage('skirmisher','modern.ram',undefined,undefined,15)).toBeCloseTo(.07);
 const plain=hitDamage('modern.archer','modern.militia',undefined,undefined);expect(hitDamage('modern.archer','modern.militia',undefined,undefined,5)).toBeLessThan(plain);expect(hitDamage('modern.archer','modern.militia',undefined,undefined,0,false,.5)).toBeCloseTo(plain*.5);
});
it('B9-3 modern counters and all six guard identities take the highest applicable bonus',()=>{
 for(const [a,d,n] of [['militia','skirmisher',1.3],['spearman','light-cavalry',2.8],['spearman','knight',2.8],['archer','militia',1.8],['archer','spearman',1.5],['skirmisher','archer',1.8],['skirmisher','spearman',1.5],['light-cavalry','archer',1.45],['light-cavalry','skirmisher',1.55],['light-cavalry','catapult',1.5],['knight','militia',1.25],['knight','archer',1.5],['knight','skirmisher',1.6],['knight','catapult',1.4],['guard.civ_zhongguo','militia',1.35],['guard.civ_zhongguo','spearman',1.35],['guard.civ_byzantium','militia',1.3],['guard.civ_frankia','spearman',1.5],['guard.civ_frankia','militia',1.25],['guard.civ_britannia','militia',2],['guard.civ_britannia','spearman',2],['guard.civ_britannia','archer',1.8],['guard.civ_britannia','skirmisher',1.8],['guard.civ_britannia','guard.civ_japan',1.5],['guard.civ_britannia','guard.civ_byzantium',1],['guard.civ_britannia','guard.civ_mongolia',1],['guard.civ_mongolia','archer',1.35],['guard.civ_mongolia','militia',1.5],['spearman','guard.civ_byzantium',2.8],['spearman','guard.civ_mongolia',2.8],['skirmisher','guard.civ_mongolia',1.8],['knight','guard.civ_mongolia',1.5]] as const)expect(counterMultiplier(modern(a),modern(d)),a+' → '+d).toBe(n);
 for(const source of rows.slice(10).map(r=>r[0]))expect(counterMultiplier('modern.guard.civ_japan',modern(source))).toBe(1.4);
 expect(counterMultiplier('modern.guard.civ_japan','guard.civ_japan')).toBe(1);
});
it('B9-3 every held ordinary/elite line retrofits once at rounded base 10%, ignoring recruitment discounts and population/queue changes',()=>{
 let w=ready();w.factions[0].civilizationId='civ_byzantium';w.factions[0].techIds=['civilization.themes'];const c=w.cities[0];
 const sources=Object.keys(UNIT_CATALOG).filter(id=>!isModernUnit(id));c.military!.units=Object.fromEntries(sources.map(id=>[id,2]));w=issue(w,{type:'military.recruit',cityId:c.id,unitId:'militia',count:1}).world;const population=w.cities[0].population;
 const eliteMapping:Record<string,string>={swordsman:'militia',pikeman:'spearman',crossbowman:'archer','heavy-skirmisher':'skirmisher',ranger:'light-cavalry','heavy-knight':'knight'};
 expect(unitRecruitCost(w,c,UNIT_CATALOG['modern.spearman'])).not.toEqual(UNIT_CATALOG['modern.spearman'].cost);
 for(const source of sources){const expected=modern(source.startsWith('elite.guard.')?source.slice(6):eliteMapping[source]??source);expect(modernizationTarget(source)?.id).toBe(expected);const target=UNIT_CATALOG[expected],before=structuredClone(w.cities[0]),events=structuredClone(w.events),prior=w.cities[0].military!.units[target.id]??0,cmd=order(w,{type:'military.modernize',cityId:c.id,unitId:source,count:2});const result=submitFormalOrder(w,cmd);expect(result.ack?.status,result.ack?.reason).toBe('committed');w=result.world;
  for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(before.stock[r]-Math.round(target.cost[r]*.1)*2);
  expect(w.cities[0].military!.units[source]).toBeUndefined();expect(w.cities[0].military!.units[target.id]).toBe(prior+2);expect(w.cities[0].population).toBe(population);expect(w.cities[0].military!.queue).toEqual(before.military!.queue);expect(w.events).toEqual(events);
  const snapshot=structuredClone(w);expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');expect(w).toEqual(snapshot);
 }
 expect(Object.values(w.cities[0].military!.units).reduce((a,b)=>a+b,0)).toBe(56);expect(unitModernizationCost(UNIT_CATALOG['modern.guard.civ_zhongguo'])).toEqual({food:16,wood:14,stone:18,gold:48});expect(unitModernizationCost(UNIT_CATALOG['modern.guard.civ_japan'])).toEqual({food:30,wood:16,stone:22,gold:60});
 expect(unitModernizationCost({...UNIT_CATALOG['modern.militia'],cost:{food:15,wood:14,stone:16,gold:5}})).toEqual({food:2,wood:1,stone:2,gold:1});
});
it('B9-3 retrofit rejects no qualification, insufficient actual stock, nonexistent/dead/modern units and wrong ownership without mutation',()=>{
 const w=ready(),c=w.cities[0];c.military!.units={militia:2};const payload={type:'military.modernize' as const,cityId:c.id,unitId:'militia',count:1};w.factions[0].modernQualification='none';reject(w,payload);w.factions[0].modernQualification='full';
 c.stock.gold=25;reject(w,payload);c.stock.gold=100000;for(const unitId of ['unknown','swordsman','modern.militia'])reject(w,{...payload,unitId});reject(w,{...payload,count:3});const before=structuredClone(w);expect(()=>submitFormalOrder(w,order(w,{...payload,count:0}))).toThrow('命令格式無效');expect(w).toEqual(before);reject(w,{...payload,cityId:w.cities[1].id});
});
it('B9-3 stationary own reinforcement can retrofit from the actual hosting city without changing army identity or its origin',()=>{
 let w=battlefield();w.factions[0].modernQualification='full';changeCityOwner(w,w.cities[2],w.playerFactionId,'receive');w.cities[0].military!.units={militia:3};w=arrive(dispatch(w,'reinforce',{militia:3},0,2).world).world;
 const misplaced=structuredClone(w),misplacedArmy=misplaced.armies.filter(isMissionArmy)[0];misplacedArmy.position.x=(misplacedArmy.position.x+1)%384;reject(misplaced,{type:'military.modernize',cityId:misplaced.cities[2].id,armyId:misplaced.armies[0].id,unitId:'militia',count:1});
 settleCity(w,w.cities[2]);const army=w.armies.filter(isMissionArmy)[0],before=structuredClone(army),payer=structuredClone(w.cities[2]),homeStock={...w.cities[0].stock},population=w.cities.map(c=>c.population);
 w=issue(w,{type:'military.modernize',cityId:payer.id,armyId:army.id,unitId:'militia',count:2}).world;
 expect(w.armies[0]).toMatchObject({id:before.id,ownerFactionId:before.ownerFactionId,originCityId:before.originCityId,initialUnits:before.initialUnits,units:{militia:1,'modern.militia':2}});expect(w.cities[0].stock).toEqual(homeStock);expect(w.cities.map(c=>c.population)).toEqual(population);
 for(const r of resourceKeys)expect(w.cities[2].stock[r]).toBe(payer.stock[r]-UNIT_CATALOG['modern.militia'].cost[r]*.2);validateFormalWorld(w);
});
it('B9-3 moving, returning and fighting armies, and a besieged garrison, cannot retrofit',()=>{
 let w=battlefield();w.factions[0].modernQualification=w.factions[1].modernQualification='full';w.cities[0].military!.units={militia:100};w.cities[1].military!.units={militia:100};
 w=dispatch(w,'conquest',{militia:100}).world;const army=w.armies[0];reject(w,{type:'military.modernize',cityId:w.cities[0].id,armyId:army.id,unitId:'militia',count:1});w=arrive(w).world;expect(w.combat!.battles).toHaveLength(1);
 reject(w,{type:'military.modernize',cityId:w.cities[0].id,armyId:army.id,unitId:'militia',count:1});const p={type:'military.modernize' as const,cityId:w.cities[1].id,unitId:'militia',count:1};expect(submitFormalOrder(w,order(w,p,undefined,w.factions[1].id)).ack?.reason).toContain('交戰');
 let raid=battlefield();raid.factions[0].modernQualification='full';raid.cities[0].military!.units={militia:20};raid=arrive(dispatch(raid,'raid',{militia:20}).world).world;expect(raid.armies[0].status).toBe('returning');reject(raid,{type:'military.modernize',cityId:raid.cities[0].id,armyId:raid.armies[0].id,unitId:'militia',count:1});
});
it('B9-3 mixed marches, supply casualties and siege roles retain the original systems',()=>{
 const w=ready(),f=w.factions[0];expect(marchSeconds({'modern.knight':1,'modern.catapult':1},f)).toBe(18);expect(marchSeconds({'modern.knight':1,catapult:1},f)).toBe(90);expect(marchSeconds({'modern.scout':1,'modern.light-cavalry':1},f)).toBe(6);
 expect(carryCapacity({'modern.baggage':2,baggage:1,'modern.militia':1},f)).toBe(11120);expect(makePools({'modern.baggage':1,'modern.scout':1},f.id,w.cities[0].id,null,f)).toEqual([]);expect(effectiveCount(makePools({'modern.ram':1,'modern.catapult':1},f.id,null,null,f))).toBe(0);
 expect(baggageLoss({'modern.militia':50,'modern.baggage':10},{'modern.militia':100,'modern.baggage':10},true,'modern.baggage')).toBe(Math.round(10*.5**1.2));expect(baggageLoss({}, {'modern.militia':10,'modern.baggage':10},false,'modern.baggage')).toBe(10);
 const old=battlefield(),newer=structuredClone(old);old.cities[1].wallLevel=newer.cities[1].wallLevel=3;const id='battle:0000000000000001' as never;
 const a=resolveSiege(old,old.cities[1],makePools({ram:1,catapult:1},old.playerFactionId,old.cities[0].id,null),id),b=resolveSiege(newer,newer.cities[1],makePools({'modern.ram':1,'modern.catapult':1},newer.playerFactionId,newer.cities[0].id,null),id);expect(b).toEqual(a);
});
it('B9-3 actual mixed-generation raid reports conserve all unit types and supply losses through returning save/load',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:30,'modern.militia':30,baggage:4,'modern.baggage':4,ram:2,'modern.ram':2,catapult:2,'modern.catapult':2};w.cities[1].military!.units={militia:40,'modern.spearman':10};w.cities[1].wallLevel=7;
 const initial={...w.cities[0].military!.units};w=dispatch(w,'raid',initial).world;const loaded=(await decodeSave(await encodeSave(w))).world,t=arrive(w);expect(arrive(loaded)).toEqual(t);w=t.world;const p=t.reports[0].battle!;expect(p.mission).toBe('raid');expect(p.wallAfter).toBe(7);expect(p.ownerAfter).toBe(p.ownerBefore);
 for(const [id,n] of Object.entries(initial))expect(p.attackers[0].after[id]??0).toBeLessThanOrEqual(n);for(const id of ['baggage','modern.baggage'])expect(initial[id]-(p.attackers[0].after[id]??0)).toBe(baggageLoss(p.attackers[0].after,initial,true,id));
 const restored=(await decodeSave(await encodeSave(w))).world,returned=advanceFormal(w,w.armies[0].arrivalAt!);expect(advanceFormal(restored,restored.armies[0].arrivalAt!)).toEqual(returned);expect(returned.world.cities[0].military!.units).toEqual(p.attackers[0].after);
});
it('B9-3 mixed traditional/modern siege emits a normal conquest report and preserves qualification ownership',()=>{
 let w=battlefield();w.cities[0].military!.units={militia:10,'modern.militia':10,ram:100,'modern.ram':100,catapult:10,'modern.catapult':10};w.cities[1].wallLevel=3;w.factions[1].modernQualification='full';
 const t=arrive(dispatch(w,'conquest',{...w.cities[0].military!.units}).world);expect(t.world.cities[1].ownerFactionId).toBe(w.playerFactionId);expect(t.reports[0].battle).toMatchObject({outcome:'conquered',wallAfter:0,conquestReason:'conquered'});expect(t.reports[0].battle!.attackers[0].after['modern.ram']).toBe(100);expect(t.world.factions[0].modernQualification).toBe('none');validateFormalWorld(t.world);
});
it('B9-3 mixed scout generations retain scout-only admission, counter-scout losses, immutable intelligence and delivery',async()=>{
 let w=battlefield();w.cities[0].military!.units={scout:6,'modern.scout':6};w.cities[1].military!.units={scout:2,'modern.scout':2,militia:5};
 w=dispatch(w,'scout',{scout:6,'modern.scout':6}).world;const loaded=(await decodeSave(await encodeSave(w))).world,t=arrive(w);expect(arrive(loaded)).toEqual(t);w=t.world;expect(w.cities[1].military!.units).toEqual({militia:5});expect(Object.values(w.armies[0].units!).reduce((a,b)=>a+b,0)).toBe(10);expect(w.armies[0].pendingIntel!.units).toEqual({scout:2,'modern.scout':2,militia:5});
 const result=advanceFormal(w,w.armies[0].arrivalAt!);expect(result.reports[0].battle!.intel!.units).toEqual({scout:2,'modern.scout':2,militia:5});expect(result.world.armies).toHaveLength(0);
 const bad=battlefield();bad.cities[0].military!.units={'modern.scout':2,'modern.militia':1};reject(bad,{type:'army.dispatch',cityId:bad.cities[0].id,mission:'scout',target:{kind:'city',cityId:bad.cities[1].id},units:{'modern.scout':2,'modern.militia':1}});
});
it('B9-3 99 native AI use identical qualification, retrofit prices, stock, population and training admission',()=>{
 let w=make();enableAutonomy(w);const agents=w.autonomy!.agents;expect(agents).toHaveLength(99);
 for(const a of agents){const f=w.factions.find(f=>f.id===a.factionId)!,c=w.cities.find(c=>c.ownerFactionId===f.id)!;rich(w,c);build(c,'barracks',1);c.military!.units={militia:2};
  expect(economicChoices(w,c,a).some(q=>q.command.type==='military.modernize'||q.command.type==='military.recruit'&&isModernUnit(q.command.unitId))).toBe(false);
  expect(submitFormalOrder(w,order(w,{type:'military.recruit',cityId:c.id,unitId:'modern.militia',count:1},undefined,f.id)).ack?.status).toBe('rejected');f.modernQualification='full';
  const choices=economicChoices(w,c,a);expect(choices.some(q=>q.command.type==='military.modernize')).toBe(true);expect(choices.some(q=>q.command.type==='military.recruit'&&q.command.unitId==='modern.militia')).toBe(true);
  const before=structuredClone(c),population=c.population;w=issue(w,{type:'military.modernize',cityId:c.id,unitId:'militia',count:2},f.id).world;let updated=w.cities.find(n=>n.id===c.id)!;expect(updated.military!.units).toEqual({'modern.militia':2});expect(updated.population).toBe(population);for(const r of resourceKeys)expect(updated.stock[r]).toBe(before.stock[r]-UNIT_CATALOG['modern.militia'].cost[r]*.2);
  w=issue(w,{type:'military.recruit',cityId:c.id,unitId:'modern.militia',count:1},f.id).world;updated=w.cities.find(n=>n.id===c.id)!;expect(updated.population).toBe(population-1);expect(updated.military!.queue[0].unitId).toBe('modern.militia');
 }validateFormalWorld(w);
},60000);
it('B9-3 retrofit and modern training persist atomically through save/load, Recovery and equivalent offline advancement',async()=>{
 const {FormalPersistence}=await import('../persistence');let fail=false;const db=new FormalPersistence({suffix:'b93-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('modern military save fault');}});
 try{let w=ready();w.cities[0].military!.units={militia:5};w=await db.start(w);const c=w.cities[0],cmd=order(w,{type:'military.modernize',cityId:c.id,unitId:'militia',count:3}),changed=submitFormalOrder(w,cmd);fail=true;await expect(db.save(changed.world,changed.reports,w.revision)).rejects.toThrow('modern military save fault');expect((await db.loadSave()).game).toEqual(w);fail=false;w=await db.save(changed.world,changed.reports,w.revision);expect((await db.loadSave()).game).toEqual(w);const checkpoint=(await db.backupList())[0];
  const loaded=(await decodeSave(await encodeSave(w))).world;expect(submitFormalOrder(loaded,cmd).ack?.status).toBe('duplicate');const recruited=issue(w,{type:'military.recruit',cityId:c.id,unitId:'modern.militia',count:2});w=await db.save(recruited.world,recruited.reports,w.revision);const deadline=w.cities[0].military!.queue[0].nextAt+w.cities[0].military!.queue[0].durationMs;
  const direct=advanceFormal(w,deadline);expect(await advanceFormalCooperative(w,deadline)).toEqual(direct);const offline=await advanceOfflineCooperative(w,0,(deadline-w.time)/w.speed);expect(offline.world.cities).toEqual(direct.world.cities);expect(offline.world.events).toEqual(direct.world.events);expect(offline.world.commandReceipts).toEqual(direct.world.commandReceipts);expect((await decodeSave(await encodeSave(direct.world))).world).toEqual(direct.world);
  const restored=await db.restore(checkpoint.id);expect(restored.cities[0].military!.units).toEqual({militia:2,'modern.militia':3});expect(submitFormalOrder(restored,cmd).ack?.status).toBe('duplicate');
  await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovery=await db.loadSave();expect(recovery.recovered).toBe(true);expect(recovery.game!.cities[0].military!.units).toEqual({militia:2,'modern.militia':3});expect(submitFormalOrder(recovery.game!,cmd).ack?.status).toBe('duplicate');
 }finally{await db.db.delete();}
});
