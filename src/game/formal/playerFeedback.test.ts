import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {createFormalWorld} from './generator';
import {commandId} from './ids';
import type {FormalCommand,FormalWorld} from './model';
import {advanceFormal,submitFormalOrder} from './reducer';
import {advanceOffline} from './offline';
import {buildingCost,fieldCost,HOUSING} from './catalogB3';
import {citySnapshot,HOUR} from './economy';
import {terrainAt,buildable} from './terrain';
import {spatial} from './spatial';
import {decodeSave,encodeSave} from './saveCodec';
import {FormalPersistence,type FailurePoint} from '../persistence';
let seq=0;const stores:FormalPersistence[]=[];
const make=(offlineHours:0|1|4|8|12=12,speed=1)=>createFormalWorld({campaign:'feedback-'+crypto.randomUUID(),seed:90217,offlineHours,speed});
function rich(w:FormalWorld){const c=w.cities[0];c.buildings['warehouse.0']=15;c.economy!.slots['warehouse.0']=0;c.stock={food:90000,wood:90000,stone:90000,gold:90000};return c;}
function submit(w:FormalWorld,payload:FormalCommand){return submitFormalOrder(w,{commandId:commandId('feedback-'+(++seq)),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload});}
function commit(w:FormalWorld,p:FormalCommand){const r=submit(w,p);expect(r.ack?.status,r.ack?.reason).toBe('committed');return r.world;}
function store(fault?:(point:FailurePoint)=>void){const p=new FormalPersistence({suffix:'feedback-'+crypto.randomUUID(),fault});stores.push(p);return p;}
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
for(const cap of [0,1,4,8,12] as const)it(`offline ${cap}h caps REAL time then uses Formal speed and scheduler`,()=>{
 const w=make(cap,3),before=JSON.stringify(w),r=advanceOffline(w,1000,1000+48*HOUR);
 expect(r.summary).toMatchObject({elapsedRealMs:48*HOUR,advancedRealMs:cap*HOUR,advancedWorldMs:cap*3*HOUR,capHours:cap});expect(r.world.time).toBe(cap*3*HOUR);expect(JSON.stringify(w)).toBe(before);
 const normal=advanceFormal(w,cap*3*HOUR).world;expect(r.world).toEqual(normal);expect(r.world.cities).toHaveLength(100);expect(r.world.worldLayer!.wildSites).toHaveLength(432);
});
it('clock rollback yields no negative advance; short absence uses the actual elapsed duration; time2 default is12h',async()=>{
 const w=make();delete w.offlineHours;expect(advanceOffline(w,2000,1000).world.time).toBe(0);expect(advanceOffline(w,1000,2350).world.time).toBe(1350);expect(advanceOffline(w,0,25*HOUR).world.time).toBe(12*HOUR);
 for(const c of w.cities){delete c.integrationTotalWorkHours;}expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
});
it('offline scheduler completes construction and training with the same anchored economy as online advance',()=>{
 let w=make(4);const c=rich(w);c.buildings.barracks=1;c.economy!.slots.barracks=1;
 w=commit(w,{type:'field.upgrade',cityId:c.id,slot:0});w=commit(w,{type:'military.recruit',cityId:c.id,unitId:'militia',count:2});
 const r=advanceOffline(w,0,HOUR);expect(r.summary).toMatchObject({buildingsCompleted:1,unitsTrained:2});expect(r.world).toEqual(advanceFormal(w,HOUR).world);expect(citySnapshot(r.world,c.id)!.fields![0].level).toBe(1);
});
it('offline load atomically persists the new wall anchor; repeated reload cannot award the same time twice',async()=>{
 const p=store(),w=await p.start(make(1));await p.db.saves.update('current',row=>{if(row.kind==='world')row.at=1000;});
 const first=await p.loadWithOffline(1000+2*HOUR);expect(first.game!.time).toBe(HOUR);expect((await p.db.saves.get('current'))?.kind).toBe('world');expect((await p.db.saves.get('current') as {at:number}).at).toBe(1000+2*HOUR);
 const second=await p.loadWithOffline(1000+2*HOUR);expect(second.game!.time).toBe(first.game!.time);expect(second.summary!.advancedWorldMs).toBe(0);expect(second.game!.revision).toBeGreaterThan(w.revision);
 const third=await p.loadWithOffline(1000+2*HOUR+500);expect(third.game!.time).toBe(HOUR+500);
});
for(const point of ['backup-write','world-write','authority-write'] as const)it(`offline ${point} failure leaves all stores unchanged and retry advances exactly once`,async()=>{
 let failure:FailurePoint|undefined;const p=store(v=>{if(v===failure)throw new Error('injected');});await p.start(make(4));await p.db.saves.update('current',row=>{if(row.kind==='world')row.at=1000;});
 const before={s:await p.db.saves.toArray(),b:await p.db.backups.toArray()};failure=point;await expect(p.loadWithOffline(1000+HOUR)).rejects.toThrow('injected');expect({s:await p.db.saves.toArray(),b:await p.db.backups.toArray()}).toEqual(before);
 failure=undefined;expect((await p.loadWithOffline(1000+HOUR)).game!.time).toBe(HOUR);expect((await p.loadWithOffline(1000+HOUR)).game!.time).toBe(HOUR);
});
it('Recovery catches up from the selected valid checkpoint wall anchor and skips metadata-invalid candidates',async()=>{
 const p=store();await p.start(make(4));const id=(await p.backupList())[0].id;await p.db.backups.update(id,{at:1000});
 const row=await p.db.saves.get('current');if(row?.kind!=='world')throw new Error('missing');row.data.checksum='0'.repeat(64);await p.db.saves.put(row);
 const r=await p.loadWithOffline(1000+HOUR);expect(r.recovered).toBe(true);expect(r.summary!.recovered).toBe(true);expect(r.game!.time).toBe(HOUR);expect((await p.loadSave()).game).toEqual(r.game);
});
it('construction capacity is5 total tasks with1 active initially; sixth is rejected without mutations',()=>{
 let w=make();const c=rich(w);for(const slot of [0,1,2,3,4])w=commit(w,{type:'field.upgrade',cityId:c.id,slot});const before=JSON.stringify(w),jobs=w.cities[0].economy!.construction;
 expect(jobs).toHaveLength(5);expect(jobs.filter(j=>j.startsAt<=w.time)).toHaveLength(1);expect(submit(w,{type:'field.upgrade',cityId:c.id,slot:5}).ack?.status).toBe('rejected');expect(JSON.stringify(w)).toBe(before);
});
it('15k unlock promotes an existing waiting job to a second lane without altering cost/duration/qualification; permanent after population drops',()=>{
 let w=make();const c=rich(w);c.buildings.center=14;c.buildings.residence=14;c.economy!.slots.residence=1;c.housing=400+HOUSING[14];c.population=14999;c.cityPromotionCompleted=true;c.economy!.milestones=[10000];
 w=commit(w,{type:'building.upgrade',cityId:c.id,key:'center'});w=commit(w,{type:'building.upgrade',cityId:c.id,key:'residence'});const old=structuredClone(w.cities[0].economy!.construction[1]);w=advanceFormal(w,HOUR).world;
 const jobs=w.cities[0].economy!.construction;expect(jobs[1].lane).toBe(1);expect(jobs[1].startsAt).toBe(HOUR);for(const key of ['paidResources','durationMs','qualificationHousing','toLevel','commandId'] as const)expect(jobs[1][key]).toEqual(old[key]);
 w.cities[0].population=20;expect(w.cities[0].economy!.milestones).toContain(15000);w=commit(w,{type:'field.upgrade',cityId:c.id,slot:2});expect(w.cities[0].economy!.construction).toHaveLength(3);expect(w.cities[0].economy!.construction.filter(j=>j.startsAt<=w.time)).toHaveLength(2);
});
it('cancel waiting refunds100%, removes its scheduler event and promotes subsequent jobs; active cancellation refunds50%',()=>{
 let w=make();const c=rich(w);for(const slot of [0,1,2])w=commit(w,{type:'field.upgrade',cityId:c.id,slot});const jobs=w.cities[0].economy!.construction,stock=w.cities[0].stock.food;
 w=commit(w,{type:'construction.cancel',cityId:c.id,constructionCommandId:jobs[1].commandId});expect(w.cities[0].stock.food).toBe(stock+fieldCost('food',1).food);expect(w.events.some(e=>e.id===jobs[1].eventId)).toBe(false);expect(w.cities[0].economy!.construction[1].startsAt).toBe(jobs[0].durationMs);
 const current=w.cities[0].stock.food;w=commit(w,{type:'construction.cancel',cityId:c.id,constructionCommandId:jobs[0].commandId});expect(w.cities[0].stock.food).toBe(current+Math.floor(fieldCost('food',1).food*.5));expect(w.cities[0].economy!.construction[0].startsAt).toBe(0);
});
it('cancelling a new building cancels dependent upgrades, returns its chosen slot and survives save/reload/Recovery',async()=>{
 const p=store(),start=make();rich(start);let w=await p.start(start),c=w.cities[0];
 async function persisted(payload:FormalCommand){const before=w.revision,r=submit(w,payload);expect(r.ack?.status,r.ack?.reason).toBe('committed');w=await p.save(r.world,r.reports,before);}
 await persisted({type:'building.upgrade',cityId:c.id,key:'residence',slot:8});await persisted({type:'building.upgrade',cityId:c.id,key:'residence'});
 const checkpoint=(await p.backupList())[0].id,job=w.cities[0].economy!.construction[0],paid=w.cities[0].stock.food;
 await persisted({type:'construction.cancel',cityId:c.id,constructionCommandId:job.commandId});c=w.cities[0];
 expect(c.buildings.residence).toBeUndefined();expect(c.economy!.slots.residence).toBeUndefined();expect(c.economy!.construction).toEqual([]);expect(c.stock.food).toBe(paid+Math.floor(buildingCost('residence',1).food*.5)+buildingCost('residence',2).food);
 expect((await p.loadSave()).game).toEqual(w);expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
 const restored=await p.restore(checkpoint);expect(restored.cities[0].economy!.construction).toHaveLength(2);expect(restored.cities[0].economy!.slots.residence).toBe(8);
});
it('military capacity stays5,20k promotes waiting work to2 active, and cancellation preserves completed units and refund semantics',async()=>{
 let w=make();const c=rich(w);c.buildings.barracks=1;c.economy!.slots.barracks=1;c.housing=30400;c.population=19999;
 for(let i=0;i<5;i++)w=commit(w,{type:'military.recruit',cityId:c.id,unitId:'militia',count:50});expect(w.cities[0].military!.queue.filter(j=>j.startsAt<=w.time)).toHaveLength(1);
 const before=JSON.stringify(w);expect(submit(w,{type:'military.recruit',cityId:c.id,unitId:'militia',count:1}).ack?.status).toBe('rejected');expect(JSON.stringify(w)).toBe(before);
 w.cities[0].population=19999;w=advanceFormal(w,HOUR).world;expect(w.cities[0].economy!.milestones).toContain(20000);expect(w.cities[0].military!.queue.filter(j=>j.startsAt<=w.time)).toHaveLength(2);
 const active=w.cities[0].military!.queue[0],trained=w.cities[0].military!.units.militia,paid=w.cities[0].stock.food;w=commit(w,{type:'military.cancel',cityId:c.id,trainingCommandId:active.commandId});expect(w.cities[0].military!.units.militia).toBe(trained);expect(w.cities[0].stock.food).toBe(paid+Math.floor(active.unitCost.food*active.remaining*.8));expect(w.events.some(e=>e.id===active.eventId)).toBe(false);expect(w.cities[0].military!.queue.filter(j=>j.startsAt<=w.time)).toHaveLength(2);
 expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
});
it('cancel of waiting military task promotes the next task and does not refund completed units twice',()=>{
 let w=make();const c=rich(w);c.buildings.barracks=1;c.economy!.slots.barracks=1;for(let i=0;i<3;i++)w=commit(w,{type:'military.recruit',cityId:c.id,unitId:'militia',count:1});const [first,second]=w.cities[0].military!.queue;
 w=commit(w,{type:'military.cancel',cityId:c.id,trainingCommandId:second.commandId});expect(w.cities[0].military!.queue[1].startsAt).toBe(first.nextAt);w=advanceFormal(w,first.nextAt*2).world;expect(w.cities[0].military!.units.militia).toBe(2);expect(w.cities[0].military!.queue).toEqual([]);
});

it('offline arrival counts founded cities but does not misreport transferred escorts as newly trained units',()=>{
 let w=make(4);const c=rich(w);w.factions[0].age=2;c.buildings.castle=1;c.economy!.slots.castle=1;c.housing=30400;c.population=3000;c.military!.units.spearman=20;
 w=commit(w,{type:'settlement.prepare',cityId:c.id});w=advanceFormal(w,4*HOUR).world;
 const points=[];for(let y=c.y-3;y<=c.y+3;y++)for(let x=c.x-3;x<=c.x+3;x++)if(buildable(terrainAt(w,x,y))&&!spatial(w).at(x,y).city&&!spatial(w).at(x,y).site)points.push({x,y});
 w=commit(w,{type:'settlement.dispatch',cityId:c.id,...points[0],name:'新聚落',escort:{spearman:20}});const r=advanceOffline(w,0,HOUR);expect(r.summary.citiesFounded).toBe(1);expect(r.summary.unitsTrained).toBe(0);expect(r.world.cities.at(-1)!.military!.units.spearman).toBe(20);
});
