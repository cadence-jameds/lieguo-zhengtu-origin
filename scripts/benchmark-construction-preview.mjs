// Node microbenchmark, never a desktop/Android latency acceptance claim.
import {createServer} from 'vite';
import fs from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true}});
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
const summary=xs=>({n:xs.length,p50:percentile(xs,.5),p95:percentile(xs,.95)});
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts'),{submitFormalOrder}=await server.ssrLoadModule('/src/game/formal/reducer.ts'),{constructionPreviewContext}=await server.ssrLoadModule('/src/game/constructionPreviewContext.ts'),{calculateConstructionPreview}=await server.ssrLoadModule('/src/game/constructionPreviewCompute.ts'),{validateFormalWorld}=await server.ssrLoadModule('/src/game/formal/schema.ts');
 const report={environment:`Node ${process.version}; same-process synthetic 100-faction world; 30 measured samples after 3 warmups`,baseline:'R3-01 preview path: full submitFormalOrder on a private draft; original R1-C numbers use a different version/environment and are not ratio-comparable',cases:[]};
 for(const history of [0,10000,30000,60000]){
  const w=createFormalWorld({campaign:`r302-node-${history}`,seed:90217});w.revision=1;w.commandReceipts=Array.from({length:history},(_,i)=>({commandId:`command:synthetic-${i}`,issuerId:w.playerFactionId,fingerprint:`synthetic-${i}`,committedRevision:1,disposition:'rolled-back'}));validateFormalWorld(w);
  const old=[],context=[],compute=[],bytes=[];
  for(let i=-3;i<30;i++){
   let at=performance.now();const t=submitFormalOrder(w,{commandId:'command:preview',campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'field.upgrade',cityId:w.cities[0].id,slot:0}});const oldMs=performance.now()-at;if(t.ack.status!=='committed')throw Error('illegal benchmark fixture');
   at=performance.now();const c=constructionPreviewContext(w,w.cities[0].id),contextMs=performance.now()-at;
   at=performance.now();const q=calculateConstructionPreview(c,{field:0}),computeMs=performance.now()-at;if(q.status!=='ready')throw Error(q.reason);
   if(i>=0){old.push(oldMs);context.push(contextMs);compute.push(computeMs);bytes.push(Buffer.byteLength(JSON.stringify(c)));}
  }
  report.cases.push({history,oldFullReducerMs:summary(old),contextPreparationMs:summary(context),sharedRulesComputeMs:summary(compute),contextBytes:bytes[0]});
 }
 await fs.mkdir('artifacts/b10-r3-02',{recursive:true});await fs.writeFile('artifacts/b10-r3-02/node-perf.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await server.close();}
