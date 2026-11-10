// Native Chromium/IndexedDB/Worker verification against local Vite source.
// Creates only ignored harness files and synthetic browser profiles; never uploads saves.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [pw,out='artifacts/b10-browser']=process.argv.slice(2);if(!pw)throw Error('Usage: <external playwright module> [output]');
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href),base=process.env.B10_BROWSER_URL??'http://127.0.0.1:5173';
await fs.mkdir('artifacts/b10-harness',{recursive:true});await fs.mkdir(out,{recursive:true});
await fs.writeFile('artifacts/b10-harness/index.html','<!doctype html><html><body>Native durable command test harness</body></html>');
await fs.writeFile('artifacts/b10-harness/worker.js',`
let fault='',faultName='AbortError',noAck=false,holdDigest=false;
const rawPost=self.postMessage.bind(self);self.postMessage=(value,...rest)=>{if(noAck&&value.type==='commandAck')return;rawPost(value,...rest);};
const put=IDBObjectStore.prototype.put,add=IDBObjectStore.prototype.add;
function write(original,value,...args){
 const point=this.name==='Inbox'?(value.state==='committed'?'result-write':'inbox-write'):this.name==='RuntimeMeta'?'metadata-write':this.name==='BattleReports'?'report-write':this.name==='backups'?'backup-write':value.id==='current'?'world-write':value.id==='authority'?'authority-write':'';
 if(point&&fault===point){fault='';throw new DOMException('native injected '+point,faultName);}
 return original.call(this,value,...args);
}
IDBObjectStore.prototype.put=function(v,...args){return write.call(this,put,v,...args);};IDBObjectStore.prototype.add=function(v,...args){return write.call(this,add,v,...args);};
const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=(...args)=>holdDigest?new Promise(()=>{}):digest(...args);
self.addEventListener('message',e=>{if(e.data.type!=='harness-control')return;e.stopImmediatePropagation();fault=e.data.fault??'';faultName=e.data.faultName??'AbortError';noAck=!!e.data.noAck;holdDigest=!!e.data.holdDigest;rawPost({type:'harness-ready'});});
globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();await import('/src/game/runtime.worker.ts');rawPost({type:'harness-booted'});
`);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const report={browser:browser.version(),source:'local Vite source; native IndexedDB, real dedicated Worker; synthetic data only',cases:[],errors:[],receiptTimingMs:[],android:'physical device pending; emulation is not device acceptance'};
const contexts=[];
const run=async(name,fn)=>{const start=Date.now();try{const data=await fn();report.cases.push({...data,name,status:'PASS',ms:Date.now()-start});}catch(error){report.cases.push({name,status:'FAIL',error:String(error)});throw error;}finally{await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));}};
async function harness(){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.route('**/artifacts/b10-harness/index.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Native harness</body></html>'}));await page.goto(base+'/artifacts/b10-harness/index.html');await page.evaluate(async()=>{
 globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();const p=await import('/src/game/persistence.ts'),f=await import('/src/game/formal/fixture.ts'),d=await import('/src/game/durableCommands.ts');
 window.lab={p,f,d,messages:[],worker:null,timings:[],sentAt:{}};
 const s=new p.FormalPersistence();await s.acquireWriter();window.lab.world=await s.start(f.createFormalFixture({research:true}));s.db.close();
 window.lab.boot=()=>{const w=new Worker('/artifacts/b10-harness/worker.js',{type:'module'});window.lab.worker=w;window.lab.messages=[];w.onmessage=e=>{window.lab.messages.push(e.data);if(e.data.type==='commandDurable'){const at=window.lab.sentAt[e.data.row.commandId];if(at!==undefined)window.lab.timings.push(performance.now()-at);}};w.onerror=e=>window.lab.messages.push({type:'harness-error',text:e.message});};
 window.lab.order=(id,name)=>{const w=window.lab.world;return{commandId:'command:'+id,campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name}};};
 window.lab.sendOrder=(id,name)=>{const order=window.lab.order(id,name);window.lab.sentAt[order.commandId]=performance.now();window.lab.worker.postMessage({type:'command',order,...d.captureIntent(window.lab.world,order),requestId:id});return order;};
 window.lab.boot();
 });await page.waitForFunction(()=>window.lab.messages.some(m=>m.type==='harness-booted'));await page.evaluate(()=>window.lab.worker.postMessage({type:'load',requestId:'load'}));await done(page,'load');await page.evaluate(()=>{window.lab.world=window.lab.messages.filter(m=>m.type==='state').at(-1).world;});return{context,page};}
async function done(page,id){await page.waitForFunction(id=>window.lab.messages.some(m=>m.type==='requestDone'&&m.requestId===id),id,{timeout:30000});const errors=await page.evaluate(()=>window.lab.messages.filter(m=>m.type==='harness-error'||m.type==='error'));assert.deepEqual(errors,[]);}
async function control(page,options){await page.evaluate(options=>{window.lab.messages=window.lab.messages.filter(m=>m.type!=='harness-ready');window.lab.worker.postMessage({type:'harness-control',...options});},options);await page.waitForFunction(()=>window.lab.messages.some(m=>m.type==='harness-ready'));}
async function durable(page,id){await page.waitForFunction(id=>window.lab.messages.some(m=>m.type==='commandDurable'&&m.row.commandId==='command:'+id),id);}
try{
 await run('native T1 durable, Worker killed before T2 writes, new writer recovers original command once',async()=>{
  const {page}=await harness();await control(page,{holdDigest:true});await page.evaluate(()=>window.lab.sendOrder('restart','原始命令'));await durable(page,'restart');
  await page.evaluate(()=>{window.lab.worker.terminate();window.lab.boot();});await page.waitForFunction(()=>window.lab.messages.some(m=>m.type==='harness-booted'));await page.evaluate(()=>window.lab.worker.postMessage({type:'load',requestId:'reload'}));await done(page,'reload');await page.waitForFunction(()=>window.lab.messages.some(m=>m.type==='commandAck'));
  const data=await page.evaluate(async()=>{const s=new window.lab.p.FormalPersistence(),row=await s.commandStatus(window.lab.world.campaignId,'command:restart'),w=(await s.loadSave()).game;s.db.close();return{state:row.state,name:w.cities[0].name,effects:w.commandReceipts.filter(r=>r.commandId==='command:restart').length};});assert.deepEqual(data,{state:'committed',name:'原始命令',effects:1});report.receiptTimingMs.push(...await page.evaluate(()=>window.lab.timings));return data;
 });
 await run('native T2 success with lost Ack; result query and repeat preserve exact result',async()=>{
  const {page}=await harness();await control(page,{noAck:true});const order=await page.evaluate(()=>window.lab.sendOrder('lost','已保存原結果'));await done(page,'lost');assert.equal(await page.evaluate(()=>window.lab.messages.some(m=>m.type==='commandAck')),false);await control(page,{});
  await page.evaluate(order=>window.lab.worker.postMessage({type:'commandQuery',campaignId:order.campaignId,commandId:order.commandId,requestId:'query'}),order);await done(page,'query');const ack=await page.evaluate(()=>window.lab.messages.filter(m=>m.type==='commandAck').at(-1).ack);assert.equal(ack.status,'committed');
  await page.evaluate(order=>window.lab.worker.postMessage({type:'command',order,requestId:'repeat'}),order);await done(page,'repeat');assert.deepEqual(await page.evaluate(()=>window.lab.messages.filter(m=>m.type==='commandAck').at(-1).ack),ack);return{exactResult:true};
 });
 for(const point of ['inbox-write','backup-write','world-write','authority-write','metadata-write','result-write'])await run('native injected '+point,async()=>{
  const {page}=await harness();await control(page,{fault:point});await page.evaluate(()=>window.lab.sendOrder('fault','故障後一致'));await done(page,'fault');const data=await page.evaluate(async()=>{const s=new window.lab.p.FormalPersistence(),row=await s.commandStatus(window.lab.world.campaignId,'command:fault'),w=(await s.loadSave()).game;s.db.close();return{row:row?{state:row.state,attempts:row.attempts}:null,effects:w.commandReceipts.filter(r=>r.commandId==='command:fault').length,name:w.cities[0].name,messages:window.lab.messages.filter(m=>m.type==='commandReceiveFailed').length};});
  if(point==='inbox-write'){assert.equal(data.row,null);assert.equal(data.effects,0);assert.equal(data.messages,1);}else{assert.equal(data.row.state,'committed');assert.equal(data.row.attempts,1);assert.equal(data.effects,1);}return data;
 });
 await run('native writer epoch fences old writer; CAS rejects stale revision; exclusive Web Lock blocks second tab',async()=>{
  const {page,context}=await harness();const result=await page.evaluate(async()=>{const a=new window.lab.p.FormalPersistence(),b=new window.lab.p.FormalPersistence();await a.acquireWriter();const w=(await a.loadSave()).game;await b.acquireWriter();let fenced=false;try{await a.receiveCommand(window.lab.order('stale','舊 writer'));}catch(e){fenced=e.message.includes('寫入權');}const reducer=await import('/src/game/formal/reducer.ts'),o=window.lab.order('cas','CAS'),t=reducer.submitFormalOrder(w,o);await b.save(t.world,t.reports,w.revision);let cas=false;try{await b.save(t.world,t.reports,w.revision);}catch(e){cas=e.message.includes('revision');}a.db.close();b.db.close();return{fenced,cas};});assert.deepEqual(result,{fenced:true,cas:true});
  const other=await context.newPage();await other.route('**/artifacts/b10-harness/index.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Lock contender</body></html>'}));await other.goto(base+'/artifacts/b10-harness/index.html');await page.evaluate(async()=>{const {FORMAL_WRITER_LOCK}=await import('/src/game/formal/versions.ts');window.lockName=FORMAL_WRITER_LOCK;window.lockEntered=false;navigator.locks.request(FORMAL_WRITER_LOCK,async()=>{window.lockEntered=true;await new Promise(r=>window.releaseLock=r);});});await page.waitForFunction(()=>window.lockEntered);const name=await page.evaluate(()=>window.lockName);assert.equal(await other.evaluate(name=>navigator.locks.request(name,{ifAvailable:true},lock=>!!lock),name),false);await page.evaluate(()=>window.releaseLock());return result;
 });
 await run('native report-write failure rolls back the funded resources and report; bounded retry commits once',async()=>{
  const {page}=await harness();await control(page,{fault:'report-write'});await page.evaluate(()=>{const w=window.lab.world,o=window.lab.order('report','unused');o.payload={type:'research.contribute',projectId:w.researchProjects[0].projectId,cityId:w.cities[0].id,resources:{food:100,wood:100,stone:100,gold:100}};window.lab.worker.postMessage({type:'command',order:o,...window.lab.d.captureIntent(w,o),requestId:'report'});});await done(page,'report');const data=await page.evaluate(async()=>{const s=new window.lab.p.FormalPersistence(),row=await s.commandStatus(window.lab.world.campaignId,'command:report'),w=(await s.loadSave()).game,reports=await s.db.BattleReports.count();s.db.close();return{state:row.state,attempts:row.attempts,food:w.cities[0].stock.food,reports,effects:w.commandReceipts.filter(r=>r.commandId==='command:report').length};});assert.deepEqual(data,{state:'committed',attempts:1,food:500,reports:1,effects:1});return data;
 });
 for(const point of ['inbox-write','world-write'])await run('native QuotaExceededError at '+point+' never retries automatically',async()=>{
  const {page}=await harness();await control(page,{fault:point,faultName:'QuotaExceededError'});await page.evaluate(()=>window.lab.sendOrder('quota','不得假成功'));await done(page,'quota');const data=await page.evaluate(async()=>{const s=new window.lab.p.FormalPersistence(),row=await s.commandStatus(window.lab.world.campaignId,'command:quota'),w=(await s.loadSave()).game;s.db.close();return{state:row?.state??'not-received',attempts:row?.attempts??0,effects:w.commandReceipts.filter(r=>r.commandId==='command:quota').length};});assert.equal(data.effects,0);assert.equal(data.state,point==='inbox-write'?'not-received':'needs-confirmation');assert.equal(data.attempts,point==='inbox-write'?0:1);return data;
 });
 for(const count of [30000,60000])await run('native synthetic '+count+' receipts preserve all history; T1 never reads the world row',async()=>{
  const {page}=await harness();const data=await page.evaluate(async count=>{
   window.lab.worker.terminate();const s=new window.lab.p.FormalPersistence();await s.acquireWriter();const w=window.lab.f.createFormalFixture();w.revision=1;w.commandReceipts=Array.from({length:count},(_,i)=>({commandId:'command:synthetic-'+i,issuerId:w.playerFactionId,fingerprint:'synthetic-'+i,committedRevision:1,disposition:'rolled-back'}));const current=await s.start(w);window.lab.world=current;
   const raw=IDBObjectStore.prototype.get;let worldReads=0;IDBObjectStore.prototype.get=function(key){if(this.name==='saves'&&key==='current')worldReads++;return raw.call(this,key);};const timings=[];
   try{for(let i=0;i<10;i++){const o=window.lab.order('timing-'+i,'合成收件'+i),at=performance.now();await s.receiveCommand(o,window.lab.d.captureIntent(current,o));timings.push(performance.now()-at);}}finally{IDBObjectStore.prototype.get=raw;}
   const all=(await s.loadSave()).game.commandReceipts.length;s.db.close();return{history:all,worldReadsDuringT1:worldReads,timingsMs:timings};
  },count);assert.equal(data.history,count);assert.equal(data.worldReadsDuringT1,0);return data;
 });
 await run('actual UI rapid operations each show Created/Durable/terminal states; native page reload keeps Inbox',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.route('**/artifacts/b10-harness/index.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Native harness</body></html>'}));await page.goto(base+'/artifacts/b10-harness/index.html');await page.evaluate(async()=>{globalThis.__APP_RELEASE_METADATA__=await(await fetch('/version.json')).json();const {FormalPersistence}=await import('/src/game/persistence.ts'),{createFormalWorld}=await import('/src/game/formal/generator.ts');const s=new FormalPersistence();await s.acquireWriter();await s.start(createFormalWorld({campaign:'ui-native',seed:90217}));s.db.close();});await page.goto(base);await page.getByRole('button',{name:'載入進度',exact:true}).first().click();await page.locator('.formal-shell').waitFor();
  // Use actual settings controls: two explicit speed choices in quick succession.
  await page.getByRole('button',{name:/設定/}).first().click();
  const buttons=await page.getByRole('button').allTextContents();await fs.writeFile(path.join(out,'ui-buttons.json'),JSON.stringify(buttons));
  const slider=page.getByRole('slider',{name:'戰役速度滑條',exact:true}),apply=page.getByRole('button',{name:'套用並儲存',exact:true});
  await slider.press('ArrowRight');await apply.click();await slider.press('ArrowRight');await apply.click();
  await page.getByRole('button',{name:/命令收件匣/}).click();await page.locator('.command-inbox article').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.command-inbox-list')?.textContent?.includes('已建立・尚未保存'));
  await page.screenshot({path:path.join(out,'ui-inbox.png')});const count=await page.locator('.command-inbox article').count();assert.equal(count,2);await page.reload();await page.getByRole('button',{name:/命令收件匣/}).waitFor();await page.getByRole('button',{name:/命令收件匣/}).click();assert.ok(await page.locator('.command-inbox article').count()>=count);return{visibleCommands:count};
 });
 assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
