import {runtimeFixtureIdentity,receiveDurableFixture} from './durableIdentityTestSupport';
import * as maps from '../admissionMap';
import * as ledger from './commandLedger';
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FormalPersistence} from '../persistence';
import {PresentationStore} from '../presentationStore';
import {captureIntent} from '../durableCommands';
import {RuntimeWorkBudget} from '../runtimeWorkBudget';
import {advanceFormal,advanceFormalCooperative} from './reducer';
import {createFormalFixture} from './fixture';
import {advanceOffline} from './offline';
import {scenarioWorld} from './ledgerTestSupport';
import {eventId} from './ids';
import {order} from './testSupport';
import type {FormalWorld} from './model';
let p:FormalPersistence,messages:any[],view:PresentationStore,send:(data:any)=>void;
const until=(f:()=>boolean)=>vi.waitFor(()=>expect(f()).toBe(true));
const done=(id:string)=>messages.some(m=>m.type==='requestDone'&&m.requestId===id);
async function boot(){
 vi.resetModules();vi.doMock('../admissionMap',()=>maps);vi.doMock('./commandLedger',()=>ledger);
 vi.doMock('../persistence',()=>({hasLegacyCampaign:async()=>false,exportLegacyCampaign:async()=>'',...Object.fromEntries(['acquireWriter','writerContext','receiveCommand','commandStatus','queryCommandStatus','pendingCommands','commandPage','finishCommand','noteCommandFailure','save','restore','importSave','backupList','clearSavedGames','exportStoredSave','readReportPage','readCityIntel','reportStatus','reportAction'].map(k=>[k,(...a:any[])=>(p[k as keyof FormalPersistence] as Function).apply(p,a)])),loadWithOffline:()=>p.loadSave(),startCampaign:(w:FormalWorld)=>p.start(w)}));
 messages=[];view=new PresentationStore();const port={onmessage:null as any,postMessage:(m:any)=>{messages.push(structuredClone(m));if(m.projection)expect(view.receive(structuredClone(m.projection)).accepted).toBe(true);}};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',vi.fn());await import('../runtime.worker');send=data=>port.onmessage({data:runtimeFixtureIdentity(data,messages)});send({type:'load',requestId:'load'});await until(()=>done('load'));
}
beforeEach(()=>{p=new FormalPersistence({suffix:'r306-priority-'+crypto.randomUUID()});});
afterEach(async()=>{await p.db.delete();vi.doUnmock('../persistence');vi.doUnmock('./commandLedger');vi.restoreAllMocks();vi.unstubAllGlobals();});
it('intake pressure shortens only a completed-event CPU slice and clears after failure',async()=>{
 const b=new RuntimeWorkBudget();let fail!:(e:Error)=>void;const work=new Promise((_,reject)=>fail=reject);b.trackIntake(work);expect(b.advance.shouldYield!(1.99)).toBe(false);expect(b.advance.shouldYield!(2)).toBe(true);fail(Error('T1 abort'));await Promise.resolve();expect(b.advance.shouldYield!(100)).toBe(false);
});
it('sustained pending intake cannot starve events or expose a partial world',async()=>{
 const w=createFormalFixture(),b=new RuntimeWorkBudget();w.events=Array.from({length:80},(_,i)=>({id:eventId('r306-'+i),type:'fixture.marker',at:i+1,marker:'complete'}));b.trackIntake(new Promise(()=>{}));const before=structuredClone(w),expected=advanceFormal(w,80);let boundaries=0;
 const actual=await advanceFormalCooperative(w,80,undefined,{...b.advance,yieldBeforeStart:false,shouldYield:()=>true,yieldControl:async()=>{boundaries++;expect(w).toEqual(before);}});expect(boundaries).toBe(80);expect(actual).toEqual(expected);expect(w).toEqual(before);
});
it('an initial service opportunity precedes draft preparation without changing the fixed logical target',async()=>{
 const w=createFormalFixture(),before=structuredClone(w);let serviced=0;const target=1;const t=await advanceFormalCooperative(w,target,undefined,{yieldBeforeStart:true,yieldControl:async boundary=>{expect(boundary).toBe('start');serviced++;expect(w).toEqual(before);}});expect(serviced).toBe(1);expect(t).toEqual(advanceFormal(w,target));expect(w).toEqual(before);
});
it('query returns Durable Pending while T2 is private, then committed, and reboot retains exact result',async()=>{
 const w=await p.start(createFormalFixture());await boot();const old=view.getWorld()!,real=p.save.bind(p);let release!:()=>void,draft:FormalWorld|undefined;const barrier=new Promise<void>(r=>release=r);
 vi.spyOn(p,'save').mockImplementationOnce(async(...args)=>{draft=args[0];await barrier;return real(...args);});const o=order(w,'query-private',{type:'city.rename',cityId:w.cities[0].id,name:'只有提交後可見'});send({type:'command',order:o,...captureIntent(old,o),requestId:'execute'});await until(()=>!!draft);
 send({type:'commandQuery',campaignId:o.campaignId,commandId:o.commandId,requestId:'during'});await until(()=>done('during'));expect(done('execute')).toBe(false);expect(messages.find(m=>m.type==='commandStatus')!.row.state).toBe('pending');expect(view.getWorld()!.cities[0].name).toBe(old.cities[0].name);
 release();await until(()=>done('execute'));const ack=messages.find(m=>m.type==='commandAck')!.ack;expect(ack.status).toBe('committed');expect(view.getWorld()!.cities[0].name).toBe('只有提交後可見');await boot();send({type:'commandQuery',campaignId:o.campaignId,commandId:o.commandId,requestId:'reboot'});await until(()=>done('reboot'));expect(messages.find(m=>m.type==='commandStatus')!.row.ack).toEqual(ack);
});
it.each([20,50])('%s T1 rows and queries can complete behind a private T2, preserving FIFO and original payloads',async n=>{
 const w=await p.start(createFormalFixture());await boot();const real=p.save.bind(p);let release!:()=>void,draft=false;const barrier=new Promise<void>(r=>release=r);vi.spyOn(p,'save').mockImplementationOnce(async(...a)=>{draft=true;await barrier;return real(...a);});
 const rows=Array.from({length:n},(_,i)=>order(w,'fifo-'+i,{type:'city.rename',cityId:w.cities[0].id,name:'原意'+i}));for(let i=0;i<n;i++)send({type:'command',order:rows[i],...captureIntent(w,rows[i]),requestId:'exec-'+i});await until(()=>draft&&messages.filter(m=>m.type==='commandDurable').length===n);
 send({type:'commandList',requestId:'list'});await until(()=>done('list'));expect(done('exec-0')).toBe(false);expect(messages.find(m=>m.type==='commandList'&&m.rows.length===n).rows.map((r:any)=>r.commandId)).toEqual(rows.map(r=>r.commandId).reverse());
 release();await until(()=>done('exec-'+(n-1)));expect(messages.filter(m=>m.type==='commandAck').map(m=>m.ack.commandId)).toEqual(rows.map(r=>r.commandId));for(const o of rows){const row=await p.commandStatus(o.campaignId,o.commandId);expect(row!.order).toEqual(o);expect(['committed','needs-confirmation']).toContain(row!.state);}expect(ledger.worldLedger((await p.loadSave()).game!).count).toBe(1);
});
it('a known durable result does not wait for a different command still entering T1',async()=>{
 const w=await p.start(createFormalFixture());await boot();const a=order(w,'known',{type:'city.rename',cityId:w.cities[0].id,name:'已提交'});send({type:'command',order:a,...captureIntent(w,a),requestId:'a'});await until(()=>done('a'));
 const current=(await p.loadSave()).game!,b=order(current,'receiving',{type:'city.rename',cityId:w.cities[0].id,name:'下一筆'}),original=p.receiveCommand.bind(p);let release!:()=>void;const barrier=new Promise<void>(r=>release=r);vi.spyOn(p,'receiveCommand').mockImplementationOnce(async(...args)=>{await barrier;return original(...args);});send({type:'command',order:b,...captureIntent(current,b),requestId:'b'});
 send({type:'commandQuery',campaignId:a.campaignId,commandId:a.commandId,requestId:'known-result'});await until(()=>done('known-result'));expect(done('b')).toBe(false);expect(messages.filter(m=>m.type==='commandStatus'&&m.commandId===a.commandId).at(-1).row.state).toBe('committed');release();await until(()=>done('b'));
});
it('a query during committed Recovery preparation cannot publish the new world under an old branch identity',async()=>{
 const w=await p.start(createFormalFixture()),point=(await p.backupList())[0];await boot();const o=order(w,'before-restore',{type:'city.rename',cityId:w.cities[0].id,name:'回復前'});send({type:'command',order:o,...captureIntent(w,o),requestId:'rename'});await until(()=>done('rename'));const old=view.getWorld()!,reader=p.writerContext.bind(p);let entered=false,release!:()=>void;const barrier=new Promise<void>(r=>release=r);vi.spyOn(p,'writerContext').mockImplementationOnce(async()=>{const context=await reader();entered=true;await barrier;return context;});
 send({type:'restore',id:point.id,transitionId:'r306-recovery',requestId:'restore'});await until(()=>entered);send({type:'commandQuery',campaignId:o.campaignId,commandId:o.commandId,requestId:'during-restore'});await new Promise(r=>setTimeout(r,0));expect(done('during-restore')).toBe(false);expect(done('restore')).toBe(false);expect(view.getWorld()!.projection.branch).toBe(old.projection.branch);expect(view.getWorld()!.cities[0].name).toBe('回復前');
 release();await until(()=>done('restore')&&done('during-restore'));expect(messages.filter(m=>m.type==='commandStatus'&&m.commandId===o.commandId).at(-1).row.state).toBe('rolled-back');expect(view.getWorld()!.projection.branch).not.toBe(old.projection.branch);expect(view.getWorld()!.cities[0].name).toBe(w.cities[0].name);
});
it('a Pending read delayed across T2 publication is refreshed before it can overwrite the committed Ack',async()=>{
 const w=await p.start(createFormalFixture());await boot();const save=p.save.bind(p);let entered=false,commit!:()=>void,answer!:()=>void;const barrier=new Promise<void>(r=>commit=r),delay=new Promise<void>(r=>answer=r);vi.spyOn(p,'save').mockImplementationOnce(async(...a)=>{entered=true;await barrier;return save(...a);});const o=order(w,'late-query',{type:'city.rename',cityId:w.cities[0].id,name:'終局不可倒退'});send({type:'command',order:o,...captureIntent(w,o),requestId:'execute-late'});await until(()=>entered);
 const query=p.commandStatus.bind(p);let captured=false;vi.spyOn(p,'commandStatus').mockImplementationOnce(async(...a)=>{const row=await query(...a);expect(row!.state).toBe('pending');captured=true;await delay;return row;});send({type:'commandQuery',campaignId:o.campaignId,commandId:o.commandId,requestId:'late-query'});await until(()=>captured);commit();await until(()=>done('execute-late'));const committedAt=messages.findIndex(m=>m.type==='commandAck'&&m.ack.commandId===o.commandId);answer();await until(()=>done('late-query'));expect(messages.slice(committedAt+1).filter(m=>m.type==='commandStatus').map(m=>m.row.state)).toEqual(['committed']);
});

it('offline intake at safe boundaries stays durable while the entire replay remains private until one T2',async()=>{
 const raw=createFormalFixture();raw.events=Array.from({length:80},(_,i)=>({id:eventId('offline-priority-'+i),type:'fixture.marker',at:i+1,marker:'complete'}));const w=await p.start(raw),stored=await p.db.saves.get('current');if(stored?.kind!=='world')throw Error('missing initial authority');const now=stored.at+1000,expected=advanceOffline(w,stored.at,now),o=order(w,'offline-priority',{type:'city.rename',cityId:w.cities[0].id,name:'離線補算原意'});let boundaries=0,sequence:number|undefined;
 const result=await p.loadWithOffline(now,undefined,{yieldIntervalMs:0,yieldBeforeStart:true,yieldControl:async boundary=>{if(boundary==='start'){const row=await receiveDurableFixture(p,o,captureIntent(w,o));sequence=row.sequence;}else{boundaries++;expect((await p.commandStatus(o.campaignId,o.commandId))!.state).toBe('pending');expect((await p.loadSave()).game!.revision).toBe(w.revision);}}});
 expect(boundaries).toBe(80);expect(result.game!.revision).toBe(w.revision+1);expect(scenarioWorld(result.game!)).toEqual(scenarioWorld(expected.world));expect((await receiveDurableFixture(p,o)).sequence).toBe(sequence);expect((await p.commandStatus(o.campaignId,o.commandId))!.state).toBe('pending');
});
