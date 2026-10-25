// Native Chromium + real game Worker/IndexedDB, using synthetic saves only.
// node scripts/verify-research-ui-browser.mjs <playwright/index.mjs> <fixtures> <evidence>
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [pw,fixtures,out]=process.argv.slice(2),url=process.env.RESEARCH_BROWSER_URL??'http://127.0.0.1:4173/';
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results={browser:browser.version(),source:'production build, synthetic formal saves, real Worker and IndexedDB; device emulation is not physical-phone acceptance',cases:[],errors:[]};
async function enter(page,name,mobile){
 await page.goto(url);await page.locator('input[type=file]').setInputFiles(path.join(fixtures,name+'.realm-save'));
 await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();
 const nav=mobile?page.locator('.mobile-nav [data-nav-id=research]'):page.locator('.left-rail nav button').filter({hasText:'科技研發'});
 if(mobile)await nav.scrollIntoViewIfNeeded();await nav.click();await page.locator('.research-workspace').waitFor();
}
async function screenshot(page,name){await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:88});}
async function bounds(page,mobile){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal page overflow');
 if(mobile){const current=await page.locator('.research-current').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();assert.ok(current.y>=0&&current.y+current.height<nav.y,'sticky current research clear of navigation');}
}
for(const [width,height] of [[1600,1000],[1024,768],[320,568],[360,640],[390,844],[430,932]]){
 const mobile=width<761,name=`${width}x${height}`,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,locale:'zh-TW',timezoneId:'Asia/Taipei',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>results.errors.push({name,message:e.message}));
 try{
  await enter(page,'ready',mobile);
  if(mobile)await page.getByRole('button',{name:'封建',exact:true}).click();
  const done=page.locator('[data-tech-id="blacksmith.melee.1"]'),available=page.locator('[data-tech-id="blacksmith.melee.2"]');
  if(!mobile){
   assert.equal(await done.getAttribute('data-state'),'done');assert.equal(await available.getAttribute('data-state'),'available');assert.equal(await page.locator('[data-tech-id="blacksmith.melee.3"]').getAttribute('data-state'),'locked');
   assert.equal(await done.locator('.formal-art').evaluate(e=>getComputedStyle(e).filter),'none');assert.match(await available.locator('.formal-art').evaluate(e=>getComputedStyle(e).filter),/brightness\(0.36\)/);
   const edges=await page.locator('svg path[data-from]').evaluateAll(els=>els.map(e=>[e.dataset.from,e.dataset.to]));assert.ok(edges.length>0);assert.ok(edges.some(([a,b])=>a==='blacksmith.melee.1'&&b==='blacksmith.melee.2'));
   await available.locator('button').click();await screenshot(page,name+'-traditional-states');
  }else{
   const group=page.locator('.research-mobile-groups>details').first();await group.locator('summary').click();assert.equal(await group.evaluate(e=>e.open),false);assert.equal(await page.locator('.research-mobile-groups>details').nth(1).evaluate(e=>e.open),true);
   await screenshot(page,name+'-collapsed');await group.locator('summary').click();await screenshot(page,name+'-traditional');await done.locator('button').click();
   await page.locator('dialog.research-sheet[open]').waitFor();const sheet=await page.locator('dialog').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();assert.ok(sheet.y>=0&&sheet.y+sheet.height<=nav.y+1,'sheet clear of navigation');
   assert.equal(await page.getByRole('button',{name:'已完成',exact:true}).isDisabled(),true);await screenshot(page,name+'-detail');await page.getByRole('button',{name:'關閉對話框',exact:true}).click();
   await group.locator('summary').click();await page.getByRole('button',{name:'城堡',exact:true}).click();await page.getByRole('button',{name:'封建',exact:true}).click();assert.equal(await page.locator('.research-mobile-groups>details').first().evaluate(e=>e.open),false);
  }
  await page.locator('.research-view').evaluate(e=>e.scrollTop=600);await bounds(page,mobile);await screenshot(page,name+'-sticky');
  await page.getByRole('button',{name:'現代科研',exact:true}).click();assert.match(await page.locator('.research-modern-note').innerText(),/尚需完整現代軍事資格/);await screenshot(page,name+'-modern-overview');const cooperation=page.locator('[data-tech-id="research.cooperation"]');await cooperation.locator('button').click();
  assert.equal(await page.getByRole('button',{name:'啟動研究',exact:true}).isDisabled(),true);assert.ok(await page.locator('.research-requirements').innerText().then(s=>s.includes('完整現代軍事資格')));await screenshot(page,name+'-modern-locked');
  results.cases.push({name,status:'PASS',traditional:true,threeStates:!mobile,formalEdges:!mobile,multipleCollapses:mobile,bottomSheet:mobile,sticky:true,modernQualification:true,noPageOverflow:true});
 }catch(e){results.cases.push({name,status:'FAIL',error:String(e)});await screenshot(page,name+'-FAIL').catch(()=>{});}
 finally{await context.close();}console.log(JSON.stringify(results.cases.at(-1)));
}
for(const mobile of [false,true])for(const fixture of ['active','funding']){
 const name=(mobile?'mobile':'desktop')+'-'+fixture,context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1600,height:1000},isMobile:mobile,hasTouch:mobile,locale:'zh-TW',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>results.errors.push({name,message:e.message}));
 try{
  await enter(page,fixture,mobile);
  assert.equal(await page.locator('.top-progress-research').count(),0,'no research progress bar on research page');
  if(fixture==='funding'){
   await page.getByRole('button',{name:'現代科研',exact:true}).click();assert.match(await page.locator('.research-current').innerText(),/籌資中/);assert.equal(await page.locator('.research-countdown').count(),0);assert.equal(await page.locator('.research-funding input').count(),4);assert.match(await page.locator('.research-funding').innerText(),/剩餘需求/);
   const input=page.getByRole('spinbutton',{name:'科研投入food',exact:true});await input.fill('123');await page.getByRole('button',{name:'投入所選科研資源',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.research-funding .cost')?.textContent.includes('123'));
   const picker=page.locator('select[aria-label="切換目前城市"]').first(),values=await picker.locator('option').evaluateAll(els=>els.map(e=>e.value));assert.equal(values.length,2);await picker.selectOption(values[1]);await page.locator('.research-funding').waitFor();assert.match(await page.locator('.research-current').innerText(),/籌資中/);
   await screenshot(page,name);
  }else{
   if(mobile)await page.getByRole('button',{name:'城堡',exact:true}).click();
   const n=page.locator('[data-tech-id="military.breeding"]');await n.scrollIntoViewIfNeeded();assert.equal(await n.getAttribute('data-state'),'active');assert.match(await n.locator('.formal-art').evaluate(e=>getComputedStyle(e).filter),/brightness\(0.36\)/);
   await n.locator('button').click();const detail=page.locator(mobile?'dialog.research-sheet':'.research-detail');assert.match(await detail.innerText(),/現實時間/);assert.equal(await detail.locator('.primary').isDisabled(),true);await screenshot(page,name+'-detail');
   if(mobile)await page.getByRole('button',{name:'關閉對話框',exact:true}).click();const first=await page.locator('.research-current').innerText();await page.waitForFunction(old=>document.querySelector('.research-current')?.textContent!==old,first);await bounds(page,mobile);await screenshot(page,name+'-countdown');
  }
  // Import writes the real save; reload must restore the formal active/funding project.
  await page.reload();await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.formal-shell').waitFor();const nav=mobile?page.locator('.mobile-nav [data-nav-id=research]'):page.locator('.left-rail nav button').filter({hasText:'科技研發'});if(mobile)await nav.scrollIntoViewIfNeeded();await nav.click();await page.locator('.research-current').waitFor();assert.match(await page.locator('.research-current').innerText(),fixture==='funding'?/籌資中/:/馬匹育種/);
  results.cases.push({name,status:'PASS',realWorker:true,realIndexedDB:true,reload:true,noProgress:true,fundingWithoutCountdown:fixture==='funding',contributionAndCitySwitch:fixture==='funding',activeDarkArt:fixture==='active'});
 }catch(e){results.cases.push({name,status:'FAIL',error:String(e)});await screenshot(page,name+'-FAIL').catch(()=>{});}
 finally{await context.close();}console.log(JSON.stringify(results.cases.at(-1)));
}
{
 const name='offline-PWA',context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-TW'}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>results.errors.push({name,message:e.message}));
 try{
  await enter(page,'active',true);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const scope=await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope);assert.equal(new URL(scope).pathname,new URL(url).pathname);
  await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'載入進度',exact:true}).click();await page.locator('.mobile-nav').waitFor();const nav=page.locator('.mobile-nav [data-nav-id=research]');await nav.scrollIntoViewIfNeeded();await nav.click();await page.locator('.research-current').waitFor();assert.match(await page.locator('.research-current').innerText(),/馬匹育種/);assert.equal(await page.locator('.top-progress-research').count(),0);await screenshot(page,name);
  results.cases.push({name,status:'PASS',scope,realServiceWorker:true,offlineReload:true,researchSaveRestored:true});
 }catch(e){results.cases.push({name,status:'FAIL',error:String(e)});await screenshot(page,name+'-FAIL').catch(()=>{});}finally{await context.close();}console.log(JSON.stringify(results.cases.at(-1)));
}
await browser.close();results.passed=results.cases.filter(c=>c.status==='PASS').length;results.failed=results.cases.length-results.passed;await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(results,null,2));if(results.failed||results.errors.length)process.exitCode=1;
