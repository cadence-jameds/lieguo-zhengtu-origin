// Isolated localhost fixture only: native unregister() below deliberately reproduces a stale registration.
// The application never unregisters workers or removes user data.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const [modulePath,root,fixture]=process.argv.slice(2);if(!fixture)throw Error('Usage: verify-update-worker-boundary-browser.mjs <playwright module> <prepared sites root> <synthetic save>');
const {chromium}=await import(pathToFileURL(path.resolve(modulePath))),base=process.env.HOTFIX_BROWSER_URL??'http://127.0.0.1:4218/lieguo-zhengtu-origin/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),result={browser:browser.version(),historicalPatchedVersionLabels:'Synthetic 0.30.52/0.30.53 metadata; patched app code',cases:[],errors:[]};await fs.mkdir(root+'/browser',{recursive:true});
async function site(name){const link=root+'/web/lieguo-zhengtu-origin';await fs.unlink(link);await fs.symlink(root+'/'+name+'/lieguo-zhengtu-origin',link);}
async function trace(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('hotfix-trace')??'[]'));}
async function reset(page){await page.evaluate(()=>localStorage.setItem('hotfix-trace','[]'));}
async function store(page){return page.evaluate(async()=>{const n=(await indexedDB.databases()).find(d=>d.name?.includes('formal'))?.name;if(!n)return null;const db=await new Promise((r,j)=>{const q=indexedDB.open(n);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const all={};for(const name of db.objectStoreNames){all[name]=await new Promise((r,j)=>{const q=db.transaction(name).objectStore(name).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});}db.close();return all;});}
async function load(page){await page.goto(base);await page.evaluate(()=>{navigator.serviceWorker.ready.then(()=>window.__initialSWReady=true);});await page.waitForFunction(()=>window.__initialSWReady);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.locator('input[type=file]').setInputFiles(fixture);await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:/戰役設定/}).click();}
async function context(){const c=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW'});await c.addInitScript(()=>{
 const record=v=>{const a=JSON.parse(localStorage.getItem('hotfix-trace')??'[]');a.push(v);localStorage.setItem('hotfix-trace',JSON.stringify(a));};
 const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);if(String(args[0]).includes('runtime.worker'))this.addEventListener('message',e=>{if(e.data.type==='synced')record({type:'durable-sync-ack',requestId:e.data.requestId});});}};
 const post=ServiceWorker.prototype.postMessage;ServiceWorker.prototype.postMessage=function(message,...args){if(message?.type==='SKIP_WAITING')record({type:'skip-waiting'});if(message?.type==='GET_APP_RELEASE')record({type:'release-query'});return post.call(this,message,...args);};
 const update=ServiceWorkerRegistration.prototype.update;ServiceWorkerRegistration.prototype.update=async function(...args){try{return await update.apply(this,args);}catch(e){record({type:'native-update-error',name:e.name,message:e.message});throw e;}};
 navigator.serviceWorker.addEventListener('controllerchange',()=>record({type:'controllerchange'}));window.addEventListener('beforeunload',()=>record({type:'beforeunload'}));
 });return c;}
async function run(label,fn){const c=await context(),p=await c.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>result.errors.push({label,message:e.message}));try{const details=await fn(p,c);result.cases.push({label,status:'PASS',...details});}catch(e){result.cases.push({label,status:'FAIL',error:String(e),trace:await trace(p).catch(()=>[]),bodyText:await p.locator('body').innerText().catch(()=>'' )});await p.screenshot({path:root+'/browser/'+label+'-FAIL.png',fullPage:true}).catch(()=>{});}finally{await c.close();await fs.writeFile(root+'/browser/progress.json',JSON.stringify(result,null,2));}}

for(const mode of (process.env.R19_MODES?.split(',')??['fail','pending','race']))await run('r19-docs-waiting-'+mode,async(p,c)=>{
 await fs.writeFile(root+'/r19-server-mode','normal');await site('patched-53');await load(p);await site('docs-53');
 await p.getByRole('button',{name:'檢查更新',exact:true}).click();const registration=await p.evaluateHandle(()=>navigator.serviceWorker.getRegistration());await p.waitForFunction(r=>!!r?.waiting&&!r.installing,registration);await registration.dispose();
 await p.evaluate(async()=>{window.__docsWorker=(await navigator.serviceWorker.getRegistration()).waiting;});
 await p.getByRole('button',{name:'檢查更新',exact:true}).click();await p.getByText('目前已載入 v0.30.53，已確認為最新版本。',{exact:true}).waitFor();
 await p.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
 const before=await store(p);await reset(p);await site('content-53');await fs.writeFile(root+'/r19-server-mode',mode);await fs.rm(root+'/r19-request-seen',{force:true});
 await p.getByRole('button',{name:'檢查更新',exact:true}).click();await p.getByRole('button',{name:'保存進度並載入新版',exact:true}).waitFor();
 for(let i=0;i<100;i++){if(await fs.stat(root+'/r19-request-seen').catch(()=>null))break;await new Promise(r=>setTimeout(r,50));}assert.ok(await fs.stat(root+'/r19-request-seen'),'Native SW request must reach the controlled server');
 // Click while the real browser update request fails, remains pending, or races its response.
 await p.getByRole('button',{name:'保存進度並載入新版',exact:true}).click();
 const broken=process.env.R19_EXPECT_BUG==='1';
 if(broken){await p.waitForURL(/_appUpdate=e{40}/);await p.getByText('本次更新 · v0.30.53',{exact:true}).waitFor();const body=await p.locator('body').innerText();assert.ok(body.includes('ddddddd'));assert.ok(body.includes('仍未取得預期新版'));}
 else {await p.getByText(/新版下載尚未完成或更新元件失效/).waitFor();assert.equal(new URL(p.url()).searchParams.has('_appUpdate'),false);assert.ok(await p.evaluate(()=>navigator.serviceWorker.controller!==window.__docsWorker));assert.ok(!(await trace(p)).some(e=>['controllerchange','skip-waiting','durable-sync-ack','beforeunload'].includes(e.type)));assert.deepEqual(await store(p),before);}
 const t=await trace(p);let retryAfterDownload;
 if(!broken&&mode==='pending'){
  // A changed JS reference is not proof that C1 finished downloading. Verify the
  // actual candidate's reply; while it still reports C0/D, the product correctly blocks it.
  const deadline=Date.now()+20000;let downloaded=false;
  while(Date.now()<deadline){
   downloaded=await p.evaluate(async()=>{
    const w=(await navigator.serviceWorker.getRegistration())?.waiting;if(!w)return false;
    return new Promise(resolve=>{const channel=new MessageChannel();let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};const timer=setTimeout(()=>finish(false),500);channel.port1.onmessage=e=>finish(e.data?.contentSha==='e'.repeat(40));w.postMessage({type:'GET_APP_RELEASE'},[channel.port2]);});
   });
   if(downloaded)break;await p.waitForTimeout(50);
  }
  assert.ok(downloaded,'C1 own identity must be confirmed within the existing 20s probe deadline');
  await reset(p);
  await c.setOffline(true);await p.getByRole('button',{name:'保存進度並載入新版',exact:true}).click();await p.waitForURL(/_appUpdate=e{40}/);await p.getByText('本次更新 · v0.30.53',{exact:true}).waitFor();assert.ok((await p.locator('body').innerText()).includes('fffffff'));
  const retry=await trace(p),ack=retry.findIndex(e=>e.type==='durable-sync-ack'),skip=retry.findIndex(e=>e.type==='skip-waiting'),control=retry.findIndex(e=>e.type==='controllerchange'),nav=retry.findIndex(e=>e.type==='beforeunload');assert.ok(ack>=0&&skip>ack&&control>skip&&nav>control);
  retryAfterDownload={status:'PASS',offline:true,loadedC1:true,eventOrder:retry.map(e=>e.type)};
 }
 return {retryAfterDownload,expectedBrokenBaseline:broken,mode,targetContentSha:'e'.repeat(40),docsWorkerActivated:broken,trace:t,noNavigation:!broken,noSaveClaim:!broken,indexedDBUnchanged:!broken};
});
await browser.close();await fs.writeFile(root+'/r19-server-mode','normal');await site('actual');result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.length-result.passed;console.log(JSON.stringify(result));if(result.failed||result.errors.length)process.exitCode=1;
