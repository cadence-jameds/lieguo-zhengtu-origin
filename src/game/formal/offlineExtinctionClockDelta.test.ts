import 'fake-indexeddb/auto';
import {afterAll,it,expect,vi} from 'vitest';
import * as autonomy from './autonomy';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CLOCK_DELTA_CASES,clockBoundaryWorld,frozenReference,eventRows,clockRows,confirmedRebirth} from './offlineExtinctionClockDeltaTestSupport';
import {advanceOffline,advanceOfflineCooperative} from './offline';
import {effectiveSpeed} from './playtest';
import {setClockMode,retimeCombatClock} from './campaignTime';
import {encodeSave,decodeSave} from './saveCodec';
import {digest} from './canonical';
import {advanceFormal} from './reducer';
import {FormalPersistence,type FailurePoint} from '../persistence';
const evidence:Record<string,unknown>={};
afterAll(()=>{const out=process.env.P0C10_CLOCK_DELTA_EVIDENCE;if(out){mkdirSync(out,{recursive:true});writeFileSync(out+'/boundary-observations.json',JSON.stringify(evidence,null,2));}});
for(const config of CLOCK_DELTA_CASES){
 it(`T1/T2 ${config.name}: offline completion preserves the exact Formal freeze, pending IDs/deadlines/order and final receipt`,async()=>{
  const f=clockBoundaryWorld(config),before=structuredClone(f.world),expected=frozenReference(f.world,f.target),elapsed=Math.ceil((f.target-f.world.time)/config.speed),sync=advanceOffline(f.world,0,elapsed);
  evidence[config.name]={input:clockRows(f.world),formalFreeze:clockRows(expected.world),offlineFinished:clockRows(sync.world),rebirth:clockRows(confirmedRebirth(sync.world).world)};
  expect(sync.world.time).toBe(f.freezeAt);expect(sync.world.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);
  expect(eventRows(sync.world)).toEqual(eventRows(expected.world));expect(sync.world.combat!.battles).toEqual(expected.world.combat!.battles);
  expect(sync.world.clockMode).toBe('offline');expect(effectiveSpeed(sync.world)).toBe(config.speed);expect(f.world).toEqual(before);
 });
 it(`T2/T3 ${config.name}: synchronous/cooperative offline worlds and summaries agree; only confirmed rebirth restores foreground speed`,async()=>{
  const f=clockBoundaryWorld(config),elapsed=Math.ceil((f.target-f.world.time)/config.speed),sync=advanceOffline(f.world,0,elapsed),cooperative=await advanceOfflineCooperative(f.world,0,elapsed);
  expect(cooperative).toEqual(sync);const frozen=cooperative.world,before=structuredClone(frozen);expect(frozen.clockMode).toBe('offline');
  setClockMode(frozen,'foreground');retimeCombatClock(frozen,config.speed,100);expect(frozen).toEqual(before);
  const t=confirmedRebirth(frozen),speed=config.developer??config.speed;expect(t.world.clockMode).toBe('foreground');expect(effectiveSpeed(t.world)).toBe(speed);expect(t.world.time).toBe(f.freezeAt);
  expect(t.world.events.filter(e=>e.at===f.freezeAt)).toEqual(frozen.events.filter(e=>e.at===f.freezeAt));expect(frozen).toEqual(before);
  evidence[config.name+'-rebirth']={frozen:clockRows(frozen),reborn:clockRows(t.world)};
 });
}
it('T4 the completed offline freeze has a strict durable envelope, while an ordinary offline draft and corrupt freeze remain rejected',async()=>{
 const f=clockBoundaryWorld(CLOCK_DELTA_CASES[3]),reference=frozenReference(f.world,f.target),frozen=reference.world;
 const save=await encodeSave(frozen,reference.reports);expect((await decodeSave(save)).world).toEqual(frozen);
 const draft=structuredClone(f.world);setClockMode(draft,'offline');await expect(encodeSave(draft)).rejects.toThrow('草稿');const forged=structuredClone(save);delete forged.snapshot.extinction!.defeat;forged.checksum=await digest(forged.snapshot);await expect(decodeSave(forged)).rejects.toThrow('草稿');
 const corrupt=structuredClone(save);corrupt.snapshot.extinction!.defeat!.at++;await expect(decodeSave(corrupt)).rejects.toThrow();const checksum=structuredClone(save);checksum.checksum='0'.repeat(64);await expect(decodeSave(checksum)).rejects.toThrow('檢查碼');
});
it('T4 real IDB reload, full export/import and Recovery preserve frozen offline deadlines across 100 real days before rebirth',async()=>{
 const f=clockBoundaryWorld(CLOCK_DELTA_CASES[3]),db=new FormalPersistence({suffix:'clock-delta-'+crypto.randomUUID()}),copy=new FormalPersistence({suffix:'clock-delta-copy-'+crypto.randomUUID()});
 try{
  const start=await db.start(f.world),t=advanceOffline(start,1000,1000+Math.ceil((f.target-start.time)/start.speed)),saved=await db.save(t.world,t.reports,start.revision,2000),events=eventRows(saved),receipts=structuredClone(saved.combat!.receipts),point=(await db.backupList())[0];
  db.db.close();await db.db.open();const loaded=(await db.loadWithOffline(100*86400000)).game!;expect(loaded.clockMode).toBe('offline');expect(loaded.time).toBe(f.freezeAt);expect(eventRows(loaded)).toEqual(events);expect(loaded.combat!.receipts).toEqual(receipts);
  const full=await db.exportStoredSave('full'),imported=await copy.importSave(full,true);expect(eventRows(imported)).toEqual(events);expect(imported.clockMode).toBe('offline');expect((await copy.readReportPage(imported)).rows.filter(r=>r.battle?.outcome==='conquered')).toHaveLength(1);
  const restored=await db.restore(point.id,true);expect(eventRows(restored)).toEqual(events);expect(restored.clockMode).toBe('offline');const reloaded=(await db.loadWithOffline(200*86400000)).game!,reborn=confirmedRebirth(reloaded).world;expect(effectiveSpeed(reborn)).toBe(100);expect(reborn.clockMode).toBe('foreground');expect(reborn.time).toBe(f.freezeAt);
 }finally{await db.db.delete();await copy.db.delete();}
});
it('T5 preserved same-time combat, march, two AI decisions and marker drain in original Scheduler order exactly once after rebirth',()=>{
 const f=clockBoundaryWorld(CLOCK_DELTA_CASES[3]),frozen=frozenReference(f.world,f.target).world,expected=frozen.events.filter(e=>e.at===f.freezeAt),seen:number[]=[];
 expect(expected.map(e=>e.type)).toEqual(['army.arrive','combat.round','ai.decide','ai.decide','fixture.marker']);const reborn=confirmedRebirth(frozen).world;expect(reborn.extinction!.resumedAt).toBe(f.freezeAt);expect(reborn.events.filter(e=>e.at===f.freezeAt)).toEqual(expected);
 const original=autonomy.handleAutonomy,observed:string[]=[],spy=vi.spyOn(autonomy,'handleAutonomy').mockImplementation((...args)=>{if(args[1].at===f.freezeAt)observed.push(args[1].id);return original(...args);});let done:typeof reborn;try{done=advanceFormal(reborn,f.freezeAt).world;}finally{spy.mockRestore();}expect(observed).toEqual(expected.map(e=>e.id));evidence['same-time-order']={expected:expected.map(e=>({id:e.id,type:e.type,at:e.at})),observed};expect(done.events.some(e=>expected.some(x=>x.id===e.id))).toBe(false);expect(done.combat!.receipts.filter(r=>r.eventId===expected[0].id)).toHaveLength(1);expect(done.combat!.receipts.filter(r=>r.eventId===expected[1].id)).toHaveLength(1);
 for(const id of f.aiEvents){const e=expected.find(e=>e.id===id)!;if(e.type!=='ai.decide')throw Error('AI fixture');const a=done.autonomy!.agents.find(a=>a.factionId===e.factionId)!;seen.push(a.decisions-frozen.autonomy!.agents.find(x=>x.factionId===a.factionId)!.decisions);}expect(seen).toEqual([1,1]);expect(advanceFormal(done,done.time).world).toBe(done);expect(advanceFormal(done,done.time+1).world.extinction!.resumedAt).toBeUndefined();
});
for(const point of ['world-write','authority-write'] as const)it(`T6 ${point}: real IDB freeze/rebirth rollback and retry preserve authority, history and event identity`,async()=>{
 let fail:FailurePoint|undefined;const f=clockBoundaryWorld(CLOCK_DELTA_CASES[3]),db=new FormalPersistence({suffix:'clock-atomic-'+crypto.randomUUID(),fault:p=>{if(p===fail)throw Error('clock delta fault');}});
 const rows=async()=>({saves:await db.db.saves.toArray(),backups:await db.db.backups.toArray(),reports:await db.db.BattleReports.toArray()});
 try{
  const start=await db.start(f.world),frozen=frozenReference(start,f.target),before=await rows();fail=point;await expect(db.save(frozen.world,frozen.reports,start.revision)).rejects.toThrow('fault');expect(await rows()).toEqual(before);fail=undefined;const saved=await db.save(frozen.world,frozen.reports,start.revision),checkpoint=await rows(),reborn=confirmedRebirth(saved);fail=point;await expect(db.save(reborn.world,reborn.reports,saved.revision)).rejects.toThrow('fault');expect(await rows()).toEqual(checkpoint);expect((await db.loadSave()).game!.clockMode).toBe('offline');fail=undefined;const committed=await db.save(reborn.world,reborn.reports,saved.revision);expect(committed.clockMode).toBe('foreground');expect(committed.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);expect((await db.readReportPage(committed)).rows.filter(r=>r.battle?.outcome==='conquered')).toHaveLength(1);
 }finally{await db.db.delete();}
});
