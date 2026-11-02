import {contribute} from './testSupport';
import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {FormalPersistence} from '../persistence';
import {createFormalFixture} from './fixture';
import {submitFormalOrder} from './reducer';
import {commandId} from './ids';
import {captureIntent} from '../durableCommands';
import {commandHistory,projectWorld,originalResult} from './commandLedger';
const store=()=>new FormalPersistence({suffix:'formal-ledger-'+crypto.randomUUID()});
it('formal T2 separates hot world, carries rejected identities and restores the exact original outcome',async()=>{
 const p=store(),other=store();try{
 let w=await p.start(createFormalFixture());expect(w.ledger).toBeDefined();expect(Object.keys(w)).not.toContain('commandReceipts');
 const o={commandId:commandId('rename-ledger'),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'正式帳本'}};
 const row=await p.receiveCommand(o,captureIntent(w,o)),t=submitFormalOrder(w,o);expect(t.ack?.status).toBe('committed');w=await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});
 expect(commandHistory(w)).toHaveLength(1);expect(originalResult(w,o.commandId)?.state).toBe('committed');expect(JSON.stringify(w)).not.toContain('rename-ledger');
 expect((await p.loadSave()).game?.ledger?.anchor.root).toBe(w.ledger!.anchor.root);
 const rejected={...o,commandId:commandId('rejected-ledger'),expectedRevision:w.revision,payload:{...o.payload,name:'不應執行'}};const r=await p.receiveCommand(rejected);w=await p.finishCommand(r,{commandId:rejected.commandId,status:'rejected',revision:w.revision,reason:'合成拒絕'},w.revision);
 const text=await p.exportStoredSave('quick');const imported=await other.importSave(text);
 expect(originalResult(imported,rejected.commandId)?.ack.reason).toBe('合成拒絕');expect((await other.receiveCommand(rejected)).state).toBe('rejected');
 expect(projectWorld(imported).cities[0].name).toBe('正式帳本');expect(submitFormalOrder(imported,rejected).ack?.reason).toBe('合成拒絕');
 }finally{await p.db.delete();await other.db.delete();}
});

import type {FailurePoint} from '../persistence';
import {readLedger} from '../ledgerStore';
import {validateFormalWorld} from './schema';
const allRows=(p:FormalPersistence)=>Promise.all(p.db.tables.map(async t=>[t.name,await t.toArray()]));
const rename=(w:ReturnType<typeof createFormalFixture>,id:string)=>({commandId:commandId(id),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'交易測試'}});
const t2Points:FailurePoint[]=['report-write','backup-write','world-write','authority-write','metadata-write','result-write','ledger-segment-write','ledger-result-write','ledger-index-write','ledger-manifest-write','ledger-head-write'];
it.each(t2Points)('formal T2 %s failure preserves every table, Pending and caller; retry commits exactly once',async point=>{
 let fail=false;const p=new FormalPersistence({suffix:'formal-fault-'+crypto.randomUUID(),fault:q=>{if(fail&&q===point)throw new DOMException('injected quota','QuotaExceededError');}});
 try{const w=await p.start(createFormalFixture({research:true})),o=contribute(w,'fault',100),row=await p.receiveCommand(o),t=submitFormalOrder(w,o),before=await allRows(p),input=JSON.stringify(t.world);fail=true;
 await expect(p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!})).rejects.toThrow('injected quota');expect(await allRows(p)).toEqual(before);expect(JSON.stringify(t.world)).toBe(input);expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('pending');
 fail=false;const saved=await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});expect(submitFormalOrder(saved,o).ack?.status).toBe('duplicate');expect(commandHistory(saved)).toHaveLength(1);expect(saved.cities[0].stock.food).toBe(w.cities[0].stock.food-100);expect((await p.loadSave()).game?.ledger?.anchor.root).toBe(saved.ledger!.anchor.root);
 }finally{await p.db.delete();}
});
it('Recovery keeps immutable results, refreshes Inbox projection and never executes an old ID again',async()=>{
 const p=store();try{const w=await p.start(createFormalFixture()),point=(await p.backupList())[0],o=rename(w,'recovered'),row=await p.receiveCommand(o),t=submitFormalOrder(w,o),saved=await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!}),text=await p.exportStoredSave('full');
 const restored=await p.restore(point.id);expect(submitFormalOrder(restored,o).ack?.status).toBe('rolled-back');expect(originalResult(restored,o.commandId)?.ack).toEqual(t.ack);expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('rolled-back');
 const imported=await p.importSave(text);expect(imported.cities[0].name).toBe(saved.cities[0].name);expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('committed');expect(originalResult(imported,o.commandId)?.ack).toEqual(t.ack);expect(submitFormalOrder(imported,o).ack?.status).toBe('duplicate');
 }finally{await p.db.delete();}
});
it('branch switching and reset persist foreign Pending outcomes and preserve old identities on restart',async()=>{
 const p=store();try{const old=await p.start(createFormalFixture({campaign:'first'})),o=rename(old,'pending-old');await p.receiveCommand(o);
 await p.start(createFormalFixture({campaign:'second'}));const firstHead=await p.db.table('LedgerHeads').get(old.campaignId),proof=await readLedger(p.db,old.campaignId,firstHead.root);expect(proof.result(o.commandId)?.state).toBe('needs-confirmation');expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('needs-confirmation');
 await p.clearSavedGames();expect((await p.loadSave()).game).toBeNull();const next=await p.start(createFormalFixture({campaign:'third'}));expect(next.campaignId).not.toBe(old.campaignId);expect((await p.receiveCommand(o)).state).toBe('needs-confirmation');
 }finally{await p.db.delete();}
});
it('structuredClone retains an explicit version reference; forged branch binding is rejected',async()=>{
 const p=store();try{const w=await p.start(createFormalFixture()),copy=structuredClone(w);expect(Object.keys(copy)).not.toContain('commandReceipts');const valid=validateFormalWorld(copy);expect(valid.ledger).toEqual(w.ledger);copy.ledger!.anchor.branch++;expect(()=>validateFormalWorld(copy)).toThrow('綁定');}finally{await p.db.delete();}
});
it('corrupt immutable segments are rejected without clearing the original database',async()=>{
 const p=store();try{const w=await p.start(createFormalFixture()),o=rename(w,'corrupt'),t=submitFormalOrder(w,o),saved=await p.save(t.world,[],w.revision),root=saved.ledger!.anchor.root;const seg=(await p.db.table('LedgerSegments').toArray())[0];await p.db.table('LedgerSegments').delete(seg.checksum);const before=await allRows(p);await expect(readLedger(p.db,w.campaignId,root)).rejects.toThrow('遺失');expect(await allRows(p)).toEqual(before);}finally{await p.db.delete();}
});

it('AI/T1 identity collision rejects the accepted player attempt without borrowing the AI success Ack',async()=>{
 const p=store(),other=store();try{const w=await p.start(createFormalFixture()),o=rename(w,'collision'),row=await p.receiveCommand(o),enemy=w.cities.find(c=>c.ownerFactionId!==w.playerFactionId)!,ai={...o,issuerId:enemy.ownerFactionId,payload:{type:'city.rename' as const,cityId:enemy.id,name:'AI 名稱'}},t=submitFormalOrder(w,ai);expect(t.ack?.status).toBe('committed');const saved=await p.save(t.world,[],w.revision);
 const queried=await p.commandStatus(o.campaignId,o.commandId);expect(queried?.state).toBe('rejected');expect(queried?.ack?.status).toBe('rejected');expect(queried?.order).toEqual(row.order);expect(originalResult(saved,o.commandId)?.issuerId).toBe(ai.issuerId);expect(saved.cities[0].name).toBe(w.cities[0].name);
 const imported=await other.importSave(await p.exportStoredSave('quick'));expect((await other.commandStatus(o.campaignId,o.commandId))?.state).toBe('rejected');expect(originalResult(imported,o.commandId)?.issuerId).toBe(ai.issuerId);expect((await other.receiveCommand(o)).state).toBe('rejected');
 }finally{await p.db.delete();await other.db.delete();}
});

import {advanceFormal} from './reducer';
it('T3 derives branch results from the immutable ledger; cache repair never changes T2 or extends a rollback revision',async()=>{
 const p=store();try{const w=await p.start(createFormalFixture()),checkpoint=(await p.backupList())[0],o=rename(w,'cache-repair'),row=await p.receiveCommand(o),t=submitFormalOrder(w,o);await p.save(t.world,[],w.revision,undefined,{row,ack:t.ack!});const restored=await p.restore(checkpoint.id),at=restored.revision,advanced=advanceFormal(restored,1000);await p.save(advanced.world,[],restored.revision);
 await p.db.Inbox.update(row.sequence!,{state:'committed',ack:t.ack!});const before=await p.db.saves.toArray(),status=await p.commandStatus(o.campaignId,o.commandId);expect(status?.state).toBe('rolled-back');expect(status?.ack?.revision).toBe(at);expect(status?.originalResult?.ack).toEqual(t.ack);expect(await p.db.saves.toArray()).toEqual(before);expect((await p.db.Inbox.get(row.sequence!))?.state).toBe('rolled-back');
 }finally{await p.db.delete();}
});

import {createFormalWorld} from './generator';
import {canonicalJSON} from './canonical';
function nativeHistory(count:number){const w=createFormalWorld({campaign:'formal-history-'+count+'-'+crypto.randomUUID(),seed:90217});w.revision=2;w.commandReceipts=Array.from({length:count},(_,i)=>{const issuer=w.factions[i%100].id,city=w.cities.find(c=>c.ownerFactionId===issuer)!;return {commandId:commandId('seed-'+String(i).padStart(6,'0')),issuerId:issuer,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:issuer,payload:{type:'city.rename',cityId:city.id,name:'合成歷史'+i}}),committedRevision:1,disposition:'rolled-back' as const};});return validateFormalWorld(w);}
it.each([0,1000,10000,30000,60000])('formal native %i history: exact rule parity, T1/T2, quick/full roundtrip, Recovery and all identities survive',async count=>{
 const p=store(),q=store();try{const initial=nativeHistory(count),w=await p.start(initial),o=rename(w,'native-after-history'),row=await p.receiveCommand(o,captureIntent(w,o)),before=projectWorld(w),legacy=submitFormalOrder(before,o),actual=submitFormalOrder(w,o);expect(actual.ack).toEqual(legacy.ack);expect(projectWorld(actual.world)).toEqual(legacy.world);
 const saved=await p.save(actual.world,actual.reports,w.revision,undefined,{row,ack:actual.ack!});expect(commandHistory(saved)).toHaveLength(count+1);expect(JSON.stringify(saved)).not.toContain('command:seed-');expect(Object.keys((await p.db.saves.get('current') as any).data.snapshot)).not.toContain('commandReceipts');expect(await p.db.table('LedgerIdentity').count()).toBe(count+1);
 for(const mode of ['quick','full'] as const){const imported=await q.importSave(await p.exportStoredSave(mode));expect(commandHistory(imported)).toHaveLength(count+1);const proof=await readLedger(q.db,imported.campaignId,imported.ledger!.anchor.root);for(const old of initial.commandReceipts){expect(proof.receipt(old.commandId)).toEqual(old);expect(proof.result(old.commandId)?.ack.status).toBe('committed');}expect((await q.receiveCommand(o)).state).toBe('committed');expect(submitFormalOrder(imported,o).ack?.status).toBe('duplicate');}
 const older=(await q.backupList()).at(-1)!;const restored=await q.restore(older.id);expect(commandHistory(restored)).toHaveLength(count+1);expect(originalResult(restored,o.commandId)?.ack).toEqual(actual.ack);expect(submitFormalOrder(restored,o).ack?.status).toBe('rolled-back');expect((await q.commandStatus(o.campaignId,o.commandId))?.state).toBe('rolled-back');
 }finally{await p.db.delete();await q.db.delete();}
},120000);

it.each(['world-write','authority-write','result-write','ledger-result-write','ledger-index-write','ledger-manifest-write','ledger-head-write'] as FailurePoint[])('no-effect T2 %s abort keeps the original Pending and every authoritative table unchanged',async point=>{
 let fail=false;const p=new FormalPersistence({suffix:'no-effect-'+crypto.randomUUID(),fault:q=>{if(fail&&q===point)throw new DOMException('no-effect quota','QuotaExceededError');}});try{const w=await p.start(createFormalFixture()),o=rename(w,'no-effect'),row=await p.receiveCommand(o),ack={commandId:o.commandId,status:'rejected' as const,revision:w.revision,reason:'合成拒絕'},before=await allRows(p);fail=true;await expect(p.finishCommand(row,ack,w.revision)).rejects.toThrow('no-effect quota');expect(await allRows(p)).toEqual(before);fail=false;const saved=await p.finishCommand(row,ack,w.revision);expect(saved.revision).toBe(w.revision);expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('rejected');expect(originalResult(saved,o.commandId)?.ack).toEqual(ack);}finally{await p.db.delete();}
});
it('T2 snapshots caller envelopes immediately and keeps the durable original order',async()=>{
 const p=store();try{const w=await p.start(createFormalFixture()),o=rename(w,'caller-mutation'),row=await p.receiveCommand(o),t=submitFormalOrder(w,o),ack={...t.ack!},promise=p.save(t.world,[],w.revision,undefined,{row,ack});row.order.expectedRevision=987;ack.reason='caller changed';const saved=await promise;expect(originalResult(saved,o.commandId)?.order).toEqual(o);expect(originalResult(saved,o.commandId)?.ack).toEqual(t.ack);}finally{await p.db.delete();}
});
