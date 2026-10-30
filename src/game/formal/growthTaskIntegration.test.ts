import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {GROWTH_TASKS,GROWTH_TASK_BY_ID} from './growthTaskCatalog';
import {GROWTH_REWARDS_V1} from './growthTaskRewardsV1';
import {quoteGrowthReward} from './growthTasks';
import {decodeSave,encodeSave,type FormalEnvelope} from './saveCodec';
import {submitFormalOrder,advanceFormal} from './reducer';
import {validateFormalWorld} from './schema';
import {order} from './developmentTestSupport';
import {storageCapacity} from './catalogB3';
import {resourceKeys,type FormalOrder,type FormalWorld} from './model';
import {FormalPersistence} from '../persistence';
const targets={
 N:[500,500,500,500,600,1000,600,800,800,800,1000,1250,1400,2400],
 F:[1200,1200,1200,1200,3000,3000,3000,3000,1500,1500,1500,1500,1500,1500,1050,1200,1050,1050,1200,1350,1200,2400,1500,2400,1050,3000,2250,5000,22500],
 C:[2000,2500,1800,1500,1500,1500,1500,6000,18000,6250,21000,4000,3000,15000,3750,17500,3750,50000,45000,5000],
 I:[80000,32000,32000,32000,32000,18000,22500,25500,30000,39000,18000,24000,30000,37500,39000,24000,30000],
};
const bytes=readFileSync('docs/validation/journey-goals-integration/legacy-v1.json');
const legacy=JSON.parse(bytes.toString()) as {sourceCommit:string;cases:{name:string;command:FormalOrder;save:FormalEnvelope}[]};
const stores:FormalPersistence[]=[];afterEach(async()=>{for(const db of stores.splice(0))await db.db.delete();});
const store=()=>{const db=new FormalPersistence({suffix:'growth-v2-'+crypto.randomUUID()});stores.push(db);return db;};
async function unclaimed(){const w=structuredClone((await decodeSave(legacy.cases[0].save)).world);const c=w.cities[0];
 // Two lawful field completions give fresh unclaimed IDs N02/N03; v1 N01 remains intact.
 c.stock={food:800,wood:800,stone:800,gold:800};let next=w;
 for(const slot of [6,11]){next=submitFormalOrder(next,order(next,{type:'field.upgrade',cityId:c.id,slot})).world;const job=next.cities[0].economy!.construction.at(-1)!;next=advanceFormal(next,job.startsAt+job.durationMs).world;}
 next.cities[0].stock={food:0,wood:0,stone:0,gold:0};return next;
}
function claim(w:FormalWorld,id='N02'){return order(w,{type:'tasks.claim',cityId:w.cities[0].id,taskId:id,rewardVersion:2,expectedResources:{...GROWTH_TASK_BY_ID.get(id)!.reward}});}
it('pins genuine original-engine saves and validates every old reward against the immutable v1 table',()=>{
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('2b97930e0cf91ef22d9c8a685968d9532e69bbf27ee3982b655889a7de01df67');expect(legacy.sourceCommit).toMatch(/^9ac3ccc/);
 expect(legacy.cases.map(c=>c.name)).toEqual(['full','partial','zero']);expect(Object.values(GROWTH_REWARDS_V1).reduce((sum,r)=>sum+Object.values(r).reduce((a,b)=>a+b),0)).toBe(2313000);
});
it('matches all 80 specified totals and the deterministic largest-remainder allocation in units of five',()=>{
 expect(GROWTH_TASKS).toHaveLength(80);const sums:number[]=[];
 for(const [era,list]of Object.entries(targets)){
  let total=0;for(const [i,target]of list.entries()){
   const id=era+String(i+1).padStart(2,'0'),t=GROWTH_TASK_BY_ID.get(id)!;expect(t,id).toBeDefined();expect(Object.values(t.reward).reduce((a,b)=>a+b)).toBe(target);expect(Object.values(t.reward).every(v=>v%5===0)).toBe(true);
   const old=GROWTH_REWARDS_V1[id],denom=Object.values(old).reduce((a,b)=>a+b),units=target/5,quotients=resourceKeys.map(r=>Math.floor(units*old[r]/denom)),ranking=resourceKeys.map((r,index)=>({index,remainder:units*old[r]%denom})).sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
   for(const {index}of ranking.slice(0,units-quotients.reduce((a,b)=>a+b)))quotients[index]++;
   expect(resourceKeys.map(r=>t.reward[r])).toEqual(quotients.map(v=>v*5));total+=target;
  }sums.push(total);
 }expect(sums).toEqual([12650,74000,210550,545500]);expect(sums.reduce((a,b)=>a+b)).toBe(842700);
});
it('matches the new master spec and preserves every chapter outside the authorized task changes',()=>{
 const old=readFileSync('docs/b6-v95/河谷戰役_vNext_平衡重構討論_v95.md','utf8'),next=readFileSync('docs/b6-v96/河谷戰役_vNext_平衡重構討論_v96.md','utf8');
 const rows=[...next.matchAll(/^\| ([NFCI]\d{2}) \| (.*?) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \|/gm)];expect(rows).toHaveLength(80);
 for(const r of rows){const t=GROWTH_TASK_BY_ID.get(r[1])!;expect(t.title).toBe(r[2]);expect(resourceKeys.map(k=>t.reward[k])).toEqual(r.slice(3,7).map(x=>Number(x.replaceAll(',',''))));}
 const cut=(s:string)=>s.slice(s.indexOf('\n# 1.'),s.indexOf('\n# 16.'));expect(cut(next)).toBe(cut(old));
 const tail=(s:string)=>s.slice(s.indexOf('\n# 17.')).replace(/^4\. \*\*任務系統凍結：\*\*.*$/m,'<authorized task exception>');expect(tail(next)).toBe(tail(old));
});
for(const witness of legacy.cases)it(`loads, re-exports and deduplicates genuine v1 ${witness.name} overflow receipts without rewriting them`,async()=>{
 const w=(await decodeSave(witness.save)).world;expect(w).toEqual(witness.save.snapshot);expect(w.growthTasks!.claimed.N01.rewardVersion).toBeUndefined();expect((await encodeSave(w)).checksum).toBe(witness.save.checksum);
 expect(submitFormalOrder(w,witness.command).ack?.status).toBe('duplicate');const before=structuredClone(w);expect(submitFormalOrder(w,claim(w,'N01')).ack?.status).toBe('rejected');expect(w).toEqual(before);
 const bad=structuredClone(w);bad.growthTasks!.claimed.N01.rewardVersion=2;expect(()=>validateFormalWorld(bad)).toThrow();
 const corrupt=structuredClone(w);corrupt.growthTasks!.claimed.N01.accepted.wood++;expect(()=>validateFormalWorld(corrupt)).toThrow();
});
it('rechecks each resource and reservations atomically, without consuming eligibility or mutating stock',async()=>{
 for(const r of resourceKeys){const w=await unclaimed(),c=w.cities[0],cap=storageCapacity(c),reward=GROWTH_TASK_BY_ID.get('N02')!.reward;
  c.stock[r]=cap-reward[r]+1;const before=structuredClone(w),result=submitFormalOrder(w,claim(w));expect(result.ack?.status).toBe('rejected');expect(result.world).toBe(w);expect(w).toEqual(before);expect(w.growthTasks!.claimed.N02).toBeUndefined();
  c.stock[r]=cap-reward[r];expect(submitFormalOrder(w,claim(w)).ack?.status).toBe('committed');
  c.economy!.reservedIncoming[r]=1;const q=quoteGrowthReward(w,c,GROWTH_TASK_BY_ID.get('N02')!);expect(q.shortfall[r]).toBe(1);expect(q.canClaim).toBe(false);expect(submitFormalOrder(w,claim(w)).ack?.status).toBe('rejected');
 }
});
it('uses a stable full reward vector through ongoing production and rejects obsolete commands without receipts',async()=>{
 let w=await unclaimed();const command=claim(w),expected=structuredClone(command.payload);w=advanceFormal(w,w.time+60000).world;
 const result=submitFormalOrder(w,{...command,expectedRevision:w.revision});expect(result.ack?.status,result.ack?.reason).toBe('committed');expect(command.payload).toEqual(expected);expect(result.world.growthTasks!.claimed.N02.accepted).toEqual(GROWTH_TASK_BY_ID.get('N02')!.reward);
 const obsolete=claim(w);delete (obsolete.payload as {rewardVersion?:2}).rewardVersion;expect(submitFormalOrder(w,obsolete).ack?.status).toBe('rejected');
});
it('serial claims cannot collectively exceed capacity, and stale parallel commands cannot double award',async()=>{
 let w=await unclaimed(),c=w.cities[0],cap=storageCapacity(c);c.stock.wood=cap-GROWTH_TASK_BY_ID.get('N02')!.reward.wood;const first=claim(w),parallel=claim(w,'N03'),a=submitFormalOrder(w,first);expect(a.ack?.status).toBe('committed');w=a.world;
 expect(submitFormalOrder(w,first).ack?.status).toBe('duplicate');expect(submitFormalOrder(w,parallel).ack?.status).toBe('rejected');expect(submitFormalOrder(w,claim(w,'N03')).ack?.status).toBe('rejected');expect(w.growthTasks!.claimed.N03).toBeUndefined();expect(w.cities[0].stock.wood).toBe(cap);
});
it('mixed v1/v2 history survives durable save, old-save import and Recovery without issuing either reward twice',async()=>{
 const db=store();let w=await db.start(await unclaimed());const backup=(await db.backupList())[0].id,old=structuredClone(w.growthTasks!.claimed.N01),o=claim(w),t=submitFormalOrder(w,o);expect(t.ack?.status).toBe('committed');w=await db.save(t.world,[],w.revision);expect((await db.loadSave()).game!.growthTasks!.claimed.N01).toEqual(old);
 const restored=await db.restore(backup);expect(restored.growthTasks!.claimed.N01).toEqual(old);expect(restored.growthTasks!.claimed.N02.rewardVersion).toBe(2);expect(submitFormalOrder(restored,o).ack?.status).toBe('rolled-back');expect(submitFormalOrder(restored,claim(restored)).ack?.status).toBe('rejected');
 const imported=await db.importSave(JSON.stringify(legacy.cases[0].save));expect(imported.growthTasks!.claimed.N01).toEqual(old);expect(imported.growthTasks!.claimed.N02.rewardVersion).toBe(2);expect(()=>validateFormalWorld(imported)).not.toThrow();
});

it('rejects malformed reward versions, forged version bindings and v2 partial-loss ledgers',async()=>{
 const legacyWorld=(await decodeSave(legacy.cases[1].save)).world,unknown=structuredClone(legacyWorld);(unknown.growthTasks!.claimed.N01 as unknown as {rewardVersion:number}).rewardVersion=3;expect(()=>validateFormalWorld(unknown)).toThrow();
 const bound=structuredClone(legacyWorld),receipt=bound.commandReceipts.find(r=>r.commandId===bound.growthTasks!.claimed.N01.commandId)!;const payload=JSON.parse(receipt.fingerprint);payload.payload.rewardVersion=2;receipt.fingerprint=JSON.stringify(payload);expect(()=>validateFormalWorld(bound)).toThrow();
 const w=await unclaimed(),next=submitFormalOrder(w,claim(w)).world,partial=structuredClone(next);partial.growthTasks!.claimed.N02.lost.food=1;expect(()=>validateFormalWorld(partial)).toThrow();
});
