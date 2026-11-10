import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {afterEach,expect,it} from 'vitest';
import {FormalDatabase,FormalPersistence,type FailurePoint} from '../persistence';
import {captureIntent,revalidateInbox,terminalCommand,retryableStorageError,MAX_COMMAND_ATTEMPTS,COMMAND_TTL} from '../durableCommands';
import {createFormalFixture,fixtureIds} from './fixture';
import {contribute,order} from './testSupport';
import {submitFormalOrder,advanceFormal} from './reducer';
import {commandId} from './ids';
import type {CommandReceipt,FormalOrder,FormalWorld} from './model';
import {encodeSave} from './saveCodec';
import {FORMAL_DB_NAME} from './versions';
const stores:FormalPersistence[]=[];let serial=0;
function store(fault?:(point:FailurePoint)=>void,suffix='durable-'+(++serial)){const s=new FormalPersistence({suffix,fault});stores.push(s);return s;}
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
async function begin(s:FormalPersistence){await s.acquireWriter();return s.start(createFormalFixture({research:true}));}
const contents=async(s:FormalPersistence)=>({saves:await s.db.saves.toArray(),backups:await s.db.backups.toArray(),reports:await s.db.BattleReports.toArray(),inbox:await s.db.Inbox.toArray(),meta:await s.db.RuntimeMeta.toArray()});
async function receive(s:FormalPersistence,w:FormalWorld,o:FormalOrder){return s.receiveCommand(o,captureIntent(w,o),(await s.writerContext()).branch);}
async function commit(s:FormalPersistence,w:FormalWorld,o:FormalOrder){const row=await receive(s,w,o),t=submitFormalOrder(w,o);expect(t.ack!.status).toBe('committed');return s.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});}
it('T1 interruption before intake creates nothing; failure after inbox-write rolls back and preserves the original payload',async()=>{
 let fail=false;const s=store(p=>{if(fail&&p==='inbox-write')throw new DOMException('quota','QuotaExceededError');}),w=await begin(s),o=contribute(w,'t1'),before=await contents(s);
 expect(await s.pendingCommands()).toEqual([]);fail=true;await expect(receive(s,w,o)).rejects.toMatchObject({name:'QuotaExceededError'});expect(await contents(s)).toEqual(before);expect(o.payload).toEqual(contribute(w,'t1').payload);
 fail=false;const row=await receive(s,w,o);expect(row.state).toBe('pending');expect(row.order).toEqual(o);expect((await s.loadSave()).game).toEqual(w);
});
it('T1 success survives a new writer/connection before T2 and recovers the original revision and intent',async()=>{
 const s=store(),w=await begin(s),o=contribute(w,'restart'),row=await receive(s,w,o);s.db.close();const resumed=store(undefined,s.db.name.slice(FORMAL_DB_NAME.length+1));await resumed.acquireWriter();const loaded=(await resumed.loadSave()).game!;
 const recovered=(await resumed.pendingCommands())[0];expect(recovered).toEqual(row);const execution=revalidateInbox(loaded,recovered)!;const t=submitFormalOrder(loaded,execution);const committed=await resumed.save(t.world,t.reports,loaded.revision,undefined,{row:recovered,ack:t.ack!});expect(committed.cities[0].stock.food).toBe(500);expect((await resumed.commandStatus(o.campaignId,o.commandId))!.state).toBe('committed');
});
for(const point of ['report-write','backup-write','world-write','authority-write','metadata-write','result-write'] as const)it(`T2 ${point} abort leaves world, authority, reports, Recovery and pending result identical`,async()=>{
 let fail:FailurePoint|undefined;const s=store(p=>{if(p===fail)throw new DOMException('temporary','AbortError');}),w=await begin(s),o=contribute(w,'atomic-'+point),row=await receive(s,w,o),t=submitFormalOrder(w,o),before=await contents(s);
 fail=point;await expect(s.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!})).rejects.toThrow('temporary');expect(await contents(s)).toEqual(before);expect((await s.loadSave()).game).toEqual(w);
 fail=undefined;const next=await s.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});expect(next.commandReceipts.filter(r=>r.commandId===o.commandId)).toHaveLength(1);expect(next.cities[0].stock.food).toBe(500);expect((await s.commandStatus(o.campaignId,o.commandId))!.ack).toEqual(t.ack);
});
it('T2 succeeds without T3/Ack; identical resends query one exact durable result and never deduct again',async()=>{
 const s=store(),w=await begin(s),o=contribute(w,'lost-ack'),next=await commit(s,w,o),row=(await s.commandStatus(o.campaignId,o.commandId))!;
 for(let i=0;i<8;i++)expect(await receive(s,next,o)).toEqual(row);
 expect((await s.loadSave()).game!.cities[0].stock.food).toBe(500);expect(next.commandReceipts).toHaveLength(1);expect(await s.db.Inbox.count()).toBe(1);expect(row.ack!.status).toBe('committed');
});
it('same CampaignId+CommandId with different issuer or fingerprint rejects before changing any durable row',async()=>{
 const s=store(),w=await begin(s),o=contribute(w,'identity');await receive(s,w,o);const before=await contents(s);
 await expect(receive(s,w,{...o,payload:{type:'city.rename',cityId:fixtureIds.home,name:'other'}})).rejects.toThrow('CommandId');
 await expect(receive(s,w,{...o,issuerId:fixtureIds.other})).rejects.toThrow('CommandId');expect(await contents(s)).toEqual(before);
});
it('FIFO intake uses persistent monotonic sequence and preserves different click envelopes',async()=>{
 const s=store(),w=await begin(s),a=order(w,'a',{type:'city.rename',cityId:fixtureIds.home,name:'甲'}),b=order(w,'b',{type:'city.rename',cityId:fixtureIds.support,name:'乙'});
 const [first,second]=await Promise.all([receive(s,w,a),receive(s,w,b)]);expect(first.sequence!).toBeLessThan(second.sequence!);expect((await s.pendingCommands()).map(r=>r.order)).toEqual([a,b]);
 const next=await commit(s,w,a),execution=revalidateInbox(next,second)!;expect(execution.payload).toEqual(b.payload);expect(second.order.expectedRevision).toBe(0);expect(execution.expectedRevision).toBe(1);
 const t=submitFormalOrder(next,execution);const done=await s.save(t.world,t.reports,next.revision,undefined,{row:second,ack:t.ack!});expect(done.cities.slice(0,2).map(c=>c.name)).toEqual(['甲','乙']);
});
it('changed intent becomes durable Needs Confirmation; no blind revision overwrite or automatic target replacement',async()=>{
 const s=store(),w=await begin(s),o=order(w,'queued',{type:'city.rename',cityId:fixtureIds.home,name:'原意圖'}),row=await receive(s,w,o),next=await commit(s,w,order(w,'prior',{type:'city.rename',cityId:fixtureIds.home,name:'已變更'}));
 expect(revalidateInbox(next,row)).toBeUndefined();const ack={commandId:o.commandId,status:'rejected' as const,revision:next.revision,reason:'世界狀態已變更，請重新確認原始操作。'};await s.finishCommand(row,ack,next.revision);expect((await s.commandStatus(o.campaignId,o.commandId))!.state).toBe('needs-confirmation');expect(row.order).toEqual(o);expect((await s.loadSave()).game).toEqual(next);
});
it.each(['restore','import','start','reset'] as const)('%s cancels old pending in the same transaction; restored committed commands become rolled-back',async mode=>{
 const s=store(),w=await begin(s),checkpoint=(await s.backupList())[0].id,text=await s.exportStoredSave(),o=contribute(w,'done'),next=await commit(s,w,o),pending=order(next,'pending',{type:'city.rename',cityId:fixtureIds.home,name:'不可跨分支'});await receive(s,next,pending);
 if(mode==='restore')await s.restore(checkpoint);else if(mode==='import')await s.importSave(text);else if(mode==='start')await s.start(createFormalFixture({campaign:'new'}));else await s.clearSavedGames();
 expect((await s.commandStatus(pending.campaignId,pending.commandId))!.state).toBe('needs-confirmation');expect(await s.pendingCommands()).toEqual([]);
 if(mode==='restore'||mode==='import')expect((await s.commandStatus(o.campaignId,o.commandId))!.state).toBe('rolled-back');
});
it('writer epoch fencing prevents a stale Worker from intake, result writes, reset and world commits; revision CAS remains enforced',async()=>{
 const a=store(),w=await begin(a),o=contribute(w,'writer'),row=await receive(a,w,o),t=submitFormalOrder(w,o),b=store(undefined,a.db.name.slice(FORMAL_DB_NAME.length+1));await b.acquireWriter();const before=await contents(b);
 await expect(a.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!})).rejects.toThrow('寫入權');await expect(a.receiveCommand(o)).rejects.toThrow('寫入權');await expect(a.finishCommand(row,t.ack!,w.revision)).rejects.toThrow('寫入權');await expect(a.clearSavedGames()).rejects.toThrow('寫入權');expect(await contents(b)).toEqual(before);
 await b.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});await expect(b.save(t.world,t.reports,w.revision)).rejects.toThrow('revision');
});
it('temporary failures retry at most three times; quota and unknown/permanent faults never auto retry; deadline stays bounded',async()=>{
 const s=store(),w=await begin(s),o=contribute(w,'retry'),row=await receive(s,w,o);
 expect(retryableStorageError(new DOMException('temporary','AbortError'))).toBe(true);expect(retryableStorageError(new DOMException('quota','QuotaExceededError'))).toBe(false);expect(retryableStorageError(Error('unknown'))).toBe(false);expect(retryableStorageError(new DOMException('uncategorized','UnknownError'))).toBe(false);
 for(let i=1;i<=MAX_COMMAND_ATTEMPTS;i++){const next=await s.noteCommandFailure(row,'temporary',true,row.createdAt+i);expect(next.attempts).toBe(i);expect(terminalCommand(next)).toBe(i===MAX_COMMAND_ATTEMPTS);expect(next.deadline).toBe(row.createdAt+COMMAND_TTL);}
 const other=await receive(s,w,contribute(w,'expired'));const expired=await s.noteCommandFailure(other,'deadline',true,other.deadline);expect(expired.state).toBe('needs-confirmation');
});
it('v1 IndexedDB migration adds empty Inbox/RuntimeMeta without changing the old world, Recovery, authority or history',async()=>{
 const suffix='migration-'+(++serial),name=FORMAL_DB_NAME+'-'+suffix,old=new Dexie(name);old.version(1).stores({saves:'id',backups:'++id,at,campaignId',BattleReports:'key,campaignId,[campaignId+sequence],[campaignId+ownerFactionId+sequence]'});await old.open();
 const w=createFormalFixture(),data=await encodeSave(w);await old.table('saves').put({id:'current',kind:'world',at:100,data});await old.table('saves').put({id:'authority',kind:'authority',revision:0,sequences:w.sequences,campaigns:[{campaignId:w.campaignId,receipts:[]}]});await old.table('backups').add({at:100,label:'v1',campaignId:w.campaignId,gameTime:0,reportCursor:1,data});const before=await old.table('saves').toArray();old.close();
 const s=store(undefined,suffix);expect((await s.loadSave()).game).toEqual(w);expect(await s.db.saves.toArray()).toEqual(before);expect(await s.db.Inbox.count()).toBe(0);expect(await s.db.backups.count()).toBe(1);expect(new FormalDatabase().verno).toBe(2);
});
for(const count of [30000,60000])it(`synthetic ${count} receipts retain all history through durable intake, atomic commit and duplicate lookup`,async()=>{
 const s=store(),w=createFormalFixture();w.revision=1;w.commandReceipts=Array.from({length:count},(_,i):CommandReceipt=>({commandId:commandId('history-'+i),issuerId:w.playerFactionId,fingerprint:'synthetic-'+i,committedRevision:1,disposition:'rolled-back'}));await s.acquireWriter();const initial=await s.start(w),o=order(initial,'new',{type:'city.rename',cityId:fixtureIds.home,name:'完整歷史'}),next=await commit(s,initial,o);expect(next.commandReceipts).toHaveLength(count+1);expect((await receive(s,next,o)).state).toBe('committed');expect((await s.loadSave()).game!.commandReceipts).toHaveLength(count+1);
},30000);
it('clock-only advancement revalidates original intent but keeps its stored revision and payload unchanged',async()=>{
 const s=store(),w=await begin(s),o=order(w,'clock',{type:'city.rename',cityId:fixtureIds.home,name:'原意圖'}),row=await receive(s,w,o),t=advanceFormal(w,1000),next=await s.save(t.world,t.reports,w.revision),execution=revalidateInbox(next,row)!;expect(execution.expectedRevision).toBe(next.revision);expect(row.order).toEqual(o);expect(execution.payload).toEqual(o.payload);
});
it('a fabricated committed result without a matching world receipt aborts the whole T2',async()=>{
 const s=store(),w=await begin(s),o=contribute(w,'fake'),row=await receive(s,w,o),draft={...w,revision:w.revision+1},before=await contents(s);
 await expect(s.save(draft,[],w.revision,undefined,{row,ack:{commandId:o.commandId,status:'committed',revision:draft.revision}})).rejects.toThrow('正式結果與世界命令收據不一致');expect(await contents(s)).toEqual(before);
});
it.each(['restore','import','start','reset'] as const)('%s branch/write failure preserves both the prior world and original pending records',async mode=>{
 let fail=false;const s=store(point=>{if(fail&&point==='branch-write')throw new Error('branch transaction fault');}),w=await begin(s),checkpoint=(await s.backupList())[0].id,text=await s.exportStoredSave(),o=order(w,'pending-branch',{type:'city.rename',cityId:fixtureIds.home,name:'保留原意圖'});await receive(s,w,o);const before=await contents(s);
 fail=true;const action=()=>mode==='restore'?s.restore(checkpoint):mode==='import'?s.importSave(text):mode==='start'?s.start(createFormalFixture({campaign:'new-branch'})):s.clearSavedGames();await expect(action()).rejects.toThrow('branch transaction fault');expect(await contents(s)).toEqual(before);
 fail=false;await action();expect((await s.commandStatus(o.campaignId,o.commandId))!.state).toBe('needs-confirmation');
});
it('writer acquisition during a corrupt v1 migration does not preempt the established Recovery fallback',async()=>{
 const suffix='migration-recovery-'+(++serial),old=new Dexie(FORMAL_DB_NAME+'-'+suffix);old.version(1).stores({saves:'id',backups:'++id,at,campaignId',BattleReports:'key,campaignId,[campaignId+sequence],[campaignId+ownerFactionId+sequence]'});await old.open();const w=createFormalFixture(),data=await encodeSave(w);
 await old.table('saves').put({id:'current',kind:'world',at:100,data:{...data,snapshot:undefined}});await old.table('saves').put({id:'authority',kind:'authority',revision:0,sequences:w.sequences,campaigns:[{campaignId:w.campaignId,receipts:[]}]});await old.table('backups').add({at:100,label:'valid-v1-recovery',campaignId:w.campaignId,gameTime:0,reportCursor:1,data});old.close();
 const s=store(undefined,suffix);await expect(s.acquireWriter()).resolves.toMatchObject({writerEpoch:1});const result=await s.loadSave();expect(result.recovered).toBe(true);expect(result.game!.cities).toEqual(w.cities);expect(result.game!.revision).toBe(1);expect((await s.writerContext()).branch).toBe(1);
});
