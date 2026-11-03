// 150k actual Persistence, native IDB; report the existing 100MiB export limit
// as a capacity restriction, never trim identities or bypass the codec limit.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.B10_BROWSER_URL??'http://127.0.0.1:5184';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const report={browser:browser.version(),method:'150000 legal projectionSyntheticWorld identities, actual Persistence/native IDB/Worker; warm modules/proof cache. Desktop Linux/2CPU/8GiB. Export rejection preserves every identity; no cap bypass.',samples:5};
try{
 await fs.mkdir('artifacts/b10-final',{recursive:true});
 await fs.writeFile('artifacts/b10-final/large.worker.js',`globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();
const{FormalPersistence}=await import('/src/game/persistence.ts'),{projectionSyntheticWorld}=await import('/src/game/formal/projectionBenchmarkSupport.ts'),{worldLedger}=await import('/src/game/formal/commandLedger.ts'),{submitFormalOrder}=await import('/src/game/formal/reducer.ts');
self.onmessage=async()=>{const p=new FormalPersistence({suffix:'final150k-'+crypto.randomUUID()}),rows=[];const measure=async(name,fn)=>{const start=performance.now();try{const result=await fn();rows.push({name,ms:performance.now()-start,status:'PASS'});postMessage({sample:rows.at(-1)});return result;}catch(error){rows.push({name,ms:performance.now()-start,status:'REJECTED',error:String(error)});postMessage({sample:rows.at(-1)});throw error;}};
try{let w=await measure('start',async()=>p.start(await projectionSyntheticWorld(150000)));for(let i=0;i<5;i++){
 p.db.close();w=(await measure('reopenLoad',async()=>{await p.db.open();return p.loadSave();})).game;if(worldLedger(w).count!==150000+i)throw Error('missing history');
 const point=(await p.backupList())[0],o={campaignId:w.campaignId,commandId:'command:final150k-'+i,issuerId:w.playerFactionId,expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'city.rename',cityId:w.cities[0].id,name:'大型歷史'+i}},row=await measure('T1',()=>p.receiveCommand(o)),t=submitFormalOrder(w,o);if(t.ack.status!=='committed')throw Error(t.ack.reason);w=await measure('T2',()=>p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack}));
 w=await measure('Recovery',()=>p.restore(point.id));if((await p.commandStatus(w.campaignId,o.commandId)).state!=='rolled-back')throw Error('reopened identity');
 for(const mode of ['quick','full'])try{const text=await measure(mode+'Export',()=>p.exportStoredSave(mode));await measure(mode+'Import',()=>p.importSave(text));}catch(error){if(!/100\\s*MiB|100MiB|100 MB|100MB/.test(String(error)))throw error;}
 if(worldLedger((await p.loadSave()).game).count!==150001+i)throw Error('capacity rejection lost data');
}postMessage({done:true,rows,history:worldLedger(w).count,identities:await p.db.table('LedgerIdentity').count(),storage:await navigator.storage.estimate()});
}catch(error){postMessage({error:String(error),rows});}finally{await p.db.delete();}};postMessage({booted:true});`);
 const page=await browser.newPage();await page.route('**/final-large.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Large synthetic history</title>'}));await page.goto(base+'/final-large.html');
 const data=await page.evaluate(()=>new Promise((resolve,reject)=>{const w=new Worker('/artifacts/b10-final/large.worker.js',{type:'module'});w.onerror=e=>{w.terminate();reject(Error(e.message));};w.onmessage=e=>{if(e.data.booted)w.postMessage({});else if(e.data.sample)console.log('large-history',e.data.sample);else{w.terminate();e.data.error?reject(Error(JSON.stringify(e.data))):resolve(e.data);}};}));
 assert.equal(data.history,150005);assert.equal(data.identities,150005);
 const stats=xs=>{const a=xs.toSorted((a,b)=>a-b);return{n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1]};};
 report.data=data;report.ms=Object.fromEntries([...new Set(data.rows.map(r=>r.name))].map(name=>[name,stats(data.rows.filter(r=>r.name===name).map(r=>r.ms))]));report.status='PASS';console.log(JSON.stringify(report.ms));
}catch(error){report.status='FAIL';report.error=String(error);throw error;}
finally{await fs.writeFile('artifacts/b10-final/large-history.json',JSON.stringify(report,null,2));await browser.close();}
