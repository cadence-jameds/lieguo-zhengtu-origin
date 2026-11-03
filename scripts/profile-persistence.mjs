// Same real FormalPersistence operations for baseline and optimized source.
// Node/fake-IDB diagnosis only. Native IndexedDB is measured separately.
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {PerformanceObserver} from 'node:perf_hooks';
import {persistenceProfilePlugin} from './persistence-profile-plugin.mjs';
const phases={},gc=[];
globalThis.__persistenceProfileRecord=(key,ms)=>{const s=phases[key]??={calls:0,ms:0,max:0};s.calls++;s.ms+=ms;s.max=Math.max(s.max,ms);};
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({ms:e.duration,kind:e.detail.kind});});observer.observe({entryTypes:['gc']});
const server=await createServer({plugins:[persistenceProfilePlugin()],server:{middlewareMode:true,hmr:false}}),count=Number(process.env.B10_HISTORY??60000),samples=Number(process.env.B10_SAMPLES??1),rows=[];
try{
 const {FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts'),{projectionSyntheticWorld}=await server.ssrLoadModule('/src/game/formal/projectionBenchmarkSupport.ts'),{submitFormalOrder}=await server.ssrLoadModule('/src/game/formal/reducer.ts');
 const p=new FormalPersistence({suffix:'r305-profile-'+crypto.randomUUID()});
 async function measure(name,fn){for(const k of Object.keys(phases))delete phases[k];const heap=process.memoryUsage(),g=gc.length,at=performance.now();const value=await fn();rows.push({name,ms:performance.now()-at,phases:structuredClone(phases),heapBefore:heap,heapAfter:process.memoryUsage(),gc:gc.slice(g)});console.log(name,rows.at(-1).ms.toFixed(1));return value;}
 try{let w=await measure('start',async()=>p.start(await projectionSyntheticWorld(count)));
  for(let i=0;i<samples;i++){
   w=(await measure('coldLoad',()=>new FormalPersistence({suffix:p.db.name.slice('lieguo-formal-ledger-v1-'.length)}).loadSave())).game;
   const point=(await p.backupList())[0],order={commandId:'command:profile-'+i,campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name:'正式量測'+i}},row=await measure('T1',()=>p.receiveCommand(order)),t=submitFormalOrder(w,order);if(t.ack.status!=='committed')throw Error(t.ack.reason);
   w=await measure('T2',()=>p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack}));
   w=await measure('Recovery',()=>p.restore(point.id));if((await p.commandStatus(order.campaignId,order.commandId)).state!=='rolled-back')throw Error('Recovery identity');
   const quick=await measure('quickExport',()=>p.exportStoredSave('quick')),full=await measure('fullExport',()=>p.exportStoredSave('full'));
   w=await measure('quickImport',()=>p.importSave(quick));w=await measure('fullImport',()=>p.importSave(full));
  }
 }finally{await p.db.delete();}
 await fs.mkdir('artifacts/b10-r3-05',{recursive:true});await fs.writeFile(process.env.B10_PROFILE_OUT??'artifacts/b10-r3-05/profile-node.json',JSON.stringify({environment:'Node '+process.version+' / Vite SSR / fake-indexeddb; inclusive instrumented phases, NOT native timing',count,samples,rows},null,2));
}finally{observer.disconnect();delete globalThis.__persistenceProfileRecord;await server.close();}
