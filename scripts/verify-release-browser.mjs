import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [playwright,fixture,root]=process.argv.slice(2);if(!playwright||!fixture||!root)throw Error('Usage: verify-release-browser.mjs <playwright module> <synthetic old save> <prepared A/docs/B site directory>');
const {chromium}=await import(pathToFileURL(path.resolve(playwright)));

const base=process.env.RELEASE_BROWSER_URL??'http://127.0.0.1:4188/lieguo-zhengtu-origin/';
const metadata=JSON.parse(await fs.readFile(root+'/site-a/lieguo-zhengtu-origin/version.json','utf8'));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const result={browser:browser.version(),metadata:{version:metadata.version,date:metadata.date,commitSha:metadata.commitSha,contentSha:metadata.contentSha,dirty:metadata.dirty},cases:[],errors:[]};
await fs.mkdir(root+'/browser',{recursive:true});
const watch=(page,label)=>{page.on('pageerror',e=>result.errors.push({label,type:'pageerror',text:e.message}));page.on('console',m=>{if(m.type()==='error')result.errors.push({label,type:'console',text:m.text(),expectedOffline:m.text().includes('ERR_INTERNET_DISCONNECTED')});});page.on('response',r=>{if(r.status()>=400)result.errors.push({label,type:'http',url:r.url(),status:r.status()});});};
async function state(page){return page.evaluate(async()=>{const name=(await indexedDB.databases()).find(d=>d.name?.includes('formal'))?.name;if(!name)return null;const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const row=await new Promise((r,j)=>{const q=db.transaction('saves').objectStore('saves').get('current');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();return row?.data?.snapshot;});}
async function waitForDownloadedWorker(page,changed=false){const registration=await page.evaluateHandle(()=>navigator.serviceWorker.getRegistration());try{await page.waitForFunction(changed?(r=>!!r?.waiting&&r.waiting!==window.__r17DocsWorker):(r=>!!r?.waiting),registration);}finally{await registration.dispose();}}
async function importWorld(page){await page.locator('input[type=file]').setInputFiles(fixture);await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();}
for(const [label,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,serviceWorkers:'block',locale:'zh-TW'}),page=await context.newPage();page.setDefaultTimeout(20000);watch(page,label);
 try{await page.goto(base);await page.getByText('本次更新 · v'+metadata.version,{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes(metadata.date));assert.ok((await page.locator('body').innerText()).includes(metadata.commitSha.slice(0,7)));await importWorld(page);
 if(label==='mobile'){await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:/戰役設定/}).click();}else await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();
 await page.getByText('戰役資料 · v'+metadata.version,{exact:true}).waitFor();await page.getByText('近期版本與過往紀錄',{exact:true}).click();assert.ok((await page.locator('body').innerText()).includes('0.30.51'));assert.ok((await page.locator('body').innerText()).includes('工匠移動途中'));const before=await state(page);assert.equal(before.metadata.appVersion,'0.30.50');
 await context.setOffline(true);await page.getByRole('button',{name:'檢查更新',exact:true}).click();await page.getByText('目前無法確認更新；本機戰役仍可繼續。',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes('工匠移動途中'));await page.screenshot({path:root+'/browser/'+label+'.png',fullPage:true});
 result.cases.push({label,status:'PASS',viewport,home:true,settings:true,history:true,offlineNotes:true,oldAppVersion:before.metadata.appVersion});}catch(e){result.cases.push({label,status:'FAIL',error:String(e)});await page.screenshot({path:root+'/browser/'+label+'-FAIL.png',fullPage:true}).catch(()=>{});}finally{await context.close();}
}
const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-TW'});await context.addInitScript(()=>{
 const record=v=>{const events=JSON.parse(localStorage.getItem('release-trace')??'[]');events.push(v);localStorage.setItem('release-trace',JSON.stringify(events));};
 const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);if(String(args[0]).includes('runtime.worker'))this.addEventListener('message',e=>{if(e.data.type==='synced')record({type:'durable-sync-ack',requestId:e.data.requestId});});}};
 navigator.serviceWorker.addEventListener('controllerchange',()=>record({type:'controllerchange'}));
});
const page=await context.newPage();page.setDefaultTimeout(20000);watch(page,'real-sw-update');
try{await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await importWorld(page);const before=await state(page);assert.equal(before.metadata.appVersion,'0.30.50');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();
 const link=root+'/web/lieguo-zhengtu-origin';
 // Rebuild only deployment metadata: this is the Pages artifact shape after a docs-only merge.
 const docs=JSON.parse(await fs.readFile(root+'/site-docs/lieguo-zhengtu-origin/version.json','utf8'));assert.equal(docs.version,metadata.version);assert.equal(docs.contentSha,metadata.contentSha);assert.notEqual(docs.commitSha,metadata.commitSha);
 await fs.unlink(link);await fs.symlink(root+'/site-docs/lieguo-zhengtu-origin',link);await page.evaluate(()=>localStorage.setItem('release-trace','[]'));
 await page.getByRole('button',{name:'檢查更新',exact:true}).click();await waitForDownloadedWorker(page);
 await page.getByRole('button',{name:'檢查更新',exact:true}).click();await page.getByText('目前已載入 v'+metadata.version+'，已確認為最新版本。',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).count(),0);
 await page.evaluate(async()=>{window.__r17DocsWorker=(await navigator.serviceWorker.getRegistration()).waiting;});
 await context.setOffline(true);await page.getByRole('button',{name:'檢查更新',exact:true}).click();await page.getByText('目前無法確認更新；本機戰役仍可繼續。',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).count(),0);
 const docsTrace=await page.evaluate(()=>JSON.parse(localStorage.getItem('release-trace')??'[]'));assert.ok(!docsTrace.some(e=>e.type==='controllerchange'));assert.equal((await state(page)).campaignId,before.campaignId);
 result.cases.push({label:'real-sw-docs-only',status:'PASS',sameVersion:metadata.version,syntheticDeploymentSha:docs.commitSha,unchangedContentSha:docs.contentSha,waitingWorker:true,noActionableUpdateOnline:true,noActionableUpdateOffline:true,noActivation:true,oldSavePreserved:true});
 await context.setOffline(false);await fs.unlink(link);await fs.symlink(root+'/site-b/lieguo-zhengtu-origin',link);
 await page.getByRole('button',{name:'檢查更新',exact:true}).click();await page.getByText('可用更新建置 v'+metadata.version+'；可保存進度並更新。',{exact:true}).waitFor();
 await waitForDownloadedWorker(page,true);
 await page.evaluate(()=>localStorage.setItem('release-trace','[]'));await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).click();await page.waitForURL(/_appUpdate=e{40}/);await page.getByText('本次更新 · v'+metadata.version,{exact:true}).waitFor();
 const after=await state(page),trace=await page.evaluate(()=>JSON.parse(localStorage.getItem('release-trace')??'[]'));assert.equal(after.campaignId,before.campaignId);assert.equal(after.metadata.appVersion,'0.30.50');assert.ok(after.revision>=before.revision);
 const ack=trace.findIndex(e=>e.type==='durable-sync-ack'),control=trace.findIndex(e=>e.type==='controllerchange');assert.ok(ack>=0&&control>ack,'SW activated before durable sync acknowledgement');assert.ok((await page.locator('body').innerText()).includes('fffffff'));
 await context.setOffline(true);await page.reload();await page.getByText('本次更新 · v'+metadata.version,{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes('fffffff'));assert.ok((await page.locator('body').innerText()).includes('近期版本與過往紀錄'));
 result.cases.push({label:'real-sw-update',status:'PASS',sameVersion:metadata.version,newSyntheticSha:'f'.repeat(40),newSyntheticContentSha:'e'.repeat(40),trace,saveBeforeActivation:true,nativeWorker:true,nativeIndexedDB:true,oldSavePreserved:true,offlineReloadFromSW:true});
}catch(e){result.cases.push({label:'real-sw-update',status:'FAIL',error:String(e)});await page.screenshot({path:root+'/browser/sw-FAIL.png',fullPage:true}).catch(()=>{});}finally{await context.close();}
await browser.close();const link=root+'/web/lieguo-zhengtu-origin';await fs.unlink(link);await fs.symlink(root+'/site-a/lieguo-zhengtu-origin',link);result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.length-result.passed;await fs.writeFile(root+'/browser/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));result.unexpectedErrors=result.errors.filter(e=>!e.expectedOffline);await fs.writeFile(root+'/browser/result.json',JSON.stringify(result,null,2));if(result.failed||result.unexpectedErrors.length)process.exitCode=1;
