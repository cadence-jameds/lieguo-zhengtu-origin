import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import * as candidate from '../../../scripts/command-ledger-candidate.mjs';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {LedgerReadSession,ledgerTables,readLedgerArchive,scanLedgerIdentity,writeLedger,resultFromReceipt} from '../ledgerStore';
import {commandId} from './ids';
import {canonicalJSON} from './canonical';
import {digest} from './canonical';
import {canonicalBytes} from './canonicalBytes';
import {jsonDataEqual,exactDataEqual} from './jsonDataEqual';
import {projectionSyntheticWorld} from './projectionBenchmarkSupport';
import {submitFormalOrder} from './reducer';
import {originalResult,verifyLedgerArchive,worldLedger,prepareVerifiedLedger} from './commandLedger';
const stores:FormalPersistence[]=[];
function store(fault?:(point:FailurePoint)=>void){const p=new FormalPersistence({suffix:'r305-test-'+crypto.randomUUID(),fault});stores.push(p);return p;}
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(stores.splice(0).map(p=>p.db.delete()));});
const rows=async(p:FormalPersistence)=>Object.fromEntries(await Promise.all(p.db.tables.map(async t=>[t.name,await t.toArray()])));
it('bounded canonical byte encoding preserves every checksum including Unicode, holes and chunk boundaries',async()=>{
 const corpus:unknown[]=[undefined,null,'中😀',new Array(3),[undefined,null,NaN],{b:1,a:undefined,c:[undefined,1]},...Array.from({length:40},(_,i)=>({records:Array.from({length:i*3},(_,j)=>({fingerprint:'中😀\\"'+j,optional:j%2?undefined:j,receipt:{commandId:'command:'+j,disposition:'rolled-back'}}))})),{large:'中😀'.repeat(40000),nested:[{a:'x'.repeat(65535)},null]}];
 for(const value of corpus){const before=new TextEncoder().encode(canonicalJSON(value));expect(canonicalBytes(value)).toEqual(before);const sum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',before)),v=>v.toString(16).padStart(2,'0')).join('');expect(await digest(value)).toBe(sum);}
});
it('direct comparison is equivalent to canonical data across optional keys, ordering, nested payloads and sparse arrays',()=>{
 const corpus:unknown[]=[null,undefined,true,false,0,-0,1,NaN,Infinity,'','0','quoted"\\中',{},[],{x:undefined},[undefined],new Array(1),[undefined,undefined],[null],{a:1,b:{x:[1,'中',null]}},{b:{x:[1,'中',null]},a:1},...[...Array(80)].map((_,i)=>({commandId:'command:'+i,issuerId:'faction:'+i%3,fingerprint:'same',ack:{commandId:'command:'+i,status:'rejected',revision:i,...(i%2?{reason:'重新確認'}:{reason:undefined})},order:{payload:{type:'army.dispatch',units:{infantry:i},target:{x:i,y:5}}}}))];
 for(const a of corpus)for(const b of corpus)expect(jsonDataEqual(a,b)).toBe(canonicalJSON(a)===canonicalJSON(b));
});
it('keyset scans visit all identities once across 512 boundaries, including the empty corrupt key',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1100)),seen:string[]=[],batches:number[]=[];
 const one=await p.db.table('LedgerIdentity').toCollection().first();await p.db.table('LedgerIdentity').put({...one,commandId:''});
 await p.db.transaction('r',p.db.table('LedgerIdentity'),()=>scanLedgerIdentity(p.db,w.campaignId,rs=>{batches.push(rs.length);seen.push(...rs.map(r=>r.commandId));}));
 expect(seen).toHaveLength(1101);expect(new Set(seen).size).toBe(1101);expect(seen[0]).toBe('');expect(Math.max(...batches)).toBe(512);
 const restored=await p.loadSave();expect(restored.recovered).toBe(true);expect(worldLedger(restored.game!).count).toBe(1100);expect(await p.db.table('LedgerIdentity').get([w.campaignId,''])).toBeUndefined();
});
it('shared archive reads reuse identical rows only inside their original native transaction',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1000)),root=w.ledger!.anchor.root;let session:LedgerReadSession;
 const archive=await p.db.transaction('r',ledgerTables(p.db),async()=>{session=new LedgerReadSession(p.db);const a=await readLedgerArchive(p.db,w.campaignId,root,session),b=await readLedgerArchive(p.db,w.campaignId,root,session);expect(a.history.segments[0]).toBe(b.history.segments[0]);expect(a.results[0]).toBe(b.results[0]);return a;});
 expect((await verifyLedgerArchive(archive)).count).toBe(1000);
 await expect(readLedgerArchive(p.db,w.campaignId,root,session!)).rejects.toThrow('跨交易');
});
it('proof reuse compares all bytes and unknown fields, not only the current revision or checksum label',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1000)),proof=worldLedger(w),archive=proof.archive();expect(await verifyLedgerArchive(archive)).toBe(proof);
 expect(exactDataEqual({unknown:undefined},{})).toBe(false);
 for(const mutate of [(a:any)=>a.history.segments[0].events[0].receipt.fingerprint='changed',(a:any)=>a.results[0].records[0].ack.reason='changed',(a:any)=>a.history.segments[0].unknown=undefined,(a:any)=>a.manifest.writerEpoch++]){const changed=proof.archive();mutate(changed);await expect(verifyLedgerArchive(changed)).rejects.toThrow();}
});
it('a warm proof cannot hide persisted immutable corruption on the next cold read',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1000));expect((await p.loadSave()).game!.ledger!.anchor.root).toBe(w.ledger!.anchor.root);
 const table=p.db.table('LedgerSegments'),s=await table.toCollection().first();s.events[0].receipt.fingerprint='corrupt';await table.put(s);const before=await rows(p);
 await expect(p.loadSave()).rejects.toThrow('帳本損毀');expect(await rows(p)).toEqual(before);
});
it.each(['ledger-segment-write','ledger-result-write','ledger-index-write','ledger-manifest-write','ledger-head-write','world-write','authority-write','backup-write','metadata-write','result-write'] as FailurePoint[])('optimized T2 remains atomic at %s and one durable retry has one effect',async point=>{
 let armed=false;const p=store(at=>{if(armed&&at===point)throw new DOMException('injected '+point,'QuotaExceededError');}),w=await p.start(await projectionSyntheticWorld(1000));
 const order={campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('r305-atomic'),expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'唯一效果'}},row=await p.receiveCommand(order),t=submitFormalOrder(w,order),before=await rows(p);expect(t.ack!.status).toBe('committed');
 armed=true;await expect(p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!})).rejects.toThrow('injected');expect(await rows(p)).toEqual(before);armed=false;
 const saved=await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});expect(worldLedger(saved).count).toBe(1001);expect((await p.commandStatus(order.campaignId,order.commandId))!.state).toBe('committed');expect(submitFormalOrder(saved,order).ack!.status).toBe('duplicate');
});
it('Recovery repairs missing/corrupt/extra index rows in the same rollback boundary and preserves Original Result',async()=>{
 let fail=false;const p=store(at=>{if(fail&&at==='ledger-index-write')throw Error('repair fault');}),w=await p.start(await projectionSyntheticWorld(1100)),point=(await p.backupList())[0],order={campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('r305-recovery'),expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'回復前'}},row=await p.receiveCommand(order),t=submitFormalOrder(w,order),saved=await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!}),original=originalResult(saved,order.commandId);
 const table=p.db.table('LedgerIdentity'),all=await table.toArray();await table.delete([w.campaignId,all[0].commandId]);await table.put({...all[1],fingerprint:'corrupt'});await table.put({...all[2],commandId:'command:extra'});const before=await rows(p);
 fail=true;await expect(p.restore(point.id)).rejects.toThrow('repair fault');expect(await rows(p)).toEqual(before);fail=false;
 const recovered=await p.restore(point.id);expect(originalResult(recovered,order.commandId)).toEqual(original);expect((await p.commandStatus(w.campaignId,order.commandId))!.state).toBe('rolled-back');expect(submitFormalOrder(recovered,order).ack!.status).toBe('rolled-back');expect(await table.count()).toBe(1101);expect((await p.loadSave()).recovered).toBe(false);
});
it('same-revision rejected and confirmation roots survive Quick/Full exports and imports without gaining effects',async()=>{
 const p=store(),q=store();let w=await p.start(await projectionSyntheticWorld(1000));const ids=[];
 for(const confirmation of [false,true]){const order={campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('r305-no-effect-'+confirmation),expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'不執行'}},row=await p.receiveCommand(order),root=w.ledger!.anchor.root,revision=w.revision;w=await p.finishCommand(row,{commandId:order.commandId,status:'rejected',revision,...(confirmation?{requiresConfirmation:true as const}:{}),reason:'原始拒絕'},revision);expect(w.revision).toBe(revision);expect(w.ledger!.anchor.root).not.toBe(root);ids.push(order);}
 for(const mode of ['quick','full'] as const){const text=await p.exportStoredSave(mode),loaded=await q.importSave(text);for(const order of ids){expect(originalResult(loaded,order.commandId)).toEqual(originalResult(w,order.commandId));expect(submitFormalOrder(loaded,order).ack!.status).toBe('rejected');}expect(worldLedger(loaded).count).toBe(1000);expect((await q.loadSave()).game!.cities[0].name).toBe(w.cities[0].name);}
});
it('load progress is bounded, monotonic and reaches completion only after verified data is readable',async()=>{
 const p=store();await p.start(await projectionSyntheticWorld(1100));const progress:number[]=[];
 const loaded=await p.loadWithOffline(Date.now(),(stage,fraction)=>{if(stage==='read'&&fraction!==undefined)progress.push(fraction);});
 expect(progress[0]).toBe(0);expect(progress.at(-1)).toBe(1);expect(progress.length).toBeLessThanOrEqual(21);expect(progress).toEqual(progress.toSorted((a,b)=>a-b));expect(worldLedger(loaded.game!).count).toBe(1100);
});
it('a lost read progress notification cannot trigger Recovery or change a branch',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1000));
 const loaded=await p.loadWithOffline(Date.now(),(stage,fraction)=>{if(stage==='read'&&fraction!==undefined)throw Error('lost display');});
 expect(loaded.recovered).toBe(false);expect(loaded.game!.ledger!.anchor.branch).toBe(w.ledger!.anchor.branch);expect(worldLedger(loaded.game!).count).toBe(1000);
});
it('same-revision root CAS rejects a stale prepared world after a no-effect result',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1000)),order={campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('r305-stale-preparation'),expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'舊準備不可提交'}},row=await p.receiveCommand(order),t=submitFormalOrder(w,order),other={...order,commandId:commandId('r305-other-result')},otherRow=await p.receiveCommand(other),next=await p.finishCommand(otherRow,{commandId:other.commandId,status:'rejected',revision:w.revision,reason:'沒有世界效果'},w.revision);
 expect(next.revision).toBe(w.revision);expect(next.ledger!.anchor.root).not.toBe(w.ledger!.anchor.root);const before=await rows(p);
 await expect(p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!})).rejects.toThrow('revision');expect(await rows(p)).toEqual(before);expect((await p.commandStatus(w.campaignId,order.commandId))!.state).toBe('pending');
});
it('a minority batch of 500 exact identities does not scan an unrelated long history',async()=>{
 const p=store(),gets:number[]=[];let queries=0;p.db.use({stack:'dbcore',name:'r305-count-identity-reads',create(down){return {...down,table(name){const t=down.table(name);if(name!=='LedgerIdentity')return t;return {...t,getMany(req){gets.push(req.keys.length);return t.getMany(req);},query(req){queries++;return t.query(req);}};}};}});
 const w=await p.start(await projectionSyntheticWorld(3000)),base=worldLedger(w),receipts=Array.from({length:500},(_,i)=>({commandId:commandId('r305-minority-'+i),issuerId:w.playerFactionId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'city.rename',cityId:w.cities[0].id,name:'合成'+i}}),committedRevision:w.revision+1,disposition:'applied' as const})),prepared=await prepareVerifiedLedger(base,receipts,receipts.map(resultFromReceipt),w.revision+1,base.manifest.branch,base.manifest.writerEpoch),before=await rows(p);gets.length=0;queries=0;
 await expect(p.db.transaction('rw',ledgerTables(p.db),async()=>{await writeLedger(p.db,prepared,base,receipts.map(r=>r.commandId));expect(queries).toBe(0);expect(gets).toEqual([256,244]);throw Error('discard unpublished test candidate');})).rejects.toThrow('discard unpublished');
 expect(await rows(p)).toEqual(before);
});
it('real one-command segments bulk-read the exact chain without thousands of serial IDB gets',async()=>{
 const p=store();let gets=0,queries=0;p.db.use({stack:'dbcore',name:'r305-sparse-reads',create(down){return {...down,table(name){const t=down.table(name);if(!['LedgerSegments','LedgerResults'].includes(name))return t;return {...t,get(req){gets++;return t.get(req);},query(req){queries++;return t.query(req);}};}};}});
 let w=await p.start(await projectionSyntheticWorld(0));for(let i=0;i<32;i++){const order={campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('r305-real-segment-'+i),issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'連續'+i}},row=await p.receiveCommand(order),t=submitFormalOrder(w,order);w=await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!});}
 gets=0;queries=0;const archive=await readLedgerArchive(p.db,w.campaignId,w.ledger!.anchor.root);expect(archive.history.segments).toHaveLength(32);expect(archive.results).toHaveLength(32);expect(gets).toBe(0);expect(queries).toBe(2);expect((await verifyLedgerArchive(archive)).count).toBe(32);
});
it('a distinct formal root reuses identical history evidence while independently validating outcomes',async()=>{
 const p=store(),w=await p.start(await projectionSyntheticWorld(1000)),order={campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('r305-history-proof-reuse'),issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename' as const,cityId:w.cities[0].id,name:'不執行'}},row=await p.receiveCommand(order),saved=await p.finishCommand(row,{commandId:order.commandId,status:'rejected',revision:w.revision,reason:'原始拒絕'},w.revision),proof=worldLedger(saved),archive=proof.archive();archive.manifest.version++;const {checksum:_old,...body}=archive.manifest;archive.manifest.checksum=await digest(body);
 const spy=vi.spyOn(candidate,'verifyLedger'),verified=await verifyLedgerArchive(archive);expect(verified.history).toBe(proof.history);expect(spy).not.toHaveBeenCalled();expect(verified.result(order.commandId)).toEqual(proof.result(order.commandId));expect(verified.manifest.checksum).not.toBe(proof.manifest.checksum);
 const corrupt=verified.archive();corrupt.results[0].records[0].ack.reason='corrupt';await expect(verifyLedgerArchive(corrupt)).rejects.toThrow();
});
it('dense segments retain linked reads instead of a large native bulk clone',async()=>{
 const p=store();let gets=0,queries=0;p.db.use({stack:'dbcore',name:'r305-dense-reads',create(down){return {...down,table(name){const t=down.table(name);if(!['LedgerSegments','LedgerResults'].includes(name))return t;return {...t,get(req){gets++;return t.get(req);},query(req){queries++;return t.query(req);}};}};}});
 const w=await p.start(await projectionSyntheticWorld(10000));gets=0;queries=0;const archive=await readLedgerArchive(p.db,w.campaignId,w.ledger!.anchor.root);expect(queries).toBe(0);expect(gets).toBe(archive.history.segments.length+archive.results.length);expect((await verifyLedgerArchive(archive)).count).toBe(10000);
});
