// Native browser, production application, official Worker commands and IndexedDB.
// node scripts/verify-modern-funding-browser.mjs <playwright/index.mjs> <fixture-dir> <evidence-dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
const [pw,fixtures,out]=process.argv.slice(2),url=process.env.RESEARCH_BROWSER_URL??'http://127.0.0.1:4174/lieguo-zhengtu-origin/';
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href),plan=JSON.parse(await fs.readFile(path.join(fixtures,'plan.json'),'utf8'));
await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const {settleCity}=await server.ssrLoadModule('/src/game/formal/economy.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const result={browser:browser.version(),source:'synthetic three-city fixture; native Worker, IndexedDB, production Pages build',cases:[],errors:[]};
async function state(page){return page.evaluate(async()=>{const name=(await indexedDB.databases()).find(d=>d.name?.includes('formal'))?.name;if(!name)return null;const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const row=await new Promise((r,j)=>{const q=db.transaction('saves').objectStore('saves').get('current');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();return row?.data?.snapshot;});}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:88});}
const project=w=>w.researchProjects.find(p=>p.ownerFactionId===w.playerFactionId&&p.techId===plan.techId);
const summary=w=>({time:w.time,revision:w.revision,stocks:plan.cityIds.map(id=>({id,stock:w.cities.find(c=>c.id===id).stock})),project:project(w),queue:w.factions.find(f=>f.id===w.playerFactionId).researchQueue,researchEvents:w.events.filter(e=>e.type==='research.complete')});
async function fundingUI(page,p){const actual=await page.locator('.research-funding .cost').evaluateAll(els=>els.map(el=>[...el.children].map(s=>Number(s.textContent.replace(/[^0-9]/g,'')))));const keys=Object.keys(plan.cost);assert.deepEqual(actual,[keys.map(r=>p.contributedResources[r]),keys.map(r=>p.requiredResources[r]),keys.map(r=>p.requiredResources[r]-p.contributedResources[r])]);return actual;}
async function settled(page,predicate){for(let i=0;i<160;i++){const w=await state(page);if(w&&predicate(w))return w;await page.waitForTimeout(100);}throw Error('Durable research state did not arrive');}
for(const [width,height] of [[1600,1000],[320,568],[360,640],[390,844],[430,932]]){
 const mobile=width<761,name=width+'x'+height,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,locale:'zh-TW',timezoneId:'Asia/Taipei',serviceWorkers:'block'}),page=await context.newPage(),trace=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>result.errors.push({name,error:e.message}));
 try{
  await page.goto(url);await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'abc.realm-save'));await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();
  const nav=mobile?page.locator('.mobile-nav [data-nav-id=research]'):page.locator('.left-rail nav button').filter({hasText:'科技研發'});if(mobile)await nav.scrollIntoViewIfNeeded();await nav.click();await page.getByRole('button',{name:'現代科研',exact:true}).click();
  const node=page.locator('[data-tech-id="'+plan.techId+'"]');await node.scrollIntoViewIfNeeded();assert.equal(await node.getAttribute('data-state'),'available');assert.match(await node.innerText(),/可建立籌資/);assert.equal(await node.evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(231, 186, 77)');assert.match(await node.locator('.formal-art').evaluate(e=>getComputedStyle(e).filter),/brightness\(0.36\)/);await shot(page,name+'-available');
  await node.locator('button').click();const detail=page.locator(mobile?'dialog.research-sheet':'.research-detail');assert.equal(await detail.getByRole('button',{name:'建立科研籌資',exact:true}).isEnabled(),true);
  if(mobile){const sheet=await detail.boundingBox(),bar=await page.locator('.mobile-nav').boundingBox();assert.ok(sheet.y>=0&&sheet.y+sheet.height<=bar.y+1);}
  await shot(page,name+'-create-detail');const initial=await state(page);assert.ok(Object.keys(plan.cost).some(r=>initial.cities.find(c=>c.id===plan.cityIds[0]).stock[r]<plan.cost[r]));
  await detail.getByRole('button',{name:'建立科研籌資',exact:true}).click();let w=await settled(page,w=>project(w)?.phase==='funding');assert.equal(project(w).startedAt,undefined);assert.equal(project(w).completionEventId,null);assert.deepEqual(project(w).contributedResources,{food:0,wood:0,stone:0,gold:0});
  // Funding creation takes no money; settle the official pre-command stock to the new world time.
  for(const id of plan.cityIds){const copy=structuredClone(initial),c=copy.cities.find(c=>c.id===id);if(id===plan.cityIds[0])settleCity(copy,c,w.time);assert.deepEqual(w.cities.find(c=>c.id===id).stock,c.stock);}
  trace.push({stage:'created',...summary(w)});if(mobile)await page.getByRole('button',{name:'關閉對話框',exact:true}).click();
  const picker=page.locator('select[aria-label="切換目前城市"]').first();
  for(const i of [0,1,2]){
   await picker.selectOption(plan.cityIds[i]);await page.locator('.research-funding').waitFor();assert.equal(await page.locator('.research-countdown').count(),0);assert.match(await page.locator('.research-current').innerText(),/籌資中/);
   const previous=await state(page),before=project(previous),ui=await fundingUI(page,before);trace.push({stage:'city-'+i+'-before',ui,...summary(previous)});
   for(const r of Object.keys(plan.cost))await page.getByRole('spinbutton',{name:'科研投入'+r,exact:true}).fill(String(plan.parts[i][r]));
   const button=page.getByRole('button',{name:'投入所選科研資源',exact:true});await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();if(mobile){const bar=await page.locator('.mobile-nav').boundingBox();assert.ok(b.y+b.height<=bar.y+1,'contribute action clear of bottom nav');}
   assert.equal(await button.isEnabled(),true);await shot(page,name+'-city-'+['A','B','C'][i]+'-before');await button.click();
   w=await settled(page,w=>project(w)?.contributions.length===i+1);const p=project(w),entry=p.contributions[i];assert.equal(entry.sourceCityId,plan.cityIds[i]);assert.equal(entry.sourceFactionId,w.playerFactionId);assert.deepEqual(entry.resources,plan.parts[i]);
   for(const id of plan.cityIds){const expected=structuredClone(previous),c=expected.cities.find(c=>c.id===id);if(id===plan.cityIds[i]){settleCity(expected,c,w.time);for(const r of Object.keys(plan.cost))c.stock[r]-=plan.parts[i][r];}assert.deepEqual(w.cities.find(c=>c.id===id).stock,c.stock);}
   for(const r of Object.keys(plan.cost))assert.equal(p.contributedResources[r],before.contributedResources[r]+plan.parts[i][r]);trace.push({stage:'city-'+i+'-after',...summary(w)});
   if(i<2){assert.equal(p.phase,'funding');assert.equal(p.startedAt,undefined);assert.equal(p.completionEventId,null);assert.equal(w.events.filter(e=>e.type==='research.complete').length,0);assert.equal(await page.locator('.research-countdown').count(),0);await picker.selectOption(plan.cityIds[(i+1)%3]);await page.locator('.research-funding').waitFor();await fundingUI(page,p);}
   await shot(page,name+'-city-'+['A','B','C'][i]+'-after');
  }
  const p=project(w);assert.equal(p.phase,'researching');assert.deepEqual(p.contributedResources,plan.cost);assert.equal(w.events.filter(e=>e.type==='research.complete').length,1);assert.equal(p.startedAt,w.time);assert.equal(w.events.find(e=>e.type==='research.complete').at,p.startedAt+p.durationSnapshot.durationMs);
  await page.locator('.research-current .research-countdown').waitFor();assert.match(await page.locator('.research-current').innerText(),/現實時間/);assert.equal(await page.locator('.research-funding').count(),0);assert.equal(await page.locator('.top-progress-research').count(),0);assert.equal(await page.locator('.research-view [role=progressbar]').count(),0);assert.equal(await node.getAttribute('data-state'),'active');
  const countdown=await page.locator('.research-current').textContent();await page.waitForFunction(old=>document.querySelector('.research-current')?.textContent!==old,countdown);await node.scrollIntoViewIfNeeded();await shot(page,name+'-researching');
  result.cases.push({name,status:'PASS',canEstablishWithoutFullCityStock:true,threeRealCityDebits:true,noLogistics:true,fundingHasNoCountdown:true,oneCompletionEvent:true,realCountdown:true,trace});
 }catch(e){result.cases.push({name,status:'FAIL',error:String(e),trace});await shot(page,name+'-FAIL').catch(()=>{});}finally{await context.close();}console.log(JSON.stringify({name,status:result.cases.at(-1).status,error:result.cases.at(-1).error}));
}
await browser.close();await server.close();result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.length-result.passed;await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));if(result.failed||result.errors.length)process.exitCode=1;
