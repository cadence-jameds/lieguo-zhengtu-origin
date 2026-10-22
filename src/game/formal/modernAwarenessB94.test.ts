import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {make,rich,researchCity,order,reject} from './developmentTestSupport';
import {effectiveAwareness,awarenessPool,recordModernRound,recordModernConquest,modernUnitAuthorized} from './modernAwareness';
import {makePools} from './combatResolver';
import {battleId,eventId,empireId,resolutionId} from './ids';
import {initialCombat,type BattleReportPayload} from './combatModel';
import {encodeSave,decodeSave} from './saveCodec';
import {hitDamage} from './combatModifiers';
import {advanceFormal,submitFormalOrder} from './reducer';
import {validateFormalWorld} from './schema';
import type {FormalWorld} from './model';
function round(w:FormalWorld,units:Record<string,number>,after=units,b='learn',r=1){
 const a=makePools({militia:1000},w.factions[0].id,w.cities[0].id,null),d=makePools(units,w.factions[1].id,w.cities[1].id,null),end=makePools(after,w.factions[1].id,w.cities[1].id,null),id=battleId(b),e=eventId(b+'-'+r);
 recordModernRound(w,id,e,r,a,d,a,end);w.combat??=initialCombat();if(!w.combat.receipts.some(x=>x.eventId===e))w.combat.receipts.push({battleId:id,resolutionId:resolutionId(b+'.round-'+r),eventId:e,at:w.time,round:r,kind:'round'});
}
it.each([49,50,51])('B9-4A simultaneous modern population %s observes exact significant threshold',n=>{
 const w=make();round(w,{'modern.militia':n});expect(awarenessPool(w,w.playerFactionId)).toMatchObject({value:n>=50?4:2,significantEncounter:n>=50});validateFormalWorld(w);
});
it('B9-4A counts modern siege population, excludes scouts/supply and never sums rounds to reach 50',()=>{
 const w=make();round(w,{'modern.militia':49,'modern.scout':1000,'modern.baggage':1000});round(w,{'modern.militia':49},{'modern.militia':49},'learn',2);expect(awarenessPool(w,w.playerFactionId)).toMatchObject({value:2,significantEncounter:false});round(w,{'modern.ram':13},{'modern.ram':13},'siege');expect(awarenessPool(w,w.playerFactionId)).toMatchObject({value:6,significantEncounter:true});
});
it('B9-4A killed modern population accumulates once per battle; battle awards cap at ten, conquest adds fifteen outside cap',async()=>{
 let w=make();w.factions[1].modernQualification='full';round(w,{'modern.militia':49},{},'learn',1);expect(effectiveAwareness(w,w.playerFactionId)).toBe(2);round(w,{'modern.militia':1},{},'learn',2);expect(effectiveAwareness(w,w.playerFactionId)).toBe(3);round(w,{'modern.militia':1000},{},'learn',3);expect(effectiveAwareness(w,w.playerFactionId)).toBe(10);
 const p={mission:'conquest',outcome:'conquered',battleId:battleId('learn'),ownerBefore:w.factions[1].id,ownerAfter:w.playerFactionId} as BattleReportPayload;recordModernConquest(w,p);recordModernConquest(w,p);expect(effectiveAwareness(w,w.playerFactionId)).toBe(25);
 w.combat!.receipts.push({battleId:p.battleId,resolutionId:resolutionId('learn.final'),eventId:eventId('learn-final'),at:0,round:3,kind:'final',outcome:'conquered',ownerBefore:p.ownerBefore,ownerAfter:p.ownerAfter,qualificationBefore:'full'});w.combat!.statistics.resolved=1;w=(await decodeSave(await encodeSave(w))).world;round(w,{'modern.militia':1000},{},'learn',3);recordModernConquest(w,p);expect(effectiveAwareness(w,w.playerFactionId)).toBe(25);validateFormalWorld(w);
});
it('B9-4A conquest of unqualified captured modern troops, unchanged ownership and scouts grant no strategic award',()=>{
 const w=make(),p={mission:'conquest',outcome:'conquered',battleId:battleId('empty'),ownerBefore:w.factions[1].id,ownerAfter:w.playerFactionId} as BattleReportPayload;recordModernConquest(w,p);expect(w.modernAwareness).toBeUndefined();w.factions[1].modernQualification='full';recordModernConquest(w,{...p,ownerAfter:p.ownerBefore});recordModernConquest(w,{...p,mission:'scout'});expect(w.modernAwareness).toBeUndefined();
});
it('B9-4A personal and empire pools freeze and resume without merge, transfer or max',()=>{
 const w=make(),me=w.factions[0],id=empireId('awareness');w.modernAwareness={pools:{[me.id]:{value:80,significantEncounter:true,encountered:['modern.militia']},[id]:{value:20,significantEncounter:false,encountered:[]}},battles:[]};
 w.politics={legions:[{id:'legion:awareness',name:'test',description:'',leader:me.id,members:[me.id],empireId:id}],empires:[{id,name:'test',leader:me.id,legions:['legion:awareness'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};me.empireId=id;expect(effectiveAwareness(w,me.id)).toBe(20);round(w,{'modern.militia':50});expect(effectiveAwareness(w,me.id)).toBe(24);expect(w.modernAwareness.pools[me.id].value).toBe(80);w.politics.legions[0].empireId=null;w.politics.empires=[];me.empireId=null;expect(effectiveAwareness(w,me.id)).toBe(80);
});
it('B9-4A 40 improves only correct traditional counters; qualification does not change unit generation',()=>{
 const w=make(),f=w.factions[0];for(const value of [0,39,40,100]){expect(hitDamage('spearman','modern.knight',f,f,0,false,1,value)).toBeCloseTo(hitDamage('spearman','modern.knight',f,f)*(value>=40?.5/.35:1));expect(hitDamage('militia','modern.knight',f,f,0,false,1,value)).toBe(hitDamage('militia','modern.knight',f,f));expect(hitDamage('modern.spearman','modern.knight',f,f,0,false,1,value)).toBe(hitDamage('modern.spearman','modern.knight',f,f));}
});
it('B9-4A 60/80 select encountered lines only, production/refit stay partial and retain real payment and full technology gate',()=>{
 let w=make();const c=researchCity(w),f=w.factions[0];w.modernAwareness={pools:{[f.id]:{value:59,significantEncounter:true,encountered:['modern.militia','modern.knight']}},battles:[]};reject(w,{type:'modern.reverse',cityId:c.id,unitId:'modern.militia'});w.modernAwareness.pools[f.id].value=60;
 w=issue(w,{type:'modern.reverse',cityId:c.id,unitId:'modern.militia'}).world;expect(modernUnitAuthorized(w.factions[0],'modern.militia')).toBe(true);reject(w,{type:'modern.reverse',cityId:c.id,unitId:'modern.knight'});reject(w,{type:'military.recruit',cityId:c.id,unitId:'modern.knight',count:1});reject(w,{type:'research.start',cityId:c.id,techId:'research.cooperation'});
 w.cities[0].military!.units={militia:2};const before=w.cities[0].stock.gold;w=issue(w,{type:'military.modernize',cityId:c.id,unitId:'militia',count:1}).world;expect(w.cities[0].stock.gold).toBe(before-26);expect(w.factions[0].modernQualification).toBe('none');w.modernAwareness!.pools[f.id].value=80;reject(w,{type:'modern.reverse',cityId:c.id,unitId:'modern.archer'});w=issue(w,{type:'modern.reverse',cityId:c.id,unitId:'modern.knight'}).world;expect(w.factions[0].reverseEngineering).toHaveLength(2);w.factions[0].modernQualification='full';expect(modernUnitAuthorized(w.factions[0],'modern.catapult')).toBe(true);
});
it('B9-4A real raids persist awareness, events and losses; replay cannot award again; scouts and simple movement award nothing',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:1000};w.cities[1].military!.units={'modern.militia':50};w=dispatch(w,'raid',{militia:1000}).world;expect(w.modernAwareness).toBeUndefined();const loaded=(await decodeSave(await encodeSave(w))).world,t=arrive(w);expect(arrive(loaded)).toEqual(t);w=t.world;expect(effectiveAwareness(w,w.playerFactionId)).toBeGreaterThanOrEqual(4);const again=advanceFormal(w,w.time);expect(again.world).toEqual(w);expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
 let scout=battlefield();scout.cities[0].military!.units={scout:3};scout.cities[1].military!.units={'modern.militia':100};scout=arrive(dispatch(scout,'scout',{scout:3}).world).world;expect(scout.modernAwareness).toBeUndefined();
});
it('B9-4A all 99 AI use identical partial production and command deduplication',()=>{
 let w=make();for(const id of w.factions.filter(f=>f.role==='ai').map(f=>f.id)){const f=w.factions.find(f=>f.id===id)!,c=rich(w,w.cities.find(c=>c.ownerFactionId===id)!,1000);c.buildings.barracks=1;c.economy!.slots.barracks??=Object.keys(c.economy!.slots).length;c.stock={food:1000,wood:1000,stone:1000,gold:1000};f.reverseEngineering=['modern.militia'];const cmd=order(w,{type:'military.recruit',cityId:c.id,unitId:'modern.militia',count:1},'ai-partial-'+f.id.slice(8),f.id),t=submitFormalOrder(w,cmd);expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');expect(w.cities.find(x=>x.id===c.id)!.stock.gold).toBe(740);}expect(w.factions.filter(f=>f.role==='ai'&&f.reverseEngineering?.length)).toHaveLength(99);
});
it('B9-4A real battle awareness survives atomic save failure, Recovery and offline replay without duplicate awards',async()=>{
 const {FormalPersistence}=await import('../persistence'),{advanceOfflineCooperative}=await import('./offline');let fail=false;
 const db=new FormalPersistence({suffix:'awareness-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('awareness save fault');}});
 try{
  let w=battlefield();w.cities[0].military!.units={militia:1000};w.cities[1].military!.units={'modern.militia':50};w=dispatch(w,'raid',{militia:1000}).world;w=await db.start(w);
  const end=w.armies[0].arrivalAt!,direct=advanceFormal(w,end),offline=await advanceOfflineCooperative(w,0,(end-w.time)/w.speed);expect(offline.world.modernAwareness).toEqual(direct.world.modernAwareness);
  fail=true;await expect(db.save(direct.world,direct.reports,w.revision)).rejects.toThrow('awareness save fault');expect((await db.loadSave()).game!.modernAwareness).toBeUndefined();fail=false;
  w=await db.save(direct.world,direct.reports,w.revision);const checkpoint=(await db.backupList())[0];const restored=await db.restore(checkpoint.id);expect(restored.modernAwareness).toEqual(w.modernAwareness);
  await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovered=await db.loadSave();expect(recovered.recovered).toBe(true);expect(recovered.game!.modernAwareness).toEqual(w.modernAwareness);expect(advanceFormal(recovered.game!,recovered.game!.time).world.modernAwareness).toEqual(w.modernAwareness);
 }finally{await db.db.delete();}
});
