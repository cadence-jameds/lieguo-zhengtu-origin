// R4 real Chromium integration evidence. Playwright is an external test tool;
// install it outside this repository. Never write private saves to Git.
// Usage: node scripts/verify-r4-browser.mjs <playwright/index.mjs> <fixture-dir> <evidence-dir>
// Requires local dev :5174 (synthetic fixture generation) and production preview :4173.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [playwright,fixtures,out]=process.argv.slice(2);
if(!playwright||!fixtures||!out)throw Error('Expected Playwright module, synthetic fixture directory and evidence directory');
await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(path.resolve(playwright)).href);
const browser=await chromium.launch({executablePath:process.env.R4_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const result={browser:browser.version(),headless:true,viewport:{width:1440,height:1000},source:'local production build',cases:[],manualPending:['physical phone','hardware GPU FPS','B5 E1 human Delta Review','SW update from older deployed build','Day30 / 168h / 360h / 720h calibration']};
const errors=[];
const context=await browser.newContext({viewport:result.viewport,locale:'zh-TW',timezoneId:'Asia/Taipei',serviceWorkers:'block'});
await context.addInitScript(()=>{
 window.__runtime=[];window.__workers=[];
 const Native=Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);window.__workers.push(this);this.addEventListener('message',e=>{if(['commandAck','switched','loaded','switchFailed','error','backups'].includes(e.data.type))window.__runtime.push(e.data);});}
  postMessage(data,...args){if(data.type==='command')window.__lastCommand=data;return super.postMessage(data,...args);}
 };
});
const page=await context.newPage();page.setDefaultTimeout(20000);
page.on('pageerror',e=>errors.push({type:'pageerror',text:e.message}));
page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',text:m.text()});});
page.on('requestfailed',r=>{if(!r.failure()?.errorText?.includes('ERR_ABORTED'))errors.push({type:'requestfailed',url:r.url(),text:r.failure()?.errorText});});
page.on('response',r=>{if(r.status()>=400)errors.push({type:'http',url:r.url(),status:r.status()});});
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
const nav=name=>page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:name});
async function state(){return page.evaluate(async()=>{
 const name=(await indexedDB.databases()).find(d=>d.name?.includes('formal'))?.name;
 if(!name)throw Error('Formal IndexedDB missing');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const row=await new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 db.close();return row.data.snapshot;
});}
async function load(file){
 const n=await page.evaluate(()=>window.__runtime.filter(e=>e.type==='switched').length);
 if(await nav('戰役設定').count())await nav('戰役設定').click();
 else if(await page.getByRole('button',{name:'返回主畫面／結束本局',exact:true}).count())await page.getByRole('button',{name:'返回主畫面／結束本局',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles(path.join(fixtures,file));
 await page.getByRole('button',{name:'確認匯入',exact:true}).click();
 await page.waitForFunction(n=>window.__runtime.filter(e=>e.type==='switched').length>n,n);
 return state();
}
async function center(x,y){
 await nav('世界地圖').click();
 if(await page.getByRole('button',{name:'展開地圖工具',exact:true}).count())await page.getByRole('button',{name:'展開地圖工具',exact:true}).click();
 await page.getByRole('button',{name:/XY.*定位/}).click();
 await page.getByLabel('X 座標').fill(String(x));await page.getByLabel('Y 座標').fill(String(y));await page.getByRole('button',{name:'前往',exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('.map-overlay')?.dataset.armyOverlay);
 return page.locator('.map-overlay').evaluate(el=>({...el.dataset}));
}
async function ackAfter(action){const n=await page.evaluate(()=>window.__runtime.filter(e=>e.type==='commandAck').length);await action();await page.waitForFunction(n=>window.__runtime.filter(e=>e.type==='commandAck').length>n,n);return page.evaluate(()=>window.__runtime.filter(e=>e.type==='commandAck').at(-1).ack);}
async function check(name,fn){if(process.env.R4_BROWSER_FILTER&&!new RegExp(process.env.R4_BROWSER_FILTER).test(name))return;console.log('START '+name);try{const evidence=await fn();result.cases.push({name,status:'PASS',evidence});}catch(e){result.cases.push({name,status:'FAIL',error:String(e)});await shot('failure-'+result.cases.length).catch(()=>{});await page.getByRole('button',{name:'關閉對話框',exact:true}).click().catch(()=>{});}console.log(JSON.stringify(result.cases.at(-1)));await fs.writeFile(path.join(out,'browser-progress.json'),JSON.stringify(result,null,2));}
try{
 // Pure synthetic fixture generation on the dev origin. Actual checks below use production.
 const gen=await context.newPage();await gen.goto('http://127.0.0.1:5174/');
 const generated=process.env.R4_REUSE_FIXTURES?{}:await gen.evaluate(async()=>{
  const {createFormalWorld}=await import('/src/game/formal/generator.ts');
  const {enableAutonomy}=await import('/src/game/formal/autonomy.ts');
  const {submitFormalOrder}=await import('/src/game/formal/reducer.ts');
  const {encodeSave}=await import('/src/game/formal/saveCodec.ts');
  const files={};let serial=0;
  const issue=(w,p,issuer=w.playerFactionId)=>{const t=submitFormalOrder(w,{commandId:'command:r4-browser-'+(++serial),campaignId:w.campaignId,issuerId:issuer,issuedWorldTime:w.time,expectedRevision:w.revision,payload:p});if(t.ack.status!=='committed')throw Error(t.ack.reason);return t.world;};
  const build=(c,key,level)=>{c.buildings[key]=level;if(key!=='center')c.economy.slots[key]??=Object.keys(c.economy.slots).length;};
  for(const speed of [1,10,50])for(const dense of [false,true]){
   let w=createFormalWorld({campaign:'r4-browser-'+speed+'-'+dense,seed:92049,speed,offlineHours:0});enableAutonomy(w);
   if(dense){for(const c of w.cities)c.military.units={militia:30};for(let i=0;i<100;i++)w=issue(w,{type:'army.dispatch',cityId:w.cities[i].id,mission:'raid',target:{kind:'city',cityId:w.cities[i===99?1:i+1].id},units:{militia:10}},w.cities[i].ownerFactionId);}
   const c=w.cities[0];build(c,'warehouse.0',15);build(c,'residence',15);c.housing=30400;c.population=15000;build(c,'townhall',5);c.stock={food:50000,wood:50000,stone:50000,gold:50000};
   files[`governance-${speed}-${dense}.realm-save`]=await encodeSave(w);
  }
  return files;
 });
 for(const [name,value]of Object.entries(generated))await fs.writeFile(path.join(fixtures,name),JSON.stringify(value));await gen.close();
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 await check('production fresh new campaign',async()=>{
  await shot('01-production-home');await page.getByRole('button',{name:'開始新遊戲',exact:true}).click();await page.getByLabel('領主名稱',{exact:true}).fill('R4 Chromium');await page.getByRole('button',{name:'升起旗幟 · 開始戰役',exact:true}).click();await page.locator('.game-shell').waitFor();const w=await state();assert.equal(w.factions.length,100);assert.equal(w.autonomy.agents.length,99);assert.equal(w.worldLayer.wildSites.length,432);assert.equal(w.cities[0].population,200);await shot('02-fair-new-campaign');return {campaign:w.campaignId,factions:100,AI:99,wildSites:432,population:200};
 });
 await check('existing empire map panel and public B6 UI',async()=>{
  const w=await load('controlled-before.realm-save');await nav('天下勢力').click();assert.match(await page.locator('.diplomacy-view').innerText(),/舊帝國/);await shot('03-B6-politics');await center(w.cities[0].x,w.cities[0].y);await page.locator('.map-overlay').press('Enter');await page.locator('.target-ownership').waitFor();const ownership=await page.locator('.target-ownership').innerText();assert.match(ownership,/舊軍團/);assert.match(ownership,/舊帝國/);assert.doesNotMatch(ownership,/尚未開放/);await shot('03b-target-politics-fixed');await page.getByRole('button',{name:'關閉對話框',exact:true}).last().click();await page.getByRole('button',{name:/帝國.*版圖/}).click();const text=await page.locator('.map-float-panel').innerText();assert.match(text,/舊帝國/);assert.doesNotMatch(text,/尚未開放/);await shot('04-empire-fixed');return {empire:w.politics.empires[0],text,ownership};
 });
 await check('R3 Browser Delta governance 1/10/50X low/100 armies',async()=>{
  const matrix=[];
  for(const speed of [1,10,50])for(const dense of [false,true]){
   const initial=await load(`governance-${speed}-${dense}.realm-save`);await nav('治理方針').click();
   if(await page.getByRole('button',{name:'委任總督',exact:true}).count())assert.equal((await ackAfter(()=>page.getByRole('button',{name:'委任總督',exact:true}).click())).status,'committed');
   const replies=[];
   for(let i=0;i<6;i++){await page.locator('.governance-controls select').selectOption(i%2?'reserve':'economy');const ack=await ackAfter(()=>page.locator('.governance-controls button').first().click());assert.equal(ack.status,'committed');replies.push(ack);}
   await shot(`05-governance-${speed}-${dense}`);
   assert.equal((await ackAfter(()=>page.getByRole('button',{name:'停止總督',exact:true}).click())).status,'committed');
   const after=await state(),g=after.governors.find(g=>g.cityId===initial.cities[0].id);assert.equal(g.enabled,false);assert.equal(g.eventId,null);assert(!after.events.some(e=>e.type==='governance.decide'&&e.cityId===g.cityId));
   matrix.push({speed,dense,initialArmies:initial.armies.length,replies,governor:g});
  }
  return matrix;
 });
 await check('governance duplicate and stale revision guards',async()=>{
  await load('governance-1-false.realm-save');await nav('治理方針').click();await ackAfter(()=>page.getByRole('button',{name:'委任總督',exact:true}).click());await page.locator('.governance-controls select').selectOption('reserve');await ackAfter(()=>page.locator('.governance-controls button').first().click());
  const req=await page.evaluate(()=>window.__lastCommand),before=await state();
  const send=r=>page.evaluate(r=>window.__workers.find(w=>!String(w).includes('raster'))?.postMessage(r),r);
  const duplicate=await ackAfter(()=>send(req));assert.equal(duplicate.status,'duplicate');const replayed=await state();assert.equal(replayed.governors[0].policy,before.governors[0].policy);assert.equal(replayed.governors[0].budget,before.governors[0].budget);assert.equal(replayed.commandReceipts.filter(r=>r.commandId===req.order.commandId).length,1);
  const stale={...req,order:{...req.order,commandId:'command:r4-stale-setting',payload:{...req.order.payload,policy:'military'}}};
  const rejected=await ackAfter(()=>send(stale));assert.equal(rejected.status,'rejected');assert.match(rejected.reason,/再次套用/);
  const economy=await ackAfter(()=>send({...stale,order:{...stale.order,commandId:'command:r4-stale-cost',payload:{type:'field.upgrade',cityId:before.cities[0].id,slot:0}}}));assert.equal(economy.status,'rejected');await shot('06-stale-guard');return {duplicate,rejected,economy};
 });
 await check('real IndexedDB export, reload, corrupt import and Recovery',async()=>{
  await load('governance-1-false.realm-save');await nav('治理方針').click();await ackAfter(()=>page.getByRole('button',{name:'委任總督',exact:true}).click());await page.locator('.governance-controls select').selectOption('reserve');let applied=await ackAfter(()=>page.locator('.governance-controls button').first().click());
  await nav('戰役設定').click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'完整備份',exact:true}).click()]);const exported=path.join(out,'synthetic-export.realm-save');await download.saveAs(exported);const before=await state();await page.reload();await page.waitForFunction(()=>window.__runtime.some(r=>r.type==='loaded'));const loaded=await state();assert.equal(loaded.campaignId,before.campaignId);assert.deepEqual(loaded.governors,before.governors);
  const buttons=await page.getByRole('button').allTextContents();const resume=page.getByRole('button',{name:'載入進度',exact:true}).first();if(await resume.count())await resume.click();else throw Error('Resume button unavailable: '+buttons.join(','));
  if(await page.getByRole('button',{name:'回到城市',exact:true}).count())await page.getByRole('button',{name:'回到城市',exact:true}).click();await nav('治理方針').click();await ackAfter(()=>page.getByRole('button',{name:'停止總督',exact:true}).click());await nav('城市建設').click();await page.getByRole('button',{name:'更改城名',exact:true}).click();await page.getByLabel('城市名稱',{exact:true}).fill('R4 Recovery Rename');applied=await ackAfter(()=>page.getByRole('button',{name:'確認改名',exact:true}).click());await nav('戰役設定').click();await page.getByRole('button',{name:'查看回復點',exact:true}).click();await page.locator('.backup-list button').last().waitFor();await page.locator('.backup-list button').last().click();const n=await page.evaluate(()=>window.__runtime.filter(e=>e.type==='switched').length);await page.getByRole('button',{name:'確認回復',exact:true}).click();await page.waitForFunction(n=>window.__runtime.filter(e=>e.type==='switched').length>n,n);const restored=await state();assert(restored.revision>loaded.revision);assert(restored.commandReceipts.some(r=>r.commandId===applied.commandId&&r.disposition==='rolled-back'));await shot('07-recovery');
  const bad=JSON.parse(await fs.readFile(exported,'utf8'));bad.checksum='0'.repeat(64);await fs.writeFile(path.join(fixtures,'corrupt.realm-save'),JSON.stringify(bad));await nav('戰役設定').click();const failed=await page.evaluate(()=>window.__runtime.filter(e=>e.type==='switchFailed').length);await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'corrupt.realm-save'));await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.waitForFunction(n=>window.__runtime.filter(e=>e.type==='switchFailed').length>n,failed);const intact=await state();assert.equal(intact.campaignId,restored.campaignId);assert.deepEqual(intact.governors,restored.governors);await shot('08-corrupt-import-rejected');return {beforeRevision:before.revision,reloadRevision:loaded.revision,recoveryRevision:restored.revision,rolledBack:applied.commandId,corruptionRejected:true};
 });
 await check('formal 100-owner world movement in Chromium',async()=>{
  const w=await load('governance-50-true.realm-save');await nav('世界地圖').click();await page.getByRole('button',{name:'展開地圖工具',exact:true}).click();await page.getByRole('button',{name:'全區',exact:true}).click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.map-overlay')?.dataset.armyOverlay??'{}').markers===100);const before=await page.locator('.map-overlay').evaluate(el=>({...el.dataset}));await page.waitForTimeout(1000);const after=await page.locator('.map-overlay').evaluate(el=>({...el.dataset}));await shot('09-100-owner-march');assert.equal(w.armies.length,100);return {formalArmies:w.armies.length,before,after};
 });
 await check('AI vs AI Lv15 ongoing swords and reduced motion',async()=>{
  const w=await load('ai-siege-active.realm-save'),target=w.cities.find(c=>c.id===w.combat.battles[0].cityId);await center(target.x,target.y);await page.waitForFunction(()=>JSON.parse(document.querySelector('.map-overlay').dataset.armyOverlay).visibleBattles===1);await shot('10-AI-Lv15-siege');const before=await page.locator('.map-overlay').evaluate(el=>({...el.dataset}));await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(500);const reduced=await page.locator('.map-overlay').evaluate(el=>({...el.dataset}));assert.equal(JSON.parse(reduced.armyOverlay).visibleBattles,1);await shot('11-siege-reduced-motion');await page.emulateMedia({reducedMotion:'no-preference'});return {battle:w.combat.battles[0],before,reduced};
 });
 await check('AI siege final removes swords once, reload never replays terminal badge',async()=>{
  const w=await load('ai-siege-near-final.realm-save'),b=w.combat.battles[0],target=w.cities.find(c=>c.id===b.cityId);await center(target.x,target.y);await page.waitForFunction(()=>JSON.parse(document.querySelector('.map-overlay').dataset.armyOverlay).visibleBattles===1);await shot('12-siege-round11');await page.waitForFunction(()=>JSON.parse(document.querySelector('.map-overlay').dataset.armyOverlay).visibleBattles===0,null,{timeout:30000});const ended=await state();assert.equal(ended.combat.receipts.filter(r=>r.kind==='final'&&r.battleId===b.id).length,1);await shot('13-siege-final');await load('ai-siege-final.realm-save');await center(target.x,target.y);await page.waitForTimeout(300);const data=await page.locator('.map-overlay').evaluate(el=>({...el.dataset}));assert.equal(JSON.parse(data.armyOverlay).visibleBattles,0);assert.equal(JSON.parse(data.armyOverlay).visibleImpacts,0);await shot('14-final-load-no-replay');return {battleId:b.id,final:ended.combat.receipts.find(r=>r.kind==='final'&&r.battleId===b.id),data};
 });
 await check('B7 extinction and real UI rebirth',async()=>{
  const w=await load('controlled-extinct.realm-save');await page.getByRole('heading',{name:'勢力已滅國',exact:true}).waitFor();await shot('15-player-extinct');assert.equal(await page.getByRole('button',{name:/候選區域/}).count(),3);const ack=await ackAfter(()=>page.getByRole('button',{name:/候選區域 1/}).click());assert.equal(ack.status,'committed');await page.locator('.game-shell').waitFor();const reborn=await state(),city=reborn.cities.find(c=>c.ownerFactionId===w.playerFactionId);assert.equal(city.population,400);assert.deepEqual(city.military.units,{});assert(reborn.factions[0].protectionUntil-reborn.time<=48*3600000);assert(reborn.factions[0].protectionUntil-reborn.time>48*3600000-10000);await shot('16-rebirth');return {ack,city,age:reborn.factions[0].age,protectionUntil:reborn.factions[0].protectionUntil,exiles:reborn.extinction.sites};
 });
 await check('mobile viewport real touch pan/pinch and reduced motion',async()=>{
  const w=await load('governance-1-false.realm-save');await center(w.cities[0].x,w.cities[0].y);await page.setViewportSize({width:390,height:844});const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});const canvas=page.locator('.map-overlay'),box=await canvas.boundingBox();const read=()=>canvas.evaluate(el=>JSON.parse(el.dataset.camera));const before=await read(),x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+80,y:y+40,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);const panned=await read();assert.notDeepEqual(panned,before);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);const pinched=await read();assert(pinched.z>panned.z);await page.emulateMedia({reducedMotion:'reduce'});await shot('17-mobile-touch-reduced');return {viewport:{width:390,height:844},before,panned,pinched,physicalPhone:'MANUAL PENDING'};
 });
 // New PWA install/offline launch is distinct from simulation offline equivalence.
 await check('production PWA install and network-offline reload',async()=>{
  const sw=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',serviceWorkers:'allow'}),p=await sw.newPage();try{await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await sw.setOffline(true);await p.reload();await p.getByRole('button',{name:'開始新遊戲',exact:true}).waitFor();await p.screenshot({path:path.join(out,'18-PWA-offline-home.png')});return {controlled:true,offlineHome:true,scope:'new local PWA install; older-version update MANUAL PENDING'};}finally{await sw.close();}
 });
 result.errors=errors;result.success=result.cases.every(c=>c.status==='PASS')&&errors.length===0;
}catch(e){result.success=false;result.fatal=String(e);}
finally{await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));await fs.writeFile(path.join(out,'console.json'),JSON.stringify(errors,null,2));await browser.close();}
console.log(JSON.stringify({success:result.success,cases:result.cases.map(c=>({name:c.name,status:c.status,error:c.error})),errors:errors.length,fatal:result.fatal}));
if(!result.success)process.exitCode=1;
