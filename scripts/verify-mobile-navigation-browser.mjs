// Usage: node scripts/verify-mobile-navigation-browser.mjs <playwright/index.mjs> <synthetic.realm-save> <evidence-dir>
// Run against a local production preview. The fixture must contain one unread battle report.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [pw,fixture,out]=process.argv.slice(2),url=process.env.MOBILE_NAV_BROWSER_URL??'http://127.0.0.1:4173/';
const {chromium}=await import(pathToFileURL(path.resolve(pw)).href);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const result={browser:browser.version(),source:'local production build; synthetic combat fixture; real Worker and IndexedDB',cases:[],errors:[]};
const key='lieguo.mobile-shortcuts.v1';
const dimensions=[[320,568],[360,640],[390,844],[430,932],[568,320],[640,360],[844,390],[932,430]];
async function enter(page){await page.goto(url);await page.locator('input[type=file]').setInputFiles(fixture);await page.getByRole('button',{name:'確認匯入',exact:true}).click();await page.locator('.formal-shell').waitFor();}
async function scrollEnd(page,direction){const button=page.getByRole('button',{name:direction==='right'?'顯示右側功能':'顯示左側功能',exact:true});for(let i=0;i<12&&await button.isVisible();i++){await button.click();await page.waitForTimeout(350);}assert.equal(await button.isVisible(),false);}
async function overview(page){await page.locator('.nav-more').click();await page.getByRole('heading',{name:'戰役總覽',exact:true}).waitFor();}
async function configure(page){await overview(page);await page.getByRole('button',{name:'自訂底部快捷列',exact:true}).click();await page.getByRole('heading',{name:'自訂底部快捷列',exact:true}).waitFor();}
for(const [width,height] of dimensions){
 const name=`${width}x${height}`,context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,locale:'zh-TW',timezoneId:'Asia/Taipei',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>result.errors.push({name,message:e.message}));
 try{
  await enter(page);const nav=page.locator('.mobile-nav'),track=nav.locator('.mobile-nav-track'),more=nav.locator('.nav-more'),report=track.locator('[data-nav-id=reports]');
  assert.equal(await track.locator('button').count(),6);assert.equal(await report.locator('.nav-unread-count').innerText(),'1');assert.notEqual(await report.evaluate(el=>getComputedStyle(el).animationName),'none');
  const normal=await track.locator('button').first().boundingBox(),fixed=await more.boundingBox();assert.ok(Math.abs(normal.width-Math.max(66,(width-36)/5))<.1,'original width preserved');assert.equal(normal.height,58);assert.equal(fixed.width,48);assert.ok(normal.width>fixed.width);
  await page.screenshot({type:'jpeg',quality:85,path:path.join(out,`${name}-shortcuts.jpg`)});
  // Real touch gesture in Chromium mobile emulation.
  const bounds=await track.boundingBox(),cdp=await context.newCDPSession(page),y=bounds.y+30;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width-25,y}]});
  for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bounds.x+bounds.width-25-(bounds.width-50)*i/6,y}]});await page.waitForTimeout(25);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);
  assert.ok(await track.evaluate(el=>el.scrollLeft)>0,'touch swipe must scroll shortcuts');assert.deepEqual(await more.boundingBox(),fixed);
  await scrollEnd(page,'right');await track.locator('button').last().click();assert.equal(await track.locator('[aria-current=page]').getAttribute('data-nav-id'),'legion');
  const last=await track.locator('button').last().boundingBox();assert.ok(last.x+last.width<=fixed.x-17,'last shortcut clear of right arrow');
  if(width===390){for(const [rotateWidth,rotateHeight]of [[932,430],[320,568],[390,844]]){await page.setViewportSize({width:rotateWidth,height:rotateHeight});await page.waitForTimeout(350);const active=await track.locator('[aria-current=page]').boundingBox(),area=await track.boundingBox();assert.ok(active.x>=area.x+17&&active.x+active.width<=area.x+area.width-17,'active shortcut remains visible after rotation');assert.equal((await more.boundingBox()).x,rotateWidth-48);}await page.screenshot({type:'jpeg',quality:85,path:path.join(out,'rotation-returned.jpg')});}
  await scrollEnd(page,'left');await track.locator('button').first().click();assert.equal(await track.locator('[aria-current=page]').getAttribute('data-nav-id'),'map');
  const first=await track.locator('button').first().boundingBox();assert.ok(first.x>=bounds.x+17,'first shortcut clear of left arrow');
  await track.locator('[data-nav-id=city]').click();await configure(page);await page.getByRole('button',{name:'移除戰報紀事',exact:true}).click();
  await page.screenshot({type:'jpeg',quality:85,path:path.join(out,`${name}-customize.jpg`)});await page.getByRole('button',{name:'儲存快捷列',exact:true}).click();
  assert.equal(await page.locator('.mobile-more [data-nav-id=reports] .nav-unread-count').innerText(),'1');assert.equal(await more.locator('.nav-unread-count').innerText(),'1');
  for(const id of ['reports','diplomacy','empire','tasks','settings'])assert.equal(await page.locator(`.mobile-more [data-nav-id=${id}]`).count(),1);
  assert.match(await page.locator('.mobile-more').innerText(),/列國征途首頁/);assert.match(await page.locator('.mobile-campaign-time').innerText(),/1X/);
  await page.screenshot({type:'jpeg',quality:85,path:path.join(out,`${name}-more-unread.jpg`)});
  // Opening the report page must not mark reports read. Only expanding the existing report does.
  await page.locator('.mobile-more [data-nav-id=reports]').click();assert.equal(await more.getAttribute('aria-current'),'page');assert.equal(await more.locator('.nav-unread-count').innerText(),'1');
  await page.locator('.compact-report summary').first().click();await page.waitForFunction(()=>!document.querySelector('.nav-more .nav-unread-count'));
  await configure(page);await page.getByRole('button',{name:'加入戰報紀事',exact:true}).click();await page.getByRole('button',{name:'將戰報紀事向前移',exact:true}).click();await page.getByRole('button',{name:'移除軍團',exact:true}).click();await page.getByRole('button',{name:'儲存快捷列',exact:true}).click();
  const expected=['map','city','army','research','reports'];assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),expected);
  await page.getByRole('button',{name:'關閉對話框',exact:true}).click();assert.deepEqual(await track.locator('button').evaluateAll(els=>els.map(el=>el.dataset.navId)),expected);
  await page.reload();await page.getByRole('button',{name:'載入進度',exact:true}).click();await nav.waitFor();assert.deepEqual(await track.locator('button').evaluateAll(els=>els.map(el=>el.dataset.navId)),expected);
  await overview(page);await page.locator('.mobile-more [data-nav-id=settings]').click();await page.getByRole('button',{name:'重新讀取',exact:true}).click();await nav.waitFor();assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),expected);
  await track.locator('[data-nav-id=city]').click();await page.screenshot({type:'jpeg',quality:85,path:path.join(out,`${name}-reloaded.jpg`)});
  result.cases.push({name,status:'PASS',normalButton:normal,moreButton:fixed,touchSwipe:true,arrowEdges:true,firstAndLastClickable:true,overviewPreserved:true,hiddenReports:true,readRulePreserved:true,readdAndSort:true,pageReload:true,campaignReload:true,storedOrder:expected});
 }catch(e){result.cases.push({name,status:'FAIL',error:String(e)});await page.screenshot({type:'jpeg',quality:85,path:path.join(out,`${name}-FAIL.jpg`)}).catch(()=>{});}
 finally{await context.close();}console.log(JSON.stringify(result.cases.at(-1)));
}
// Reduced motion keeps counts/attention visible while stopping navigation animation.
for(const [name,viewport,reducedMotion] of [['reduced-motion',{width:390,height:844},'reduce'],['desktop',{width:1440,height:900},'no-preference']]){
 const context=await browser.newContext({viewport,isMobile:name!=='desktop',hasTouch:name!=='desktop',reducedMotion,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);
 try{await enter(page);if(name==='desktop'){assert.equal(await page.locator('.left-rail nav button').count(),10);assert.equal(await page.locator('.mobile-nav').count(),0);assert.match(await page.locator('.left-rail .has-unread').innerText(),/1/);}else{assert.equal(await page.locator('.mobile-nav [data-nav-id=reports]').evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await page.locator('.nav-unread-count').innerText(),'1');await configure(page);await page.getByRole('button',{name:'移除戰報紀事',exact:true}).click();await page.getByRole('button',{name:'儲存快捷列',exact:true}).click();assert.equal(await page.locator('.mobile-more .has-unread').evaluate(el=>getComputedStyle(el).animationName),'none');}
 await page.screenshot({type:'jpeg',quality:85,path:path.join(out,`${name}.jpg`)});result.cases.push({name,status:'PASS'});
 }catch(e){result.cases.push({name,status:'FAIL',error:String(e)});}finally{await context.close();}console.log(JSON.stringify(result.cases.at(-1)));
}
await browser.close();result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.filter(c=>c.status==='FAIL').length;await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));if(result.failed||result.errors.length)process.exitCode=1;
