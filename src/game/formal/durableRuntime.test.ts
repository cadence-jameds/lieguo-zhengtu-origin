import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {eventId} from './ids';
import {createFormalFixture,fixtureIds} from './fixture';
import {order,contribute} from './testSupport';
import {captureIntent} from '../durableCommands';
import {createFormalWorld} from './generator';
import {EventScheduler} from './scheduler';
import {enableAutonomy} from './autonomy';
import {build,rich} from './developmentTestSupport';
import {rebirthCandidates} from './extinction';
import {battlefield,dispatch} from './combatTestSupport';
import {advanceFormal} from './reducer';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import type {FormalOrder,FormalWorld,FormalCommand} from './model';
let store:FormalPersistence,now=0,fail:FailurePoint|undefined,dropAck=false,dropState=false,tick:()=>void;
let messages:any[],port:{onmessage:((e:{data:unknown})=>void)|null;postMessage:(v:any)=>void};
const send=(data:unknown)=>port.onmessage!({data});
const until=async(fn:()=>boolean)=>vi.waitFor(()=>expect(fn()).toBe(true),{timeout:15000});
const done=(id:string)=>messages.some(m=>m.type==='requestDone'&&m.requestId===id);
const latest=()=>messages.filter(m=>m.type==='state').at(-1)?.world as FormalWorld;
const ack=(o:FormalOrder)=>messages.filter(m=>m.type==='commandAck'&&m.ack.commandId===o.commandId).at(-1)?.ack;
async function boot(){
 vi.resetModules();vi.doMock('../persistence',()=>({
  hasLegacyCampaign:async()=>false,exportLegacyCampaign:async()=>'',
  ...Object.fromEntries(['acquireWriter','writerContext','receiveCommand','commandStatus','pendingCommands','commandPage','finishCommand','noteCommandFailure','loadWithOffline','save','restore','importSave','backupList','clearSavedGames','exportStoredSave','readReportPage','readCityIntel','reportStatus','reportAction'].map(name=>[name,(...args:any[])=>(store[name as keyof FormalPersistence] as Function).apply(store,args)])),
  loadWithOffline:(progress:Parameters<FormalPersistence['loadWithOffline']>[1])=>store.loadWithOffline(Date.now(),progress),
  startCampaign:(w:FormalWorld)=>store.start(w)
 }));
 messages=[];port={onmessage:null,postMessage:v=>{if(dropAck&&v.type==='commandAck'||dropState&&v.type==='state')return;messages.push(structuredClone(v));}};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',(cb:()=>void)=>{tick=cb;return 1;});await import('../runtime.worker');send({type:'load',requestId:'load'});await until(()=>done('load'));expect(messages.filter(m=>m.type==='error')).toEqual([]);
}
beforeEach(()=>{now=0;fail=undefined;dropAck=false;dropState=false;vi.spyOn(performance,'now').mockImplementation(()=>now);store=new FormalPersistence({suffix:'runtime-durable-'+crypto.randomUUID(),fault:point=>{if(point===fail){fail=undefined;throw new DOMException('transient '+point,'AbortError');}}});});
afterEach(async()=>{await store.db.delete();vi.doUnmock('../persistence');vi.restoreAllMocks();vi.unstubAllGlobals();});
function click(w:FormalWorld,key:string,payload:FormalCommand){const o=order(w,key,payload);send({type:'command',order:o,...captureIntent(w,o),requestId:key});return o;}
it('real Worker protocol: T1 survives termination before execution, reboot revalidates and commits one effect; Ack loss queries exact T2 result',async()=>{
 const initial=await store.start(createFormalFixture({research:true})),o=contribute(initial,'recovered',50);await store.receiveCommand(o,captureIntent(initial,o));
 await boot();await until(()=>messages.some(m=>m.type==='commandAck'));expect(ack(o).status).toBe('committed');const next=(await store.loadSave()).game!;expect(next.cities[0].stock.food).toBe(550);expect((await store.commandStatus(o.campaignId,o.commandId))!.state).toBe('committed');
 send({type:'snapshot',stateMode:'patch',requestId:'enable-patch'});await until(()=>done('enable-patch'));dropAck=true;dropState=true;const second=click(next,'lost-ack',{type:'city.rename',cityId:fixtureIds.home,name:'Ack遺失'});await until(()=>done('lost-ack'));expect(ack(second)).toBeUndefined();const durable=await store.commandStatus(second.campaignId,second.commandId);expect(durable!.state).toBe('committed');dropAck=false;dropState=false;
 send({type:'commandQuery',campaignId:second.campaignId,commandId:second.commandId,requestId:'query'});await until(()=>done('query'));expect(ack(second)).toEqual(durable!.ack);expect(latest().cities[0].name).toBe('Ack遺失');
 send({type:'command',order:second,...captureIntent(next,second),requestId:'repeat'});await until(()=>done('repeat'));expect(ack(second)).toEqual(durable!.ack);expect((await store.loadSave()).game!.commandReceipts).toHaveLength(2);
});
it.each(['report-write','backup-write','world-write','authority-write','metadata-write','result-write'] as const)('real Worker retries a temporary T2 %s failure finitely and never duplicates resource deduction',async point=>{
 await store.start(createFormalFixture({research:true}));await boot();const w=latest();fail=point;const o=click(w,'temporary',contribute(w,'x',50).payload);await until(()=>done('temporary'));
 expect(ack(o).status).toBe('committed');const row=await store.commandStatus(o.campaignId,o.commandId);expect(row!.attempts).toBe(1);expect((await store.loadSave()).game!.cities[0].stock.food).toBe(550);expect((await store.loadSave()).game!.commandReceipts).toHaveLength(1);
});
it('quota at T2 does not auto retry, publishes no success, and retains a durable confirmation result',async()=>{
 await store.start(createFormalFixture());await boot();const w=latest();const original=store.save.bind(store);let calls=0;vi.spyOn(store,'save').mockImplementation(async(...args)=>{calls++;if(calls===1)throw new DOMException('full','QuotaExceededError');return original(...args);});
 const o=click(w,'quota',{type:'city.rename',cityId:fixtureIds.home,name:'不能假成功'});await until(()=>done('quota'));expect(calls).toBe(1);expect(ack(o).status).toBe('rejected');expect((await store.commandStatus(o.campaignId,o.commandId))!.state).toBe('needs-confirmation');expect((await store.loadSave()).game).toEqual(w);
});
it('99 AI at 25X accepts T1 while an AI replay is still private and serializes fast building/training/research/logistics/governance/dispatch inputs',async()=>{
 const native=createFormalWorld({campaign:'99-ai-durable',seed:90217,speed:25}),city=rich(native);native.factions[0].age=1;for(const faction of native.factions)faction.protectionUntil=0;for(const key of ['townhall','barracks','academy','market','blacksmith'])build(city,key,1);city.military!.units={militia:30,scout:2};enableAutonomy(native);for(const agent of native.autonomy!.agents)agent.nextAt=200000;for(const e of native.events)if(e.type==='ai.decide')e.at=200000;native.events=new EventScheduler(native.events).snapshot();await store.start(native);await boot();const w=latest();
 expect(w.factions).toHaveLength(100);now=10000;let finish!:(w:FormalWorld)=>void,draft!:FormalWorld;const save=store.save.bind(store);vi.spyOn(store,'save').mockImplementationOnce(async(...args)=>{draft=args[0];await new Promise<FormalWorld>(r=>finish=r);return save(...args);});
 let duringReplay=0,delta=0;const publish=port.postMessage;
 port.postMessage=value=>{if(value.type==='commandDurable'&&!draft)duringReplay++;publish(value);};
 // Force cooperative event boundaries without treating Node time as a device
 // latency benchmark. Real IDB intake must complete before the AI draft ends.
 vi.mocked(performance.now).mockImplementation(()=>now+(delta+=10));tick();
 const payloads:FormalCommand[]=[{type:'building.upgrade',cityId:city.id,key:'center'},{type:'military.recruit',cityId:city.id,unitId:'militia',count:1},{type:'research.start',cityId:city.id,techId:'blacksmith.melee.1'},{type:'logistics.auto.set',cityId:city.id,rules:[]},{type:'governance.set',cityId:city.id,enabled:false,policy:'reserve',budget:0,reserve:0},{type:'army.dispatch',cityId:city.id,mission:'scout',target:{kind:'city',cityId:w.cities[1].id},units:{scout:1}}];
 const orders=payloads.map((p,i)=>click(w,'fast-'+i,p));await until(()=>messages.filter(m=>m.type==='commandDurable').length===6);expect(messages.filter(m=>m.type==='commandAck')).toHaveLength(0);expect(await store.db.Inbox.count()).toBe(6);
 await until(()=>!!draft);expect(duringReplay).toBeGreaterThan(0);
 expect(draft.autonomy!.agents.every(a=>a.decisions>=1)).toBe(true);finish(draft);await until(()=>done('fast-5'));const rows=await store.commandPage();expect(rows).toHaveLength(6);expect(rows.every(r=>r.ack&&r.state!=='pending'&&r.state!=='retryable')).toBe(true);expect(rows.slice().reverse().map(r=>r.commandId)).toEqual(orders.map(o=>o.commandId));
 expect(rows.every(r=>r.state==='committed'||r.state==='needs-confirmation'),JSON.stringify(rows.map(r=>[r.order.payload.type,r.state,r.ack?.reason]))).toBe(true);
 expect(messages.filter(m=>m.type==='commandAck').map(m=>m.ack.commandId)).toEqual(orders.map(o=>o.commandId));
 // Where earlier queued operations changed an explicit precondition, a player
 // may confirm the SAME parameters with a fresh ID. All six inputs are legal;
 // none is silently discarded or rewritten to manufacture a success.
 for(let i=0;i<orders.length;i++){const row=await store.commandStatus(orders[i].campaignId,orders[i].commandId);if(row!.state==='committed')continue;
  const current=(await store.loadSave()).game!,confirmed=click(current,'confirmed-fast-'+i,orders[i].payload);await until(()=>done('confirmed-fast-'+i));expect(ack(confirmed).status,ack(confirmed).reason).toBe('committed');}
 const loaded=(await store.loadSave()).game!;expect(new Set(loaded.commandReceipts.map(r=>r.commandId)).size).toBe(loaded.commandReceipts.length);
},30000);
it('expired pending becomes terminal confirmation on reboot and a stale row never revives an ended campaign',async()=>{
 const active=isolatedAutonomyFixture(battlefield());active.cities[0].military!.units={};active.cities[1].military!.units={militia:1000};const army=dispatch(active,'conquest',{militia:1000},1,0).world;const defeat=advanceFormal(army,army.armies[0].arrivalAt!+1000).world;await store.start(defeat);await boot();const w=latest(),p=rebirthCandidates(w)[0],rebirth=order(w,'old-rebirth',{type:'player.rebirth',cityId:w.cities[0].id,...p,name:'不可自動復國'});const row=await store.receiveCommand(rebirth,captureIntent(w,rebirth));await store.db.Inbox.update(row.sequence!,{deadline:Date.now()-1});
 // End first; the old rebirth then runs from its unchanged stored envelope.
 const end=click(w,'end',{type:'player.end',cityId:w.cities[0].id});await until(()=>done('end'));expect(ack(end).status).toBe('committed');
 send({type:'command',order:rebirth,...captureIntent(w,rebirth),requestId:'old-rebirth'});await until(()=>done('old-rebirth'));expect(ack(rebirth).status).toBe('rejected');const ended=(await store.loadSave()).game!;expect(ended.extinction!.defeat!.ended).toBe(true);expect(ended.events).toEqual(w.events);expect(ended.time).toBe(w.time);
});
it('expired durable pending is persisted as Needs Confirmation on reboot without executing the original action',async()=>{
 const w=await store.start(createFormalFixture()),o=order(w,'expired-before-reboot',{type:'city.rename',cityId:fixtureIds.home,name:'不得逾時自動執行'}),row=await store.receiveCommand(o,captureIntent(w,o));await store.db.Inbox.update(row.sequence!,{deadline:Date.now()-1});await boot();await until(()=>messages.some(m=>m.type==='commandAck'));
 expect(ack(o).status).toBe('rejected');expect((await store.commandStatus(o.campaignId,o.commandId))!.state).toBe('needs-confirmation');expect((await store.loadSave()).game!.cities[0].name).toBe(w.cities[0].name);expect((await store.loadSave()).game!.commandReceipts).toHaveLength(0);
});
it('paused same-time remainder is never caught up by rejected rebirth; legal rebirth preserves it until the resumed clock advances',async()=>{
 const active=isolatedAutonomyFixture(battlefield());active.cities[0].military!.units={};active.cities[1].military!.units={militia:1000};const army=dispatch(active,'conquest',{militia:1000},1,0).world,arrival=army.armies[0].arrivalAt!;
 army.events=new EventScheduler([...army.events,{id:eventId('same-time-paused'),type:'fixture.marker',at:arrival,marker:'must-remain'}]).snapshot();const defeat=advanceFormal(army,arrival+1000).world;expect(defeat.events.some(e=>e.id===eventId('same-time-paused'))).toBe(true);await store.start(defeat);await boot();const w=latest(),before=structuredClone(w),save=vi.spyOn(store,'save');
 const invalid=click(w,'invalid-rebirth',{type:'player.rebirth',cityId:w.cities[0].id,x:w.cities[1].x,y:w.cities[1].y,name:'被佔領位置'});await until(()=>done('invalid-rebirth'));expect(ack(invalid).status).toBe('rejected');expect(save).not.toHaveBeenCalled();expect((await store.loadSave()).game).toEqual(before);expect(latest()).toEqual(before);
 const p=rebirthCandidates(w)[0],valid=click(w,'valid-rebirth',{type:'player.rebirth',cityId:w.cities[0].id,...p,name:'合法復國'});await until(()=>done('valid-rebirth'));expect(ack(valid).status).toBe('committed');expect(latest().events.some(e=>e.id===eventId('same-time-paused'))).toBe(true);expect(latest().time).toBe(w.time);
});
