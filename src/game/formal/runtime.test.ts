import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {createFormalFixture,fixtureIds} from './fixture';
import {createFormalWorld as nativeWorld} from './generator';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
// Established admission/load lab; raw new-world shield rules have separate P0-C-10 coverage.
const createFormalWorld=(...args:Parameters<typeof nativeWorld>)=>{const w=isolatedAutonomyFixture(nativeWorld(...args));for(const f of w.factions)f.protectionUntil=0;return w;};
import {order} from './testSupport';
import type {FormalWorld,FormalCommand} from './model';
import {researchCity,ownSecond,build} from './developmentTestSupport';
import {advanceOffline} from './offline';
import {validateFormalWorld} from './schema';
import {playerOrderBase} from '../orderAdmission';
import {submitFormalOrder} from './reducer';
import {governanceBase} from '../governanceAdmission';
import {applyWorldPatch} from '../worldStream';
const storage=vi.hoisted(()=>({hasLegacyCampaign:vi.fn().mockResolvedValue(false),exportLegacyCampaign:vi.fn(),loadWithOffline:vi.fn(),save:vi.fn(),startCampaign:vi.fn(),restore:vi.fn(),importSave:vi.fn(),backupList:vi.fn(),clearSavedGames:vi.fn(),exportStoredSave:vi.fn(),readReportPage:vi.fn(),reportStatus:vi.fn().mockResolvedValue({unread:0,alerts:0,counts:{all:0,battle:0,chronicle:0}}),reportAction:vi.fn()}));
vi.mock('../persistence',()=>storage);
let messages:Record<string,any>[],port:{postMessage:(r:Record<string,any>)=>void;onmessage:((e:{data:unknown})=>void)|null},initial:FormalWorld;
const send=(data:unknown)=>port.onmessage!({data});
async function until(test:()=>boolean){await vi.waitFor(()=>expect(test()).toBe(true));}
let realNow=0;
beforeEach(async()=>{
 vi.restoreAllMocks();realNow=0;vi.spyOn(performance,'now').mockImplementation(()=>realNow);
 vi.resetModules();vi.clearAllMocks();messages=[];initial=createFormalFixture();
 storage.loadWithOffline.mockResolvedValue({game:initial,recovered:false});storage.save.mockImplementation(async(w:FormalWorld)=>w);storage.startCampaign.mockImplementation(async(w:FormalWorld)=>w);storage.restore.mockResolvedValue(initial);storage.importSave.mockResolvedValue(initial);
 port={postMessage:r=>messages.push(structuredClone(r)),onmessage:null};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',vi.fn());
 await import('../runtime.worker');send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
});
it('active Worker does not acknowledge or switch a draft until persistence resolves',async()=>{
 let finish!:(w:FormalWorld)=>void,submitted!:FormalWorld;storage.save.mockImplementation((w:FormalWorld)=>{submitted=w;return new Promise<FormalWorld>(r=>{finish=r;});});
 const cmd=order(initial,'wait',{type:'city.rename',cityId:fixtureIds.home,name:'已改名'});send({type:'command',order:cmd});await until(()=>storage.save.mock.calls.length===1);
 expect(messages).toEqual([{type:'commandReceived',commandId:cmd.commandId,requestId:undefined}]);finish(submitted);await until(()=>messages.some(r=>r.type==='commandAck'));
 expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');expect(messages.find(r=>r.type==='state')!.world.cities[0].name).toBe('已改名');
});
it('failed commit gives rejected ack and prior world; retry and replay only save once successfully',async()=>{
 storage.save.mockRejectedValueOnce(new Error('Transaction failed'));
 const cmd=order(initial,'retry',{type:'city.rename',cityId:fixtureIds.home,name:'新名'});send({type:'command',order:cmd});await until(()=>messages.some(r=>r.type==='commandAck'));
 expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('rejected');expect(messages.find(r=>r.type==='state')!.world).toEqual(initial);
 messages=[];send({type:'command',order:cmd});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');
 messages=[];send({type:'command',order:cmd});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(2);
});
it('requests share one serialized authority and reject an overlapping stale command',async()=>{
 const a=order(initial,'a',{type:'city.rename',cityId:fixtureIds.home,name:'甲'}),b=order(initial,'b',{type:'city.rename',cityId:fixtureIds.home,name:'乙'});
 send({type:'command',order:a});send({type:'command',order:b});await until(()=>messages.filter(r=>r.type==='commandAck').length===2);
 expect(messages.filter(r=>r.type==='commandAck').map(r=>r.ack.status)).toEqual(['committed','rejected']);expect(storage.save).toHaveBeenCalledTimes(1);
});
for(const type of ['restore','import'] as const)it(`${type} mid-transaction failure never exposes success`,async()=>{
 storage[type==='restore'?'restore':'importSave'].mockRejectedValueOnce(new Error('rollback'));
 send(type==='restore'?{type,id:1,transitionId:'fail'}:{type,text:'{}',transitionId:'fail'});await until(()=>messages.some(r=>r.type==='switchFailed'));
 expect(messages.some(r=>r.type==='switched')).toBe(false);expect(messages.find(r=>r.type==='switchFailed')!.world).toEqual(initial);
});
it('restart loads durable receipts and replay does not submit a second save',async()=>{
 const cmd=order(initial,'persist',{type:'city.rename',cityId:fixtureIds.home,name:'甲'});send({type:'command',order:cmd});await until(()=>messages.some(r=>r.type==='commandAck'));
 const committed=messages.find(r=>r.type==='state')!.world;storage.loadWithOffline.mockResolvedValue({game:committed,recovered:false});messages=[];
 vi.resetModules();await import('../runtime.worker');send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];send({type:'command',order:cmd});await until(()=>messages.some(r=>r.type==='commandAck'));
 expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(1);
});

for(const speed of [1,3,6,10,25])it(`${speed}X construction completes at its real deadline, not the old ten-second tick`,async()=>{
 const generated=createFormalWorld({campaign:'speed-'+speed,seed:90217,speed});
 storage.loadWithOffline.mockResolvedValue({game:generated,recovered:false});messages=[];send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
 const city=generated.cities[0],slot=city.fields!.find(f=>f.resource==='wood')!.slot;send({type:'command',order:order(generated,'timed-field',{type:'field.upgrade',cityId:city.id,slot})});await until(()=>messages.some(r=>r.type==='commandAck'));
 const started=messages.filter(r=>r.type==='state').at(-1)!.world as FormalWorld,job=started.cities[0].economy!.construction[0];expect(job).toBeDefined();
 const finishAt=job.startsAt+job.durationMs,deadline=Math.ceil(finishAt/speed);if(speed===50)expect(Math.ceil(job.durationMs/speed/1000)).toBe(2);
 const timer=vi.mocked(setInterval).mock.calls[0];expect(timer[1]).toBe(100);const tick=timer[0] as ()=>void;
 messages=[];realNow=deadline-1;tick();if(realNow>=10000)await until(()=>messages.some(r=>r.type==='state'));
 const before=(messages.filter(r=>r.type==='state').at(-1)?.world??started) as FormalWorld;expect(before.cities[0].fields!.find(f=>f.slot===slot)!.level).toBe(0);
 messages=[];realNow=deadline;tick();await until(()=>messages.some(r=>r.type==='state'));
 const finished=messages.filter(r=>r.type==='state').at(-1)!.world as FormalWorld;expect(finished.time).toBe(Math.floor(deadline*speed));expect(finished.cities[0].fields!.find(f=>f.slot===slot)!.level).toBe(1);expect(finished.cities[0].economy!.construction).toHaveLength(0);
});
it('polling is coalesced while the durable advance is pending and catches up elapsed real time',async()=>{
 const tick=vi.mocked(setInterval).mock.calls[0][0] as ()=>void;let finish!:(w:FormalWorld)=>void,draft!:FormalWorld;
 storage.save.mockImplementation(w=>{draft=w;return new Promise<FormalWorld>(r=>{finish=r;});});realNow=10000;tick();await until(()=>storage.save.mock.calls.length===1);
 realNow=50000;for(let i=0;i<20;i++)tick();expect(storage.save).toHaveBeenCalledTimes(1);expect(messages).toEqual([]);
 finish(draft);await until(()=>messages.some(r=>r.type==='state'));storage.save.mockImplementation(async w=>w);messages=[];realNow=60000;tick();await until(()=>messages.some(r=>r.type==='state'));
 expect(messages.filter(r=>r.type==='state').at(-1)!.world.time).toBe(60000);
});

for(const speed of [1,3,6,10,25]){
 it(`${speed}X idle polling does not publish/save per second and checkpoints at ten seconds`,async()=>{
  const w=createFormalFixture({speed});storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
  const tick=vi.mocked(setInterval).mock.calls[0][0] as ()=>void;
  for(realNow=100;realNow<10000;realNow+=100)tick();await Promise.resolve();await Promise.resolve();expect(storage.save).not.toHaveBeenCalled();expect(messages).toEqual([]);
  realNow=10000;tick();await until(()=>messages.some(r=>r.type==='state'));expect(storage.save).toHaveBeenCalledTimes(1);
  const s=messages.find(r=>r.type==='state')!;expect(s.world.time).toBe(10000*speed);expect(s.clock.time).toBe(10000*speed);expect(s.passiveRevisionBase).toBe(0);
 });
 it(`${speed}X a new construction starts at actual admission time and saves a single revision`,async()=>{
  const w=createFormalWorld({campaign:'admission-'+speed,seed:90217,speed});storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
  realNow=1550;send({type:'command',requestId:'click',order:order(w,'admission',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})});await until(()=>messages.some(r=>r.type==='requestDone'));
  const next=messages.find(r=>r.type==='state')!.world as FormalWorld;
  expect(next.time).toBe(1550*speed);expect(next.cities[0].economy!.construction[0].startsAt).toBe(next.time);expect(next.revision).toBe(w.revision+1);expect(storage.save).toHaveBeenCalledTimes(1);expect(storage.save.mock.calls[0][2]).toBe(w.revision);expect(()=>validateFormalWorld(next)).not.toThrow();
 });
 it(`${speed}X a clock checkpoint revalidates the exact click once without a rejected acknowledgement or resubmission`,async()=>{
  const w=createFormalFixture({speed});storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
  const original=order(w,'clock-click',{type:'city.rename',cityId:fixtureIds.home,name:'時鐘不阻擋'}),base=playerOrderBase(w,original.payload);
  realNow=10000;(vi.mocked(setInterval).mock.calls[0][0] as ()=>void)();await until(()=>messages.some(r=>r.type==='state'));messages=[];
  send({type:'command',order:original,playerBase:base});await until(()=>messages.some(r=>r.type==='commandAck'));
  expect(messages.filter(r=>r.type==='commandAck').map(r=>r.ack.status)).toEqual(['committed']);
  const next=messages.find(r=>r.type==='state')!.world as FormalWorld;expect(next.commandReceipts).toHaveLength(1);expect(next.cities[0].name).toBe('時鐘不阻擋');
  messages=[];send({type:'command',order:original,playerBase:base});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(2);
 });
 for(const mode of ['training','research','settlement','logistics'] as const)it(`${speed}X ${mode} uses the real deadline and agrees with offline completion`,async()=>{
  const w=createFormalWorld({campaign:mode+'-'+speed,seed:90217,speed}),city=researchCity(w);let payload:FormalCommand,at:(w:FormalWorld)=>number,done:(w:FormalWorld)=>boolean;
  if(mode==='training'){payload={type:'military.recruit',cityId:city.id,unitId:'militia',count:1};at=w=>w.cities[0].military!.queue[0].nextAt;done=w=>w.cities[0].military!.units.militia===1;}
  else if(mode==='research'){payload={type:'research.start',cityId:city.id,techId:'blacksmith.melee.1'};at=w=>w.researchProjects[0].startedAt!+w.researchProjects[0].durationSnapshot.durationMs;done=w=>w.factions[0].techIds.includes('blacksmith.melee.1');}
  else if(mode==='settlement'){build(city,'castle',1);payload={type:'settlement.prepare',cityId:city.id};at=w=>w.settlements![0].startedAt+w.settlements![0].prepDurationMs;done=w=>w.settlements![0].phase==='ready';}
  else {const dest=ownSecond(w);payload={type:'logistics.dispatch',cityId:city.id,destinationCityId:dest.id,resources:{food:100,wood:0,stone:0,gold:0}};at=w=>w.logistics![0].arrivalAt;done=w=>w.logistics![0].phase==='returning';}
  storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
  send({type:'command',order:order(w,mode+'-start',payload)});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');
  const started=messages.find(r=>r.type==='state')!.world as FormalWorld,finish=at(started),deadline=Math.ceil(finish/speed),tick=vi.mocked(setInterval).mock.calls[0][0] as ()=>void;expect(done(started)).toBe(false);
  messages=[];realNow=deadline-1;tick();if(realNow>=10000)await until(()=>messages.some(r=>r.type==='state'));
  expect(done(messages.filter(r=>r.type==='state').at(-1)?.world??started)).toBe(false);
  messages=[];realNow=deadline;tick();await until(()=>messages.some(r=>r.type==='state'));const finished=messages.find(r=>r.type==='state')!.world as FormalWorld;expect(done(finished)).toBe(true);
  const offline=advanceOffline(started,0,deadline);expect(done(offline.world)).toBe(true);expect(finished.time).toBe(offline.world.time);expect(finished.cities).toEqual(offline.world.cities);expect(finished.events).toEqual(offline.world.events);expect(finished.researchProjects).toEqual(offline.world.researchProjects);expect(finished.settlements).toEqual(offline.world.settlements);expect(finished.logistics).toEqual(offline.world.logistics);
 });
}
it('a due event crossed by an original click commits first and must not auto-retry a changed intention',async()=>{
 const w=createFormalWorld({campaign:'event-click',seed:90217,speed:25});storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
 send({type:'command',order:order(w,'first',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})});await until(()=>messages.some(r=>r.type==='commandAck'));const started=messages.find(r=>r.type==='state')!.world as FormalWorld;
 const original=order(started,'second',{type:'field.upgrade',cityId:w.cities[0].id,slot:0}),base=playerOrderBase(started,original.payload);messages=[];
 realNow=Math.ceil((started.cities[0].economy!.construction[0].startsAt+started.cities[0].economy!.construction[0].durationMs)/25);send({type:'command',order:original,playerBase:base});await until(()=>messages.some(r=>r.type==='commandAck'));
 const ack=messages.find(r=>r.type==='commandAck')!.ack;expect(ack.status).toBe('rejected');const state=messages.filter(r=>r.type==='state').at(-1)!;expect(state.world.cities[0].economy.construction).toEqual([]);expect(state.world.commandReceipts.some((r:any)=>r.commandId===original.commandId)).toBe(false);
});
for(const speed of [1,10,25])for(const dense of [false,true])it(`${speed}X governance bridges its own catch-up with ${dense?'100 armies':'low load'} and never duplicates payment or events`,async()=>{
 let w=createFormalWorld({campaign:'governance-'+speed+'-'+dense,seed:90217,speed});build(w.cities[0],'townhall',1);
 if(dense){for(const c of w.cities)c.military!.units={militia:40};for(let i=0;i<100;i++){
  const c=w.cities[i],t=submitFormalOrder(w,{...order(w,'dense-'+i,{type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'city',cityId:w.cities[(i+1)%100].id},units:{militia:10}}),issuerId:c.ownerFactionId});expect(t.ack?.status).toBe('committed');w=t.world;
 }expect(w.armies).toHaveLength(100);}
 storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
 const first=order(w,'commission',{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'economy',budget:2400,reserve:180});send({type:'command',order:first});await until(()=>messages.some(r=>r.type==='commandAck'));
 if(first.payload.type!=='governance.set')throw Error('test setup');
 const started=messages.filter(r=>r.type==='state').at(-1)!.world as FormalWorld,change=order(started,'change',{...first.payload,policy:'reserve'});
 realNow=dense?Math.ceil(Math.min(...started.armies.map(a=>a.arrivalAt!))/speed):100;messages=[];(vi.mocked(setInterval).mock.calls[0][0] as ()=>void)();send({type:'command',order:change,governanceBase:governanceBase(started,w.cities[0].id)});await until(()=>messages.some(r=>r.type==='commandAck'));
 expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');const after=messages.filter(r=>r.type==='state').at(-1)!.world as FormalWorld;
 expect(after.governors!.find(g=>g.cityId===w.cities[0].id)?.policy).toBe('reserve');expect(after.commandReceipts.filter(r=>r.commandId===change.commandId)).toHaveLength(1);expect(after.events.filter(e=>e.type==='governance.decide'&&e.cityId===w.cities[0].id)).toHaveLength(1);expect(()=>validateFormalWorld(after)).not.toThrow();
 const stock=structuredClone(after.cities[0].stock),spent=structuredClone(after.governors![0].spent),events=structuredClone(after.events),calls=storage.save.mock.calls.length;
 messages=[];send({type:'command',order:change});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(calls);expect(messages.find(r=>r.type==='state')!.world.cities[0].stock).toEqual(stock);expect(messages.find(r=>r.type==='state')!.world.governors[0].spent).toEqual(spent);expect(messages.find(r=>r.type==='state')!.world.events).toEqual(events);
 messages=[];send({type:'command',order:order(started,'stale-setting',{...first.payload,policy:'military'}),governanceBase:governanceBase(started,w.cities[0].id)});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('rejected');expect(messages.find(r=>r.type==='commandAck')!.ack.reason).toContain('再次套用');expect(messages.find(r=>r.type==='state')!.world.governors[0].policy).toBe('reserve');
},20000);
it('a late event remains unexposed on failed persistence, retries after one second, and never overlaps',async()=>{
 const w=createFormalWorld({campaign:'failure-deadline',seed:90217,speed:25});storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
 send({type:'command',order:order(w,'first',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})});await until(()=>messages.some(r=>r.type==='commandAck'));const started=messages.find(r=>r.type==='state')!.world as FormalWorld;messages=[];
 storage.save.mockRejectedValueOnce(new Error('disk busy'));const tick=vi.mocked(setInterval).mock.calls[0][0] as ()=>void;realNow=Math.ceil(started.cities[0].economy!.construction[0].durationMs/25);tick();await until(()=>messages.some(r=>r.type==='notice'));expect(messages.some(r=>r.type==='state')).toBe(false);
 const calls=storage.save.mock.calls.length;realNow+=999;tick();await Promise.resolve();expect(storage.save).toHaveBeenCalledTimes(calls);realNow+=1;tick();await until(()=>messages.some(r=>r.type==='state'));expect(messages.find(r=>r.type==='state')!.world.cities[0].fields[0].level).toBe(1);
});
it('a failed governance save never exposes a new setting or receipt and replay commits only once',async()=>{
 const w=createFormalWorld({campaign:'governance-save-failure',seed:90217,speed:25});build(w.cities[0],'townhall',1);storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
 const o=order(w,'governance-failed',{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'reserve',budget:2400,reserve:180});storage.save.mockRejectedValueOnce(new Error('Transaction failed'));send({type:'command',order:o,governanceBase:governanceBase(w,w.cities[0].id)});await until(()=>messages.some(r=>r.type==='commandAck'));
 expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('rejected');expect(messages.find(r=>r.type==='state')!.world).toEqual(w);messages=[];send({type:'command',order:o});await until(()=>messages.some(r=>r.type==='commandAck'));const next=messages.find(r=>r.type==='state')!.world as FormalWorld;expect(next.commandReceipts.filter(r=>r.commandId===o.commandId)).toHaveLength(1);expect(next.events.filter(e=>e.type==='governance.decide')).toHaveLength(1);expect(next.cities[0].stock).toEqual(w.cities[0].stock);messages=[];send({type:'command',order:o});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(2);
});

for(const speed of [1,3,6,10,25])it(`${speed}X command admission uses real IndexedDB authority and restores the same durable state`,async()=>{
 const {FormalPersistence}=await vi.importActual<typeof import('../persistence')>('../persistence'),p=new FormalPersistence({suffix:'admission-'+speed+'-'+crypto.randomUUID()});
 try{
  const w=await p.start(createFormalWorld({campaign:'idb-admission-'+speed,seed:90217,speed}));storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});storage.save.mockImplementation((draft,reports,revision)=>p.save(draft,reports,revision));send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
  realNow=1550;send({type:'command',order:order(w,'actual-idb',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');const committed=messages.find(r=>r.type==='state')!.world as FormalWorld;
  expect(committed.revision).toBe(w.revision+1);expect(committed.time).toBe(1550*speed);expect((await p.loadSave()).game).toEqual(committed);expect((await p.backupList())).toHaveLength(2);
  messages=[];send({type:'command',order:order(w,'actual-idb',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(1);
 }finally{await p.db.delete();}
});

it('the active presentation stream sends committed patches and can recover a full snapshot',async()=>{
 const w=createFormalWorld({campaign:'patch-worker',seed:90217,speed:25});storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});send({type:'load',stateMode:'patch'});await until(()=>messages.some(r=>r.type==='state'));expect(messages.find(r=>r.type==='state')!.world).toEqual(w);messages=[];
 send({type:'command',order:order(w,'patch-build',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})});await until(()=>messages.some(r=>r.type==='commandAck'));const state=messages.find(r=>r.type==='state')!;expect(state.world).toBeUndefined();expect(state.patch.changes.worldLayer).toBeUndefined();const started=applyWorldPatch(w,state.patch)!;expect(started.cities[0].economy!.construction).toHaveLength(1);messages=[];
 const job=started.cities[0].economy!.construction[0];realNow=Math.ceil(job.durationMs/25);(vi.mocked(setInterval).mock.calls[0][0] as ()=>void)();await until(()=>messages.some(r=>r.type==='state'));const completion=messages.find(r=>r.type==='state')!,finished=applyWorldPatch(started,completion.patch)!;expect(finished.cities[0].fields![0].level).toBe(1);messages=[];
 send({type:'snapshot'});await until(()=>messages.some(r=>r.type==='state'));expect(messages.find(r=>r.type==='state')!.world).toEqual(finished);expect(messages.find(r=>r.type==='state')!.patch).toBeUndefined();
});

it('a queued visibility boundary freezes dev time before waiting behind an atomic save and duplicate barriers are idempotent',async()=>{
 initial.speed=3;initial.developer={enabled:true,speed:100};initial.clockMode='foreground';storage.loadWithOffline.mockResolvedValue({game:initial,recovered:false});send({type:'load'});await until(()=>messages.some(m=>m.type==='state'));
 let release:()=>void=()=>{},saved=initial;const barrier=new Promise<void>(r=>release=r);storage.save.mockImplementationOnce(async(w:FormalWorld)=>{await barrier;saved=w;return w;}).mockImplementation(async(w:FormalWorld)=>{saved=w;return w;});
 realNow=100;send({type:'command',order:order(initial,'visibility-fence',{type:'city.rename',cityId:initial.cities[0].id,name:'時鐘邊界'})});await until(()=>storage.save.mock.calls.length===1);realNow=200;send({type:'away',visibilityAt:performance.timeOrigin+200});realNow=500;release();await until(()=>messages.some(m=>m.type==='state'&&m.clock?.running===false));expect(saved.time).toBe(20000);expect(storage.save.mock.calls.at(-1)![3]).toBeTypeOf('number');
 const loads=storage.loadWithOffline.mock.calls.length,count=storage.save.mock.calls.length;realNow=1000;send({type:'away',visibilityAt:performance.timeOrigin+1000});await new Promise(r=>setTimeout(r,0));expect(storage.save.mock.calls.length).toBe(count);storage.loadWithOffline.mockResolvedValue({game:saved,recovered:false});send({type:'resume'});await until(()=>storage.loadWithOffline.mock.calls.length===loads+1);send({type:'resume'});await new Promise(r=>setTimeout(r,0));expect(storage.loadWithOffline.mock.calls.length).toBe(loads+1);
});

it('developer speed changes bridge due AI catch-up only with unchanged intent, retain durable rollback and reject concurrent settings',async()=>{
 const w=createFormalWorld({campaign:'dev-admission',seed:90217,speed:25});
 const {enableAutonomy}=await import('./autonomy');enableAutonomy(w);
 storage.loadWithOffline.mockResolvedValue({game:w,recovered:false});messages=[];send({type:'load'});await until(()=>messages.some(m=>m.type==='state'));messages=[];
 const payload={type:'developer.configure' as const,cityId:w.cities[0].id,enabled:true,speed:100 as const,shield:true},o=order(w,'dev-intent',payload),base=playerOrderBase(w,payload);expect(base).toBeDefined();
 realNow=Math.ceil(Math.min(...w.events.filter(e=>e.type==='ai.decide').map(e=>e.at))/25)+1;
 storage.save.mockRejectedValueOnce(Error('dev setting write fault'));send({type:'command',order:o,playerBase:base});await until(()=>messages.some(m=>m.type==='commandAck'));expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('rejected');expect(messages.find(m=>m.type==='state')!.world).toEqual(w);
 messages=[];send({type:'command',order:o,playerBase:base});await until(()=>messages.some(m=>m.type==='commandAck'));expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('committed');const committed=messages.find(m=>m.type==='state')!.world as FormalWorld;expect(committed.developer).toEqual({enabled:true,speed:100,shieldUntil:committed.time+20*3600000});expect(committed.speed).toBe(25);expect(committed.commandReceipts.filter(r=>r.commandId===o.commandId)).toHaveLength(1);
 const calls=storage.save.mock.calls.length;messages=[];send({type:'command',order:o,playerBase:base});await until(()=>messages.some(m=>m.type==='commandAck'));expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save.mock.calls.length).toBe(calls);
 messages=[];send({type:'command',order:order(w,'stale-dev',{...payload,enabled:false}),playerBase:base});await until(()=>messages.some(m=>m.type==='commandAck'));expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('rejected');expect(messages.find(m=>m.type==='state')!.world.developer.speed).toBe(100);
});
