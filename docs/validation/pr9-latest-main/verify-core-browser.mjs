// Real production Worker / native IndexedDB probes. All inputs are synthetic.
// node scripts/verify-r4-review-browser.mjs <playwright-core/index.mjs> <fixtures> <output>
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [pw,fixtures,out]=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const result={testedSourceHead:process.env.V94_SOURCE_HEAD??null,browser:browser.version(),controlled:true,aiDecisionsDeferredDays:30,cases:[],errors:[]};
const probe=await browser.newPage();result.releaseMetadata=await (await probe.request.get((process.env.R4_REVIEW_URL??'http://127.0.0.1:4199/lieguo-zhengtu-origin/')+'version.json')).json();if(result.testedSourceHead)assert.equal(result.releaseMetadata.commitSha,result.testedSourceHead);result.viewports=[{width:1440,height:900},{width:390,height:844}];await probe.close();
async function snapshot(page){return page.evaluate(async()=>{
 const name=(await indexedDB.databases()).find(d=>d.name?.includes('formal'))?.name;if(!name)return null;
 const db=await new Promise((res,rej)=>{const r=indexedDB.open(name);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
 try{return await new Promise((res,rej)=>{const r=db.transaction('saves').objectStore('saves').get('current');r.onsuccess=()=>res(r.result?.data?.snapshot??null);r.onerror=()=>rej(r.error);});}finally{db.close();}
});}
for(const mobile of [false,true])for(const label of ['C1-reachable','C1-blocked','C3-true','C3-false']){
 const caseLabel=(mobile?'mobile-':'desktop-')+label;const expected=JSON.parse(await fs.readFile(path.join(fixtures,label+'-expected.json'),'utf8'));
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,locale:'zh-TW',serviceWorkers:'block'});
 await context.addInitScript(()=>{window.__reviewEvents=[];const Native=Worker;window.Worker=class extends Native{constructor(...a){super(...a);if(String(a[0]).includes('runtime.worker'))window.__reviewWorker=this;this.addEventListener('message',e=>{if(['error','switchFailed','switched'].includes(e.data.type))window.__reviewEvents.push(e.data);});}};});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>result.errors.push({label:caseLabel,type:'pageerror',text:e.message}));
 page.on('console',m=>{if(m.type()==='error')result.errors.push({label:caseLabel,type:'console',text:m.text()});});
 page.on('response',r=>{if(r.status()>=400)result.errors.push({label:caseLabel,type:'http',status:r.status(),url:r.url()});});
 const check=w=>{
  assert.ok(w&&w.time>=expected.at,'world stopped before arrival');
  assert.equal(w.autonomy.agents.length,99);
  assert.equal(w.events.some(e=>e.id===expected.eventId),false);
  if(expected.kind==='C3'){
   assert.equal(w.armies.some(a=>a.id===expected.armyId),false);
   assert.equal(w.events.some(e=>e.armyId===expected.armyId),false);
   assert.equal(w.cities.find(c=>c.id===expected.sourceCityId).ownerFactionId,expected.ownerAfter);
   assert.equal(w.extinction.sites.filter(s=>s.sourceFactionId===expected.originalOwner).length,0);
   assert.equal(w.politics.joints.some(j=>j.armyIds.includes(expected.armyId)),false);return;
  }
  const crafts=w.extinction.craftsmen.filter(c=>c.id===expected.id);
  assert.equal(crafts.length,expected.mode==='reachable'?1:0);
  if(crafts.length){assert.equal(crafts[0].destinationCityId,expected.destinationCityId);assert.equal(crafts[0].cityId,null);assert.ok(crafts[0].arrivalAt>w.time);assert.equal(w.events.filter(e=>e.id===crafts[0].eventId).length,1);}
  else assert.equal(w.events.some(e=>e.type==='craftsman.arrive'&&e.craftsmanId===expected.id),false);
 };
 try{
  await page.goto(process.env.R4_REVIEW_URL??'http://127.0.0.1:4176/lieguo-zhengtu-origin/');
  await page.locator('input[type=file]').setInputFiles(path.join(fixtures,label+'.realm-save'));
  await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();
  let after;const end=Date.now()+20000;
  while(Date.now()<end){after=await snapshot(page);if(after?.time>=expected.at+1000)break;await page.waitForTimeout(200);}
  check(after);assert.equal(await page.evaluate(()=>window.__reviewEvents.some(e=>['error','switchFailed'].includes(e.type))),false);
  const extinct=expected.kind==='C3'&&label==='C3-false';
  if(extinct){
   // The legitimate RebirthView has no settings navigation. Exercise the same
   // native Worker API directly, without adding a product shortcut or editing DB.
   const call=async(type,extra={})=>page.evaluate(({type,extra})=>new Promise((resolve,reject)=>{
    const worker=window.__reviewWorker;if(!worker){reject(Error('runtime Worker unavailable'));return;}
    const requestId='review-'+crypto.randomUUID(),transitionId=requestId;
    const expected={sync:'synced',load:'loaded',backups:'backups',restore:'switched'}[type];
    const timer=setTimeout(()=>{worker.removeEventListener('message',listener);reject(Error(type+' response timeout'));},20000);
    function listener(e){const d=e.data;if(d.type===expected&&(type!=='sync'||d.requestId===requestId)&&(type!=='restore'||d.transitionId===transitionId)){clearTimeout(timer);worker.removeEventListener('message',listener);resolve(d);}}
    worker.addEventListener('message',listener);worker.postMessage({type,requestId,transitionId,...extra});
   }),{type,extra});
   await call('sync');await call('load');const reload=await snapshot(page);check(reload);
   const backups=await call('backups');assert.ok(backups.items.length);
   await call('restore',{id:backups.items[0].id});const recovered=await snapshot(page);check(recovered);assert.ok(recovered.revision>reload.revision);
   assert.equal(await page.evaluate(()=>window.__reviewEvents.some(e=>['error','switchFailed'].includes(e.type))),false);
   await page.screenshot({path:path.join(out,caseLabel+'.png'),fullPage:true});
   result.cases.push({label:caseLabel,status:'PASS',worldAfter:after.time,reload:true,recovery:true,recoveryRevision:recovered.revision,realWorker:true,nativeIndexedDB:true,agents:99,recoveryPath:'native Worker sync/load/backups/restore; RebirthView has no settings nav'});
   continue;
  }
  if(mobile){await page.locator('.mobile-nav button').filter({hasText:'更多'}).click();await page.getByRole('button',{name:/戰役設定/}).click();}else await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();
  await page.getByRole('button',{name:'立即保存',exact:true}).click();
  await page.getByRole('button',{name:'重新讀取',exact:true}).click();await page.locator('.formal-shell').waitFor();await page.waitForTimeout(800);
  const reload=await snapshot(page);check(reload);assert.ok(reload.revision>=after.revision);
  const switches=await page.evaluate(()=>window.__reviewEvents.filter(e=>e.type==='switched').length);
  await page.getByRole('button',{name:'查看回復點',exact:true}).click();await page.locator('.backup-list button').first().click();
  await page.getByRole('button',{name:'確認回復',exact:true}).click();
  await page.waitForFunction(n=>window.__reviewEvents.filter(e=>e.type==='switched').length>n,switches);await page.locator('.formal-shell').waitFor();
  const recovered=await snapshot(page);check(recovered);assert.ok(recovered.revision>reload.revision);
  assert.equal(await page.evaluate(()=>window.__reviewEvents.some(e=>['error','switchFailed'].includes(e.type))),false);
  await page.screenshot({path:path.join(out,caseLabel+'.png'),fullPage:true});
  result.cases.push({label:caseLabel,status:'PASS',worldAfter:after.time,reload:true,recovery:true,recoveryRevision:recovered.revision,realWorker:true,nativeIndexedDB:true,agents:99});
 }catch(e){result.cases.push({label:caseLabel,status:'FAIL',error:String(e)});await page.screenshot({path:path.join(out,caseLabel+'-FAIL.png'),fullPage:true}).catch(()=>{});}
 finally{await context.close();}
 console.log(JSON.stringify(result.cases.at(-1)));
}
await browser.close();result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.length-result.passed;
await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));
if(result.failed||result.errors.length)process.exitCode=1;
