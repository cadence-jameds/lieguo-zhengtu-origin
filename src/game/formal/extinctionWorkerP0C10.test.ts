import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import type {FormalWorld} from './model';
import {battlefield,dispatch} from './combatTestSupport';
import {order} from './developmentTestSupport';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import {rebirthCandidates} from './extinction';
const storage=vi.hoisted(()=>({hasLegacyCampaign:vi.fn().mockResolvedValue(false),exportLegacyCampaign:vi.fn(),loadWithOffline:vi.fn(),save:vi.fn(),startCampaign:vi.fn(),restore:vi.fn(),importSave:vi.fn(),backupList:vi.fn(),clearSavedGames:vi.fn(),exportStoredSave:vi.fn(),readReportPage:vi.fn(),readCityIntel:vi.fn(),reportStatus:vi.fn(),reportAction:vi.fn()}));
vi.mock('../persistence',()=>storage);
let world:FormalWorld,messages:Record<string,any>[],port:{onmessage:((e:{data:unknown})=>void)|null;postMessage:(v:Record<string,any>)=>void},now=0;
const send=(data:unknown)=>port.onmessage!({data}),until=async(fn:()=>boolean)=>vi.waitFor(()=>expect(fn()).toBe(true));
const state=()=>messages.filter(m=>m.type==='state').at(-1)!;
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);vi.stubGlobal('setInterval',vi.fn());world=isolatedAutonomyFixture(battlefield());world.cities[0].military!.units={};world.cities[1].military!.units={militia:1000};world=dispatch(world,'conquest',{militia:1000},1,0).world;storage.reportStatus.mockResolvedValue({unread:0,alerts:0,counts:{all:0,battle:0,chronicle:0}});storage.loadWithOffline.mockResolvedValue({game:world,recovered:false});storage.save.mockImplementation(async(w:FormalWorld)=>w);storage.exportStoredSave.mockResolvedValue('synthetic-export');messages=[];port={onmessage:null,postMessage:v=>messages.push(structuredClone(v))};vi.stubGlobal('self',port);await import('../runtime.worker');send({type:'load'});await until(()=>messages.some(m=>m.type==='state'));messages=[];});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each([1,3,6,10,25])('Worker %sX freezes only after the terminal durable commit, accepts rebirth in order and excludes defeated wall time',async speed=>{
 // Configure the campaign before advancing; the same Worker clock handles every supported speed.
 send({type:'command',order:order(world,{type:'campaign.configure',cityId:world.cities[0].id,speed:speed as 1|3|6|10|25,offlineHours:12})});await until(()=>messages.some(m=>m.type==='commandAck'));world=state().world;messages=[];
 const arrival=world.armies[0].arrivalAt!;now=(arrival+5000)/speed;let commit!:(w:FormalWorld)=>void,draft!:FormalWorld;
 storage.save.mockImplementationOnce((w:FormalWorld)=>{draft=w;return new Promise<FormalWorld>(r=>commit=r);});send({type:'sync',requestId:'loss'});await until(()=>!!draft);
 expect(messages.some(m=>m.type==='state')).toBe(false);expect(draft.time).toBe(arrival);expect(draft.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);expect(storage.save.mock.calls.at(-1)![1].some((r:any)=>r.battle?.outcome==='conquered')).toBe(true);
 commit(draft);await until(()=>messages.some(m=>m.type==='synced'));world=state().world;expect(state().clock).toMatchObject({time:arrival,running:false});messages=[];
 now+=100*3600000;const saves=storage.save.mock.calls.length;send({type:'sync',requestId:'frozen'});send({type:'export'});await until(()=>messages.some(m=>m.type==='export'));expect(storage.save.mock.calls.length).toBe(saves);
 send({type:'snapshot'});await until(()=>messages.some(m=>m.type==='state'));expect(state().world).toEqual(world);expect(state().clock.time).toBe(arrival);messages=[];
 const p=rebirthCandidates(world)[0];send({type:'command',order:order(world,{type:'player.rebirth',cityId:world.cities[0].id,...p,name:'Worker復國'})});await until(()=>messages.some(m=>m.type==='commandAck'));world=state().world;expect(state().clock).toMatchObject({time:arrival,running:true});expect(world.extinction!.defeat).toBeUndefined();messages=[];
 now+=1000;send({type:'sync',requestId:'after-rebirth'});await until(()=>messages.some(m=>m.type==='synced'));expect(state().world.time).toBe(arrival+1000*speed);expect(state().world.combat.receipts.filter((r:any)=>r.kind==='final')).toHaveLength(1);
});
it('failed terminal save is invisible and a retry commits the receipt exactly once',async()=>{
 now=world.armies[0].arrivalAt!+1000;storage.save.mockRejectedValueOnce(Error('terminal storage fault'));send({type:'sync'});await until(()=>messages.some(m=>m.type==='error'));expect(messages.some(m=>m.type==='state')).toBe(false);messages=[];
 send({type:'snapshot'});await until(()=>messages.some(m=>m.type==='state'));expect(state().world).toEqual(world);messages=[];
 send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));expect(state().world.extinction.defeat.at).toBe(world.armies[0].arrivalAt);expect(state().world.combat.receipts.filter((r:any)=>r.kind==='final')).toHaveLength(1);
});
it('away/resume, re-load and ended campaign preserve a stopped Worker clock and never clear saves',async()=>{
 now=world.armies[0].arrivalAt!+1000;send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));world=state().world;messages=[];const events=structuredClone(world.events);storage.loadWithOffline.mockResolvedValue({game:world,recovered:false});now+=100*3600000;
 send({type:'away'});send({type:'resume'});send({type:'load'});await until(()=>messages.filter(m=>m.type==='loaded').length===2);expect(state().clock).toMatchObject({time:world.time,running:false});expect(state().world.events).toEqual(events);messages=[];
 send({type:'command',order:order(world,{type:'player.end',cityId:world.cities[0].id})});await until(()=>messages.some(m=>m.type==='commandAck'));world=state().world;expect(world.extinction!.defeat!.ended).toBe(true);expect(state().clock.running).toBe(false);messages=[];
 send({type:'command',order:order(world,{type:'player.rebirth',cityId:world.cities[0].id,...rebirthCandidates(world)[0],name:'拒絕'})});await until(()=>messages.some(m=>m.type==='commandAck'));expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('rejected');expect(storage.clearSavedGames).not.toHaveBeenCalled();expect(state().world).toEqual(world);
});
