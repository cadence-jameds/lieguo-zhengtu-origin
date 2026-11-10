import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {playerCommandId,RetiredCommand} from '../replayFence';
import {captureIntent} from '../durableCommands';
import {createFormalFixture} from './fixture';
import type {FormalOrder,FormalWorld} from './model';
import {submitFormalOrder} from './reducer';
import {worldLedger,prepareVerifiedLedger} from './commandLedger';
import {resultFromReceipt} from '../ledgerStore';
import {canonicalJSON} from './canonical';
const stores:FormalPersistence[]=[];
const store=(fault?:(p:FailurePoint)=>void)=>{const p=new FormalPersistence({suffix:'bounded-'+crypto.randomUUID(),fault});stores.push(p);return p;};
afterEach(async()=>{for(const p of stores.splice(0))await p.db.delete();});
async function order(p:FormalPersistence,w:FormalWorld,seq:number):Promise<FormalOrder>{return {commandId:playerCommandId((await p.writerContext()).commandEpoch!,seq),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name:'有界命令'+seq}};}
const allRows=(p:FormalPersistence)=>Promise.all(p.db.tables.map(async t=>[t.name,await t.toArray()]));
it('T1 atomically accepts monotonic identities, closes gaps, and recovers durable rows across writer restart',async()=>{
 const p=store();await p.acquireWriter();const w=await p.start(createFormalFixture()),a=await order(p,w,1),c=await order(p,w,3),b=await order(p,w,2);
 const first=await p.receiveCommand(a,captureIntent(w,a));await p.receiveCommand(c,captureIntent(w,c));await expect(p.receiveCommand(b)).rejects.toThrow(RetiredCommand);
 const oldWriter=await p.writerContext();await p.acquireWriter();expect((await p.writerContext()).commandEpoch).not.toBe(oldWriter.commandEpoch);
 expect(await p.receiveCommand(a)).toEqual(first);expect((await p.pendingCommands()).map(r=>r.commandId)).toEqual([a.commandId,c.commandId]);
 const unknown=playerCommandId(oldWriter.commandEpoch!,100);await expect(p.receiveCommand({...a,commandId:unknown})).rejects.toThrow(RetiredCommand);
});
it.each(['fence-write','inbox-write'] as const)('T1 %s failure rolls back both the water mark and durable row; exact retry remains legal',async point=>{
 let fail=false;const p=store(q=>{if(fail&&q===point)throw new DOMException('injected','QuotaExceededError');});await p.acquireWriter();const w=await p.start(createFormalFixture()),o=await order(p,w,1),before=await allRows(p);fail=true;
 await expect(p.receiveCommand(o)).rejects.toThrow('injected');expect(await allRows(p)).toEqual(before);fail=false;expect((await p.receiveCommand(o)).state).toBe('pending');
});
it('50 rapid accepted envelopes preserve sequence, payloads and pending rows during result compaction',async()=>{
 const p=store();await p.acquireWriter();let w=await p.start(createFormalFixture());const orders=await Promise.all(Array.from({length:50},(_,i)=>order(p,w,i+1)));
 const rows=await Promise.all(orders.map(o=>p.receiveCommand(o,captureIntent(w,o))));expect(rows.map(r=>r.commandId)).toEqual(orders.map(o=>o.commandId));expect((await p.pendingCommands()).map(r=>r.sequence)).toEqual(rows.map(r=>r.sequence));
 const row=rows[0],t=submitFormalOrder(w,row.order);w=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});expect(await p.pendingCommands()).toHaveLength(49);expect((await p.commandStatus(row.campaignId,row.commandId))?.ack).toEqual(t.ack);
});
it('committed Ack loss, exact retry, Recovery and portable import preserve recent results without executing again',async()=>{
 const p=store(),recipient=store();await p.acquireWriter();let w=await p.start(createFormalFixture());const checkpoint=(await p.backupList())[0],o=await order(p,w,1),row=await p.receiveCommand(o,captureIntent(w,o)),t=submitFormalOrder(w,o);
 w=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});expect((await p.receiveCommand(o)).ack).toEqual(t.ack);
 const quick=await p.exportStoredSave('quick'),full=await p.exportStoredSave('full');expect(JSON.parse(quick).format).toBe('lieguo-formal-bounded-save-v1');
 const restored=await p.restore(checkpoint.id);expect((await p.receiveCommand(o)).state).toBe('rolled-back');expect(submitFormalOrder(restored,o).ack?.status).toBe('rolled-back');
 await recipient.acquireWriter();await recipient.importSave(full);expect((await recipient.receiveCommand(o)).ack).toEqual(t.ack);await recipient.importSave(quick);expect((await recipient.loadSave()).game?.cities[0].name).toBe(w.cities[0].name);
 const delayed={...o,commandId:playerCommandId(row.order.commandId.slice('command:p.'.length,row.order.commandId.lastIndexOf('.')),500)};await expect(recipient.receiveCommand(delayed)).rejects.toThrow(RetiredCommand);
});
it('a compacted identity cannot return as a new effect and an unrelated durable Pending is never pruned',async()=>{
 const p=store();await p.acquireWriter();let w=await p.start(createFormalFixture());const old=await order(p,w,1),row=await p.receiveCommand(old),t=submitFormalOrder(w,old);w=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});
 const pending=await order(p,w,2000);await p.receiveCommand(pending);
 // Legal synthetic cumulative rename outcomes: the final domain state is equal;
 // only the bounded recent transport window differs. No production rule bypass.
 const epoch=(await p.writerContext()).commandEpoch!,receipts=Array.from({length:1100},(_,i)=>({commandId:playerCommandId(epoch,i+2),issuerId:w.playerFactionId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'city.rename',cityId:w.cities[0].id,name:w.cities[0].name}}),committedRevision:w.revision,disposition:'applied' as const}));
 const proof=await prepareVerifiedLedger(worldLedger(w),receipts,receipts.map(resultFromReceipt),w.revision, w.ledger!.anchor.branch,w.ledger!.anchor.writerEpoch);expect(proof.count).toBe(1024);expect(proof.result(old.commandId)).toBeUndefined();
 // Stage bounded receipts as the normal next commit delta; T1's accepted watermark
 // is already above all retired synthetic transport identities.
 w.ledger!.pending.push(...receipts);w.revision++;w=await p.save(w,[],w.revision-1);
 expect((await p.pendingCommands()).map(r=>r.commandId)).toEqual([pending.commandId]);expect(await p.commandStatus(old.campaignId,old.commandId)).toBeUndefined();await expect(p.receiveCommand(old)).rejects.toThrow(RetiredCommand);
 expect((await p.db.table('LedgerIdentity').count())).toBeLessThanOrEqual(1024);expect((await p.db.table('LedgerManifests').count())).toBeLessThanOrEqual(3);expect(w.cities[0].name).toBe(t.world.cities[0].name);
});
it.each(['report-write','backup-write','world-write','authority-write','metadata-write','result-write','ledger-segment-write','ledger-result-write','ledger-index-write','ledger-manifest-write','ledger-head-write','retention-write'] as const)('T2 %s abort preserves every table, fence, Pending, checkpoint and authoritative result',async point=>{
 let fail=false;const p=store(q=>{if(fail&&q===point)throw new DOMException('injected T2 failure','QuotaExceededError');});await p.acquireWriter();const w=await p.start(createFormalFixture()),o=await order(p,w,1),row=await p.receiveCommand(o),t=submitFormalOrder(w,o),before=await allRows(p),input=canonicalJSON(t.world);fail=true;
 await expect(p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!})).rejects.toThrow('injected T2 failure');expect(await allRows(p)).toEqual(before);expect(canonicalJSON(t.world)).toBe(input);expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('pending');
 fail=false;const committed=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});expect(committed.cities[0].name).toBe(o.payload.type==='city.rename'?o.payload.name:'');expect((await p.receiveCommand(o)).ack).toEqual(t.ack);
});
it('same identity with another payload or issuer is rejected before the intake watermark changes',async()=>{
 const p=store();await p.acquireWriter();const w=await p.start(createFormalFixture()),o=await order(p,w,1);await p.receiveCommand(o);const before=await allRows(p);
 await expect(p.receiveCommand({...o,payload:{...o.payload,type:'city.rename',cityId:w.cities[0].id,name:'不同意圖'}})).rejects.toThrow('CommandId');
 await expect(p.receiveCommand({...o,issuerId:w.factions[1].id})).rejects.toThrow('CommandId');expect(await allRows(p)).toEqual(before);
});
it('import retires a verified older terminal Inbox with its expired receipt after Recovery adds a confirmation result',async()=>{
 const p=store();await p.acquireWriter();let w=await p.start(createFormalFixture());const first=await order(p,w,1),row=await p.receiveCommand(first),t=submitFormalOrder(w,first);w=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});
 // The original real T1/T2 outcome is the oldest entry in a full foreground
 // window. The additional legal rolled-back rows carry no world effects.
 const extra=Array.from({length:1023},(_,i)=>({commandId:('command:window-'+i) as FormalOrder['commandId'],issuerId:w.playerFactionId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'city.rename',cityId:w.cities[0].id,name:w.cities[0].name}}),committedRevision:w.revision,disposition:'rolled-back' as const}));
 w.ledger!.pending.push(...extra);w.revision++;w=await p.save(w,[],w.revision-1);expect(worldLedger(w).count).toBe(1024);expect((await p.receiveCommand(first)).ack).toEqual(t.ack);
 const pending=await order(p,w,2000);await p.receiveCommand(pending);const portable=await p.exportStoredSave('quick'),point=(await p.backupList())[0];await p.restore(point.id);
 expect((await p.queryCommandStatus(first.campaignId,first.commandId)).availability).toBe('retired');expect((await p.commandStatus(pending.campaignId,pending.commandId))?.state).toBe('needs-confirmation');
 const imported=await p.importSave(portable);expect(imported.cities[0].name).toBe(w.cities[0].name);expect((await p.queryCommandStatus(first.campaignId,first.commandId)).availability).toBe('retired');await expect(p.receiveCommand(first)).rejects.toThrow(RetiredCommand);
 expect((await p.commandStatus(pending.campaignId,pending.commandId))?.state).toBe('needs-confirmation');expect(worldLedger(imported).result(first.commandId)).toBeUndefined();
});
it('checksum corruption in the replay watermark fails closed and preserves raw rows',async()=>{
 const p=store();await p.acquireWriter();const w=await p.start(createFormalFixture()),o=await order(p,w,1);await p.receiveCommand(o);
 const epoch=(await p.writerContext()).commandEpoch!;const meta=(await p.db.RuntimeMeta.get('runtime'))!;meta.fence!.acceptedThrough=0;await p.db.RuntimeMeta.put(meta);const before=await allRows(p);
 await expect(p.receiveCommand({...o,commandId:playerCommandId(epoch,2)})).rejects.toThrow();expect(await allRows(p)).toEqual(before);
});
it('Recovery preserves only pending-event internal replay witnesses even after the ordinary recent window retires the ID',async()=>{
 const {eventId,commandId}=await import('./ids'),{EventScheduler}=await import('./scheduler'),{submitAutonomous}=await import('./autonomy'),{cloneWorldDraft}=await import('./worldDraft'),{advanceFormal}=await import('./reducer'),{validateCheckpointCandidate}=await import('../persistence'),{encodeSave}=await import('./saveCodec'),{findReceipt}=await import('./commandLedger');
 const p=store();await p.acquireWriter();const input=createFormalFixture();input.events=[{id:eventId('chain-replay'),type:'fixture.marker',at:1000,marker:'pending domain event'}];let w=await p.start(input),draft=cloneWorldDraft(w),scheduler=new EventScheduler(draft.events),event=scheduler.pop()!;draft.time=event.at;draft.events=scheduler.snapshot();
 const payload={type:'city.rename' as const,cityId:w.cities[0].id,name:'內部事件只執行一次'},reports=submitAutonomous(draft,scheduler,event,w.playerFactionId,[payload],submitFormalOrder),id=commandId('ai-chain-replay-0');w=await p.save(draft,reports,w.revision);
 const point=(await p.db.backups.orderBy('id').first())!,proof=worldLedger(w),oldProofRoot=point.data.snapshot.ledger!.anchor.root,{readLedger}=await import('../ledgerStore'),checkpoint=await validateCheckpointCandidate(point,await readLedger(p.db,w.campaignId,oldProofRoot));
 expect(findReceipt(checkpoint,id)?.disposition).toBe('rolled-back');const portable=JSON.stringify(await encodeSave(checkpoint));
 const rows=Array.from({length:1100},(_,i)=>({commandId:commandId('ai-later-'+i+'-0'),issuerId:w.playerFactionId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload}),committedRevision:w.revision,disposition:'rolled-back' as const}));
 w.ledger!.pending.push(...rows);w.revision++;w=await p.save(w,[],w.revision-1);expect(worldLedger(w).result(id)).toBeUndefined();expect(proof.result(id)?.state).toBe('committed');
 const restored=await p.importSave(portable);expect(worldLedger(restored).result(id)).toBeUndefined();expect(findReceipt(restored,id)?.disposition).toBe('rolled-back');const duplicate=submitFormalOrder(restored,{commandId:id,campaignId:restored.campaignId,issuerId:restored.playerFactionId,issuedWorldTime:restored.time,expectedRevision:restored.revision,payload});expect(duplicate.ack?.status).toBe('rolled-back');expect(duplicate.world).toBe(restored);
 const consumed=advanceFormal(restored,1000).world;expect(consumed.cities[0].name).toBe(input.cities[0].name);expect(consumed.commandFacts!.replayReservations).toBeUndefined();
});
it('query distinguishes a never-received current identity from a retired gap without advancing or executing it',async()=>{
 const p=store();await p.acquireWriter();const w=await p.start(createFormalFixture()),a=await order(p,w,1),later=await order(p,w,2),before=await allRows(p);
 expect(await p.queryCommandStatus(a.campaignId,a.commandId)).toEqual({availability:'unreceived'});expect(await allRows(p)).toEqual(before);
 await p.receiveCommand(later);expect(await p.queryCommandStatus(a.campaignId,a.commandId)).toEqual({availability:'retired'});expect((await p.queryCommandStatus(later.campaignId,later.commandId)).row?.state).toBe('pending');
});
it('minimal irreversible task proofs survive more than four campaigns without retaining their command history',async()=>{
 const {initializeEconomy}=await import('./economy'),{initialMilitary}=await import('./military'),{resourceKeys}=await import('./model'),{advanceFormal}=await import('./reducer'),{GROWTH_TASK_BY_ID}=await import('./growthTaskCatalog');
 const p=store();await p.acquireWriter();let seed=createFormalFixture();seed.armies=[];for(const c of seed.cities){c.fields=Array.from({length:18},(_,slot)=>({slot,resource:resourceKeys[slot<6?0:slot<11?1:slot<15?2:3],level:0}));c.wallLevel=0;c.cityPromotionCompleted=false;c.integrationWorkHours=0;c.military=initialMilitary();}initializeEconomy(seed);
 let t=submitFormalOrder(seed,{commandId:('command:task-seed') as FormalOrder['commandId'],campaignId:seed.campaignId,issuerId:seed.playerFactionId,issuedWorldTime:seed.time,expectedRevision:seed.revision,payload:{type:'field.upgrade',cityId:seed.cities[0].id,slot:0}});expect(t.ack?.status).toBe('committed');const job=t.world.cities[0].economy!.construction[0];seed=advanceFormal(t.world,job.startsAt+job.durationMs).world;seed.cities[0].stock={food:0,wood:0,stone:0,gold:0};
 let w=await p.start(seed);const old=await p.exportStoredSave('full'),claim=await order(p,w,1);claim.payload={type:'tasks.claim',cityId:w.cities[0].id,taskId:'N01',rewardVersion:2,expectedResources:{...GROWTH_TASK_BY_ID.get('N01')!.reward}};const row=await p.receiveCommand(claim,captureIntent(w,claim));t=submitFormalOrder(w,claim);expect(t.ack?.status).toBe('committed');w=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});
 for(let i=0;i<6;i++)await p.start(createFormalFixture({campaign:'another-'+i}));expect(await p.db.table('LedgerHeads').count()).toBeLessThanOrEqual(4);expect(await p.db.table('LedgerIdentity').get([w.campaignId,claim.commandId])).toBeUndefined();
 const restored=await p.importSave(old);expect(restored.growthTasks!.claimed.N01.commandId).toBe(claim.commandId);const fresh=await order(p,restored,1);fresh.payload=claim.payload;expect(submitFormalOrder(restored,fresh).ack?.status).toBe('rejected');expect(submitFormalOrder(restored,fresh).ack?.reason).toContain('已領取');
 expect((await p.loadSave()).game!.growthTasks!.claimed).toEqual(restored.growthTasks!.claimed);expect(new TextEncoder().encode(await p.exportStoredSave('full')).length).toBeLessThan(2*1024*1024);
});
it('a private recent identity index and result proof cannot be forged from a public manifest',async()=>{
 const {LedgerCandidate}=await import('./recentReceiptIndex'),{emptyVerifiedLedger}=await import('./commandLedger'),base=await emptyVerifiedLedger('campaign:private-proof');
 expect(()=>new LedgerCandidate(undefined,base.history.manifest,[],[])).toThrow('尚未驗證');expect(Object.hasOwn(base.history,'index')).toBe(false);expect(Object.hasOwn(base,'index')).toBe(false);
});
it('an imported snapshot with an expired receipt does not invent a rolled-back result for an older effect',async()=>{
 const p=store(),source=store();await p.acquireWriter();let w=await p.start(createFormalFixture());const o=await order(p,w,1),row=await p.receiveCommand(o),t=submitFormalOrder(w,o);w=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});
 // Another installation legitimately expires this result while keeping the world
 // effect. Its bounded snapshot cannot prove this old effect was rolled back.
 await source.acquireWriter();let imported=await source.importSave(await p.exportStoredSave('quick'));const receipts=Array.from({length:1100},(_,i)=>({commandId:`command:source-${i}` as FormalOrder['commandId'],issuerId:imported.playerFactionId,fingerprint:canonicalJSON({campaignId:imported.campaignId,issuerId:imported.playerFactionId,payload:{type:'city.rename',cityId:imported.cities[0].id,name:imported.cities[0].name}}),committedRevision:imported.revision,disposition:'applied' as const}));
 imported.ledger!.pending.push(...receipts);imported.revision++;await source.save(imported,[],imported.revision-1);const beforeName=w.cities[0].name;
 const restored=await p.importSave(await source.exportStoredSave('quick'));expect(restored.cities[0].name).toBe(beforeName);expect(worldLedger(restored).result(o.commandId)).toBeUndefined();expect(await p.queryCommandStatus(o.campaignId,o.commandId)).toEqual({availability:'retired'});await expect(p.receiveCommand(o)).rejects.toThrow(RetiredCommand);
});
it('Quick and Full export refuse missing signed Recovery references instead of silently dropping them',async()=>{
 const p=store();await p.acquireWriter();await p.start(createFormalFixture());const point=(await p.backupList())[0];await p.db.backups.delete(point.id);const before=await allRows(p);
 for(const mode of ['quick','full'] as const)await expect(p.exportStoredSave(mode)).rejects.toThrow('權威回復點遺失');expect(await allRows(p)).toEqual(before);
});
it('export refuses a valid older snapshot substituted beneath a newer Authority binding',async()=>{
 const p=store();await p.acquireWriter();const w=await p.start(createFormalFixture()),old=await p.db.saves.get('current'),o=await order(p,w,1),row=await p.receiveCommand(o),t=submitFormalOrder(w,o);await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});await p.db.saves.put(old!);const before=await allRows(p);
 await expect(p.exportStoredSave('quick')).rejects.toThrow('匯出世界與權威版本不一致');expect(await allRows(p)).toEqual(before);
});
it('T2 retention reads identity keys without cloning payloads and preserves Pending and authoritative results',async()=>{
 const p=store(),queries:(boolean|undefined)[]=[];p.db.use({stack:'dbcore',name:'observe-retention-query',create(down){return {...down,table(name){const table=down.table(name);if(name!=='LedgerIdentity')return table;return {...table,query(req){queries.push(req.values);return table.query(req);}};}};}});
 await p.acquireWriter();const w=await p.start(createFormalFixture()),o=await order(p,w,1),row=await p.receiveCommand(o),later=await order(p,w,2);await p.receiveCommand(later);
 await p.db.table('LedgerIdentity').put({campaignId:'campaign:unretained',commandId:'command:unretained',original:{payload:'not needed for retention'}});
 queries.length=0;const t=submitFormalOrder(w,o);await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});
 expect(queries.length).toBeGreaterThan(0);expect(queries.every(values=>values===false)).toBe(true);
 expect(await p.db.table('LedgerIdentity').get(['campaign:unretained','command:unretained'])).toBeUndefined();
 expect((await p.receiveCommand(o)).ack).toEqual(t.ack);expect((await p.commandStatus(later.campaignId,later.commandId))?.state).toBe('pending');
});
