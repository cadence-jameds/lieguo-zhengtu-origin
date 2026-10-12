import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {load,state,center} from './scenarios.mjs';
const outDir=path.dirname(fileURLToPath(import.meta.url)),{chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-TW',timezoneId:'Asia/Taipei',serviceWorkers:'block'});
await context.addInitScript(()=>{
 window.__runtime=[];window.__workerUrls=[];
 const Native=Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);window.__workerUrls.push(String(args[0]));this.addEventListener('message',e=>{if(e.data.type==='commandAck'||e.data.type==='switched')window.__runtime.push(e.data);});}
  postMessage(data,...args){if(data.type==='command'){window.__commandWorker=this;window.__runtime.push({...data,direction:'request'});}return super.postMessage(data,...args);}
 };
});
const page=await context.newPage(),consoleLog=[],result={matrix:[]};
page.on('console',m=>consoleLog.push({type:'console',level:m.type(),text:m.text()}));
page.on('pageerror',e=>consoleLog.push({type:'pageerror',message:e.message}));
page.on('requestfailed',r=>consoleLog.push({type:'requestfailed',url:r.url(),failure:r.failure()}));
page.on('response',r=>{if(r.status()>=400)consoleLog.push({type:'http-error',url:r.url(),status:r.status()});});
page.setDefaultTimeout(15000);
const shot=name=>page.screenshot({path:path.join(outDir,name),fullPage:true});
const nav=name=>page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:name});
const apply=async policy=>{await page.locator('.governance-controls select').selectOption(policy);await page.locator('.governance-controls button').first().click();await page.waitForFunction(()=>!document.querySelector('.governance-controls button').disabled);const ack=await page.evaluate(()=>window.__runtime.filter(r=>r.type==='commandAck').at(-1).ack);if(ack.status!=='committed')throw Error(JSON.stringify(ack));return ack;};
const protocol=async request=>{await page.evaluate(r=>window.__commandWorker.postMessage({...r,requestId:crypto.randomUUID()}),request);await page.waitForFunction(id=>window.__runtime.filter(r=>r.type==='commandAck').at(-1)?.ack.commandId===id,request.order.commandId);return page.evaluate(()=>window.__runtime.filter(r=>r.type==='commandAck').at(-1).ack);};
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
try{
 await page.goto('http://127.0.0.1:5174/',{waitUntil:'networkidle'});await shot('final-production-home.png');
 await page.getByRole('button',{name:'開始新遊戲',exact:true}).click();await page.getByLabel('領主名稱',{exact:true}).fill('R3 Final Chrome');await page.getByRole('button',{name:'升起旗幟 · 開始戰役',exact:true}).click();await page.locator('.game-shell').waitFor();
 for(const speed of [1,10,50])for(const dense of [false,true]){
  const initial=await load(page,outDir,`matrix-${speed}-${dense}.realm-save`);await nav('治理方針').click();const replies=[];
  for(let i=0;i<6;i++)replies.push(await apply(i%2?'reserve':'economy'));
  const applied=await state(page);await shot(`governance-final-${speed}x-${dense?'100':'low'}.png`);
  await page.getByRole('button',{name:'停止總督',exact:true}).click();await page.getByRole('button',{name:'委任總督',exact:true}).waitFor();const stopped=await state(page),g=stopped.governors.find(g=>g.cityId===initial.cities[0].id);
  if(g.enabled||g.eventId||stopped.events.some(e=>e.type==='governance.decide'&&e.cityId===g.cityId))throw Error('governance stop');
  result.matrix.push({speed,dense,initialArmies:initial.armies.length,replies,appliedGovernor:applied.governors.find(g=>g.cityId===g.cityId&&g.ownerFactionId===initial.playerFactionId),stoppedGovernor:g,receipts:stopped.commandReceipts.filter(r=>replies.some(a=>a.commandId===r.commandId))});
 }
 await load(page,outDir,'matrix-1-false.realm-save');await nav('治理方針').click();await apply('reserve');await page.waitForTimeout(200);
 const request=await page.evaluate(()=>window.__runtime.filter(r=>r.direction==='request').at(-1)),before=await state(page);
 // Wait for the new acknowledgement, rather than matching the earlier same-ID ack.
 await page.evaluate(()=>{window.__runtime=[];});const replay=await protocol(request),after=await state(page);
 if(replay.status!=='duplicate'||JSON.stringify(before.governors)!==JSON.stringify(after.governors)||JSON.stringify(before.cities[0].stock)!==JSON.stringify(after.cities[0].stock))throw Error('duplicate replay changed governance or stock');
 const stale={...request,order:{...request.order,commandId:'command:stale-final-'+crypto.randomUUID(),payload:{...request.order.payload,policy:'military'}}};const rejected=await protocol(stale),unchanged=await state(page);
 if(rejected.status!=='rejected'||!rejected.reason.includes('再次套用')||unchanged.governors[0].policy!=='reserve')throw Error('stale setting overwrite');
 const economic={...stale,order:{...stale.order,commandId:'command:economic-stale-'+crypto.randomUUID(),payload:{type:'field.upgrade',cityId:before.cities[0].id,slot:0}}};const economicAck=await protocol(economic);if(economicAck.status!=='rejected')throw Error('economic stale command bypass');
 result.safety={replay,rejected,economicAck,beforeGovernor:before.governors[0],afterGovernor:after.governors[0],stockBefore:before.cities[0].stock,stockAfter:after.cities[0].stock};await shot('governance-stale-guard.png');
 await load(page,outDir,'civilians.realm-save');const meta=JSON.parse(await fs.readFile(path.join(outDir,'scenario-metadata.json'),'utf8'));
 await page.evaluate(()=>{window.__flowPaints=[];window.__civilianPaints={};const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(text==='流')window.__flowPaints.push({at:performance.now(),x:args[0],y:args[1]});if(['商','拓','工'].includes(text))window.__civilianPaints[text]={x:args[0],y:args[1]};return original.call(this,text,...args);};});
 await center(page,meta.civilians.home.x-6,meta.civilians.home.y-5);const civilianBefore=await page.evaluate(()=>window.__civilianPaints);await shot('civilian-final-before.png');await page.waitForTimeout(2500);const civilianAfter=await page.evaluate(()=>window.__civilianPaints);await shot('civilian-final-after.png');
 for(const glyph of ['商','拓','工'])if(!civilianBefore[glyph]||JSON.stringify(civilianBefore[glyph])===JSON.stringify(civilianAfter[glyph]))throw Error('civilian glyph did not move: '+glyph);
 await center(page,meta.civilians.exile.x,meta.civilians.exile.y);if(await page.getByRole('button',{name:/隱藏.*標示/}).count())await page.getByRole('button',{name:/隱藏.*標示/}).click();await page.evaluate(()=>{window.__flowPaints=[];});await page.getByRole('button',{name:'放大地圖',exact:true}).click();await page.waitForTimeout(250);const flow=await page.evaluate(()=>window.__flowPaints);if(!flow.length)throw Error('hidden-label exile lost');await shot('exile-labels-off-fixed.png');result.exile={labelsEnabled:false,paintCount:flow.length,paint:flow.at(-1),site:meta.civilians.exile};result.civilian={before:civilianBefore,after:civilianAfter};
 result.browser=browser.version();result.url=page.url();result.workers=await page.evaluate(()=>window.__workerUrls);result.serviceWorkers='blocked in this fresh verification context to ensure final build';
 const errors=consoleLog.filter(r=>r.type!=='console'||r.level==='error');if(errors.length)throw Error('final Chrome errors: '+JSON.stringify(errors));result.success=true;
 console.log(JSON.stringify({success:true,browser:result.browser,matrix:result.matrix.map(r=>({speed:r.speed,dense:r.dense,armies:r.initialArmies,committed:r.replies.length})),safety:result.safety,exilePaints:flow.length,workers:result.workers}));
}catch(e){result.success=false;result.error=String(e);console.error(e);process.exitCode=1;await shot('final-chrome-failure.png').catch(()=>{});}
finally{await fs.writeFile(path.join(outDir,'final-chrome.json'),JSON.stringify(result,null,2));await fs.writeFile(path.join(outDir,'final-console.json'),JSON.stringify(consoleLog,null,2));await context.tracing.stop({path:path.join(outDir,'final-chrome-trace.zip')});await browser.close();}
