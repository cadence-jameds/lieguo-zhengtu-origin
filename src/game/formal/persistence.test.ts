import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {afterEach,describe,expect,it} from 'vitest';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {createFormalFixture,fixtureIds} from './fixture';
import {advanceFormal,submitFormalOrder} from './reducer';
import {contribute,order} from './testSupport';
import {decodeSave,encodeSave} from './saveCodec';
import {FORMAL_DB_NAME} from './versions';
import {canonicalJSON} from './canonical';
import type {FormalReport,FormalWorld} from './model';
const stores:FormalPersistence[]=[];let serial=0;
function store(fault?:(point:FailurePoint)=>void){const s=new FormalPersistence({suffix:'test-'+(++serial),fault});stores.push(s);return s;}
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
async function contents(s:FormalPersistence){return{saves:await s.db.saves.toArray(),backups:await s.db.backups.toArray(),reports:await s.db.BattleReports.toArray()};}
async function funded(s:FormalPersistence){let w=await s.start(createFormalFixture({research:true}));const tr=submitFormalOrder(w,contribute(w,'fund'));w=await s.save(tr.world,tr.reports,w.revision);return w;}
async function complete(s:FormalPersistence,w:FormalWorld){const t=advanceFormal(w,47400);return s.save(t.world,t.reports,w.revision);}
it('formal save/load and durable dedupe survive a database/worker restart',async()=>{
 const s=store();let w=await s.start(createFormalFixture({research:true}));const cmd=contribute(w,'half',50),tr=submitFormalOrder(w,cmd);w=await s.save(tr.world,tr.reports,w.revision);
 s.db.close();const connection=new FormalPersistence({suffix:s.db.name.slice(FORMAL_DB_NAME.length+1)});stores.push(connection);const reload=(await connection.loadSave()).game!;expect(reload).toEqual(w);expect(submitFormalOrder(reload,cmd).ack?.status).toBe('duplicate');expect(reload.cities[0].stock.food).toBe(550);
});
it('Recovery roundtrip keeps increasing revision; post-checkpoint commands become durable rolled-back receipts',async()=>{
 const s=store();let w=await s.start(createFormalFixture({research:true}));const first=contribute(w,'first',50);w=await s.save(submitFormalOrder(w,first).world,[],w.revision);const checkpoint=(await s.backupList())[0].id;
 const second=contribute(w,'second',50),t=submitFormalOrder(w,second);w=await s.save(t.world,t.reports,w.revision);const restored=await s.restore(checkpoint);
 expect(restored.revision).toBeGreaterThan(w.revision);expect(restored.researchProjects[0].phase).toBe('funding');expect(restored.cities[0].stock.food).toBe(550);
 expect(submitFormalOrder(restored,first).ack?.status).toBe('duplicate');expect(submitFormalOrder(restored,second).ack?.status).toBe('rolled-back');
 const again=(await s.loadSave()).game!;expect(submitFormalOrder(again,second).ack?.status).toBe('rolled-back');
 const stale=contribute(w,'new-stale',50);expect(submitFormalOrder(again,stale).ack?.status).toBe('rejected');
 const retry=contribute(again,'new-intent',50),next=submitFormalOrder(again,retry);expect(next.ack?.status).toBe('committed');expect(next.world.researchProjects[0].phase).toBe('researching');
});
it('Recovery clears future reports and checkpoints in the same commit as world and authority',async()=>{
 const s=store(),w=await funded(s),checkpoint=(await s.backupList())[0].id;await complete(s,w);const restored=await s.restore(checkpoint);
 expect(restored.researchProjects[0].phase).toBe('researching');const reports=(await s.readReportPage(restored)).rows;
 expect(reports.some(r=>r.title==='科研開始')).toBe(true);expect(reports.some(r=>r.title==='科研完成')).toBe(false);
 expect((await s.backupList()).every(b=>b.time<=restored.time)).toBe(true);
});
for(const point of ['report-write','backup-write','world-write','authority-write'] as const)it(`${point} failure rolls back real IDB stores, keeps input revision, and retries exactly once`,async()=>{
 let failure:FailurePoint|undefined;const s=store(p=>{if(p===failure)throw new Error('injected '+p);}),w=await s.start(createFormalFixture({research:true})),cmd=contribute(w,'fund'),tr=submitFormalOrder(w,cmd),before=await contents(s);
 const input=canonicalJSON(w);failure=point;await expect(s.save(tr.world,tr.reports,w.revision)).rejects.toThrow('injected');expect(await contents(s)).toEqual(before);expect(canonicalJSON(w)).toBe(input);
 failure=undefined;const committed=await s.save(tr.world,tr.reports,w.revision);expect(committed.revision).toBe(1);expect((await s.readReportPage(committed)).rows).toHaveLength(1);
 expect(submitFormalOrder((await s.loadSave()).game!,cmd).ack?.status).toBe('duplicate');
});
for(const operation of ['restore','import'] as const)for(const point of ['history-modified','report-write','backup-write','world-write','authority-write'] as const)it(`${operation} failure after ${point} leaves world/reports/Recovery coherent and retry works`,async()=>{
 let failure:FailurePoint|undefined;const s=store(p=>{if(p===failure)throw new Error('injected '+p);});const running=await funded(s),checkpoint=(await s.backupList())[0].id,text=await s.exportStoredSave('full');await complete(s,running);const before=await contents(s);
 failure=point;const run=()=>operation==='restore'?s.restore(checkpoint):s.importSave(text);await expect(run()).rejects.toThrow('injected');expect(await contents(s)).toEqual(before);
 failure=undefined;const recovered=await run();expect(recovered.researchProjects[0].phase).toBe('researching');expect((await s.readReportPage(recovered)).rows.map(r=>r.title)).toEqual(['科研開始']);expect((await s.loadSave()).game).toEqual(recovered);
});
it('full import commits reports and quick import replaces history without borrowing old reports',async()=>{
 const source=store(),running=await funded(source),full=await source.exportStoredSave('full'),quick=await source.exportStoredSave('quick'),destination=store();
 const imported=await destination.importSave(full);expect((await destination.readReportPage(imported)).rows).toHaveLength(1);
 const overwritten=await destination.importSave(quick);expect((await destination.readReportPage(overwritten)).rows).toHaveLength(0);expect(overwritten.revision).toBeGreaterThan(imported.revision);expect(overwritten.researchProjects).toEqual(running.researchProjects);
});
it('checksums and duplicate report IDs are rejected before any writes',async()=>{
 const s=store(),w=await funded(s),before=await contents(s),e=JSON.parse(await s.exportStoredSave('full'));e.snapshot.cities[0].stock.food++;
 await expect(s.importSave(JSON.stringify(e))).rejects.toThrow('檢查碼');expect(await contents(s)).toEqual(before);
 const reports=(await s.readReportPage(w)).rows;await expect(encodeSave(w,[...reports,...reports])).rejects.toThrow('戰報');
});
it('CAS rejects a competing stale revision in the actual transaction',async()=>{
 const s=store(),w=await s.start(createFormalFixture()),a=submitFormalOrder(w,order(w,'a',{type:'city.rename',cityId:fixtureIds.home,name:'甲'})),b=submitFormalOrder(w,order(w,'b',{type:'city.rename',cityId:fixtureIds.home,name:'乙'}));
 await s.save(a.world,[],w.revision);await expect(s.save(b.world,[],w.revision)).rejects.toThrow('revision');expect((await s.loadSave()).game!.cities[0].name).toBe('甲');
});
it('automatic Recovery uses a valid formal checkpoint, restores atomically, and does not conceal write failure',async()=>{
 let failure:FailurePoint|undefined;const s=store(p=>{if(p===failure)throw new Error('injected '+p);}),w=await funded(s),row=await s.db.saves.get('current');if(!row||row.kind!=='world')throw new Error('World row');row.data.checksum='0'.repeat(64);await s.db.saves.put(row);
 const before=await contents(s);failure='world-write';await expect(s.loadSave()).rejects.toThrow('injected');expect(await contents(s)).toEqual(before);
 failure=undefined;const result=await s.loadSave();expect(result.recovered).toBe(true);expect(result.game!.revision).toBeGreaterThan(w.revision);expect(result.game!.researchProjects[0].phase).toBe('researching');
});
it('reports are independently stored and paged by 50',async()=>{
 const s=store();let w=await s.start(createFormalFixture());const next=structuredClone(w);next.revision++;next.sequences.report=122;
 const reports:FormalReport[]=Array.from({length:121},(_,i)=>({id:('report:'+String(i+1).padStart(16,'0')) as FormalReport['id'],sequence:i+1,campaignId:w.campaignId,ownerFactionId:w.playerFactionId,at:0,category:'system',title:'test',text:'test'}));
 w=await s.save(next,reports,w.revision);expect((await s.readReportPage(w,0)).rows).toHaveLength(50);expect((await s.readReportPage(w,2)).rows).toHaveLength(21);expect(await s.exportStoredSave('quick')).not.toContain('"title":"test"');
});
describe('DEMO isolation with actual separate IndexedDB databases',()=>{
 const demoName='guozhan-river-valley-v027';
 async function demo(){const d=new Dexie(demoName);d.version(1).stores({saves:'id',backups:'++id,at',BattleReports:'key'});await d.table('saves').put({id:1,marker:'DEMO UNTOUCHED',data:{format:'guozhan-realm-save',schema:6,content:'river-valley-0.27.0',checksum:'demo',snapshot:{schema:6}}});await d.table('backups').put({id:1,at:0,data:{format:'guozhan-realm-save',schema:6}});return d;}
 it('new formal DB never reads/enumerates/deletes/rewrites DEMO saves or Recovery',async()=>{
  const d=await demo(),before={saves:await d.table('saves').toArray(),backups:await d.table('backups').toArray()},s=store();
  expect(s.db.name.startsWith(FORMAL_DB_NAME)).toBe(true);expect(await s.loadSave()).toEqual({game:null,recovered:false});expect(await s.backupList()).toEqual([]);
  await s.start(createFormalFixture());await s.clearSavedGames();expect(await d.table('saves').toArray()).toEqual(before.saves);expect(await d.table('backups').toArray()).toEqual(before.backups);
  d.close();await Dexie.delete(demoName);
 });
 it('schema6 envelope load/import/restore are rejected, never repaired or listed as formal Recovery',async()=>{
  const s=store();await s.start(createFormalFixture());const demo={format:'guozhan-realm-save',schema:6,content:'river-valley-0.27.0',checksum:'demo',snapshot:{schema:6}},before=await contents(s);
  await expect(decodeSave(demo)).rejects.toThrow('DEMO');await expect(s.importSave(JSON.stringify(demo))).rejects.toThrow('DEMO');expect(await contents(s)).toEqual(before);
  await s.db.backups.clear();const id=await s.db.backups.add({at:1,label:'DEMO',campaignId:fixtureIds.player as unknown as FormalWorld['campaignId'],gameTime:0,reportCursor:1,data:demo as unknown as Awaited<ReturnType<typeof encodeSave>>});
  expect(await s.backupList()).toEqual([]);await expect(s.restore(id)).rejects.toThrow('DEMO');
  await s.db.saves.put({id:'current',kind:'world',at:0,data:demo as unknown as Awaited<ReturnType<typeof encodeSave>>});await expect(s.loadSave()).rejects.toThrow('均無法讀取');
 });
 it('new formal save rejects repairable state rather than running old normalize/repair/upgrade',async()=>{
  const s=store(),w=createFormalFixture();w.cities[0].x=-1;const before=JSON.stringify(w);await expect(s.start(w)).rejects.toThrow();expect(JSON.stringify(w)).toBe(before);expect(await s.db.saves.count()).toBe(0);
 });
});
it('Recovery retains event/report sequence high-water marks and never reuses a rolled-back EventId',async()=>{
 const s=store();let w=await s.start(createFormalFixture({research:true}));w=await s.save(submitFormalOrder(w,contribute(w,'half',50)).world,[],w.revision);const checkpoint=(await s.backupList())[0].id;
 const started=submitFormalOrder(w,contribute(w,'start',50));w=await s.save(started.world,started.reports,w.revision);const oldEvent=w.events[0].id;
 const restored=await s.restore(checkpoint),fresh=submitFormalOrder(restored,contribute(restored,'fresh',50));
 expect(fresh.world.events[0].id).not.toBe(oldEvent);expect(fresh.world.sequences.report).toBeGreaterThan(w.sequences.report);
 const committed=await s.save(fresh.world,fresh.reports,restored.revision);expect((await s.readReportPage(committed)).rows).toHaveLength(1);
});
