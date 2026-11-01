// Real Chromium, local Vite source, actual Dedicated Workers and native IndexedDB.
// Only synthetic worlds; ignored harness/output; no raw traces or player saves.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [pw,out='artifacts/b10-r3-02']=process.argv.slice(2);if(!pw)throw Error('Pass external Playwright module path');
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href),base=process.env.B10_BROWSER_URL??'http://127.0.0.1:5173';
await fs.mkdir('artifacts/r302-harness',{recursive:true});await fs.mkdir(out,{recursive:true});
async function writeIfChanged(file,text){if(await fs.readFile(file,'utf8').catch(()=>null)!==text)await fs.writeFile(file,text);}
await writeIfChanged('artifacts/r302-harness/index.html','<!doctype html><html><body><div id="root"></div></body></html>');
await writeIfChanged('artifacts/r302-harness/entry.tsx',`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {createFormalWorld} from '/src/game/formal/generator.ts';
import {validateFormalWorld} from '/src/game/formal/schema.ts';
import {submitFormalOrder} from '/src/game/formal/reducer.ts';
import {constructionPreviewContext} from '/src/game/constructionPreviewContext.ts';
import {ConstructionPreviewController,constructionPreviews} from '/src/game/constructionPreviewController.ts';
import {BuildingDetail} from '/src/game/presentation/BuildingDetail.tsx';
import FormalCityPanel from '/src/game/FormalCityPanel.tsx';
import {PreviewBranchContext} from '/src/game/presentation/useConstructionPreviews.tsx';
const root=createRoot(document.getElementById('root')),controllers=[];
let seq=0;const issued=[];
window.lab={issued,constructionPreviews,root,context:constructionPreviewContext,
 world(history=0){const w=createFormalWorld({campaign:'r302-browser-'+history,seed:90217,speed:25});w.revision=1;w.commandReceipts=Array.from({length:history},(_,i)=>({commandId:'command:synth-'+i,issuerId:w.playerFactionId,fingerprint:'synth-'+i,committedRevision:1,disposition:'rolled-back'}));validateFormalWorld(w);return w;},
 controller(url){const c=url?new ConstructionPreviewController(()=>new Worker(url,{type:'module'})):new ConstructionPreviewController();controllers.push(c);return c;},
 request(c,w,targets=[{field:0}],channel=1){const at=performance.now(),context=constructionPreviewContext(w,w.cities[0].id),prepared=performance.now()-at,r={protocolVersion:1,campaignId:w.campaignId,branch:'1',revision:w.revision,cityId:w.cities[0].id,requestId:++seq,generation:seq,context,targets};const bytes=new TextEncoder().encode(JSON.stringify(r)).length;let postMs=0;const promise=new Promise((resolve,reject)=>{const sendAt=performance.now();c.request(channel,r,response=>resolve({response,prepared,bytes,postMs,total:performance.now()-at}),reject);postMs=performance.now()-sendAt;});return promise;},
 old(w){const at=performance.now();const result=submitFormalOrder(w,{commandId:'command:old-preview',campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'field.upgrade',cityId:w.cities[0].id,slot:0}});if(result.ack.status!=='committed')throw Error('illegal old fixture');return performance.now()-at;},
 detail(w,key='wall',branch='1'){flushSync(()=>root.render(<PreviewBranchContext.Provider value={branch}><BuildingDetail world={w} city={w.cities[0]} buildingKey={key} issue={p=>issued.push(p)} busy={false}/></PreviewBranchContext.Provider>));},
 panel(w){flushSync(()=>root.render(<PreviewBranchContext.Provider value="1"><FormalCityPanel world={w} cityId={w.cities[0].id} issue={p=>issued.push(p)} busy={false}/></PreviewBranchContext.Provider>));},
 close(){flushSync(()=>root.render(<div>closed</div>));},
 dispose(){controllers.forEach(c=>c.dispose());constructionPreviews.dispose();}
};
`);
await writeIfChanged('artifacts/r302-harness/runtime.js',`globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();await import('/src/game/runtime.worker.ts');postMessage({type:'booted'});`);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets']});
const report={browser:browser.version(),environment:'native headless Chromium, desktop Linux container; Vite source; not Android or production deployment',cases:[],performance:[],errors:[]};
const pct=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1],stats=xs=>({n:xs.length,p50:pct(xs,.5),p95:pct(xs,.95)});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack??String(e)));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
const run=async(name,fn)=>{try{const data=await fn();report.cases.push({name,status:'PASS',...data});}catch(e){report.cases.push({name,status:'FAIL',error:String(e)});throw e;}finally{await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));}};
try{
 await page.route('**/artifacts/r302-harness/index.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}));
 for(let setup=0;setup<3;setup++){
  try{
   await page.goto(base+'/artifacts/r302-harness/index.html');
 await page.evaluate(async()=>{globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();const refresh=(await import('/@react-refresh')).default;refresh.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await new Promise(r=>setTimeout(r,500));await Promise.all([import('/src/game/persistence.ts'),import('/src/game/durableCommands.ts')]);await import('/artifacts/r302-harness/entry.tsx');});
   break;
  }catch(e){if(!String(e).includes('Execution context was destroyed')||setup===2)throw e;report.setupReloads=(report.setupReloads??0)+1;}
 }
 await run('native single/batch Worker preview and compact context at 0/10k/30k/60k history',async()=>{
  for(const history of [0,10000,30000,60000]){
   const data=await page.evaluate(async history=>{
    const w=window.lab.world(history),old=[],single=[],batch=[],prepared=[],transfer=[],cache=[],interactive=[],longTasks=[];
    const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({at:e.startTime,duration:e.duration});});observer.observe({type:'longtask',buffered:false});
    let contextBytes=0,counts={};
    for(let i=-3;i<30;i++){
     // Baseline full Reducer is measured separately so its long tasks are not attributed to the new UI.
     const oldMs=window.lab.old(w);await new Promise(r=>setTimeout(r,0));const c=window.lab.controller(),at=performance.now();const one=await window.lab.request(c,w);const end=performance.now();
     if(one.response.results[0].status!=='ready')throw Error('single unavailable');
     const many=await window.lab.request(c,w,[{field:0},{field:1},{field:2},{key:'wall'},{key:'warehouse.0'},{key:'bunker.0'}]);
     const hit=await window.lab.request(c,w);c.dispose();
     const renderAt=performance.now();window.lab.detail(w);const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('升級至'));if(!button||button.disabled)throw Error('UI blocked '+JSON.stringify({button:button?.outerHTML,body:document.body.innerHTML.slice(-2500),connected:window.lab.root._internalRoot.containerInfo.isConnected,container:window.lab.root._internalRoot.containerInfo.innerHTML.slice(0,500),history,i}));button.click();const interactiveMs=performance.now()-renderAt;window.lab.close();
     if(i>=0){old.push(oldMs);single.push(one.total);batch.push(many.total);prepared.push(one.prepared);transfer.push(one.postMs);cache.push(hit.total);interactive.push(interactiveMs);contextBytes=one.bytes;counts={single:one.response.results.length,batch:many.response.results.length};
      // New-path interval excludes old reducer and panel setup.
      await new Promise(r=>setTimeout(r,0));const entries=longTasks.filter(t=>t.at>=at&&t.at<end);if(entries.length)throw Error('new preview main-thread long task '+JSON.stringify(entries));
     }
    }
    observer.disconnect();return {old,single,batch,prepared,transfer,cache,interactive,contextBytes,counts};
   },history);
   console.log('Completed native history',history);report.performance.push({history,contextBytes:data.contextBytes,oldFullReducerMs:stats(data.old),singleColdWorkerMs:stats(data.single),batchColdQuoteWarmWorkerMs:stats(data.batch),contextMainMs:stats(data.prepared),postMessageAndKeyMainMs:stats(data.transfer),cacheHitMs:stats(data.cache),detailInteractiveMainMs:stats(data.interactive),previewLongTasksOver50ms:0,sample:'30 measured, 3 warmups; a fresh actual worker per cold sample; 6 independent targets per batch'});
  }
  return {histories:report.performance.map(p=>p.history)};
 });
 await run('compiled production Preview Worker uses the same compact protocol and shared rules',async()=>{
  const asset=(await fs.readdir('dist/assets')).find(x=>/^constructionPreview\.worker-.*\.js$/.test(x));assert.ok(asset,'Build the current preview worker first');
  report.compiledWorker={asset,bytes:(await fs.stat(path.join('dist/assets',asset))).size,measurements:[]};
  for(const history of [0,10000,30000,60000]){
   const data=await page.evaluate(async({history,url})=>{
    const w=window.lab.world(history),single=[],batch=[],main=[];let bytes=0;
    for(let i=-3;i<30;i++){
     const c=window.lab.controller(url),r=await window.lab.request(c,w);if(r.response.results[0].status!=='ready')throw Error('compiled worker unavailable');
     const quote=r.response.results[0].quote;if(quote.durationMs!==50000||quote.paidResources.food!==20)throw Error('compiled rule mismatch');
     const b=await window.lab.request(c,w,[{field:0},{field:1},{field:2},{key:'wall'},{key:'warehouse.0'},{key:'bunker.0'}]);c.dispose();
     if(i>=0){single.push(r.total);batch.push(b.total);main.push(r.prepared+r.postMs);bytes=r.bytes;}
    }return {single,batch,main,bytes};
   },{history,url:'/dist/assets/'+asset});
   report.compiledWorker.measurements.push({history,contextBytes:data.bytes,singleColdWorkerMs:stats(data.single),batchColdQuoteWarmWorkerMs:stats(data.batch),mainPreparationAndPostMs:stats(data.main)});
  }return {asset,bytes:report.compiledWorker.bytes};
 });
 await run('actual construction list batches candidates, field/wall/detail asynchronous; formal submit before preview',async()=>{
  await page.evaluate(()=>{window.uiWorld=window.lab.world(30000);window.lab.panel(window.uiWorld);});await page.getByRole('tab',{name:'城內',exact:true}).click();await page.locator('.town-lot.vacant').first().click();
  await page.locator('.construction-menu').waitFor();await page.getByText('預覽已更新；正式提交時仍會重新驗證。',{exact:true}).waitFor();
  const candidates=await page.locator('.build-choice').count();assert.ok(candidates>1);
  await page.getByRole('button',{name:'查看民居資訊',exact:true}).click();await page.locator('.shared-building-detail').waitFor();await page.evaluate(()=>window.lab.close());
  await page.evaluate(()=>{window.lab.detail(window.uiWorld);document.querySelector('button.primary').click();});assert.ok(await page.evaluate(()=>window.lab.issued.some(p=>p.type==='building.upgrade'&&p.key==='wall')));await page.getByText('預覽已更新；正式提交時仍會重新驗證。',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'preview-ui.png')});return {candidates,immediateFormalSubmission:true};
 });
 await run('revision/branch/target switching discards late preview; worker termination recovers without formal side effects',async()=>{
  const data=await page.evaluate(async()=>{
   const w=window.lab.world(),c=window.lab.controller();const pending=window.lab.request(c,w);c.dispose();let failed=false;try{await pending;}catch{failed=true;}if(!failed)throw Error('pending survived disposal');const result=await window.lab.request(c,{...w,revision:2});c.dispose();
   window.lab.detail(w,'wall','old');window.lab.detail({...w,revision:2},'warehouse.0','new');return {restarted:result.response.revision===2};
  });assert.equal(data.restarted,true);await page.getByText('預覽已更新；正式提交時仍會重新驗證。',{exact:true}).waitFor();assert.equal(await page.locator('.shared-building-detail').getAttribute('data-building-kind'),'warehouse');return data;
 });
 await run('native list opening latency, operation long tasks and bounded preview metrics',async()=>{
  const measurements=await page.evaluate(async()=>{
   const histories=[];
   for(const history of [0,10000,30000,60000]){
    const w=window.lab.world(history),times=[],tasks=[];let begin=0;
    const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.startTime>=begin)tasks.push(e.duration);});observer.observe({type:'longtask',buffered:false});
    for(let i=-3;i<30;i++){
     await new Promise(r=>requestAnimationFrame(r));begin=performance.now();window.lab.panel(w);document.querySelector('#tab-town').click();await new Promise(r=>requestAnimationFrame(r));
     document.querySelector('.town-lot.vacant').click();await new Promise(r=>requestAnimationFrame(r));
     const buttons=[...document.querySelectorAll('.build-choice button.primary')];if(!buttons.some(b=>!b.disabled))throw Error('list not interactive');if(i>=0)times.push(performance.now()-begin);window.lab.close();
    }
    await new Promise(r=>setTimeout(r,0));observer.disconnect();histories.push({history,times,longTasksOver50ms:tasks.filter(t=>t>50)});
   }
   const w=window.lab.world(),c=window.lab.controller();await window.lab.request(c,w);await window.lab.request(c,w);window.lab.request(c,w,[{field:3}]).catch(()=>null);await window.lab.request(c,w,[{field:4}]);const metrics={...c.metrics};c.dispose();return {histories,metrics};
  });
  assert.equal(measurements.metrics.calculations,3);assert.equal(measurements.metrics.cacheHits,1);assert.equal(measurements.metrics.discarded,1);
  report.panelOpening=measurements.histories.map(x=>({history:x.history,interactiveMs:stats(x.times),longTasksOver50ms:x.longTasksOver50ms}));report.controllerMetrics=measurements.metrics;return {metrics:measurements.metrics};
 });
 await run('native durable Inbox and Runtime stay independent when preview worker dies during a formal command',async()=>{
  await page.evaluate(async()=>{
   window.lab.close();const {FormalPersistence}=await import('/src/game/persistence.ts'),{captureIntent}=await import('/src/game/durableCommands.ts');const s=new FormalPersistence();await s.acquireWriter();window.runtimeWorld=await s.start(window.lab.world());s.db.close();window.runtimeMessages=[];
   const worker=new Worker('/artifacts/r302-harness/runtime.js',{type:'module'});window.runtime=worker;worker.onmessage=e=>window.runtimeMessages.push(e.data);window.captureIntent=captureIntent;
  });await page.waitForFunction(()=>window.runtimeMessages.some(m=>m.type==='booted'));await page.evaluate(()=>window.runtime.postMessage({type:'load',requestId:'load'}));await page.waitForFunction(()=>window.runtimeMessages.some(m=>m.type==='requestDone'&&m.requestId==='load'));
  await page.evaluate(()=>{
   const w=window.runtimeMessages.filter(m=>m.type==='state').at(-1).world;window.runtimeWorld=w;const order={commandId:'command:r302-independent',campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'field.upgrade',cityId:w.cities[0].id,slot:0}};window.formalOrder=order;
   window.previewPending=window.lab.controller();window.previewSettled=false;window.previewPromise=window.lab.request(window.previewPending,w).then(r=>{window.previewSettled=true;return r;}).catch(()=>null);window.runtime.postMessage({type:'command',order,...window.captureIntent(w,order),requestId:'formal'});
  });await page.waitForFunction(()=>window.runtimeMessages.some(m=>m.type==='commandDurable'));
  assert.equal(await page.evaluate(()=>window.previewSettled),false);await page.evaluate(()=>window.previewPending.dispose());await page.waitForFunction(()=>window.runtimeMessages.some(m=>m.type==='commandAck'&&m.ack.commandId==='command:r302-independent'));
  const result=await page.evaluate(async()=>{const {FormalPersistence}=await import('/src/game/persistence.ts'),s=new FormalPersistence(),row=await s.commandStatus(window.formalOrder.campaignId,window.formalOrder.commandId),w=(await s.loadSave()).game;s.db.close();window.runtime.terminate();return {state:row.state,effects:w.commandReceipts.filter(r=>r.commandId===window.formalOrder.commandId).length,jobs:w.cities[0].economy.construction.length};});assert.deepEqual(result,{state:'committed',effects:1,jobs:1});return result;
 });
 assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
