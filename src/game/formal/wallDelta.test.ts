import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createFormalWorld} from './generator';
import {order} from './testSupport';
import {submitFormalOrder,advanceFormal} from './reducer';
import {buildingCost,buildingDuration,buildingLevel,storageCapacity} from './catalogB3';
import {validateFormalWorld} from './schema';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence,type FailurePoint} from '../persistence';
import type {FormalWorld,FormalCommand,Resources} from './model';
import {cityPresentation} from '../presentation/artMap';
import {constructionAction,constructionPreview} from '../presentation/cityActions';
import {advanceOffline} from './offline';
const base=createFormalWorld({campaign:'wall-delta',seed:90217}),keys=['food','wood','stone','gold'] as const;
const times=[15,18,22,27,33,40,50,60,75,90,110,135,165,200,270],costs={food:30,wood:70,stone:160,gold:40};
let serial=0;const stores:FormalPersistence[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
function make(speed=1,center=2){const w=structuredClone(base);w.speed=speed;const c=w.cities[0];c.buildings.center=center;c.buildings['warehouse.0']=15;c.economy!.slots['warehouse.0']=0;c.stock={food:90000,wood:90000,stone:90000,gold:90000};validateFormalWorld(w);return w;}
function submit(w:FormalWorld,p:FormalCommand){return submitFormalOrder(w,order(w,'wall-'+(++serial),p));}
function commit(w:FormalWorld,p:FormalCommand){const r=submit(w,p);expect(r.ack?.status,r.ack?.reason).toBe('committed');return r.world;}
const wall=(w:FormalWorld,lane?:0|1)=>({type:'building.upgrade' as const,cityId:w.cities[0].id,key:'wall',...(lane===undefined?{}:{lane})});
function store(fault?:(point:FailurePoint)=>void){const s=new FormalPersistence({suffix:'wall-'+crypto.randomUUID(),fault});stores.push(s);return s;}
it('Lv0 to15: independent v85 cost/time, all center accelerators and five speeds; completion alone advances the sole wall authority',()=>{
 const rows:unknown[]=[];
 for(const speed of [1,3,6,10,25])for(const center of [2,5,15]){
  let w=make(speed,center);
  for(let lv=1;lv<=15;lv++){
   const before=w.cities[0],slots=structuredClone(before.economy!.slots),expectedCost=Object.fromEntries(keys.map(r=>[r,Math.floor(costs[r]*1.38**(lv-1)/5+.5)*5])) as Resources,expectedMs=Math.round(times[lv-1]*60000*.964**(center-1));
   expect(buildingCost('wall',lv)).toEqual(expectedCost);expect(buildingDuration('wall',lv,center)).toBe(expectedMs);
   const started=commit(w,wall(w)),c=started.cities[0],j=c.economy!.construction[0];expect(c.wallLevel).toBe(lv-1);expect(c.buildings).not.toHaveProperty('wall');expect(c.economy!.slots).toEqual(slots);expect(j).toMatchObject({fromLevel:lv-1,toLevel:lv,durationMs:expectedMs,startsAt:w.time,paidResources:expectedCost});for(const r of keys)expect(c.stock[r]).toBe(before.stock[r]-expectedCost[r]);
   const edge=advanceFormal(started,j.startsAt+j.durationMs-1).world;expect(edge.cities[0].wallLevel).toBe(lv-1);w=advanceFormal(edge,j.startsAt+j.durationMs).world;expect(w.cities[0].wallLevel).toBe(lv);expect(buildingLevel(w.cities[0],'wall')).toBe(lv);expect(cityPresentation(w,w.cities[0]).wall).toBe(lv);expect(w.cities[0].economy!.construction).toEqual([]);expect(w.events.some(e=>e.id===j.eventId)).toBe(false);
   rows.push({speed,center,targetLevel:lv,cost:expectedCost,durationMs:expectedMs,realSeconds:expectedMs/speed/1000,completedWallLevel:w.cities[0].wallLevel});
  }
  const before=JSON.stringify(w);expect(submit(w,wall(w)).ack?.status).toBe('rejected');expect(JSON.stringify(w)).toBe(before);expect(constructionAction(w,w.cities[0],{key:'wall'}).cost).toBeNull();
 }
 mkdirSync('docs/wall-delta-v03022',{recursive:true});writeFileSync('docs/wall-delta-v03022/wall-level-speed-matrix.json',JSON.stringify({authority:'v85',comparisons:rows},null,2));expect(rows).toHaveLength(225);
},60000);
it('dark-age center2 prerequisite, exact resources, identity and fixed-slot rules are enforced without mutation',()=>{
 for(const variant of ['center','resources','slot','identity','lane'] as const){const w=make(),c=w.cities[0];let p=wall(w);if(variant==='center')c.buildings.center=1;if(variant==='resources')c.stock.stone=159;if(variant==='identity')p={...p,key:'wall.0'};if(variant==='lane')p={...p,lane:1};const before=JSON.stringify(w),t=submit(w,variant==='slot'?{...p,slot:0}:p);expect(t.ack?.status).toBe('rejected');expect(t.world).toBe(w);expect(JSON.stringify(w)).toBe(before);}
 const w=make(),c=w.cities[0];c.buildings={center:2};c.economy!.slots={};for(let i=0;i<15;i++){c.buildings['warehouse.'+i]=1;c.economy!.slots['warehouse.'+i]=i;}c.stock={food:2000,wood:2000,stone:2000,gold:2000};validateFormalWorld(w);expect(constructionAction(w,c,{key:'wall'}).reasons).toEqual([]);const done=commit(w,wall(w));expect(Object.keys(done.cities[0].economy!.slots)).toHaveLength(15);expect(done.cities[0].economy!.slots).not.toHaveProperty('wall');
});
it('same-wall upgrades remain ordered in one lane; shared capacity is5 and inherited cancellation removes dependent queued work',()=>{
 let w=make();for(let i=0;i<5;i++)w=commit(w,wall(w));const c=w.cities[0],jobs=structuredClone(c.economy!.construction),before=JSON.stringify(w);expect(jobs.map(j=>j.toLevel)).toEqual([1,2,3,4,5]);expect(jobs.map(j=>j.lane)).toEqual([0,0,0,0,0]);expect(jobs[1].startsAt).toBe(jobs[0].durationMs);expect(submit(w,wall(w)).ack?.status).toBe('rejected');expect(JSON.stringify(w)).toBe(before);
 w=commit(w,{type:'construction.cancel',cityId:c.id,constructionCommandId:jobs[1].commandId});for(const r of keys)expect(w.cities[0].stock[r]).toBe(c.stock[r]+jobs.slice(1).reduce((n,j)=>n+j.paidResources![r],0));expect(w.cities[0].economy!.construction).toHaveLength(1);expect(w.cities[0].wallLevel).toBe(0);expect(w.events.some(e=>jobs.slice(1).some(j=>j.eventId===e.id))).toBe(false);
 const paid=w.cities[0].stock;w=commit(w,{type:'construction.cancel',cityId:c.id,constructionCommandId:jobs[0].commandId});for(const r of keys)expect(w.cities[0].stock[r]).toBe(paid[r]+Math.floor(jobs[0].paidResources![r]*.5));expect(w.cities[0].economy!.construction).toEqual([]);expect(w.cities[0].buildings).not.toHaveProperty('wall');expect(w.cities[0].wallLevel).toBe(0);
 w=advanceFormal(w,jobs[2].startsAt+jobs[2].durationMs).world;expect(w.cities[0].wallLevel).toBe(0);
});
it('cancel queued wall does not change completed level; refunds remain bounded by existing warehouse policy',()=>{
 let w=make();w.cities[0].wallLevel=5;w=commit(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0});w=commit(w,wall(w));const c=w.cities[0],job=c.economy!.construction[1];for(const r of keys)c.stock[r]=storageCapacity(c);const cancelled=commit(w,{type:'construction.cancel',cityId:c.id,constructionCommandId:job.commandId});expect(cancelled.cities[0].wallLevel).toBe(5);for(const r of keys)expect(cancelled.cities[0].stock[r]).toBe(storageCapacity(c));
});
it('wall shares the permanent second construction lane and promotes waiting work at15k without changing snapshots',()=>{
 let w=make(1,14),c=w.cities[0];c.wallLevel=14;c.buildings.residence=15;c.economy!.slots.residence=1;c.housing=30400;c.population=14999;c.economy!.milestones=[10000];c.fields![0].level=9;
 w=commit(w,wall(w));w=commit(w,{type:'field.upgrade',cityId:c.id,slot:0});const old=structuredClone(w.cities[0].economy!.construction[1]);w=advanceFormal(w,3600000).world;c=w.cities[0];const j=c.economy!.construction.find(j=>j.commandId===old.commandId)!;expect(c.economy!.milestones).toContain(15000);expect(j.lane).toBe(1);expect(j.startsAt).toBe(3600000);expect(j.paidResources).toEqual(old.paidResources);expect(j.durationMs).toBe(old.durationMs);expect(c.wallLevel).toBe(14);
 let two=make();two.cities[0].economy!.milestones=[15000];two=commit(two,wall(two,0));two=commit(two,{type:'field.upgrade',cityId:two.cities[0].id,slot:0,lane:1});two=commit(two,wall(two,1));const jobs=two.cities[0].economy!.construction;expect(jobs.map(j=>j.lane)).toEqual([0,1,0]);expect(jobs[2].startsAt).toBe(jobs[0].durationMs);
});
it('clock/scheduler snapshots remain fixed after center change; duplicate/stale/id-conflict and completed-cancel cannot pay or complete twice',()=>{
 const w=make(),cmd=order(w,'wall-replay',wall(w)),first=submitFormalOrder(w,cmd);expect(first.ack?.status).toBe('committed');const started=first.world,j=started.cities[0].economy!.construction[0];expect(submitFormalOrder(started,cmd).ack?.status).toBe('duplicate');expect(submitFormalOrder(started,{...cmd,commandId:order(w,'wall-stale',wall(w)).commandId}).ack?.status).toBe('rejected');expect(submitFormalOrder(started,{...cmd,payload:{...wall(w),key:'center'}}).ack?.status).toBe('rejected');started.cities[0].buildings.center=15;expect(started.cities[0].economy!.construction[0].durationMs).toBe(j.durationMs);
 const done=advanceFormal(started,j.startsAt+j.durationMs).world,again=advanceFormal(done,done.time).world;expect(again.cities[0].wallLevel).toBe(1);expect(submitFormalOrder(done,cmd).ack?.status).toBe('duplicate');expect(submit(done,{type:'construction.cancel',cityId:done.cities[0].id,constructionCommandId:j.commandId}).ack?.status).toBe('rejected');
});
it('save/load and native Recovery keep active+queued wall work, final authority and durable dedupe',async()=>{
 const s=store();let w=await s.start(make());for(let i=0;i<2;i++){const t=submit(w,wall(w));w=await s.save(t.world,t.reports,w.revision);}const job=w.cities[0].economy!.construction[0],checkpoint=(await s.backupList())[0].id;
 const decoded=(await decodeSave(await encodeSave(w))).world;expect(decoded).toEqual(w);const loaded=(await s.loadSave()).game!;expect(loaded).toEqual(w);let finish=advanceFormal(loaded,loaded.cities[0].economy!.construction[1].startsAt+loaded.cities[0].economy!.construction[1].durationMs);finish.world=await s.save(finish.world,finish.reports,w.revision);expect(finish.world.cities[0].wallLevel).toBe(2);expect((await s.loadSave()).game!.cities[0].wallLevel).toBe(2);
 const restored=await s.restore(checkpoint);expect(restored.cities[0].wallLevel).toBe(0);expect(restored.cities[0].economy!.construction).toHaveLength(2);const end=advanceFormal(restored,restored.cities[0].economy!.construction[1].startsAt+restored.cities[0].economy!.construction[1].durationMs).world;expect(end.cities[0].wallLevel).toBe(2);expect(end.events.some(e=>e.id===job.eventId)).toBe(false);
});
it('R1 automatic Recovery skips metadata-invalid wall completion checkpoint then completes recovered wall exactly once',async()=>{
 const s=store();let w=await s.start(make());const cmd=order(w,'wall-r1',wall(w)),queued=submitFormalOrder(w,cmd);w=await s.save(queued.world,queued.reports,w.revision);const aId=(await s.backupList())[0].id,j=w.cities[0].economy!.construction[0],completed=advanceFormal(w,j.durationMs);const b=await s.save(completed.world,completed.reports,w.revision),bId=(await s.backupList())[0].id;const current=await s.db.saves.get('current');if(!current||current.kind!=='world')throw new Error('current missing');current.data.checksum='0'.repeat(64);await s.db.saves.put(current);await s.db.backups.update(bId,{gameTime:b.time+1});
 const r=await s.loadSave();expect(r.recovered).toBe(true);expect(r.game!.cities[0].wallLevel).toBe(0);expect((await s.backupList()).some(p=>p.id===aId)).toBe(true);expect(submitFormalOrder(r.game!,cmd).ack?.status).toBe('duplicate');const next=advanceFormal(r.game!,j.durationMs);const done=await s.save(next.world,next.reports,r.game!.revision);expect(done.cities[0].wallLevel).toBe(1);expect(done.cities[0].economy!.construction).toEqual([]);expect((await s.loadSave()).game).toEqual(done);
});
for(const point of ['backup-write','world-write','authority-write'] as const)it('atomic wall completion rollback and retry at '+point,async()=>{
 let fail:FailurePoint|undefined;const s=store(p=>{if(p===fail)throw new Error('wall atomic fault');});let w=await s.start(make());const t=submit(w,wall(w));w=await s.save(t.world,t.reports,w.revision);const j=w.cities[0].economy!.construction[0],done=advanceFormal(w,j.durationMs);fail=point;await expect(s.save(done.world,done.reports,w.revision)).rejects.toThrow('wall atomic fault');expect((await s.loadSave()).game).toEqual(w);fail=undefined;const retry=await s.save(done.world,done.reports,w.revision);expect(retry.cities[0].wallLevel).toBe(1);expect(retry.cities[0].economy!.construction).toEqual([]);
});
it('wall offline completion equals online and a second elapsed-time application does not repeat it',()=>{
 const started=commit(make(),wall(make())),j=started.cities[0].economy!.construction[0],offline=advanceOffline(started,0,j.durationMs);expect(offline.world).toEqual(advanceFormal(started,j.durationMs).world);expect(offline.world.cities[0].wallLevel).toBe(1);expect(advanceOffline(offline.world,j.durationMs,j.durationMs).world.cities[0].wallLevel).toBe(1);
});
it('native contract rejects a second stored wall authority, consumed slots and malformed wall level chains',()=>{
 for(const variant of ['mirror','slot','chain'] as const){const w=commit(make(),wall(make()));if(variant==='mirror')w.cities[0].buildings.wall=0;if(variant==='slot')w.cities[0].economy!.slots.wall=1;if(variant==='chain'){w.cities[0].economy!.construction[0].fromLevel=5;w.cities[0].economy!.construction[0].toLevel=6;}expect(()=>validateFormalWorld(w)).toThrow();}
});
it('wall preview shares real prerequisites, cost/time and queue state without mutating the campaign',()=>{
 const w=make(),before=JSON.stringify(w),c=w.cities[0],preview=constructionPreview(w,c,{key:'wall'});expect(preview?.target).toEqual({kind:'building',key:'wall'});expect(preview?.durationMs).toBe(867600);expect(constructionAction(w,c,{key:'wall'})).toMatchObject({next:1,cost:costs,duration:867600,reasons:[]});expect(JSON.stringify(w)).toBe(before);
});
