import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {craftWorld,captureCraftCity} from './gateDeltaTestSupport';
import {issue} from './combatTestSupport';
import {order,build} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {buildingCost,buildingDuration} from './catalogB3';
import {zeroResources,resourceKeys} from './model';
import type {FormalWorld} from './model';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence} from '../persistence';
import {enableAutonomy,economicChoices} from './autonomy';

function prepared(same:boolean,ai=false){const w=craftWorld(),craft=w.extinction!.craftsmen[0];if(same)w.factions[0].civilizationId=craft.civilizationId;if(ai){w.factions[0].role='ai';w.factions[3].role='player';w.playerFactionId=w.factions[3].id;}return w;}
const payload=(w:FormalWorld)=>({type:'craftsman.castle' as const,cityId:w.cities[0].id,craftsmanId:w.extinction!.craftsmen[0].id});
it.each([1,10,50] as const)('D5 both civilizations and player/AI use zero-resource Lv1 at %sX, normal deadline and one consumption',async speed=>{
 for(const same of [false,true])for(const ai of [false,true]){
  let w=prepared(same,ai);w.speed=speed;w.cities[0].stock=zeroResources();const owner=w.cities[0].ownerFactionId,craft=w.extinction!.craftsmen[0],civ=craft.civilizationId;
  const command=order(w,payload(w),undefined,owner),sent=submitFormalOrder(w,command);expect(sent.ack?.status,sent.ack?.reason).toBe('committed');w=sent.world;
  const job=w.cities[0].economy!.construction[0];expect(w.cities[0].stock).toEqual(zeroResources());expect(job.paidResources).toEqual(zeroResources());expect(job.durationMs).toBe(buildingDuration('castle',1,5));expect(job.castleCivilizationId).toBe(civ);expect(w.extinction!.craftsmen).toHaveLength(1);
  expect(submitFormalOrder(w,command)).toMatchObject({world:w,ack:{status:'duplicate'}});
  w=(await decodeSave(await encodeSave(w))).world;const before=advanceFormal(w,job.startsAt+job.durationMs-1);expect(before.world.cities[0].buildings.castle).toBe(0);
  const done=advanceFormal(before.world,job.startsAt+job.durationMs);w=done.world;expect(w.cities[0].buildings.castle).toBe(1);expect(w.cities[0].castleCivilizationId).toBe(civ);expect(w.extinction!.craftsmen).toHaveLength(0);expect(w.factions.filter(f=>f.role==='ai')).toHaveLength(99);expect(advanceFormal(w,w.time).world).toBe(w);
 }
},30000);
it.each([false,true])('D5 normal Lv1 and subsequent Lv2 keep full resource costs; same civilization=%s',same=>{
 let w=prepared(same),c=w.cities[0],stock={...c.stock};w=issue(w,{type:'building.upgrade',cityId:c.id,key:'castle'}).world;
 expect(w.cities[0].economy!.construction[0].paidResources).toEqual(buildingCost('castle',1));for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(stock[r]-buildingCost('castle',1)[r]);
 w=prepared(same);w=issue(w,payload(w)).world;const first=w.cities[0].economy!.construction[0];w=advanceFormal(w,first.startsAt+first.durationMs).world;stock={...w.cities[0].stock};w=issue(w,{type:'building.upgrade',cityId:w.cities[0].id,key:'castle'}).world;
 expect(w.cities[0].economy!.construction[0].paidResources).toEqual(buildingCost('castle',2));for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(stock[r]-buildingCost('castle',2)[r]);
});
it.each([false,true])('D5 active/queued cancellation refunds zero and releases exactly one craft; queued=%s',queued=>{
 let w=prepared(true);if(queued)for(const lane of [0,1] as const)w=issue(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:lane,lane}).world;
 w.cities[0].stock=zeroResources();w=issue(w,payload(w)).world;const job=w.cities[0].economy!.construction.find(j=>j.castleCivilizationId)!;
 expect(job.startsAt>w.time).toBe(queued);w=issue(w,{type:'construction.cancel',cityId:w.cities[0].id,constructionCommandId:job.commandId}).world;
 expect(w.cities[0].stock).toEqual(zeroResources());expect(w.extinction!.craftsmen).toHaveLength(1);expect(w.extinction!.craftsmen[0].constructionCommandId).toBeNull();expect(w.events.some(e=>e.id===job.eventId)).toBe(false);
 w=issue(w,payload(w)).world;expect(w.cities[0].economy!.construction.filter(j=>j.castleCivilizationId)).toHaveLength(1);
});
it.each(['age','building','castle','busy'] as const)('D5 resource waiver does not bypass %s restrictions',why=>{
 let w=prepared(true);if(why==='age')w.factions[0].age=1;if(why==='building')w.cities[0].buildings.academy=1;if(why==='castle')build(w.cities[0],'castle',1);if(why==='busy')w=issue(w,payload(w)).world;
 const before=JSON.stringify(w),t=submitFormalOrder(w,order(w,payload(w)));expect(t.ack?.status).toBe('rejected');expect(JSON.stringify(w)).toBe(before);
});
it.each([false,true])('D5 capture cancels free castle even when conqueror has matching civilization; same=%s',same=>{
 let w=prepared(same);w.factions[2].civilizationId=w.extinction!.craftsmen[0].civilizationId;w.cities[0].stock=zeroResources();w=issue(w,payload(w)).world;
 const job=w.cities[0].economy!.construction[0];expect(job.paidResources).toEqual(zeroResources());w=captureCraftCity(w).world;
 expect(w.extinction!.craftsmen).toHaveLength(0);expect(w.cities[0].buildings.castle).toBeUndefined();expect(w.cities[0].economy!.construction).toHaveLength(0);expect(w.events.some(e=>e.id===job.eventId)).toBe(false);
 w=advanceFormal(w,job.startsAt+job.durationMs).world;expect(w.cities[0].buildings.castle).toBeUndefined();
});
it('D5 AI and governor candidate quotes use zero, including an otherwise empty treasury, with all 99 agents retained',()=>{
 const w=prepared(true,true);enableAutonomy(w);w.cities[0].stock=zeroResources();const agent=w.autonomy!.agents.find(a=>a.factionId===w.cities[0].ownerFactionId)!;
 expect(w.autonomy!.agents).toHaveLength(99);expect(economicChoices(w,w.cities[0],agent).find(q=>q.command.type==='craftsman.castle')?.cost).toEqual(zeroResources());
});
it.each([false,true])('D5 atomic save, full import and pre-command Recovery preserve zero payment and receipts; same=%s',async same=>{
 const db=new FormalPersistence({suffix:'r4-free-'+crypto.randomUUID()}),copy=new FormalPersistence({suffix:'r4-free-copy-'+crypto.randomUUID()});let fail=false;
 const fault=new FormalPersistence({suffix:'r4-free-fault-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('D5 fault');}});
 try{
  let w=prepared(same);w.cities[0].stock=zeroResources();w=await db.start(w);const point=(await db.backupList())[0],command=order(w,payload(w)),t=submitFormalOrder(w,command),saved=await db.save(t.world,t.reports,w.revision);
  const loaded=await copy.importSave(await db.exportStoredSave('full'));expect(loaded.cities[0].economy!.construction[0].paidResources).toEqual(zeroResources());expect(loaded.extinction!.craftsmen).toEqual(saved.extinction!.craftsmen);
  const restored=await db.restore(point.id);expect(restored.extinction!.craftsmen[0].constructionCommandId).toBeNull();expect(submitFormalOrder(restored,command).ack?.status).toBe('rolled-back');expect(restored.cities[0].stock).toEqual(zeroResources());
  const base=await fault.start(prepared(same)),next=issue(base,payload(base));fail=true;await expect(fault.save(next.world,next.reports,base.revision)).rejects.toThrow('D5 fault');expect((await fault.loadSave()).game).toEqual(base);fail=false;const committed=await fault.save(next.world,next.reports,base.revision);expect(committed.cities[0].economy!.construction[0].paidResources).toEqual(zeroResources());
 }finally{await Promise.all([db.db.delete(),copy.db.delete(),fault.db.delete()]);}
});
it('D5 pre-policy paid craftsman snapshot keeps its payment and existing cancellation refund',async()=>{
 let w=prepared(false);w=issue(w,payload(w)).world;const job=w.cities[0].economy!.construction[0],cost=buildingCost('castle',1);job.paidResources=cost;for(const r of resourceKeys)w.cities[0].stock[r]-=cost[r];
 const old=structuredClone(w);w=(await decodeSave(await encodeSave(w))).world;expect(w).toEqual(old);const stock={...w.cities[0].stock};w=issue(w,{type:'construction.cancel',cityId:w.cities[0].id,constructionCommandId:job.commandId}).world;for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(stock[r]+Math.floor(cost[r]*.5));
});
