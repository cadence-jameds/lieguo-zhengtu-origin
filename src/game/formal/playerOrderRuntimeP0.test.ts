import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createFormalFixture,fixtureIds} from './fixture';
import {createFormalWorld} from './generator';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {order} from './testSupport';
import {build} from './developmentTestSupport';
import {eventId,commandId} from './ids';
import {playerOrderBase} from '../orderAdmission';
import type {FormalWorld,FormalCommand,FormalOrder} from './model';

const storage=vi.hoisted(()=>({loadWithOffline:vi.fn(),save:vi.fn(),reportStatus:vi.fn(),startCampaign:vi.fn(),restore:vi.fn(),importSave:vi.fn(),backupList:vi.fn(),clearSavedGames:vi.fn(),exportStoredSave:vi.fn(),readReportPage:vi.fn(),reportAction:vi.fn(),readCityIntel:vi.fn()}));
vi.mock('../persistence',()=>storage);
let messages:any[],port:{postMessage:(r:unknown)=>void;onmessage:((e:{data:unknown})=>void)|null},initial:FormalWorld,now=0;
const send=(r:unknown)=>port.onmessage!({data:r});
const until=async(test:()=>boolean)=>{await vi.waitFor(()=>expect(test()).toBe(true));};
const done=(id:string)=>messages.some(r=>r.type==='requestDone'&&r.requestId===id);
const ack=(id:string)=>messages.find(r=>r.type==='commandAck'&&r.ack.commandId===commandId(id))?.ack;
const latest=()=>messages.filter(r=>r.type==='state').at(-1)?.world as FormalWorld;
async function load(world:FormalWorld){storage.loadWithOffline.mockResolvedValue({game:world,recovered:false});send({type:'load',requestId:'load'});await until(()=>done('load'));messages=[];}
function click(world:FormalWorld,id:string,payload:FormalCommand){const issued=order(world,id,payload);send({type:'command',requestId:id,order:issued,playerBase:playerOrderBase(world,payload)});return issued;}
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks();now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);vi.stubGlobal('setInterval',vi.fn());
 initial=createFormalFixture();messages=[];port={postMessage:r=>messages.push(structuredClone(r)),onmessage:null};vi.stubGlobal('self',port);
 storage.save.mockImplementation(async(w:FormalWorld)=>w);storage.reportStatus.mockResolvedValue({unread:0,alerts:0,counts:{all:0,battle:0,chronicle:0}});
 await import('../runtime.worker');await load(initial);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it('receives a command during cooperative replay without exposing a draft or interleaving its mutation',async()=>{
 const w=createFormalFixture();w.events=Array.from({length:32},(_,i)=>({id:eventId('yield-'+i),type:'fixture.marker' as const,at:i+1,marker:'atomic'}));await load(w);
 let delta=0;now=10000;vi.mocked(performance.now).mockImplementation(()=>now+(delta+=10));
 send({type:'sync',requestId:'replay'});
 await new Promise<void>(resolve=>setTimeout(()=>{
  click(w,'during-replay',{type:'city.rename',cityId:fixtureIds.home,name:'接收但尚未提交'});
  expect(messages.some(r=>r.type==='commandReceived')).toBe(true);expect(ack('during-replay')).toBeUndefined();
  expect(messages.some(r=>r.type==='state')).toBe(false);expect(storage.save).not.toHaveBeenCalled();resolve();
 },0));
 await until(()=>done('during-replay'));expect(ack('during-replay').status).toBe('committed');
 expect(messages.findIndex(r=>r.type==='synced')).toBeLessThan(messages.findIndex(r=>r.type==='commandAck'));
 expect(latest().events).toEqual([]);expect(latest().cities[0].name).toBe('接收但尚未提交');
});

it('foreground FIFO overtakes only a pending tick and remains behind the in-flight durable save',async()=>{
 let finish!:(w:FormalWorld)=>void,draft!:FormalWorld;
 storage.save.mockImplementationOnce((w:FormalWorld)=>{draft=w;return new Promise<FormalWorld>(resolve=>finish=resolve);});
 now=10000;send({type:'sync',requestId:'first-sync'});await until(()=>storage.save.mock.calls.length===1);
 now=20000;(vi.mocked(setInterval).mock.calls[0][0] as ()=>void)();
 click(initial,'first-command',{type:'city.rename',cityId:fixtureIds.home,name:'前景優先'});
 send({type:'sync',requestId:'second-sync'});
 expect(messages.filter(r=>r.type==='commandReceived')).toHaveLength(1);expect(ack('first-command')).toBeUndefined();expect(messages.some(r=>r.type==='state')).toBe(false);
 finish(draft);await until(()=>done('second-sync'));
 expect(ack('first-command').status).toBe('committed');expect(storage.save).toHaveBeenCalledTimes(2);
 expect(storage.save.mock.calls[1][0].cities[0].name).toBe('前景優先');expect(storage.save.mock.calls[1][0].time).toBe(20000);
 expect(messages.filter(r=>r.type==='requestDone').map(r=>r.requestId)).toEqual(['first-sync','first-command','second-sync']);
});

it('import and visibility/load barriers preserve arrival order and old-campaign clicks never cross a switch',async()=>{
 let finish!:(w:FormalWorld)=>void;const switched=createFormalFixture({campaign:'switched'});
 storage.importSave.mockImplementation(()=>new Promise<FormalWorld>(resolve=>finish=resolve));
 send({type:'import',text:'private placeholder',transitionId:'switch',requestId:'switch'});await until(()=>storage.importSave.mock.calls.length===1);
 click(initial,'old-campaign',{type:'city.rename',cityId:fixtureIds.home,name:'不可跨戰役'});
 send({type:'away',requestId:'away'});send({type:'resume',requestId:'resume'});storage.loadWithOffline.mockResolvedValue({game:switched,recovered:false});
 const freshPayload={type:'city.rename' as const,cityId:fixtureIds.home,name:'切換後'},fresh:FormalOrder=order(switched,'fresh',freshPayload);
 send({type:'command',requestId:'fresh',order:fresh,playerBase:playerOrderBase(switched,freshPayload)});
 expect(ack('old-campaign')).toBeUndefined();finish(switched);await until(()=>done('fresh'));
 expect(ack('old-campaign').status).toBe('rejected');expect(ack('fresh').status).toBe('committed');
 expect(messages.filter(r=>r.type==='requestDone').map(r=>r.requestId)).toEqual(['switch','old-campaign','away','resume','fresh']);
 expect(latest().campaignId).toBe(switched.campaignId);expect(latest().cities[0].name).toBe('切換後');
});

it('an old unchanged construction catches up actual admission time after its revision was rebased',async()=>{
 const w=isolatedAutonomyFixture(createFormalWorld({campaign:'old-clock',seed:90217,speed:10}));await load(w);
 now=10000;send({type:'sync',requestId:'checkpoint'});await until(()=>done('checkpoint'));messages=[];
 now=15500;click(w,'after-checkpoint',{type:'building.upgrade',cityId:w.cities[0].id,key:'center'});await until(()=>done('after-checkpoint'));
 expect(ack('after-checkpoint').status).toBe('committed');const committed=latest();expect(committed.time).toBe(155000);expect(committed.cities[0].economy!.construction[0].startsAt).toBe(155000);
});

for(const target of ['unrelated','same'] as const)it(`actual player-governor catch-up ${target==='unrelated'?'admits an unchanged building':'rejects its changed field target'} without retry`,async()=>{
 let w=isolatedAutonomyFixture(createFormalWorld({campaign:'governor-'+target,seed:90217}));const city=w.cities[0];build(city,'townhall',1);
 w=submitFormalOrder(w,order(w,'configure-governor',{type:'governance.set',cityId:city.id,enabled:true,policy:'economy',budget:270,reserve:0})).world;
 const computed=advanceFormal(w,1).world,governorJob=computed.cities[0].economy!.construction[0];expect(governorJob?.target.kind).toBe('field');
 const payload:FormalCommand=target==='same'?{type:'field.upgrade',cityId:city.id,slot:(governorJob.target as {kind:'field';slot:number}).slot}:{type:'building.upgrade',cityId:city.id,key:'center'};
 await load(w);now=1;click(w,'governor-click',payload);await until(()=>done('governor-click'));
 expect(ack('governor-click').status).toBe(target==='same'?'rejected':'committed');
 const committed=latest();expect(committed.commandReceipts.some(r=>r.issuerId===w.playerFactionId&&r.commandId.startsWith('command:ai-'))).toBe(true);
 expect(committed.cities[0].economy!.construction).toHaveLength(target==='same'?1:2);expect(messages.filter(r=>r.type==='commandAck')).toHaveLength(1);
});

it('a newer foreground command stays a hard fence even when its ID looks autonomous and its effect is undone',async()=>{
 const payload={type:'city.rename' as const,cityId:fixtureIds.home,name:'舊命令'},older=order(initial,'older',payload),base=playerOrderBase(initial,payload);
 click(initial,'ai-human-1',{type:'city.rename',cityId:fixtureIds.support,name:'較新'});await until(()=>done('ai-human-1'));
 const newer=latest();click(newer,'ai-human-2',{type:'city.rename',cityId:fixtureIds.support,name:initial.cities[1].name});await until(()=>done('ai-human-2'));
 send({type:'command',requestId:'older',order:older,playerBase:base});await until(()=>done('older'));
 expect(ack('older').status).toBe('rejected');expect(latest().cities[0].name).toBe(initial.cities[0].name);expect(storage.save).toHaveBeenCalledTimes(2);
});

for(const kind of ['resources','queue'] as const)it(`current ${kind} conflict rejects without any draft spend or durable save`,async()=>{
 let w=isolatedAutonomyFixture(createFormalWorld({campaign:'conflict-'+kind,seed:90217}));const city=w.cities[0];
 if(kind==='resources')city.stock={food:0,wood:0,stone:0,gold:0};
 else for(let i=0;i<5;i++)w=submitFormalOrder(w,order(w,'fill-'+i,{type:'field.upgrade',cityId:city.id,slot:i})).world;
 await load(w);const before=JSON.stringify(w);click(w,'illegal',{type:'building.upgrade',cityId:city.id,key:'center'});await until(()=>done('illegal'));
 expect(ack('illegal').status).toBe('rejected');expect(ack('illegal').reason).toContain(kind==='resources'?'庫存不足':'5 項上限');
 expect(JSON.stringify(latest())).toBe(before);expect(storage.save).not.toHaveBeenCalled();
});

it('an actual failed IDB transaction produces only rejection, preserves authority, and deliberate same-ID resend commits once',async()=>{
 const {FormalPersistence}=await vi.importActual<typeof import('../persistence')>('../persistence');let fail=false;
 const p=new FormalPersistence({suffix:'p0-worker-'+crypto.randomUUID(),fault:point=>{if(fail&&point==='authority-write')throw new Error('injected durable failure');}});
 try{
  const w=await p.start(isolatedAutonomyFixture(createFormalWorld({campaign:'durable-p0',seed:90217})));await load(w);storage.save.mockImplementation((draft,reports,revision)=>p.save(draft,reports,revision));
  const before={saves:await p.db.saves.toArray(),backups:await p.db.backups.toArray()},payload={type:'field.upgrade' as const,cityId:w.cities[0].id,slot:0};
  fail=true;const issued=click(w,'durable-build',payload);expect(messages[0].type).toBe('commandReceived');await until(()=>done('durable-build'));
  expect(ack('durable-build').status).toBe('rejected');expect(latest()).toEqual(w);expect({saves:await p.db.saves.toArray(),backups:await p.db.backups.toArray()}).toEqual(before);
  fail=false;messages=[];send({type:'command',requestId:'resend',order:issued,playerBase:playerOrderBase(w,payload)});await until(()=>done('resend'));
  expect(ack('durable-build').status).toBe('committed');const committed=latest();expect(committed.cities[0].economy!.construction).toHaveLength(1);expect((await p.loadSave()).game).toEqual(committed);
  messages=[];send({type:'command',requestId:'duplicate',order:issued,playerBase:playerOrderBase(w,payload)});await until(()=>done('duplicate'));
  expect(ack('durable-build').status).toBe('duplicate');expect(latest()).toEqual(committed);expect(storage.save).toHaveBeenCalledTimes(2);
 }finally{await p.db.delete();}
});
