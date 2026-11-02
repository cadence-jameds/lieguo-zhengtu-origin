// Node microbenchmark. Authoritative T2/portable/native measurements are separate.
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false}}),stats=xs=>{const s=[...xs].sort((a,b)=>a-b);return {n:s.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1]};};
try{
 const {FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts'),{createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts'),{canonicalJSON}=await server.ssrLoadModule('/src/game/formal/canonical.ts'),{submitFormalOrder}=await server.ssrLoadModule('/src/game/formal/reducer.ts'),{worldLedger,projectWorld,pendingHistory,prepareVerifiedLedger}=await server.ssrLoadModule('/src/game/formal/commandLedger.ts');
 const report={environment:'Node '+process.version+' Linux; Vite SSR; fake-indexeddb only for fixture setup; no native/device timing claim',samples:30,warmups:3,cases:[]};
 for(const count of [0,1000,10000,30000,60000]){
  const p=new FormalPersistence({suffix:'node-perf-'+crypto.randomUUID()});try{
   const raw=createFormalWorld({campaign:'node-perf-'+count,seed:90217,speed:25});raw.revision=2;raw.commandReceipts=Array.from({length:count},(_,i)=>{const issuer=raw.factions[i%100].id,city=raw.cities.find(c=>c.ownerFactionId===issuer);return {commandId:'command:seed-'+String(i).padStart(6,'0'),issuerId:issuer,fingerprint:canonicalJSON({campaignId:raw.campaignId,issuerId:issuer,payload:{type:'city.rename',cityId:city.id,name:'合成'+i}}),committedRevision:1,disposition:'rolled-back'};});const w=await p.start(raw),base=worldLedger(w),legacy=projectWorld(w),lookup=[],append=[],bound=[],materialized=[];
   for(let i=-3;i<30;i++){
    const order={commandId:'command:bench-'+i.toString().replace('-','n'),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name:'量測'}},at=performance.now();for(let j=0;j<100;j++)base.receipt('command:seed-'+String(Math.max(0,count-1)).padStart(6,'0'));const lookupMs=(performance.now()-at)/100;
    let start=performance.now();const result=submitFormalOrder(w,order),boundMs=performance.now()-start;if(result.ack.status!=='committed')throw Error(result.ack.reason);start=performance.now();const old=submitFormalOrder(legacy,order),legacyMs=performance.now()-start;if(old.ack.status!=='committed')throw Error('legacy parity');
    start=performance.now();await prepareVerifiedLedger(base,pendingHistory(result.world),[{commandId:order.commandId,issuerId:order.issuerId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:order.issuerId,payload:order.payload}),state:'committed',ack:result.ack,order}],result.world.revision,base.manifest.branch,base.manifest.writerEpoch);const appendMs=performance.now()-start;
    if(i>=0){lookup.push(lookupMs);bound.push(boundMs);materialized.push(legacyMs);append.push(appendMs);}
   }
   report.cases.push({count,factions:w.factions.length,speed:w.speed,ms:{identityLookup:stats(lookup),purePrepareAppend:stats(append),boundReducer:stats(bound),materializedReducer:stats(materialized)},hotWorldBytes:Buffer.byteLength(JSON.stringify(w)),heap:process.memoryUsage(),heapCaveat:'process snapshot includes baseline materialized world, harness and temporary preparations; not isolated retained world'});console.log('Node microbenchmark',count);
  }finally{await p.db.delete();}
 }
 await fs.mkdir('artifacts/b10-r3-03/formal',{recursive:true});await fs.writeFile('artifacts/b10-r3-03/formal/node-formal.json',JSON.stringify(report,null,2));
}finally{await server.close();}
