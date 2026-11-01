import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {commandId,factionId} from './ids';
import type {CommandReceipt} from './model';
import {emptyLedger,prepareLedger,verifyLedger,assertFormalActivationSupported,hash} from '../../../scripts/command-ledger-candidate.mjs';
import {candidateDatabase,publishCandidate,readCandidate,readHistoricalCandidate} from '../../../scripts/command-ledger-candidate-store.mjs';
import {createFormalFixture} from './fixture';
import {createFormalWorld} from './generator';
import {submitFormalOrder,advanceFormal} from './reducer';
import {FormalPersistence} from '../persistence';
import {captureIntent} from '../durableCommands';
const campaign='campaign:ledger-proposal';
const receipt=(i:number):CommandReceipt=>({commandId:commandId('ledger-'+i),issuerId:factionId(String(i%100).padStart(3,'0')),fingerprint:JSON.stringify({payload:{type:'synthetic-evidence',i}}),committedRevision:1,disposition:'applied'});
it('explicitly refuses formal activation and production database names',()=>{expect(assertFormalActivationSupported).toThrow('BLOCKED');expect(()=>candidateDatabase('lieguo-formal')).toThrow('production database');expect(()=>candidateDatabase('anything')).toThrow();});
it.each([0,1000,10000,30000,60000])('preserves every field at %i identities and verifies a portable roundtrip',async count=>{
 const base=await emptyLedger(campaign),rows=Array.from({length:count},(_,i)=>receipt(i));const a=await prepareLedger(base,rows,{worldRevision:1}),b=await verifyLedger(JSON.parse(JSON.stringify(a.archive())));
 expect(b.manifest.recordCount).toBe(count);for(let i=0;i<count;i++)expect(b.lookup(campaign,rows[i].commandId)).toEqual(rows[i]);expect(base.manifest.recordCount).toBe(0);
 const appended=await prepareLedger(b,[receipt(count)],{worldRevision:2});expect(appended.lookup(campaign,receipt(count).commandId)).toEqual(receipt(count));expect(b.lookup(campaign,receipt(count).commandId)).toBeUndefined();expect(appended.segments[0]).toBe(count?b.segments[0]:appended.segments[0]);
});
it('rejects same ID/different issuer/fingerprint/revision; branch never namespaces identity',async()=>{
 const a=await prepareLedger(await emptyLedger(campaign),[receipt(0)],{worldRevision:1});expect(await prepareLedger(a,[receipt(0)],{worldRevision:2})).toBe(a);
 for(const changed of [{issuerId:factionId('001')},{fingerprint:'different'},{committedRevision:2}])await expect(prepareLedger(a,[{...receipt(0),...changed}],{worldRevision:2,branch:1,recovery:true})).rejects.toThrow('identity conflict');
 expect(()=>a.lookup('campaign:other',receipt(0).commandId)).toThrow('Campaign');
});
it('keeps immutable history and historic disposition on explicit Recovery',async()=>{
 const a=await prepareLedger(await emptyLedger(campaign),[receipt(0),receipt(1)],{worldRevision:1});const b=await prepareLedger(a,[{...receipt(0),disposition:'rolled-back'}],{worldRevision:2,branch:1,recovery:true});
 expect(a.lookup(campaign,receipt(0).commandId)?.disposition).toBe('applied');expect(b.lookup(campaign,receipt(0).commandId)?.disposition).toBe('rolled-back');expect(b.manifest.recordCount).toBe(2);expect(b.manifest.eventCount).toBe(3);expect((await verifyLedger(b.archive())).lookup(campaign,receipt(0).commandId)).toEqual({...receipt(0),disposition:'rolled-back'});
 await expect(prepareLedger(a,[{...receipt(0),disposition:'rolled-back'}],{worldRevision:2})).rejects.toThrow('Recovery');
});
it('rejects missing/corrupt/reordered segments, cross-campaign roots and forged index counts',async()=>{
 const a=await prepareLedger(await emptyLedger(campaign),Array.from({length:260},(_,i)=>receipt(i)),{worldRevision:1});
 for(const change of [(v:any)=>v.segments.pop(),(v:any)=>v.segments.reverse(),(v:any)=>v.segments[0].events[0].receipt.fingerprint='corrupt',(v:any)=>v.manifest.campaignId='campaign:other',(v:any)=>v.manifest.recordCount++]){const v=a.archive();change(v);await expect(verifyLedger(v)).rejects.toThrow();}
 const v=a.archive();v.manifest.unknown=true;const {checksum:_old,...body}=v.manifest;v.manifest.checksum=await hash(body);await expect(verifyLedger(v)).rejects.toThrow('Unknown manifest');
});
it.each(['segment-write','index-write','manifest-write','marker-write','head-write'])('synthetic transaction failure at %s publishes no partial evidence',async point=>{
 const db=candidateDatabase('synthetic-ledger-r303-'+crypto.randomUUID());try{const a=await emptyLedger(campaign),b=await prepareLedger(a,[receipt(0)],{worldRevision:1});await expect(publishCandidate(db,b,a.manifest.checksum,{fault:p=>{if(p===point)throw new DOMException('injected','QuotaExceededError');}})).rejects.toThrow();for(const table of db.tables)expect(await table.count()).toBe(0);expect((await readCandidate(db,campaign)).manifest.recordCount).toBe(0);}finally{await db.delete();}
});
it('synthetic restart, lost notification and competing writer CAS keep exact index identity once',async()=>{
 const name='synthetic-ledger-r303-'+crypto.randomUUID();let db=candidateDatabase(name);try{const a=await emptyLedger(campaign),b=await prepareLedger(a,[receipt(0)],{worldRevision:1,writerEpoch:1});await publishCandidate(db,b,a.manifest.checksum);db.close();db=candidateDatabase(name);const loaded=await readCandidate(db,campaign);expect(loaded.lookup(campaign,receipt(0).commandId)).toEqual(receipt(0));expect((await publishCandidate(db,b,a.manifest.checksum)).duplicate).toBe(true);
 const stale=await prepareLedger(a,[receipt(1)],{worldRevision:1});await expect(publishCandidate(db,stale,a.manifest.checksum)).rejects.toThrow('CAS');expect(await db.table('identity').count()).toBe(1);
 await db.table('segments').delete([campaign,1]);await expect(readCandidate(db,campaign)).rejects.toThrow();
 }finally{await db.delete();}
});
it('BLOCKER evidence: imported applied snapshot can coexist with retained rolled-back Inbox result',async()=>{
 const p=new FormalPersistence({suffix:'ledger-blocker-'+crypto.randomUUID()});try{
 const w=await p.start(createFormalFixture()),point=(await p.backupList())[0];const o={commandId:commandId('snapshot-restore'),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'匯出時已套用'}};
 const row=await p.receiveCommand(o,captureIntent(w,o)),t=submitFormalOrder(w,o);await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});const exported=await p.exportStoredSave('full');await p.restore(point.id);
 expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('rolled-back');const imported=await p.importSave(exported);
 expect(imported.commandReceipts.find(r=>r.commandId===o.commandId)?.disposition).toBe('applied');expect((await p.commandStatus(o.campaignId,o.commandId))?.state).toBe('rolled-back');
 // This documents the existing dual-state case. It is NOT a proposed new ledger policy.
 }finally{await p.db.delete();}
});
it('BLOCKER evidence: legacy portable export cannot carry a durable rejected identity to a new DB',async()=>{
 const a=new FormalPersistence({suffix:'ledger-export-a-'+crypto.randomUUID()}),b=new FormalPersistence({suffix:'ledger-export-b-'+crypto.randomUUID()});try{
 const raw=createFormalWorld({campaign:'ledger-export-'+crypto.randomUUID(),seed:90217});raw.cities[0].stock={food:0,wood:0,stone:0,gold:0};const w=await a.start(raw),o={commandId:commandId('original-rejection'),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'field.upgrade' as const,cityId:w.cities[0].id,slot:0}};
 const row=await a.receiveCommand(o,captureIntent(w,o)),rejected=submitFormalOrder(w,o);expect(rejected.ack?.status).toBe('rejected');await a.finishCommand(row,rejected.ack!,w.revision);const imported=await b.importSave(await a.exportStoredSave('quick'));
 expect((await a.commandStatus(o.campaignId,o.commandId))?.state).toBe('rejected');expect(await b.commandStatus(o.campaignId,o.commandId)).toBeUndefined();expect(imported.commandReceipts).toHaveLength(0);
 const later=advanceFormal(imported,3*3600000);await b.save(later.world,later.reports,imported.revision);const repeat={...o,expectedRevision:later.world.revision,issuedWorldTime:later.world.time};const accepted=await b.receiveCommand(repeat,captureIntent(later.world,repeat));expect(accepted.state).toBe('pending');expect(submitFormalOrder(later.world,repeat).ack?.status).toBe('committed');
 }finally{await a.db.delete();await b.db.delete();}
});

it('historic persisted roots use their own projection, never the current identity table',async()=>{
 const db=candidateDatabase('synthetic-ledger-r303-'+crypto.randomUUID());try{const zero=await emptyLedger(campaign),a=await prepareLedger(zero,[receipt(0)],{worldRevision:1});await publishCandidate(db,a,zero.manifest.checksum);const b=await prepareLedger(a,[{...receipt(0),disposition:'rolled-back'}],{worldRevision:2,branch:1,recovery:true});await publishCandidate(db,b,a.manifest.checksum);
 expect((await readCandidate(db,campaign)).lookup(campaign,receipt(0).commandId)?.disposition).toBe('rolled-back');expect((await readHistoricalCandidate(db,campaign,1)).lookup(campaign,receipt(0).commandId)?.disposition).toBe('applied');
 }finally{await db.delete();}
});
it('does not truncate an indivisible oversized fingerprint or normalize legacy evidence',async()=>{
 const r={...receipt(0),fingerprint:'x'.repeat(300000)},a=await prepareLedger(await emptyLedger(campaign),[r],{worldRevision:1});expect(a.manifest.segmentCount).toBe(1);expect((await verifyLedger(a.archive())).lookup(campaign,r.commandId)?.fingerprint).toBe(r.fingerprint);await expect(prepareLedger(a,[{...receipt(1),fingerprint:''}],{worldRevision:1})).rejects.toThrow('identity');
});
