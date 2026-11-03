// Actual production bundles and native Service Workers on localhost only.
// The before/after sites are PR58/PR59 builds, never public deployments.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=process.argv[2],base=process.env.B10_PRODUCTION_URL??'http://127.0.0.1:4219/lieguo-zhengtu-origin/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const report={browser:browser.version(),selection:process.env.B10_SW_ONLY??'all five cases',method:'Localhost, actual PR58 and final PR59 production builds, native SW/cache/IndexedDB/Runtime/Preview. Native IDB abort injection is isolated to a disposable test context. Desktop headless, not Android.',cases:[]};
const output=process.env.B10_SW_OUT??'artifacts/b10-final/production-sw.json';
async function step(page,label){await page.evaluate(label=>window.__caseStep=label,label);}
async function site(name,mode='normal'){await fs.writeFile(root+'/variant.txt',name);await fs.writeFile(root+'/mode.txt',mode);}
async function trace(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('b10-final-trace')??'[]'));}
async function context(){const c=await browser.newContext();await c.addInitScript(()=>{
 const record=e=>{const rows=JSON.parse(localStorage.getItem('b10-final-trace')??'[]');rows.push({...e,at:Date.now()});localStorage.setItem('b10-final-trace',JSON.stringify(rows.slice(-200)));};
 window.wires=[];window.failSave=false;
 const Native=Worker;window.Worker=class extends Native{
  constructor(url,options){
   const runtime=String(url).includes('runtime.worker');
   const target=runtime?URL.createObjectURL(new Blob([`import ${JSON.stringify(new URL(url,location.href).href)};
let failWrites=false;const receive=self.onmessage;self.onmessage=function(e){if(e.data?.__finalFailWrites)failWrites=true;return receive.call(this,e);};
const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(failWrites&&args[1]==='readwrite')tx.abort();return tx;};`],{type:'application/javascript'})):url;
   super(target,options);if(runtime){window.runtime=this;this.addEventListener('message',e=>{window.wires.push(e.data);if(e.data.type==='synced')record({type:'durable-save-ack'});if(e.data.type==='commandAck')record({type:'command-ack',ack:e.data.ack});});}
  }
  postMessage(m,...rest){if(m.type==='sync'){record({type:'save-request'});if(window.failSave)m={...m,__finalFailWrites:true};}return super.postMessage(m,...rest);}
 };
 const post=ServiceWorker.prototype.postMessage;ServiceWorker.prototype.postMessage=function(m,...rest){if(m?.type==='SKIP_WAITING')record({type:'skip-waiting'});if(m?.type==='GET_APP_RELEASE')record({type:'release-probe'});return post.call(this,m,...rest);};
 navigator.serviceWorker.addEventListener('controllerchange',()=>record({type:'controllerchange'}));window.addEventListener('beforeunload',()=>record({type:'navigation'}));
});return c;}
async function seed(page){await page.goto(base+'__validation/lab.html');return page.evaluate(()=>new Promise((resolve,reject)=>{const w=new Worker('seed.js',{type:'module'});w.onerror=e=>{w.terminate();reject(Error(e.message));};w.onmessage=e=>{if(e.data.booted)w.postMessage({action:'seed',count:0});else{w.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);}};}));}
async function load(page){await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.formal-city-panel').waitFor();}
let querySequence=0;
async function query(page,id){const requestId='final-query-'+(++querySequence);await page.evaluate(({id,requestId})=>window.runtime.postMessage({type:'commandQuery',campaignId:window.campaign,commandId:id,requestId}),{id,requestId});await page.waitForFunction(requestId=>window.wires.some(m=>m.type==='requestDone'&&m.requestId===requestId),requestId);return page.evaluate(id=>window.wires.filter(m=>m.type==='commandStatus'&&m.commandId===id).at(-1)?.row,id);}
async function start(page){await site('before');const fixture=await seed(page);await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await load(page);await page.evaluate(c=>window.campaign=c,fixture.campaignId);
 await page.getByRole('button',{name:'更改城名',exact:true}).click();await page.getByLabel('城市名稱',{exact:true}).fill('正式更新保留原始結果');await page.getByRole('button',{name:'確認改名',exact:true}).click();await page.waitForFunction(()=>window.wires.some(m=>m.type==='commandAck'&&m.ack.status==='committed'));
 const ack=await page.evaluate(()=>window.wires.filter(m=>m.type==='commandAck').at(-1).ack),row=await query(page,ack.commandId);assert.equal(row.state,'committed');
 await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();await page.locator('.view-scroll.settings').getByRole('button',{name:'返回首頁',exact:true}).click();return{fixture,ack,row};}
async function offer(page,mode='normal'){await site('after',mode);await page.getByRole('button',{name:'檢查更新',exact:true}).click();await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).waitFor();}
async function waitCandidate(page){await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting,undefined,{timeout:30000});}
async function resetTrace(page){await page.evaluate(()=>localStorage.setItem('b10-final-trace','[]'));}
async function updated(page,before){await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).click();await page.waitForURL(/_appUpdate=/);await page.getByText(/已載入預期新版/).waitFor();await load(page);await page.evaluate(c=>window.campaign=c,before.fixture.campaignId);const row=await query(page,before.ack.commandId);assert.equal(row.state,'committed');assert.deepEqual(row.ack,before.ack);const events=await trace(page),ack=events.findIndex(e=>e.type==='durable-save-ack'),skip=events.findIndex(e=>e.type==='skip-waiting'),control=events.findIndex(e=>e.type==='controllerchange'),navigation=events.findIndex(e=>e.type==='navigation');assert.ok(ack>=0&&skip>ack&&control>skip&&navigation>control,'durable save before activation and navigation');return{row,events};}
async function run(name,fn){if(process.env.B10_SW_ONLY&&!name.startsWith(process.env.B10_SW_ONLY))return;const c=await context(),page=await c.newPage();page.setDefaultTimeout(30000);try{const data=await fn(page,c);report.cases.push({name,status:'PASS',data});console.log('PASS production SW',name);}catch(error){report.cases.push({name,status:'FAIL',error:String(error),step:await page.evaluate(()=>window.__caseStep).catch(()=>null),phase:await page.locator('[data-update-phase]').getAttribute('data-update-phase').catch(()=>null),trace:await trace(page).catch(()=>[]),body:(await page.locator('body').innerText().catch(()=>'' )).slice(-2500)});console.log('FAIL production SW',name,String(error));}finally{await c.close();await fs.writeFile(output,JSON.stringify(report,null,2));}}
try{
 await run('native update retains campaign and exact original Ack, then cold offline reopen',async(page,c)=>{
  const before=await start(page);await offer(page);await waitCandidate(page);await resetTrace(page);const result=await updated(page,before);
  await c.setOffline(true);await page.reload();await load(page);await page.evaluate(c=>window.campaign=c,before.fixture.campaignId);const row=await query(page,before.ack.commandId);assert.equal(row.state,'committed');assert.deepEqual(row.ack,before.ack);assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller));return{...result,offlineOriginalAck:true};
 });
 for(const mode of ['offline-sw','bad-install'])await run(mode+' refuses activation and later retries safely',async page=>{
  const before=await start(page);await offer(page,mode);await resetTrace(page);const url=page.url();await step(page,'click failing update');await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).click();if(mode==='bad-install'){await step(page,'wait native installation identity probe');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('b10-final-trace')??'[]').some(e=>e.type==='release-probe'));}await step(page,'wait application failure phase');await page.waitForFunction(()=>document.querySelector('[data-update-phase]')?.getAttribute('data-update-phase')==='failed');await step(page,'verify old campaign after failure');assert.equal(page.url(),url);const failedTrace=await trace(page);assert.ok(!failedTrace.some(e=>e.type==='skip-waiting'));assert.deepEqual((await query(page,before.ack.commandId)).ack,before.ack);
  await step(page,'retry metadata check');await site('after');await page.getByRole('button',{name:'檢查更新',exact:true}).click();await resetTrace(page);await step(page,'retry update and verify target');return{failedTrace,retry:await updated(page,before)};
 });
 await run('aborted durable save never activates or claims save success',async page=>{
  const before=await start(page);await offer(page);await waitCandidate(page);await resetTrace(page);await page.evaluate(()=>window.failSave=true);const url=page.url();await page.getByRole('button',{name:'保存進度並載入新版',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-update-phase]')?.getAttribute('data-update-phase')==='failed');assert.equal(page.url(),url);const events=await trace(page);assert.ok(events.some(e=>e.type==='save-request'));assert.ok(!events.some(e=>['durable-save-ack','skip-waiting','controllerchange','navigation'].includes(e.type)));assert.ok((await page.locator('body').innerText()).includes('不能確認本次保存成功'));assert.deepEqual((await query(page,before.ack.commandId)).ack,before.ack);return{events,originalAckPreserved:true};
 });
 await run('page closes after native Durable notification; reopen resolves the same ID once',async(page,c)=>{
  const before=await start(page);await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('nav[aria-label="遊戲主要功能"]').waitFor();await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'城市'}).first().click();await page.locator('.formal-city-panel').waitFor();
  await page.exposeFunction('__finalClose',()=>page.close());
  await page.evaluate(()=>window.runtime.addEventListener('message',e=>{if(e.data.type==='commandDurable'){localStorage.setItem('b10-final-closed-order',JSON.stringify(e.data.row.order));void window.__finalClose();}}));
  await page.getByRole('button',{name:'更改城名',exact:true}).click();await page.getByLabel('城市名稱',{exact:true}).fill('關頁後同一原意');const closed=page.waitForEvent('close');
  try{await page.getByRole('button',{name:'確認改名',exact:true}).click();}catch(error){if(!page.isClosed())throw error;}await closed;
  const reopened=await c.newPage();await reopened.goto(base);await load(reopened);await reopened.evaluate(c=>window.campaign=c,before.fixture.campaignId);
  const order=await reopened.evaluate(()=>JSON.parse(localStorage.getItem('b10-final-closed-order')));assert.ok(order?.commandId);
  let row=await query(reopened,order.commandId);if(['pending','retryable'].includes(row.state)){await reopened.waitForFunction(id=>window.wires.some(m=>m.type==='commandAck'&&m.ack.commandId===id),order.commandId);row=await query(reopened,order.commandId);}assert.equal(row.state,'committed');assert.deepEqual(row.order,order);
  await reopened.evaluate(()=>window.runtime.postMessage({type:'away',requestId:'final-inspect-barrier'}));await reopened.waitForFunction(()=>window.wires.some(m=>m.type==='requestDone'&&m.requestId==='final-inspect-barrier'));
  const evidence=await reopened.evaluate(id=>new Promise((resolve,reject)=>{const w=new Worker('__validation/seed.js',{type:'module'});w.onerror=e=>{w.terminate();reject(Error(e.message));};w.onmessage=e=>{if(e.data.booted)w.postMessage({action:'inspect',ids:[id]});else{w.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data);}};}),order.commandId);
  assert.equal(evidence.effects[order.commandId],1);return{order,state:row.state,effects:evidence.effects,scope:'Desktop page close, not Android process kill; T2 may have completed before page closure'};
 });
}finally{await browser.close();await site('after');}
if(report.cases.some(c=>c.status!=='PASS'))process.exitCode=1;
