// Production Worker + native IndexedDB. UI timing and controlled parallel behavior are separate cases.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [pw,fixtures,outArg,url='http://127.0.0.1:4309/lieguo-zhengtu-origin/']=process.argv.slice(2),out=path.resolve(outArg);
const samplesCount=Number(process.env.P0C9_LATENCY_SAMPLES??8);assert.ok(Number.isInteger(samplesCount)&&samplesCount>=2&&samplesCount<=100);
await fs.mkdir(out,{recursive:true});const manifest=JSON.parse(await fs.readFile(path.join(fixtures,'manifest.json'),'utf8'));
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href),browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const result={inputHead:manifest.head,inputSourceTreeHash:manifest.sourceTreeHash,browser:browser.version(),platform:'headless Chromium on Linux; native IndexedDB and production Worker',cases:[],errors:[],notVerified:['physical Android','mobile GPU FPS','physical-device memory','private user saves'],concurrency:process.env.P0C9_CONCURRENT??'not recorded; do not infer an idle host',mode:process.env.P0C9_LATENCY_ONLY==='1'?'common UI latency baseline comparator':'candidate latency and parallel functionality'};
const identityPage=await browser.newPage();result.testedRelease=await (await identityPage.request.get(url+'version.json')).json();await identityPage.close();
async function context(mobile=false){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await ctx.newPage();
 page.on('pageerror',e=>result.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>{
  window.__runtime=null;window.__messages=[];window.__sent=[];window.__timings={};window.__pointer=0;
  document.addEventListener('pointerdown',e=>{if(e.target.closest('button')?.textContent==='確認改名')window.__pointer=performance.now();},true);
  const observe=()=>new MutationObserver(()=>{const heading=document.querySelector('.city-title-row h1')?.textContent;for(const r of Object.values(window.__timings))if(!r.renderedAt&&heading===r.name)r.renderedAt=performance.now();}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  if(document.documentElement)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});
  const Native=window.Worker;window.Worker=class extends Native{
   constructor(url,options){super(url,options);if(String(url).includes('runtime.worker')){window.__runtime=this;this.addEventListener('message',e=>{if(e.data.type!=='state')window.__messages.push(e.data);if(e.data.type==='commandAck'){const t=window.__timings[e.data.ack.commandId];if(t){t.ackAt=performance.now();t.status=e.data.ack.status;}}});}}
   postMessage(request,...rest){if(request.type==='command'){window.__sent.push(request);if(request.order.payload.type==='city.rename'&&!window.__timings[request.order.commandId])window.__timings[request.order.commandId]={name:request.order.payload.name,start:window.__pointer||performance.now(),postedAt:performance.now()};}return super.postMessage(request,...rest);}
  };
 });
 await page.goto(url);await page.locator('input[type=file]').waitFor({state:'attached'});return{ctx,page};
}
async function current(page){return page.evaluate(async()=>{
 const name=(await indexedDB.databases()).find(x=>x.name?.includes('formal'))?.name;if(!name)throw Error('No native Formal DB');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const row=await new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return row.data.snapshot;
});}
async function load(page,name){await page.locator('input[type=file]').setInputFiles(path.join(fixtures,name));await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.waitForFunction(()=>window.__messages.some(m=>m.type==='switched'));return current(page);}
async function rpc(page,request){const id='p0c9-rpc-'+crypto.randomUUID();await page.evaluate(r=>window.__runtime.postMessage(r),{...request,requestId:id});await page.waitForFunction(id=>window.__messages.some(m=>m.type==='requestDone'&&m.requestId===id),id);return page.evaluate(()=>window.__messages.filter(m=>['backups','commandAck','requestDone'].includes(m.type)).slice(-50));}
const quantile=(xs,q)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*q)-1)];
for(const speed of [1,10,50]){
 const item=manifest.fixtures.find(f=>f.name===`natural-96h-${speed}x.realm-save`),{ctx,page}=await context();
 try{
  console.log(JSON.stringify({phase:'native-start',speed}));
  assert.ok(item.owned>0,'Natural world has no legal player city; do not fabricate one');const initial=await load(page,item.name);console.log(JSON.stringify({phase:'native-loaded',speed}));await page.locator('.formal-shell').waitFor();assert.equal(initial.autonomy.agents.length,99);
  for(let i=0;i<samplesCount;i++){console.log(JSON.stringify({phase:'rename',speed,sample:i}));
   const name=`P0C9-${speed}-${i}`;await page.getByRole('button',{name:'更改城名',exact:true}).click();await page.getByLabel('城市名稱',{exact:true}).fill(name);await page.getByRole('button',{name:'確認改名',exact:true}).click();
   await page.getByRole('heading',{name,exact:true}).waitFor();
   await page.waitForFunction(()=>{const r=window.__sent.at(-1),t=window.__timings[r?.order.commandId];return t?.status==='committed'&&t.renderedAt;});
   const request=await page.evaluate(()=>window.__sent.at(-1)),saved=await current(page);assert.equal(saved.commandReceipts.filter(r=>r.commandId===request.order.commandId&&r.disposition==='applied').length,1);
  }
  const times=await page.evaluate(()=>Object.entries(window.__timings).map(([id,t])=>({id,status:t.status,ackMs:t.ackAt-t.start,renderMs:t.renderedAt-t.start}))),request=await page.evaluate(()=>window.__sent[0]);
  const duplicateCount=await page.evaluate(()=>window.__messages.filter(m=>m.type==='commandAck').length);await page.evaluate(r=>window.__runtime.postMessage(r),request);
  await page.waitForFunction(n=>window.__messages.filter(m=>m.type==='commandAck').length>n,duplicateCount);assert.equal(await page.evaluate(()=>window.__messages.filter(m=>m.type==='commandAck').at(-1).ack.status),'duplicate');
  const stale={...request,requestId:'p0c9-stale',order:{...request.order,commandId:'command:p0c9-stale-'+speed,payload:{...request.order.payload,name:'不得覆蓋新名字'}}};await rpc(page,stale);
  const staleAck=await page.evaluate(id=>window.__messages.find(m=>m.type==='commandAck'&&m.ack.commandId===id)?.ack,stale.order.commandId);assert.equal(staleAck.status,'rejected');
  await page.screenshot({path:path.join(out,`native-${speed}x.png`),fullPage:true});await page.reload();await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.getByRole('heading',{name:`P0C9-${speed}-${samplesCount-1}`,exact:true}).waitFor();const final=await current(page);
  assert.equal(final.autonomy.agents.length,99);assert.ok(final.revision>=initial.revision);
  const xs=times.map(t=>t.renderMs);result.cases.push({case:'natural UI durable rename',speed,status:'PASS',samples:times,latency:{n:xs.length,p50:quantile(xs,.5),p95:quantile(xs,.95),max:Math.max(...xs)},inputHours:96,aiRecords:99,liveAI:item.liveAI,duplicate:'duplicate',trueConflict:staleAck.reason,reload:true});
 }catch(e){result.cases.push({case:'natural UI durable rename',speed,status:'FAIL',error:String(e)});await page.screenshot({path:path.join(out,`failure-${speed}x.png`),fullPage:true});}
 await ctx.close();
}
for(const mobile of process.env.P0C9_LATENCY_ONLY==='1'?[]:[false,true]){
 const {ctx,page}=await context(mobile),item=manifest.fixtures.find(f=>f.name==='controlled-parallel.realm-save');
 try{
  await load(page,item.name);await page.locator('.formal-shell').waitFor();
  const prefix='command:ai-'+item.eventId.slice(6)+'-';let latest;const until=Date.now()+15000;
  do{latest=await current(page);if(latest.commandReceipts.filter(r=>r.commandId.startsWith(prefix)&&JSON.parse(r.fingerprint).payload.type==='army.dispatch').length===2)break;await page.waitForTimeout(100);}while(Date.now()<until);
  const departures=latest.commandReceipts.filter(r=>r.commandId.startsWith(prefix)&&JSON.parse(r.fingerprint).payload.type==='army.dispatch');assert.equal(departures.length,2);assert.ok(departures.every(r=>r.disposition==='applied'));
  assert.equal(latest.armies.filter(a=>a.ownerFactionId===item.factionId).length,2);const city=latest.cities.find(c=>c.id===item.cityId);assert.ok(city.military.units.militia>=180);assert.equal(latest.autonomy.agents.length,99);
  await page.screenshot({path:path.join(out,`parallel-${mobile?'mobile':'desktop'}.png`),fullPage:true});
  const messages=await rpc(page,{type:'backups'}),backups=messages.filter(m=>m.type==='backups').at(-1);const list=backups.items??backups.backups??backups.data;
  assert.ok(Array.isArray(list)&&list.length);const checkpoint=list.find(p=>p.gameTime===2*3600000)??list.at(-1);await rpc(page,{type:'restore',id:checkpoint.id,transitionId:'p0c9-native-recovery'});
  const restored=await current(page);assert.equal(restored.armies.filter(a=>a.ownerFactionId===item.factionId).length,0);assert.ok(restored.revision>latest.revision);
  assert.ok(departures.every(r=>restored.commandReceipts.some(s=>s.commandId===r.commandId&&s.disposition==='rolled-back')));
  result.cases.push({case:'controlled real AI parallel / native Recovery',mobile,status:'PASS',fixture:item,departures:departures.map(r=>({commandId:r.commandId,disposition:r.disposition})),remainingUnits:city.military.units,revisionBefore:latest.revision,revisionAfter:restored.revision});
 }catch(e){result.cases.push({case:'controlled real AI parallel / native Recovery',mobile,status:'FAIL',error:String(e)});await page.screenshot({path:path.join(out,`parallel-failure-${mobile}.png`),fullPage:true});}
 await ctx.close();
}
await browser.close();result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.filter(c=>c.status==='FAIL').length;
await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.failed||result.errors.length)process.exitCode=1;
