// Same committed worlds, same process/version. The v1 implementation below is
// copied verbatim from PR56 1737d14 (apart from TypeScript syntax), never used by UI.
import fs from 'node:fs/promises';
import {createServer} from 'vite';
import {benchmarkProjection,stats} from './ui-projection-benchmark-case.mjs';
if(process.argv[1]?.endsWith('benchmark-ui-projection.mjs')){
 const server=await createServer({server:{middlewareMode:true,hmr:false}});try{
  const lab={...await server.ssrLoadModule('/src/game/formal/projectionBenchmarkSupport.ts'),...await server.ssrLoadModule('/src/game/formal/commandLedger.ts'),...await server.ssrLoadModule('/src/game/formal/reducer.ts'),...await server.ssrLoadModule('/src/game/worldStream.ts'),...await server.ssrLoadModule('/src/game/worldProjection.ts'),...await server.ssrLoadModule('/src/game/presentationStore.ts')},report={environment:'Node '+process.version+' Linux Vite SSR, RAM verified synthetic fixtures, not native/Android',samples:30,warmups:3,cases:[]};
  for(const count of [0,1000,10000,30000,60000]){const data=await benchmarkProjection(count,lab);report.cases.push({...data,ms:Object.fromEntries(Object.entries(data.samples).map(([k,v])=>[k,stats(v)])),heap:process.memoryUsage()});console.log(count,JSON.stringify(report.cases.at(-1).ms));await fs.mkdir('artifacts/b10-r3-04',{recursive:true});await fs.writeFile('artifacts/b10-r3-04/node-perf.json',JSON.stringify(report,null,2));}
 }finally{await server.close();}
}
