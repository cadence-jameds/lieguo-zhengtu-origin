// Real Dedicated Worker -> production Persistence/Codec/LedgerStore -> native IDB.
// Profiling uses a validation-only Vite transform, never changes production rules.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.B10_BROWSER_URL??'http://127.0.0.1:5184',dir='artifacts/r305-harness',samples=Number(process.env.B10_SAMPLES??5),warm=Number(process.env.B10_WARM??20),counts=(process.env.B10_COUNTS??'0,1000,10000,30000,60000').split(',').map(Number),stats=xs=>{const s=xs.toSorted((a,b)=>a-b);return {n:s.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1]};};
await fs.mkdir(dir,{recursive:true});await fs.mkdir('artifacts/b10-r3-05',{recursive:true});
const worker=`globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();
const {FormalPersistence}=await import('/src/game/persistence.ts'),{projectionSyntheticWorld}=await import('/src/game/formal/projectionBenchmarkSupport.ts'),{submitFormalOrder}=await import('/src/game/formal/reducer.ts'),{enableAutonomy}=await import('/src/game/formal/autonomy.ts');
const phases={},rows=[];globalThis.__persistenceProfileRecord=(key,ms)=>{const s=phases[key]??={calls:0,ms:0,max:0};s.calls++;s.ms+=ms;s.max=Math.max(s.max,ms);};
function instrument(p){p.db.use({stack:'dbcore',name:'validation-only-timing',create(down){return {...down,table(name){const table=down.table(name),out={...table};for(const op of ['get','getMany','query','mutate','count','openCursor'])out[op]=async req=>{const at=performance.now();try{return await table[op](req);}finally{globalThis.__persistenceProfileRecord('IDB.'+op+':'+name,performance.now()-at);}};return out;}};}});}
async function measure(name,fn){for(const k of Object.keys(phases))delete phases[k];const at=performance.now(),value=await fn();rows.push({name,ms:performance.now()-at,phases:structuredClone(phases)});postMessage({type:'sample',row:rows.at(-1)});return value;}
self.onmessage=async e=>{const {count,samples,warm}=e.data,suffix='r305-native-'+crypto.randomUUID(),p=new FormalPersistence({suffix});instrument(p);try{
 let w=await measure('start',async()=>{const raw=await projectionSyntheticWorld(count);enableAutonomy(raw);return p.start(raw);});
 for(let i=0;i<warm;i++){
  const order={commandId:'command:measure-'+i,campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name:'儲存量測'+i}},row=await measure('T1',()=>p.receiveCommand(order)),t=submitFormalOrder(w,order);if(t.ack.status!=='committed')throw Error(t.ack.reason);w=await measure('T2',()=>p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack}));
  await measure('query',()=>p.commandStatus(order.campaignId,order.commandId));
  const rejected={...order,commandId:'command:rejected-'+i,expectedRevision:w.revision},r=await p.receiveCommand(rejected);w=await measure('rejectedT2',()=>p.finishCommand(r,{commandId:r.commandId,status:'rejected',revision:w.revision,reason:'合成永久拒絕'},w.revision));
  const pending={...order,commandId:'command:confirmation-'+i,expectedRevision:w.revision},n=await p.receiveCommand(pending);w=await measure('confirmationT2',()=>p.finishCommand(n,{commandId:n.commandId,status:'rejected',requiresConfirmation:true,revision:w.revision,reason:'請重新確認'},w.revision));
 }
 const sizes=[];for(let i=0;i<samples;i++){
  p.db.close();const reader=new FormalPersistence({suffix});instrument(reader);try{w=(await measure('reopenLoad',()=>reader.loadSave())).game;}finally{reader.db.close();}await p.db.open();
  const point=(await p.backupList())[0],order={commandId:'command:recovery-'+i,campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name:'回復量測'+i}},row=await p.receiveCommand(order),t=submitFormalOrder(w,order);if(t.ack.status!=='committed')throw Error(t.ack.reason);w=await p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack});w=await measure('Recovery',()=>p.restore(point.id));if((await p.commandStatus(w.campaignId,order.commandId)).state!=='rolled-back')throw Error('replayed identity');
  const quick=await measure('quickExport',()=>p.exportStoredSave('quick')),full=await measure('fullExport',()=>p.exportStoredSave('full'));sizes.push({quick:new TextEncoder().encode(quick).length,full:new TextEncoder().encode(full).length});
  w=await measure('quickImport',()=>p.importSave(quick));w=await measure('fullImport',()=>p.importSave(full));
 }
 var completed={type:'done',count,rows,sizes,agents:w.autonomy?.agents.length,speed:w.speed};
}catch(error){var completed={type:'failed',error:String(error),stack:error.stack};}finally{await p.db.delete();}postMessage(completed);};postMessage({type:'booted'});`;
await fs.writeFile(dir+'/persistence.worker.js',worker);
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),environment:'Native Chromium154 Linux / CPU2 / real dedicated Worker / native IndexedDB; independent browser per history size; not Android; reopenLoad reopens DB with warm module caches; inclusive profile times overlap',samples,warm,cases:[]};
for(const count of counts){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),partial=[];report.browser=await browser.version();
 try{const page=await browser.newPage();await page.exposeFunction('__r305Sample',async row=>{partial.push(row);await fs.writeFile((process.env.B10_PERF_OUT??'artifacts/b10-r3-05/native-perf.json')+'.partial',JSON.stringify({count,rows:partial},null,2));});await page.route('**/persistence-measure.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Persistence measurement</title>'}));await page.goto(base+'/persistence-measure.html',{waitUntil:'networkidle'});
 const data=await page.evaluate(({count,samples,warm})=>new Promise((ok,fail)=>{const worker=new Worker('/artifacts/r305-harness/persistence.worker.js',{type:'module'}),deadline=setTimeout(()=>{worker.terminate();fail(Error('aggregate benchmark exceeded 15 minutes; not a test timeout change'));},900000);worker.onerror=e=>{clearTimeout(deadline);worker.terminate();fail(Error(e.message));};worker.onmessage=e=>{const m=e.data;if(m.type==='sample')void window.__r305Sample(m.row);if(m.type==='booted')worker.postMessage({count,samples,warm});if(m.type==='failed'){clearTimeout(deadline);worker.terminate();fail(Error(m.error+' '+m.stack));}if(m.type==='done'){clearTimeout(deadline);worker.terminate();ok(m);}};}),{count,samples,warm});
 data.ms=Object.fromEntries([...new Set(data.rows.map(r=>r.name))].map(name=>[name,stats(data.rows.filter(r=>r.name===name).map(r=>r.ms))]));report.cases.push(data);console.log(count,JSON.stringify(data.ms));
 }catch(error){report.cases.push({count,error:String(error),completedSamples:partial});throw error;}finally{await fs.writeFile(process.env.B10_PERF_OUT??'artifacts/b10-r3-05/native-perf.json',JSON.stringify(report,null,2));await browser.close();}
}
