import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {FormalPersistence,validateCheckpointCandidate,type FailurePoint} from '../persistence';
import {createFormalFixture} from './fixture';
import {campaignId} from './ids';
import {submitFormalOrder} from './reducer';
import {contribute} from './testSupport';
import {decodeSave} from './saveCodec';
import {canonicalJSON} from './canonical';

const stores:FormalPersistence[]=[];let serial=0;
function store(fault?:(point:FailurePoint)=>void){const s=new FormalPersistence({suffix:'r1-'+(++serial),fault});stores.push(s);return s;}
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
async function contents(s:FormalPersistence){return{saves:await s.db.saves.toArray(),backups:await s.db.backups.toArray(),reports:await s.db.BattleReports.toArray()};}
/** A: partial funding; B: countdown started at the same world timestamp, with a new event/report. */
async function checkpoints(s:FormalPersistence){
 let world=await s.start(createFormalFixture({research:true}));
 const first=contribute(world,'first-half',50),partial=submitFormalOrder(world,first);
 const a=await s.save(partial.world,partial.reports,world.revision),aId=(await s.backupList())[0].id;
 const second=contribute(a,'second-half',50),funded=submitFormalOrder(a,second);
 const b=await s.save(funded.world,funded.reports,a.revision),bId=(await s.backupList())[0].id;
 return{a,aId,b,bId,first,second,reports:funded.reports};
}
async function corruptCurrent(s:FormalPersistence){
 const row=await s.db.saves.get('current');if(!row||row.kind!=='world')throw new Error('Missing current world');
 row.data.checksum='0'.repeat(64);await s.db.saves.put(row);
}

describe('B1-R1 automatic Recovery checkpoint fallback',()=>{
 it('R1-A exact Gate reproduction: initial A, half-funded B, corrupt current, and B gameTime mismatch',async()=>{
  const s=store(),a=await s.start(createFormalFixture({research:true})),aId=(await s.backupList())[0].id;
  const half=contribute(a,'gate-half',50),transition=submitFormalOrder(a,half);
  const b=await s.save(transition.world,transition.reports,a.revision),bId=(await s.backupList())[0].id;
  await corruptCurrent(s);await s.db.backups.update(bId,{gameTime:1});
  expect((await decodeSave((await s.db.backups.get(bId))!.data)).world).toEqual(b);
  expect((await s.backupList()).map(p=>p.id)).toEqual([aId]);
  const result=await s.loadSave();expect(result.recovered).toBe(true);
  expect(result.game!.cities[0].stock.food).toBe(600);expect(result.game!.researchProjects).toEqual(a.researchProjects);
  expect(submitFormalOrder(result.game!,half).ack?.status).toBe('rolled-back');
  expect(result.game!.revision).toBe(b.revision+1);expect(result.game!.sequences).toEqual(b.sequences);
 });
 it('R1-A skips a metadata-invalid B, restores A atomically, and preserves revision/dedupe/ID high-water marks',async()=>{
  const s=store(),{a,aId,b,bId,first,second,reports}=await checkpoints(s);
  await corruptCurrent(s);await s.db.backups.update(bId,{gameTime:1});
  const bad=await s.db.backups.get(bId);expect((await decodeSave(bad!.data)).world).toEqual(b);
  expect((await s.backupList()).map(p=>p.id)).toEqual([aId]);
  const result=await s.loadSave(),restored=result.game!;
  expect(result.recovered).toBe(true);
  expect({...restored,revision:a.revision,sequences:a.sequences,commandReceipts:a.commandReceipts}).toEqual(a);
  expect(restored.revision).toBe(b.revision+1);expect(restored.sequences).toEqual(b.sequences);
  expect(submitFormalOrder(restored,first).ack?.status).toBe('duplicate');
  expect(submitFormalOrder(restored,second).ack?.status).toBe('rolled-back');
  expect((await s.readReportPage(restored)).rows).toEqual([]);
  const rows=await contents(s),current=rows.saves.find(r=>r.id==='current'),authority=rows.saves.find(r=>r.id==='authority');
  if(current?.kind!=='world'||authority?.kind!=='authority')throw new Error('Missing committed authority');
  expect((await decodeSave(current.data)).world).toEqual(restored);
  expect(authority.revision).toBe(restored.revision);expect(authority.sequences).toEqual(restored.sequences);
  expect(authority.campaigns.find(c=>c.campaignId===restored.campaignId)?.receipts).toEqual(restored.commandReceipts);
  expect(rows.reports).toEqual([]);expect(rows.backups).toHaveLength(2);
  expect(rows.backups.some(p=>p.id===aId)).toBe(true);expect(rows.backups.some(p=>p.id===bId)).toBe(false);
  for(const point of rows.backups)await expect(validateCheckpointCandidate(point)).resolves.toBeDefined();
  expect(await s.loadSave()).toEqual({game:restored,recovered:false});
  const fresh=contribute(restored,'new-intent',50),next=submitFormalOrder(restored,fresh);
  expect(next.world.events[0].id).not.toBe(b.events[0].id);expect(next.reports[0].id).not.toBe(reports[0].id);
  const committed=await s.save(next.world,next.reports,restored.revision);
  expect(committed.cities[0].stock.food).toBe(500);expect(submitFormalOrder(committed,fresh).ack?.status).toBe('duplicate');
 });

 for(const point of ['history-modified','report-write','backup-write','world-write','authority-write'] as const)
 it(`R1-B selected A ${point} failure propagates, rolls back every store, and retries once`,async()=>{
  let failure:FailurePoint|undefined,attempts=0;
  const s=store(p=>{if(p===failure){attempts++;throw new Error('R1 injected '+p);}}),{a,b,bId,second}=await checkpoints(s);
  await corruptCurrent(s);await s.db.backups.update(bId,{gameTime:1});const before=await contents(s);
  failure=point;await expect(s.loadSave()).rejects.toThrow('R1 injected '+point);
  expect(attempts).toBe(1);expect(await contents(s)).toEqual(before);
  failure=undefined;const result=await s.loadSave();
  expect(result.recovered).toBe(true);expect(result.game!.cities).toEqual(a.cities);
  expect(result.game!.revision).toBe(b.revision+1);expect(result.game!.sequences).toEqual(b.sequences);
  expect((await s.readReportPage(result.game!)).rows).toEqual([]);
  expect(submitFormalOrder(result.game!,second).ack?.status).toBe('rolled-back');
  const committed=await contents(s);expect(await s.loadSave()).toEqual({game:result.game,recovered:false});
  expect(await contents(s)).toEqual(committed);
 });

 for(const field of ['campaignId','gameTime','reportCursor'] as const)
 it(`R1-C ${field} mismatch has the same validity in auto Recovery, backupList, and manual restore`,async()=>{
  const s=store(),{a,aId,b,bId}=await checkpoints(s);
  const patch=field==='campaignId'?{campaignId:campaignId('wrong-row')}:
   field==='gameTime'?{gameTime:b.time+1}:{reportCursor:b.sequences.report+1};
  await s.db.backups.update(bId,patch);await corruptCurrent(s);const before=await contents(s);
  const bad=await s.db.backups.get(bId);expect((await decodeSave(bad!.data)).world).toEqual(b);
  await expect(validateCheckpointCandidate(bad!)).rejects.toThrow('游標不一致');
  expect((await s.backupList()).map(p=>p.id)).toEqual([aId]);
  await expect(s.restore(bId)).rejects.toThrow('游標不一致');expect(await contents(s)).toEqual(before);
  const recovered=await s.loadSave();expect(recovered.recovered).toBe(true);
  expect(recovered.game!.cities).toEqual(a.cities);expect(recovered.game!.researchProjects).toEqual(a.researchProjects);
 });

 it('R1-D valid current save does not inspect or restore a bad checkpoint or write any store',async()=>{
  let writes=0;const s=store(()=>{writes++;}),{b,bId}=await checkpoints(s);
  await s.db.backups.update(bId,{gameTime:1});const before=await contents(s),lookups=vi.spyOn(s.db.backups,'orderBy');writes=0;
  expect(await s.loadSave()).toEqual({game:b,recovered:false});expect(writes).toBe(0);
  expect(lookups).not.toHaveBeenCalled();
  expect(await contents(s)).toEqual(before);
 });

 it('R1 pure checkpoint validation does not change its input or any database table',async()=>{
  const s=store(),{a,aId}=await checkpoints(s),row=await s.db.backups.get(aId),before=await contents(s),input=canonicalJSON(row);
  expect(await validateCheckpointCandidate(row!)).toEqual(a);
  expect(canonicalJSON(row)).toBe(input);expect(await contents(s)).toEqual(before);
  const invalid={...row!,gameTime:1},badInput=canonicalJSON(invalid);
  await expect(validateCheckpointCandidate(invalid)).rejects.toThrow('游標不一致');
  expect(canonicalJSON(invalid)).toBe(badInput);expect(await contents(s)).toEqual(before);
 });
});
