// Actual bundled Preview/Runtime/WorldStream v2 and SW cache, synthetic data.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base='http://127.0.0.1:4219/lieguo-zhengtu-origin/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const report={browser:browser.version(),source:'8d40f63c5efbd08ee252f533719d5f58fc95b3dd',method:'Production bundles, actual GameApp, native Preview/Runtime workers and SW, synthetic fixture. Desktop Chromium, not Android.'};
try{
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(30000);
 await page.addInitScript(()=>{window.messages=[];window.workerURLs=[];window.orders=[];const Native=Worker;window.Worker=class extends Native{constructor(url,options){super(url,options);window.workerURLs.push(String(url));if(String(url).includes('runtime.worker')){window.runtime=this;this.addEventListener('message',e=>window.messages.push(e.data));}}postMessage(message,...rest){if(message.type==='command')window.orders.push(message.order);return super.postMessage(message,...rest);}};});
 await page.goto(base+'__validation/lab.html');
 const seeded=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('seed.js',{type:'module'});worker.onerror=e=>{worker.terminate();reject(Error(e.message));};worker.onmessage=e=>{if(e.data.booted)worker.postMessage({action:'seed',count:0});else{worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);}};}));
 await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.formal-city-panel').waitFor();
 await page.getByRole('tab',{name:'城內',exact:true}).click();await page.locator('.town-lot.vacant').first().click();await page.getByText('預覽已更新；正式提交時仍會重新驗證。',{exact:true}).waitFor();
 await page.locator('.construction-menu .build-choice button.primary:enabled').first().click();await page.waitForFunction(()=>window.messages.some(m=>m.type==='commandAck'));
 const result=await page.evaluate(()=>({ack:window.messages.filter(m=>m.type==='commandAck').at(-1).ack,order:window.orders.at(-1),workers:window.workerURLs,protocols:[...new Set(window.messages.filter(m=>m.projection).map(m=>m.projection.protocolVersion))],historyOnWire:window.messages.some(m=>m.projection&&JSON.stringify(m.projection).includes('commandReceipts'))}));
 assert.equal(result.ack.status,'committed');assert.ok(result.workers.some(u=>u.includes('/assets/constructionPreview.worker-')));assert.ok(result.workers.some(u=>u.includes('/assets/runtime.worker-')));assert.deepEqual(result.protocols,[2]);assert.equal(result.historyOnWire,false);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.formal-city-panel').waitFor();
 await page.evaluate(({campaignId,commandId})=>window.runtime.postMessage({type:'commandQuery',campaignId,commandId,requestId:'production-preview-query'}),{campaignId:seeded.campaignId,commandId:result.ack.commandId});await page.waitForFunction(()=>window.messages.some(m=>m.type==='requestDone'&&m.requestId==='production-preview-query'));
 const row=await page.evaluate(()=>window.messages.filter(m=>m.type==='commandStatus').at(-1).row);assert.equal(row.state,'committed');assert.deepEqual(row.ack,result.ack);assert.deepEqual(row.order,result.order);
 await page.getByRole('tab',{name:'城內',exact:true}).click();await page.locator('.town-lot.vacant').first().click();await page.getByText('預覽已更新；正式提交時仍會重新驗證。',{exact:true}).waitFor();
 report.status='PASS';report.result={...result,offlinePreview:true,offlineOriginalAckPreserved:true};console.log('PASS production bundled Preview/Runtime/v2/offline');
}catch(error){report.status='FAIL';report.error=String(error);throw error;}
finally{await fs.writeFile('artifacts/b10-final/production-preview.json',JSON.stringify(report,null,2));await browser.close();}
