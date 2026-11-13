import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import * as maps from '../admissionMap';
import * as ledger from './commandLedger';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {advanceFormal} from './reducer';
import {runtimeFixtureIdentity} from './durableIdentityTestSupport';
import {captureIntent} from '../durableCommands';
import {order} from './testSupport';
import {createFormalFixture} from './fixture';
import type {RuntimeRequest} from '../runtime.worker';
let fault:FailurePoint|undefined;
let p:FormalPersistence,now=0,messages:any[],send:(data:RuntimeRequest)=>void;
const wall=1_700_000_010_000;
const until=(f:()=>boolean)=>vi.waitFor(()=>expect(f()).toBe(true));
beforeEach(()=>{now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);vi.spyOn(Date,'now').mockReturnValue(wall);fault=undefined;p=new FormalPersistence({suffix:'background-save-hotfix-'+crypto.randomUUID(),fault:point=>{if(point===fault){fault=undefined;throw new DOMException('synthetic write abort','AbortError');}}});});
afterEach(async()=>{await p.db.delete();vi.doUnmock('../persistence');vi.doUnmock('../admissionMap');vi.doUnmock('./commandLedger');vi.restoreAllMocks();vi.unstubAllGlobals();});
async function boot(){
 vi.resetModules();vi.doMock('../admissionMap',()=>maps);vi.doMock('./commandLedger',()=>ledger);
 vi.doMock('../persistence',()=>({hasLegacyCampaign:async()=>false,exportLegacyCampaign:async()=>'',...Object.fromEntries(['acquireWriter','writerContext','receiveCommand','commandStatus','queryCommandStatus','pendingCommands','commandPage','finishCommand','noteCommandFailure','save','restore','importSave','backupList','clearSavedGames','exportStoredSave','readReportPage','readCityIntel','reportStatus','reportAction'].map(k=>[k,(...args:any[])=>(p[k as keyof FormalPersistence] as Function).apply(p,args)])),loadWithOffline:(progress:any,options:any)=>p.loadWithOffline(Date.now(),progress,options),startCampaign:(w:any)=>p.start(w)}));
 messages=[];const port={onmessage:null as any,postMessage:(m:any)=>messages.push(structuredClone(m))};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',vi.fn());await import('../runtime.worker');send=data=>port.onmessage({data:runtimeFixtureIdentity(data,messages)});send({type:'load',requestId:'load'});await until(()=>messages.some(m=>m.type==='requestDone'&&m.requestId==='load'));expect(messages.filter(m=>m.type==='error')).toEqual([]);
}
it.each([1,10,25])('fractional visibility latency at %sX saves one integer wall anchor without changing the foreground fence',async speed=>{
 const fixture=createFormalFixture();fixture.speed=speed;await p.start(fixture);await boot();const prior=(await p.loadSave()).game!;
 now=100.625;send({type:'away',visibilityAt:performance.timeOrigin+99.25,requestId:'away'});await until(()=>messages.some(m=>m.type==='requestDone'&&m.requestId==='away'));
 expect(messages.filter(m=>m.type==='error')).toEqual([]);
 const stored=await p.db.saves.get('current'),authority:any=await p.db.saves.get('authority');if(stored?.kind!=='world')throw Error('Missing committed world');
 expect(stored.at).toBe(wall-2);expect(authority.savedAt).toBe(stored.at);expect(authority.recovery.at(-1).at).toBe(stored.at);expect((await p.db.backups.get(authority.recovery.at(-1).id))!.at).toBe(stored.at);
 expect((await p.loadSave()).game!.time).toBe(prior.time+Math.floor(99.25*speed));expect(await p.backupList()).toHaveLength(2);
});

const dump=async()=>Promise.all(p.db.tables.map(async table=>[table.name,await table.toArray()]));
it.each([NaN,Infinity,-Infinity,-1,Number.MAX_SAFE_INTEGER+1])('rejects illegal persistence time %s before touching authority or recovery',async value=>{
 const w=await p.start(createFormalFixture()),before=await dump();await expect(p.save(advanceFormal(w,1).world,[],w.revision,value)).rejects.toThrow('SAVE_TIME_INVALID');expect(await dump()).toEqual(before);expect((await p.loadSave()).game!.revision).toBe(w.revision);expect(await p.backupList()).toHaveLength(1);
});
it.each(['report-write','backup-write','world-write','authority-write','metadata-write'] as FailurePoint[])('fractional timestamps still roll back every store on %s',async point=>{
 const w=await p.start(createFormalFixture()),before=await dump();fault=point;await expect(p.save(advanceFormal(w,1).world,[],w.revision,wall-.125)).rejects.toThrow('synthetic write abort');expect(await dump()).toEqual(before);expect((await p.loadSave()).game!.revision).toBe(w.revision);expect(await p.backupList()).toHaveLength(1);
});
it('normalizes direct callers once and preserves strict load, old Recovery, export and import',async()=>{
 const w=await p.start(createFormalFixture()),committed=await p.save(advanceFormal(w,1).world,[],w.revision,wall-1.625),current:any=await p.db.saves.get('current'),authority:any=await p.db.saves.get('authority');
 expect(current.at).toBe(wall-2);expect(authority.savedAt).toBe(current.at);expect(authority.recovery.at(-1).at).toBe(current.at);expect((await p.db.backups.get(authority.recovery.at(-1).id))!.at).toBe(current.at);
 expect((await p.loadSave()).game!.revision).toBe(committed.revision);const points=await p.backupList();expect(points).toHaveLength(2);const restored=await p.restore(points.at(-1)!.id);expect(restored.time).toBe(w.time);const imported=await p.importSave(await p.exportStoredSave('full'));expect((await p.loadSave()).game!.revision).toBe(imported.revision);expect(await p.backupList()).toHaveLength(2);
});
it('queued duplicate background barriers preserve T1, one command result and the original high precision fence',async()=>{
 const w=createFormalFixture();w.speed=25;await p.start(w);await boot();const prior=(await p.loadSave()).game!,real=p.save.bind(p);let release!:()=>void;const wait=new Promise<void>(r=>release=r),save=vi.spyOn(p,'save').mockImplementationOnce(async(...args)=>{await wait;return real(...args);});
 const command=order(prior,'queued-background',{type:'city.rename',cityId:prior.cities[0].id,name:'邊界保存'});now=100.625;send({type:'command',order:command,...captureIntent(prior,command),requestId:'command'});await until(()=>save.mock.calls.length===1);
 now=200.875;send({type:'away',visibilityAt:performance.timeOrigin+199.25,requestId:'away'});send({type:'away',visibilityAt:performance.timeOrigin+200.25,requestId:'duplicate'});release();await until(()=>messages.some(m=>m.type==='requestDone'&&m.requestId==='duplicate'));
 expect(save).toHaveBeenCalledTimes(2);expect((await p.loadSave()).game!.time).toBe(Math.floor(199.25*25));expect((await p.commandStatus(command.campaignId,command.commandId))!.state).toBe('committed');expect(messages.filter(m=>m.type==='commandAck'&&m.ack.status==='committed')).toHaveLength(1);expect(messages.filter(m=>m.type==='error')).toEqual([]);
});
