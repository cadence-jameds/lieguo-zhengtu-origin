// Actual production GameApp + Runtime Worker + native IndexedDB, isolated origin.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.B10_START_URL??'http://127.0.0.1:4231/lieguo-zhengtu-origin/',out=process.argv[2];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),results=[];
async function diagnostic(page,action){return page.evaluate(({base,action})=>new Promise((resolve,reject)=>{
 const worker=new Worker(base+'__validation/start.js',{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('diagnostic worker deadline'));},30000);
 worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.onmessage=e=>{clearTimeout(timer);worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};worker.postMessage({action});
}),{base,action});}
async function legacyHash(page){return page.evaluate(async()=>{
 const names=(await indexedDB.databases()).filter(d=>d.name==='lieguo-formal-ledger-v1');if(!names.length)return null;
 return new Promise((resolve,reject)=>{const r=indexedDB.open('lieguo-formal-ledger-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('saves','readonly'),a=t.objectStore('saves').getAll();a.onsuccess=()=>{const value=JSON.stringify(a.result);db.close();resolve(value);};a.onerror=()=>reject(a.error);};});
});}
try{
 for(const [scenario,mobile] of [['legacy',false],['incompatible',false],['incompatible',true],['corrupt',false]]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();await page.goto(base+'__validation/lab.html');const seeded=await diagnostic(page,scenario),old=await legacyHash(page);
  await page.goto(base);const primary=page.getByRole('button',{name:'開始新遊戲',exact:true});await primary.waitFor();
  if(scenario==='corrupt'){
   await page.getByText('活動戰役完整性或 Authority 不一致，原資料保留。',{exact:true}).first().waitFor();assert.equal(await primary.isEnabled(),false);const observed=await diagnostic(page,'read');
   // Writer intake metadata may advance at startup, but the bad source itself
   // must remain untouched and the UI must not claim a new campaign.
   assert.equal(observed.current.data.snapshot.campaignId,seeded.campaign);results.push({scenario,mobile,status:'PASS',newGameBlocked:true,sourcePreserved:true});await context.close();continue;
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='開始新遊戲'&&!b.disabled));
  const before=await diagnostic(page,'read');await primary.click();await page.getByLabel('領主名稱',{exact:true}).fill(mobile?'手機新領主':'新局領主');await page.getByLabel('世界種子碼',{exact:true}).fill('884422');await page.getByLabel('新局速度',{exact:true}).selectOption('25');await page.getByLabel('離線世界推進',{exact:true}).selectOption('0');
  await page.getByRole('button',{name:'升起旗幟 · 開始戰役',exact:true}).click();await page.getByRole('dialog',{name:'確認建立新戰役',exact:true}).waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();
  const cancelled=await diagnostic(page,'read');assert.equal(cancelled.hash,before.hash);assert.equal(await legacyHash(page),old);
  await page.getByRole('button',{name:'升起旗幟 · 開始戰役',exact:true}).click();await page.getByRole('button',{name:'確認建立新戰役',exact:true}).click();await page.locator('.formal-city-panel').waitFor({timeout:30000});
  const after=await diagnostic(page,'read');assert.notEqual(after.current.data.snapshot.campaignId,seeded.campaign);assert.equal(after.current.data.snapshot.seed,884422);assert.equal(after.current.data.snapshot.speed,25);assert.equal(after.current.data.snapshot.offlineLimit,0);assert.equal(await legacyHash(page),old);
  const other=await context.newPage();await other.goto(base);await other.getByText(/另一個分頁開啟/).waitFor({timeout:15000});assert.equal(await other.getByRole('button',{name:'開始新遊戲',exact:true}).count(),0);await other.close();
  await page.reload();await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.formal-city-panel').waitFor();const reloaded=await diagnostic(page,'read');assert.equal(reloaded.current.data.snapshot.campaignId,after.current.data.snapshot.campaignId);assert.equal(await legacyHash(page),old);
  results.push({scenario,mobile,status:'PASS',withoutBackup:true,cancelPreserved:true,newCampaign:true,reloaded:true,legacyPreserved:true,writerLock:true});await context.close();
 }
}catch(error){results.push({status:'FAIL',error:String(error)});process.exitCode=1;}
finally{await fs.writeFile(out,JSON.stringify({browser:browser.version(),native:true,android:false,results},null,2));await browser.close();console.log(JSON.stringify(results));}
