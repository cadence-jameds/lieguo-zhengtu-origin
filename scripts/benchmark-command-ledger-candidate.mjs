// Inactive candidate microbench only. No Formal T2/Migration improvement claim.
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {emptyLedger,prepareLedger,verifyLedger} from './command-ledger-candidate.mjs';
const server=await createServer({server:{middlewareMode:true}}),stats=xs=>{xs.sort((a,b)=>a-b);return {n:xs.length,p50:xs[Math.ceil(xs.length*.5)-1],p95:xs[Math.ceil(xs.length*.95)-1]};};
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts'),{validateFormalWorld}=await server.ssrLoadModule('/src/game/formal/schema.ts'),{canonicalJSON}=await server.ssrLoadModule('/src/game/formal/canonical.ts');
 const report={node:process.version,status:'BLOCKED: candidate not activated',environment:'Linux container; Node microbenchmark; no browser/Android latency claim',samples:30,warmups:3,formalT2:'NOT INTEGRATED',migration:'NOT IMPLEMENTED; legacy production data never touched',cases:[]};
 for(const count of [0,1000,10000,30000,60000]){
  const w=createFormalWorld({campaign:'ledger-bench-'+count,seed:90217});w.revision=2;
  w.commandReceipts=Array.from({length:count},(_,i)=>{const issuer=w.factions[i%100].id,city=w.cities.find(c=>c.ownerFactionId===issuer);return {commandId:'command:bench-'+i,issuerId:issuer,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:issuer,payload:{type:'city.rename',cityId:city.id,name:'合成'+i}}),committedRevision:1,disposition:'rolled-back'};});validateFormalWorld(w);
  const at=performance.now(),snapshot=await prepareLedger(await emptyLedger(w.campaignId),w.commandReceipts,{worldRevision:w.revision}),constructionMs=performance.now()-at;
  const linear=[],indexed=[],append=[],verify=[],lookupId=w.commandReceipts.at(-1)?.commandId??'command:missing';const extra={commandId:'command:new',issuerId:w.playerFactionId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'city.rename',cityId:w.cities[0].id,name:'新命令'}}),committedRevision:3,disposition:'applied'};
  for(let i=-3;i<30;i++){
   let t=performance.now();const a=w.commandReceipts.find(r=>r.commandId===lookupId);const l=performance.now()-t;
   t=performance.now();const b=snapshot.lookup(w.campaignId,lookupId),q=performance.now()-t;if(a?.fingerprint!==b?.fingerprint)throw Error('Lookup mismatch');
   t=performance.now();await prepareLedger(snapshot,[extra],{worldRevision:3});const p=performance.now()-t;
   t=performance.now();await verifyLedger(snapshot.archive());const v=performance.now()-t;if(i>=0){linear.push(l);indexed.push(q);append.push(p);verify.push(v);}
  }
  report.cases.push({count,legalFormalSchema:true,constructionMs,linearIdentityLookupMs:stats(linear),candidateIndexLookupMs:stats(indexed),candidatePrepareAppendMs:stats(append),fullCandidateArchiveVerifyMs:stats(verify),candidateArchiveBytes:Buffer.byteLength(JSON.stringify(snapshot.archive())),legacyWorldBytes:Buffer.byteLength(JSON.stringify(w)),segments:snapshot.manifest.segmentCount,heapUsed:process.memoryUsage().heapUsed});
 }
 await fs.mkdir('artifacts/b10-r3-03',{recursive:true});await fs.writeFile('artifacts/b10-r3-03/candidate-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await server.close();}
