// Synthetic genuine-order fixtures from R4_DELTA_EVIDENCE. Production bundle only.
// node scripts/verify-r4-craftsman-browser.mjs <external-playwright> <fixtures> <evidence>
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [pw,fixtures,out]=process.argv.slice(2);await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const result={browser:browser.version(),mode:'production bundle / native IndexedDB',controlledOfflineTimestamp:true,cases:[],errors:[]};
async function stored(page){return page.evaluate(async()=>{const name=(await indexedDB.databases()).find(d=>d.name?.includes('formal'))?.name;if(!name)return null;const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const rows=await new Promise((r,j)=>{const q=db.transaction('saves').objectStore('saves').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();return{world:rows.find(r=>r.id==='current')?.data.snapshot,authority:rows.find(r=>r.id==='authority')};});}
for(const same of [false,true]){
 const label=same?'same':'foreign',context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-TW',serviceWorkers:'block'});
 await context.addInitScript(()=>{window.__r4={workers:[],events:[]};const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);window.__r4.workers.push(this);this.addEventListener('message',e=>{if(['commandAck','error','switchFailed','switched'].includes(e.data.type))window.__r4.events.push(e.data);});}};});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>result.errors.push({label,type:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')result.errors.push({label,type:'console',message:m.text()});});page.on('response',r=>{if(r.status()>=400)result.errors.push({label,type:'http',status:r.status(),url:r.url()});});
 try{
  const expected=JSON.parse(await fs.readFile(path.join(fixtures,`browser-free-${same}-expected.json`),'utf8'));
  await page.goto(process.env.R4_BROWSER_URL??'http://127.0.0.1:4176/lieguo-zhengtu-origin/');
  await page.locator('input[type=file]').setInputFiles(path.join(fixtures,`browser-free-${same}.realm-save`));await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();
  await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'天下勢力'}).click();
  await page.getByRole('button',{name:'工匠建造城堡 Lv1（免資源）',exact:true}).click();
  await page.waitForFunction(()=>window.__r4.events.some(e=>e.type==='commandAck'));
  const ack=await page.evaluate(()=>window.__r4.events.find(e=>e.type==='commandAck').ack);assert.equal(ack.status,'committed');
  const queued=await stored(page),city=queued.world.cities[0],job=city.economy.construction.find(j=>j.commandId===ack.commandId);
  assert.ok(job);assert.deepEqual(job.paidResources,{food:0,wood:0,stone:0,gold:0});assert.equal(job.durationMs,expected.durationMs);assert.equal(job.castleCivilizationId,expected.civilizationId);assert.equal(queued.world.extinction.craftsmen.length,1);assert.equal(queued.world.commandReceipts.filter(r=>r.commandId===ack.commandId).length,1);
  await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();await page.getByRole('button',{name:'立即保存',exact:true}).click();await page.getByRole('button',{name:'重新讀取',exact:true}).click();await page.waitForTimeout(500);
  const reloaded=await stored(page);assert.deepEqual(reloaded.world.cities[0].economy.construction.find(j=>j.commandId===ack.commandId).paidResources,{food:0,wood:0,stone:0,gold:0});
  // Move only the checkpoint wall timestamp. The native offline loader must execute
  // the original, normally timed construction event; no world/envelope is edited.
  await page.evaluate(async end=>{for(const w of window.__r4.workers)w.terminate();const name=(await indexedDB.databases()).find(d=>d.name?.includes('formal')).name;const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),q=store.get('current');q.onsuccess=()=>{const row=q.result,w=row.data.snapshot;row.at=Date.now()-Math.ceil((end-w.time+5000)/w.speed);store.put(row);};tx.oncomplete=r;tx.onerror=()=>j(tx.error);});db.close();},job.startsAt+job.durationMs);
  await page.reload();let done;for(let i=0;i<120;i++){done=await stored(page);if(done?.world?.cities[0].buildings.castle===1)break;await page.waitForTimeout(250);}
  assert.equal(done.world.cities[0].buildings.castle,1);assert.equal(done.world.cities[0].castleCivilizationId,expected.civilizationId);assert.equal(done.world.extinction.craftsmen.length,0);assert.equal(done.world.commandReceipts.filter(r=>r.commandId===ack.commandId).length,1);
  if(await page.getByRole('button',{name:'載入進度',exact:true}).count())await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.formal-shell').waitFor();await page.screenshot({path:path.join(out,label+'-completed.png'),fullPage:true});
  result.cases.push({name:label,status:'PASS',uiCommand:true,paidResources:job.paidResources,normalDurationMs:job.durationMs,reload:true,nativeOfflineCompletion:true,singleConsumption:true,singleReceipt:true,aiAgents:done.world.autonomy.agents.length});
 }catch(e){result.cases.push({name:label,status:'FAIL',error:String(e)});await page.screenshot({path:path.join(out,label+'-FAIL.png'),fullPage:true}).catch(()=>{});}finally{await context.close();}
}
await browser.close();result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.filter(c=>c.status==='FAIL').length;await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.failed||result.errors.length)process.exitCode=1;
