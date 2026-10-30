import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output='docs/validation/city-ui-integration';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[],errors=[];
async function open(phase,width,height,query=''){
 const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push({phase,width,error:String(e)}));page.on('response',r=>{if(r.status()>=400)errors.push({phase,width,status:r.status(),url:r.url()});});
 await page.addInitScript(()=>{window.mapTexts=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(...args){window.mapTexts.push(args[0]);return original.apply(this,args);};});
 await page.goto(`http://127.0.0.1:${phase==='before'?4181:4175}/docs/validation/city-ui-integration/preview.html?${query}`);await page.locator('.formal-shell').waitFor();
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));return {ctx,page};
}
async function geometry(page){return page.evaluate(()=>{
 const rect=e=>e.getBoundingClientRect().toJSON(),h=document.querySelector('h1'),actions=[...document.querySelectorAll('.city-heading-actions button')],levels=[...document.querySelectorAll('.town-level-anchor')].map(e=>{const actual=[...document.querySelectorAll('button.town-lot')].find(l=>l.style.left===e.style.left&&l.style.top===e.style.top),art=rect(actual.querySelector('.town-building-art')),badge=rect(e.querySelector('.town-level')),style=getComputedStyle(e.querySelector('.town-level'));return {value:e.textContent,art,badge,background:style.backgroundColor,radius:style.borderRadius,color:style.color,visible:style.display!=='none'};});
 return {heading:rect(h),title:h.title,aria:h.getAttribute('aria-label'),scrollWidth:h.scrollWidth,width:h.clientWidth,actions:actions.map(e=>({text:e.textContent,rect:rect(e)})),overflow:document.documentElement.scrollWidth>innerWidth+1,levels,topbar:rect(document.querySelector('.topbar'))};
});}
for(const phase of ['before','after'])for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
 const name=`${phase}-${width}x${height}-imperial`,{ctx,page}=await open(phase,width,height);
 try{await page.getByRole('tab',{name:'城內',exact:true}).click();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
 const g=await geometry(page);assert(!g.overflow,'document overflow');
 if(phase==='after'){
  assert.equal(g.title,'河谷東方長城名稱驗收城');assert.equal(g.aria,g.title);
  for(const action of g.actions){assert(Math.abs(action.rect.y+action.rect.height/2-g.heading.y-g.heading.height/2)<2,'heading/actions different rows');assert(action.rect.right<=width,'clipped action');assert(action.rect.height>=44||width>932);assert(action.rect.left>=g.heading.right-1,'overlapping title');}
  assert.equal(await page.locator('.formal-scenes .formal-badge').count(),0);
  assert(g.levels.length>0);for(const l of g.levels){assert(Math.abs(l.art.x+l.art.width/2-l.badge.x-l.badge.width/2)<1,'badge x');assert(Math.abs(l.art.y+l.art.height/2-l.badge.y-l.badge.height/2)<1,'badge y');assert(Math.abs(l.badge.width-l.badge.height)<.1,'circle');assert.equal(l.radius,'50%');assert.equal(l.background,'rgba(0, 0, 0, 0.65)');assert(l.visible);}
  assert(['1','9','10','15'].every(n=>g.levels.some(l=>l.value===n)),'levels 1/9/10/15 missing');
  await page.locator('.rename-city').click();assert(await page.evaluate(()=>window.renameClicked));
  await page.locator('.governor-shortcut').click();assert(await page.locator('dialog').isVisible());await page.getByRole('button',{name:'關閉對話框',exact:true}).click();
  if(width<=932){const count=g.levels.length;await page.locator('.scene-view-shortcut').click();assert.equal(await page.locator('.town-close').count(),0);assert.equal(await page.locator('.town-level').count(),count);assert(await page.locator('.town-level').first().isVisible());await page.locator('.scene-view-shortcut').click();}
  await page.locator('.town-lot.building-hall').click();assert(await page.locator('dialog').isVisible());await page.getByRole('button',{name:'關閉對話框',exact:true}).click();
 }
 await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:88});results.push({name,status:'PASS',geometry:g});
 if(phase==='after'&&width===390){const ageResults=[];for(const [age,label] of ['黑暗','封建','城堡','帝王'].entries()){
   await page.evaluate(age=>window.setReviewAge(age),age);await page.waitForFunction(label=>document.querySelector('.mobile-era').textContent===label+'時代',label);
   assert.equal(await page.locator('.mobile-era > span').count(),2);assert.equal(await page.locator('.mobile-era').getAttribute('aria-label'),label+'時代');
   const lines=await page.locator('.mobile-era > span').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));assert(lines[1].y>=lines[0].bottom-1);assert(Math.abs(lines[0].x+lines[0].width/2-lines[1].x-lines[1].width/2)<1);
   await page.locator('.mobile-era').click();assert(await page.locator('dialog').isVisible());await page.getByRole('button',{name:'關閉對話框',exact:true}).click();
   const now=await geometry(page);assert.equal(now.topbar.height,g.topbar.height);ageResults.push({age,label,topbarHeight:now.topbar.height});
   if(age!==3)await page.screenshot({path:`${output}/after-390-age-${age}.jpg`,type:'jpeg',quality:88});
  }results.push({name:'same-mounted-four-age-HUD',status:'PASS',ages:ageResults});
 }
 }catch(e){console.log(name,String(e));results.push({name,status:'FAIL',error:String(e)});await page.screenshot({path:`${output}/${name}-failure.jpg`,type:'jpeg',quality:85});}finally{await ctx.close();}console.log(name,results.at(-1).status);
}
for(const phase of ['before','after'])for(const age of [2,3]){
 const {ctx,page}=await open(phase,1440,900,`age=${age}&mode=map`),name=`${phase}-map-age-${age}`;
 try{await page.locator('canvas[data-camera]').waitFor();await page.waitForTimeout(900);await page.getByRole('button',{name:'放大地圖',exact:true}).click();await page.waitForTimeout(300);
 const imperial=await page.evaluate(()=>window.mapTexts.includes('帝'));assert.equal(imperial,phase==='before'&&age===3);await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:88});
 const canvas=page.locator('canvas[data-camera]'),r=await canvas.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await page.locator('dialog.formal-target-dialog').waitFor();assert((await page.locator('dialog .dialog-title h2').textContent()).includes('河谷東方'));results.push({name,status:'PASS',imperialMarker:imperial});
 }catch(e){console.log(name,String(e));results.push({name,status:'FAIL',error:String(e)});}finally{await ctx.close();}console.log(name,results.at(-1).status);
}
for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'])for(const age of [0,1,2,3]){
 const {ctx,page}=await open('after',390,844,`civ=${civ}&age=${age}&vacant=1`),name=`art-${civ}-${age}`;
 try{const outer=await page.locator('.parcel-label').evaluateAll(es=>es.map(e=>({text:e.textContent,background:getComputedStyle(e).backgroundColor})));assert.equal(outer.length,18);await page.getByRole('tab',{name:'城內',exact:true}).click();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));assert.equal(await page.locator('.town-level-anchor.building-mint').count(),0);const broken=await page.locator('.town-lot img').evaluateAll(es=>es.filter(e=>!e.complete||!e.naturalWidth).map(e=>e.src));assert.deepEqual(broken,[]);const g=await geometry(page);for(const l of g.levels){assert(Math.abs(l.art.x+l.art.width/2-l.badge.x-l.badge.width/2)<1);assert(Math.abs(l.art.y+l.art.height/2-l.badge.y-l.badge.height/2)<1);}results.push({name,status:'PASS',outer,levels:g.levels.length});}catch(e){console.log(name,String(e));results.push({name,status:'FAIL',error:String(e)});}await ctx.close();
}
for(const state of ['construction','queued']){
 const {ctx,page}=await open('after',390,844,`state=${state}`),name=state+'-completed-levels';
 try{await page.getByRole('tab',{name:'城內',exact:true}).click();assert.equal(await page.locator('.town-level-anchor.building-hall').textContent(),'14');assert.equal(await page.locator('.town-level-anchor.building-monastery').textContent(),'10');assert.equal(await page.locator('.town-lot.constructing').count(),state==='construction'?2:4);await page.screenshot({path:`${output}/after-${state}.jpg`,type:'jpeg',quality:88});results.push({name,status:'PASS'});}catch(e){console.log(name,String(e));results.push({name,status:'FAIL',error:String(e)});}await ctx.close();
}
await browser.close();fs.writeFileSync(`${output}/browser-result.json`,JSON.stringify({status:errors.length||results.some(r=>r.status==='FAIL')?'FAIL':'PASS',fixture:'Validated synthetic Formal worlds rendered through actual Shell, FormalCityPanel, CityScenes, FormalWorldMap; no private saves.',physicalPhone:'待驗',results,errors}));console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL'),errors}));if(errors.length||results.some(r=>r.status==='FAIL'))process.exitCode=1;
