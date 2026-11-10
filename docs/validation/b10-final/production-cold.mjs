// Real production GameApp cold starts. A fresh browser/IDB/authority Worker is
// used per sample. Fixture generation terminates before the measured interval.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.B10_PRODUCTION_URL??'http://127.0.0.1:4219/lieguo-zhengtu-origin/';
const counts=(process.env.B10_COUNTS??'0,60000,150000').split(',').map(Number),samples=Number(process.env.B10_SAMPLES??5);
const stats=xs=>{const a=xs.toSorted((a,b)=>a-b);return{n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1]};};
const report={method:'Fresh headless Chromium per sample; actual production GameApp, bundled Runtime, native IndexedDB, synthetic legal history. No Vite dev server, source substitution or forced GC. Desktop Linux/2 CPU/8GiB, not Android.',samples,cases:[]};
for(const count of counts){const rows=[];
 for(let i=0;i<samples;i++){
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),page=await browser.newPage();report.browser=browser.version();
  try{
   await page.goto(base+'__validation/lab.html');
   const seeded=await page.evaluate(count=>new Promise((resolve,reject)=>{
    const worker=new Worker('__validation/seed.js'.replace('__validation/',''),{type:'module'});
    worker.onerror=e=>{worker.terminate();reject(Error(e.message));};
    worker.onmessage=e=>{if(e.data.booted)worker.postMessage({action:'seed',count});else{worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);}};
   }),count);
   assert.equal(seeded.history,count);
   await page.addInitScript(()=>{
    window.tasks=[];window.wires=[];window.workers=[];window.heartbeats=[];window.mainIDBOps=[];
    new PerformanceObserver(l=>window.tasks.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
    let last=performance.now();setInterval(()=>{const now=performance.now();window.heartbeats.push({at:now,gap:now-last});last=now;},50);
    for(const method of ['get','getAll','count','openCursor','put','add','delete']){const native=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(...args){const row={table:this.name,method,at:performance.now()},request=native.apply(this,args);window.mainIDBOps.push(row);request.addEventListener('success',()=>row.ms=performance.now()-row.at,{once:true});return request;};}
    const Native=Worker;window.Worker=class extends Native{constructor(url,options){super(url,options);window.workers.push(String(url));this.addEventListener('message',e=>{const m=e.data;if(m.type==='phase'||m.type==='progress'||m.type==='loaded'||m.type==='error')window.wires.push({at:performance.now(),type:m.type,text:m.text,progress:m.progress});if(m.projection){window.snapshotBytes=new TextEncoder().encode(JSON.stringify(m.projection)).length;window.historyOnWire=JSON.stringify(m.projection).includes('commandReceipts');}});}};
   });
   let cdp;if(process.env.B10_CPU_PROFILE==='1'){cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
   const start=performance.now();await page.goto(base,{waitUntil:'networkidle'});
   const button=page.getByRole('button',{name:'載入進度',exact:true});await button.waitFor();
   const clicked=performance.now();await button.click();await page.locator('.formal-city-panel').waitFor({timeout:60000});
   const data=await page.evaluate(()=>({longTasks:window.tasks,wires:window.wires,workers:window.workers,mainIDBOps:window.mainIDBOps,heartbeatMaxMs:Math.max(...window.heartbeats.map(x=>x.gap)),mainHeap:performance.memory?.usedJSHeapSize,snapshotBytes:window.snapshotBytes,historyOnWire:window.historyOnWire,controlled:!!navigator.serviceWorker.controller}));
   if(cdp){const {profile}=await cdp.send('Profiler.stop'),nodes=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map();for(let n=0;n<profile.samples.length;n++){const f=nodes.get(profile.samples[n]).callFrame,key=f.functionName+' @ '+f.url;totals.set(key,(totals.get(key)??0)+profile.timeDeltas[n]/1000);}data.mainCPU={durationMs:(profile.endTime-profile.startTime)/1000,topLeafSampleMs:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,25),caveat:'Separate sampled CPU diagnosis, adds instrumentation overhead; not the cold percentile dataset.'};}
   assert.equal(data.historyOnWire,false);assert.ok(data.snapshotBytes<700000);
   rows.push({status:'PASS',sample:i,navigationToCityMs:performance.now()-start,clickToCityMs:performance.now()-clicked,seeded,...data});
   console.log('Production cold',count,i,Math.round(rows.at(-1).navigationToCityMs),Math.max(0,...data.longTasks.map(t=>t.ms)));
  }catch(error){rows.push({status:'FAIL',sample:i,error:String(error)});throw error;}
  finally{
   await browser.close();report.cases=report.cases.filter(x=>x.count!==count);report.cases.push({count,rows,ms:rows.every(x=>x.status==='PASS')?{navigation:stats(rows.map(x=>x.navigationToCityMs)),click:stats(rows.map(x=>x.clickToCityMs))}:null});
   await fs.writeFile(process.env.B10_PRODUCTION_COLD_OUT??'artifacts/b10-final/production-cold.json',JSON.stringify(report,null,2));
  }
 }
}
