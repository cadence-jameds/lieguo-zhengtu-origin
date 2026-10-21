import 'fake-indexeddb/auto';
import {afterEach,it,expect} from 'vitest';
import {craftWorld} from './gateDeltaTestSupport';
import {battlefield,issue,dispatch} from './combatTestSupport';
import {build} from './developmentTestSupport';
import {advanceFormal} from './reducer';
import {changeCityOwner,HOUR} from './economy';
import {EventScheduler} from './scheduler';
import {isMissionArmy} from './combatModel';
import {invalidateSpatial} from './spatial';
import {route} from './routing';
import {validateFormalWorld} from './schema';
import type {FormalWorld} from './model';
import {handleCraftsmanEvent} from './extinction';
import {handleCombatEvent} from './battles';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence} from '../persistence';
import {enableAutonomy} from './autonomy';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const stores:FormalPersistence[]=[];
afterEach(async()=>{for(const db of stores.splice(0))await db.db.delete();});
const store=()=>{const db=new FormalPersistence({suffix:'r4-review-'+crypto.randomUUID()});stores.push(db);return db;};
const normalize=(w:FormalWorld)=>{const v=structuredClone(w);v.revision=0;for(const r of v.commandReceipts)r.committedRevision=0;return v;};
async function browserFixture(label:string,fixture:FormalWorld,expected:object){
 if(!process.env.R4_REVIEW_FIXTURES)return;
 enableAutonomy(fixture);fixture.offlineHours=0;
 for(const agent of fixture.autonomy!.agents)if(agent.eventId){agent.nextAt=fixture.time+30*86400000;fixture.events.find(e=>e.id===agent.eventId)!.at=agent.nextAt;}
 fixture.events=new EventScheduler(fixture.events).snapshot();validateFormalWorld(fixture);
 mkdirSync(process.env.R4_REVIEW_FIXTURES,{recursive:true});
 writeFileSync(join(process.env.R4_REVIEW_FIXTURES,label+'.realm-save'),JSON.stringify(await encodeSave(fixture)));
 writeFileSync(join(process.env.R4_REVIEW_FIXTURES,label+'-expected.json'),JSON.stringify(expected));
}

function conquer(w:FormalWorld,index:number){const s=new EventScheduler(w.events);changeCityOwner(w,w.cities[index],w.factions[4].id,'conquest',s);w.events=s.snapshot();return w;}
export function movingCraft(mode:'reachable'|'blocked'|'extinct',speed:1|10|25=1){
 let w=craftWorld();w.speed=speed;
 // Static synthetic terrain: all original cities/sites remain legal. Mountain rings
 // exist before dispatch, outside its path, and only enclose fallback destinations.
 w.worldLayer!.terrain='L'.repeat(384*384);w.worldLayer!.mountains!.sprites=[];
 const points=[{x:2,y:10},{x:12,y:10},{x:14,y:10},{x:20,y:10}];
 for(let i=0;i<4;i++)Object.assign(w.cities[i],points[i]);invalidateSpatial(w);
 if(mode!=='extinct')for(const i of [2,3])changeCityOwner(w,w.cities[i],w.playerFactionId,'receive');
 const terrain=w.worldLayer!.terrain.split('');
 for(const i of mode==='blocked'?[2,3]:mode==='reachable'?[2]:[])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)terrain[(points[i].y+dy)*384+points[i].x+dx]='M';
 w.worldLayer!.terrain=terrain.join('');invalidateSpatial(w);
 const id=w.extinction!.craftsmen[0].id;
 w=issue(w,{type:'craftsman.move',cityId:w.cities[0].id,craftsmanId:id,destinationCityId:w.cities[1].id}).world;
 const arrival=w.extinction!.craftsmen[0].arrivalAt!,eventId=w.extinction!.craftsmen[0].eventId!;
 conquer(w,0);conquer(w,1);validateFormalWorld(w);
 return {world:w,id,arrival,eventId};
}
it.each(['reachable','blocked','extinct'] as const)('R4-C1 lost craftsman destination: %s does not abort the world',async mode=>{
 const {world:w,id,arrival,eventId}=movingCraft(mode);
 if(mode!=='extinct')expect(()=>route(w,w.cities[1],w.cities[2])).toThrow('No traversable route');
 if(mode==='reachable')expect(()=>route(w,w.cities[1],w.cities[3])).not.toThrow();
 const beforeSites=structuredClone(w.extinction!.sites),receipts=structuredClone(w.commandReceipts);
 const t=advanceFormal(w,arrival),next=t.world;
 expect(next.events.some(e=>e.id===eventId)).toBe(false);
 if(mode==='reachable'){
  const craft=next.extinction!.craftsmen.find(c=>c.id===id)!;
  expect(craft).toMatchObject({cityId:null,destinationCityId:w.cities[3].id,departedAt:arrival});
  expect(craft.arrivalAt).toBeGreaterThan(arrival);
  const done=advanceFormal(next,craft.arrivalAt!);expect(done.world.extinction!.craftsmen.find(c=>c.id===id)?.cityId).toBe(w.cities[3].id);
 }else{expect(next.extinction!.craftsmen.some(c=>c.id===id)).toBe(false);expect(next.events.some(e=>e.type==='craftsman.arrive'&&e.craftsmanId===id)).toBe(false);}
 expect(next.extinction!.sites).toEqual(beforeSites);expect(next.commandReceipts).toEqual(receipts);validateFormalWorld(next);
 if(process.env.R4_REVIEW_FIXTURES&&mode!=='extinct'){
  await browserFixture('C1-'+mode,advanceFormal(w,arrival-4000).world,{kind:'C1',mode,id,eventId,at:arrival,destinationCityId:w.cities[3].id});
 }
});
it.each(['reachable','blocked','extinct'] as const)('R4-C1 arrival handler alone retires/redirects once without refunds, rewards or stale-ID reuse: %s',mode=>{
 const {world:w,id,arrival,eventId}=movingCraft(mode),event=w.events.find(e=>e.id===eventId)!;
 w.time=arrival;const s=new EventScheduler(w.events.filter(e=>e.id!==eventId));
 const stocks=structuredClone(w.cities.map(c=>c.stock)),sites=structuredClone(w.extinction!.sites),sequences={...w.sequences};
 expect(handleCraftsmanEvent(w,event,s)).toBe(true);w.events=s.snapshot();
 expect(w.cities.map(c=>c.stock)).toEqual(stocks);expect(w.extinction!.sites).toEqual(sites);
 expect(w.sequences).toEqual({...sequences,event:sequences.event+(mode==='reachable'?1:0)});
 expect(w.extinction!.craftsmen.filter(c=>c.id===id)).toHaveLength(mode==='reachable'?1:0);
 const before=structuredClone(w);handleCraftsmanEvent(w,event,s);w.events=s.snapshot();expect(w).toEqual(before);
});
it.each([1,10,25] as const)('R4-C1 %sX SaveLoad, full import, Recovery and sliced continuation remain equivalent',async speed=>{
 for(const mode of ['reachable','blocked','extinct'] as const){
  const {world:initial,id,arrival}=movingCraft(mode,speed),db=store(),copy=store();
  const w=await db.start((await decodeSave(await encodeSave(initial))).world),backup=(await db.backupList())[0];
  const end=arrival+HOUR,direct=advanceFormal(w,end),first=advanceFormal(w,arrival-1),last=advanceFormal(first.world,end);
  expect(normalize(last.world)).toEqual(normalize(direct.world));expect([...first.reports,...last.reports]).toEqual(direct.reports);
  const saved=await db.save(direct.world,direct.reports,w.revision);
  expect((await db.loadSave()).game).toEqual(saved);
  const imported=await copy.importSave(await db.exportStoredSave('full'));expect(imported.extinction).toEqual(saved.extinction);
  const restored=await db.restore(backup.id);
  // Recovery deliberately keeps durable ID high-water marks; it must not rewind
  // sequences to make its newly allocated event IDs equal the abandoned future.
  expect({...restored,revision:w.revision,sequences:w.sequences,commandReceipts:w.commandReceipts}).toEqual(w);
  expect(restored.revision).toBeGreaterThan(saved.revision);expect(restored.sequences).toEqual(saved.sequences);
  const expected=advanceFormal({...structuredClone(w),revision:restored.revision,sequences:{...saved.sequences},commandReceipts:restored.commandReceipts},end);
  const replayed=advanceFormal(restored,end),again=await db.save(replayed.world,replayed.reports,restored.revision);
  expect(normalize(again)).toEqual(normalize(expected.world));expect(advanceFormal(again,end).reports).toEqual([]);
  expect(again.extinction!.craftsmen.filter(c=>c.id===id)).toHaveLength(mode==='reachable'?1:0);validateFormalWorld(again);
 }
});

export function waitingJoint(secondCity:boolean,speed:1|10|25=1){
 let w=battlefield();w.speed=speed;w.factions[0].age=2;build(w.cities[0],'embassy',14);
 if(secondCity)changeCityOwner(w,w.cities[3],w.playerFactionId,'receive');
 w.cities[0].military!.units={militia:10,scout:3,baggage:2};
 w=issue(w,{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'來源失守負向測試'}).world;
 w=issue(w,{type:'joint.create',cityId:w.cities[0].id,targetCityId:w.cities[1].id,units:{militia:10,scout:3,baggage:2},arrivalAt:w.time+HOUR}).world;
 const a=structuredClone(w.armies.filter(isMissionArmy)[0]);expect(a.status).toBe('waiting');
 w.cities[2].military!.units={militia:1000};w=dispatch(w,'conquest',{militia:1000},2,0).world;
 const captureAt=w.armies.filter(isMissionArmy).find(x=>x.ownerFactionId===w.factions[2].id)!.arrivalAt;
 expect(captureAt).toBeLessThan(a.departedAt);
 return {world:w,waiting:a,captureAt};
}
it.each([true,false])('R4-C3 lost source cannot dispatch a waiting mixed joint; other city=%s',async second=>{
 const {world:w,waiting:a,captureAt}=waitingJoint(second);
 const captured=advanceFormal(w,captureAt).world;expect(captured.cities[0].ownerFactionId).toBe(w.factions[2].id);
 const resident=captured.armies.filter(isMissionArmy).find(x=>x.id===a.id);
 expect(resident?.units.scout??0).toBe(0);expect(resident?.units.baggage??0).toBe(0);
 expect(resident).toBeUndefined();
 expect(captured.extinction?.sites.filter(s=>s.sourceFactionId===a.ownerFactionId)??[]).toEqual([]);
 expect(captured.politics!.joints.some(j=>j.armyIds.includes(a.id))).toBe(false);
 expect(captured.events.some(e=>e.id===a.movementEventId)).toBe(false);
 const after=advanceFormal(captured,a.departedAt+1).world;
 expect(after.armies.filter(isMissionArmy).some(x=>x.id===a.id&&x.status==='outbound')).toBe(false);
 expect(after.events.some(e=>e.type==='army.depart'&&e.armyId===a.id)).toBe(false);validateFormalWorld(after);
 if(process.env.R4_REVIEW_FIXTURES)await browserFixture('C3-'+second,advanceFormal(w,captureAt-4000).world,{kind:'C3',at:captureAt,armyId:a.id,sourceCityId:w.cities[0].id,ownerAfter:w.factions[2].id,originalOwner:a.ownerFactionId,eventId:a.movementEventId});
});
it.each([true,false])('R4-C3 capture preserves already departed troops under existing survival/extinction rules; other city=%s',second=>{
 let {world:w,waiting:a,captureAt}=waitingJoint(second);
 w.cities[0].military!.units={militia:3};
 w=dispatch(w,'raid',{militia:3},0,4).world;
 const departed=structuredClone(w.armies.filter(isMissionArmy).find(x=>x.id!==a.id&&x.ownerFactionId===a.ownerFactionId)!);
 expect(departed.status).toBe('outbound');expect(departed.arrivalAt).toBeGreaterThan(captureAt);
 const end=advanceFormal(w,captureAt).world;
 expect(end.armies.some(x=>x.id===a.id)).toBe(false);
 if(second)expect(end.armies.find(x=>x.id===departed.id)).toEqual(departed);
 else{expect(end.armies.some(x=>x.id===departed.id)).toBe(false);expect(end.extinction!.sites.filter(s=>s.sourceFactionId===a.ownerFactionId).map(s=>s.defenders)).toEqual([{militia:3}]);}
 validateFormalWorld(end);
});
it.each([-1,0,1])('R4-C3 departure at capture %+d ms obeys existing priorities; no retroactive death',offset=>{
 const {world:w,waiting:before,captureAt}=waitingJoint(true),a=w.armies.filter(isMissionArmy).find(x=>x.id===before.id)!,travel=a.arrivalAt-a.departedAt;
 a.departedAt=captureAt+offset;a.arrivalAt=a.departedAt+travel;
 w.events.find(e=>e.id===a.movementEventId)!.at=a.departedAt;w.politics!.joints[0].arrivalAt=a.arrivalAt;
 w.events=new EventScheduler(w.events).snapshot();validateFormalWorld(w);
 const end=advanceFormal(w,captureAt).world,resident=end.armies.filter(isMissionArmy).find(x=>x.id===a.id);
 if(offset<=0){expect(resident).toMatchObject({status:'outbound',units:{militia:10,scout:3,baggage:2}});}
 else{expect(resident).toBeUndefined();expect(end.events.some(e=>e.id===a.movementEventId)).toBe(false);}
 validateFormalWorld(end);
});
it('R4-C3 departure handler rejects a stale legacy waiting army after ownership loss, without grants or sequence allocation',()=>{
 const {world:w,waiting:a}=waitingJoint(true),event=w.events.find(e=>e.id===a.movementEventId)!;
 // Deliberately bypass capture cleanup to verify the handler's independent guard.
 w.cities[0].ownerFactionId=w.factions[2].id;invalidateSpatial(w);w.time=event.at;
 const s=new EventScheduler(w.events.filter(e=>e.id!==event.id)),stock=structuredClone(w.cities.map(c=>c.stock)),sequences={...w.sequences};
 expect(handleCombatEvent(w,event,s)).toEqual([]);w.events=s.snapshot();
 expect(w.armies.some(x=>x.id===a.id)).toBe(false);expect(w.events.some(e=>'armyId' in e&&e.armyId===a.id)).toBe(false);
 expect(w.politics!.joints.some(j=>j.armyIds.includes(a.id))).toBe(false);
 expect(w.cities.map(c=>c.stock)).toEqual(stock);expect(w.sequences).toEqual(sequences);expect(w.extinction?.sites??[]).toEqual([]);
 const before=structuredClone(w);handleCombatEvent(w,event,s);w.events=s.snapshot();expect(w).toEqual(before);
});
it('R4-C3 removing one waiting participant preserves the surviving joint member and cannot transfer the lost source back',()=>{
 let {world:w,waiting:a,captureAt}=waitingJoint(true);w.cities[3].military!.units={militia:3};
 w=issue(w,{type:'joint.join',cityId:w.cities[3].id,jointId:a.jointId!,units:{militia:3}}).world;
 const other=w.armies.filter(isMissionArmy).find(x=>x.id!==a.id&&x.ownerFactionId===a.ownerFactionId)!;
 const end=advanceFormal(w,captureAt).world;
 expect(end.politics!.joints.find(j=>j.id===a.jointId)!.armyIds).toEqual([other.id]);
 expect(end.cities[0].ownerFactionId).toBe(w.factions[2].id);expect(end.armies.some(x=>x.id===a.id)).toBe(false);validateFormalWorld(end);
});
it.each([1,10,25] as const)('R4-C3 %sX SaveLoad / full import / Recovery / sliced battle clear waiting forces only once',async speed=>{
 for(const second of [true,false]){
  const {world:initial,waiting:a,captureAt}=waitingJoint(second,speed),db=store(),copy=store();
  const w=await db.start((await decodeSave(await encodeSave(initial))).world),backup=(await db.backupList())[0],end=a.departedAt+1;
  const direct=advanceFormal(w,end),first=advanceFormal(w,captureAt-1),last=advanceFormal(first.world,end);
  expect(normalize(last.world)).toEqual(normalize(direct.world));expect([...first.reports,...last.reports]).toEqual(direct.reports);
  const saved=await db.save(direct.world,direct.reports,w.revision),imported=await copy.importSave(await db.exportStoredSave('full'));
  expect(imported.armies).toEqual(saved.armies);expect(imported.extinction).toEqual(saved.extinction);
  expect((await db.loadSave()).game).toEqual(saved);
  const restored=await db.restore(backup.id),replay=advanceFormal(restored,end),again=await db.save(replay.world,replay.reports,restored.revision);
  expect(again.armies.some(x=>x.id===a.id)).toBe(false);expect(again.events.some(e=>'armyId' in e&&e.armyId===a.id)).toBe(false);
  expect(again.extinction?.sites.filter(s=>s.sourceFactionId===a.ownerFactionId)??[]).toEqual([]);
  expect(again.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);
  // One final battle remains mandatory; extinction now also emits one player-visible diplomacy notice.
  expect((await db.readReportPage(again,0,'battle')).rows).toHaveLength(1);
  expect((await db.readReportPage(again,0,'diplomacy')).rows).toHaveLength(second?0:1);
  expect((await db.readReportPage(again)).rows).toHaveLength(second?1:2);expect(advanceFormal(again,end).reports).toEqual([]);
  expect(again.revision).toBeGreaterThan(saved.revision);validateFormalWorld(again);
 }
});
