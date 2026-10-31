import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {CLOCK_DELTA_CASES,clockBoundaryWorld,eventRows,rebirthOrder} from './offlineExtinctionClockDeltaTestSupport';
import {effectiveSpeed} from './playtest';
import type {FormalWorld,FormalReport} from './model';
import type {FormalPersistence,FailurePoint} from '../persistence';
const storage=vi.hoisted(()=>({hasLegacyCampaign:vi.fn().mockResolvedValue(false),exportLegacyCampaign:vi.fn(),loadWithOffline:vi.fn(),save:vi.fn(),startCampaign:vi.fn(),restore:vi.fn(),importSave:vi.fn(),backupList:vi.fn(),clearSavedGames:vi.fn(),exportStoredSave:vi.fn(),readReportPage:vi.fn(),readCityIntel:vi.fn(),reportStatus:vi.fn(),reportAction:vi.fn()}));
vi.mock('../persistence',()=>storage);
let db:FormalPersistence,messages:Record<string,any>[],port:{onmessage:((e:{data:unknown})=>void)|null;postMessage:(v:Record<string,any>)=>void},now=0,wall=1000,failure:FailurePoint|undefined;
const send=(data:unknown)=>port.onmessage!({data}),until=async(fn:()=>boolean)=>vi.waitFor(()=>expect(fn()).toBe(true)),state=()=>messages.filter(m=>m.type==='state').at(-1)!;
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks();now=0;wall=1000;failure=undefined;vi.spyOn(performance,'now').mockImplementation(()=>now);vi.spyOn(Date,'now').mockImplementation(()=>wall);vi.stubGlobal('setInterval',vi.fn());
 const actual=await vi.importActual<typeof import('../persistence')>('../persistence');db=new actual.FormalPersistence({suffix:'clock-worker-delta-'+crypto.randomUUID(),fault:p=>{if(p===failure)throw Error('Worker clock storage fault');}});
 storage.reportStatus.mockImplementation((w:FormalWorld)=>db.reportStatus(w));storage.loadWithOffline.mockImplementation((progress:any)=>db.loadWithOffline(wall,progress));storage.save.mockImplementation((w:FormalWorld,reports:FormalReport[],revision:number,savedAt?:number)=>db.save(w,reports,revision,savedAt));
 messages=[];port={onmessage:null,postMessage:v=>messages.push(structuredClone(v))};vi.stubGlobal('self',port);await import('../runtime.worker');
});
afterEach(async()=>{await db.db.delete();vi.restoreAllMocks();vi.unstubAllGlobals();});
for(const config of CLOCK_DELTA_CASES)it(`T2/T4/T5/T6 Worker ${config.name}: offline freeze and rebirth publish only durable state; failure/retry, queued requests and first tick preserve the clock boundary`,async()=>{
 const f=clockBoundaryWorld(config),start=await db.start(f.world),rows=async()=>({saves:await db.db.saves.toArray(),backups:await db.db.backups.toArray(),reports:await db.db.BattleReports.toArray()}),before=await rows();
 wall+=Math.ceil((f.target-start.time)/config.speed);failure='world-write';send({type:'load',requestId:'offline-fail'});await until(()=>messages.some(m=>m.type==='error'));expect(messages.some(m=>m.type==='state'||m.type==='loaded')).toBe(false);expect(await rows()).toEqual(before);
 failure=undefined;messages=[];send({type:'load',requestId:'offline-retry'});await until(()=>messages.some(m=>m.type==='state'));const frozen=state().world as FormalWorld,events=eventRows(frozen);expect(frozen.clockMode).toBe('offline');expect(frozen.time).toBe(f.freezeAt);expect(state().clock).toMatchObject({time:f.freezeAt,speed:config.speed,running:false});expect(frozen.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);
 const frozenRows=await rows();wall+=100*86400000;now+=100*86400000;messages=[];send({type:'sync',requestId:'frozen-sync'});send({type:'snapshot'});await until(()=>messages.some(m=>m.type==='synced')&&!!state());expect(state().world).toEqual(frozen);expect(await rows()).toEqual(frozenRows);
 let release!:()=>void,draft:FormalWorld|undefined;storage.save.mockImplementationOnce(async(w:FormalWorld,reports:FormalReport[],revision:number)=>{draft=w;await new Promise<void>(r=>release=r);return db.save(w,reports,revision);});const o=rebirthOrder(frozen);messages=[];failure='authority-write';send({type:'command',order:o});await until(()=>!!draft);send({type:'sync',requestId:'queued-after-rebirth'});send({type:'snapshot'});
 expect(draft!.clockMode).toBe('foreground');expect(effectiveSpeed(draft!)).toBe(config.developer??config.speed);expect(messages.filter(m=>m.type==='state')).toEqual([]);expect(await rows()).toEqual(frozenRows);release();await until(()=>messages.some(m=>m.type==='commandAck')&&messages.some(m=>m.type==='synced'));
 expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('rejected');expect(state().world).toEqual(frozen);expect(state().clock).toMatchObject({time:f.freezeAt,running:false});expect(await rows()).toEqual(frozenRows);expect(eventRows(state().world)).toEqual(events);
 failure=undefined;messages=[];send({type:'command',order:o});await until(()=>messages.some(m=>m.type==='commandAck'));expect(messages.find(m=>m.type==='commandAck')!.ack.status).toBe('committed');const reborn=state().world as FormalWorld,speed=config.developer??config.speed;expect(state().clock).toMatchObject({time:f.freezeAt,speed,running:true});expect(reborn.clockMode).toBe('foreground');expect(reborn.extinction!.resumedAt).toBe(f.freezeAt);expect(reborn.events.filter(e=>e.at===f.freezeAt)).toEqual(frozen.events.filter(e=>e.at===f.freezeAt));
 // No command/tick overtakes persistence; only this new foreground second is admitted.
 messages=[];now+=1000;wall+=1000;send({type:'sync',requestId:'first-tick'});await until(()=>messages.some(m=>m.type==='synced'));const tick=state().world as FormalWorld;expect(tick.time).toBe(f.freezeAt+1000*speed);expect(tick.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);
 for(const e of frozen.events.filter(e=>e.at===f.freezeAt))expect(tick.events.some(x=>x.id===e.id)).toBe(false);expect(tick.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(2);
 const stable=await rows();messages=[];send({type:'sync',requestId:'same-tick'});send({type:'snapshot'});await until(()=>messages.some(m=>m.type==='synced')&&!!state());expect(state().world).toEqual(tick);expect(await rows()).toEqual(stable);expect(storage.clearSavedGames).not.toHaveBeenCalled();
});
