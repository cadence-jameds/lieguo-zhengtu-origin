import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,after='http://127.0.0.1:4175',before='http://127.0.0.1:4181',output='docs/art-unification/city-fit/browser',suite='all']=process.argv.slice(2);
if(!modulePath)throw Error('Pass Playwright module, current URL, baseline URL, output, optional city/map');
const {chromium}=await import(pathToFileURL(path.resolve(modulePath)));fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const civs=['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'],cases=[],errors=[];
const rect=e=>e.getBoundingClientRect().toJSON();
async function open(name,width,url,candidate){
 const ctx=await browser.newContext({viewport:{width,height:width>760?1000:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();
 page.on('pageerror',e=>errors.push({name,error:String(e)}));page.on('response',r=>{if(r.status()>=400)errors.push({name,status:r.status(),url:r.url()});});
 if(candidate!==undefined)await page.route('**/src/game/presentation/cityVisuals.ts*',async route=>{const response=await route.fetch();let body=await response.text();if(!/IMPERIAL_WORLD_SCALE\s*=\s*1\.1\s*;/.test(body))throw Error('Candidate substitution missing');body=body.replace(/IMPERIAL_WORLD_SCALE\s*=\s*1\.1\s*;/,`IMPERIAL_WORLD_SCALE = ${candidate};`);await route.fulfill({response,body});});
 await page.addInitScript(()=>{window.__cityDraws=[];const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im?.src&&/center.imperial|building-atlas|buildings-dark|buildings-feudal/.test(im.src)){const t=this.getTransform();window.__cityDraws.push({src:im.src,args,matrix:{a:t.a,b:t.b,c:t.c,d:t.d,e:t.e,f:t.f}});if(window.__cityDraws.length>300)window.__cityDraws.shift();}return original.call(this,im,...args);};});
 await page.goto(url);await page.locator('.formal-shell').waitFor();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
 return {ctx,page};
}
async function common(page,width){
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Document overflow');
 if(width<=760&&await page.locator('.mobile-nav-track button').count()!==6)throw Error('Six shortcuts changed');
}
if(suite!=='map')for(const phase of ['before','after'])for(const civ of civs)for(const width of [320,390,1440])for(const age of [0,1,2,3]){
 if(process.env.CITY_REVIEW_CIV&&civ!==process.env.CITY_REVIEW_CIV)continue;
 if(process.env.CITY_REVIEW_PHASE&&phase!==process.env.CITY_REVIEW_PHASE)continue;
 if(process.env.CITY_REVIEW_AGE&&age!==Number(process.env.CITY_REVIEW_AGE))continue;
 const name=`${phase}-${width}-${civ}-${age}`,base=phase==='before'?before:after,{ctx,page}=await open(name,width,base+'/scripts/art-preview.html?'+new URLSearchParams({civ,age}));
 try{
 await page.locator('.miniature-city-art').evaluate(async e=>{const i=new Image();i.src=getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+)/)[1];await i.decode();});
 const outer=await page.locator('.miniature-city').evaluate(e=>{const a=e.querySelector('.miniature-city-art'),w=e.querySelector('.miniature-city-wall');return {art:a.getBoundingClientRect().toJSON(),wall:w.getBoundingClientRect().toJSON(),transform:getComputedStyle(a).transform,mask:getComputedStyle(a).maskImage,html:e.outerHTML};});
 await common(page,width);await page.locator('.outskirts-center').screenshot({path:`${output}/${name}-outskirts.jpg`,type:'jpeg',quality:90});
 if(age===3)await page.screenshot({path:`${output}/${name}-outskirts-ui.jpg`,type:'jpeg',quality:85});
 const towns=[];
 for(const state of ['complete','building-audit']){
  if(state==='building-audit'){await page.goto(base+'/scripts/art-preview.html?'+new URLSearchParams({civ,age,state}));await page.locator('.formal-shell').waitFor();}
  await page.getByRole('tab',{name:'城內',exact:true}).click();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  const lots=await page.locator('.town-lot').evaluateAll(es=>es.map(e=>({cls:e.className,anchor:{left:e.style.left,top:e.style.top},rect:e.getBoundingClientRect().toJSON(),art:(e.querySelector('.town-building-art')??e.firstElementChild).getBoundingClientRect().toJSON(),img:e.querySelector('img')?.src,scale:e.querySelector('.town-building-art')?.getAttribute('data-scale')??'1',labelRect:e.querySelector('.town-label').getBoundingClientRect().toJSON()})));
  // Viewport is the real scroll container; preserve a useful view at both phone widths.
  if(age===3||width===1440)await page.locator('.town-viewport').screenshot({path:`${output}/${name}-${state}-town.jpg`,type:'jpeg',quality:87});
  if(age===3&&state==='complete')await page.screenshot({path:`${output}/${name}-town-ui.jpg`,type:'jpeg',quality:85});
  // Every lot retains its own center as an actionable target, including offscreen phone lots.
  for(const selector of ['.town-lot.building-hall','.town-lot.building-castle']){const lot=page.locator(selector);await lot.scrollIntoViewIfNeeded();await lot.click({trial:true});}
  towns.push({state,lots});
 }
 await common(page,width);cases.push({name,status:'PASS',phase,civ,width,age,outer,towns});
 }catch(e){cases.push({name,status:'FAIL',error:String(e)});}await ctx.close();
 console.log(name+' '+cases.at(-1).status);
}
if(suite!=='city')for(const civ of civs)for(const width of [320,390,1440])for(const scale of [1,1.08,1.1,1.12]){
 const name=`map-${width}-${civ}-${Math.round(scale*100)}`,{ctx,page}=await open(name,width,after+'/scripts/art-preview.html?'+new URLSearchParams({civ,age:3,mode:'map'}),scale);
 try{
  const aliased=civ==='civ_byzantium'?'civ_byzantion':civ==='civ_mongolia'?'civ_mongol':civ;
  for(const zoomStep of [0,1,3]){
   const already=zoomStep===0?0:zoomStep===1?0:1;for(let i=already;i<zoomStep;i++)await page.getByRole('button',{name:'放大地圖',exact:true}).click();
   await page.waitForFunction(alias=>window.__cityDraws.some(d=>d.src.includes('center.imperial.'+alias)),aliased);
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   const geometry=await page.evaluate(alias=>({draws:window.__cityDraws.filter(d=>d.src.includes('center.imperial.'+alias)).slice(-10),zoom:document.querySelector('canvas[data-camera]')?.dataset.camera,scale:document.querySelector('.formal-map-scale')?.textContent,canvas:document.querySelector('canvas[data-camera]')?.getBoundingClientRect().toJSON()}),aliased);
   const canvas=geometry.canvas;if(!canvas)throw Error('Missing map canvas');
   await common(page,width);
   const clip={x:Math.max(canvas.x,canvas.x+canvas.width/2-240),y:Math.max(canvas.y,canvas.y+canvas.height/2-180),width:Math.min(480,canvas.width),height:Math.min(360,canvas.height)};
   await page.screenshot({path:`${output}/${name}-z${zoomStep}.jpg`,type:'jpeg',quality:90,clip});
   if(zoomStep===1&&(scale===1||scale===1.1))await page.screenshot({path:`${output}/${name}-ui.jpg`,type:'jpeg',quality:85});
   cases.push({name:name+'-z'+zoomStep,status:'PASS',civ,width,candidate:scale,zoomStep,geometry});
  }
 }catch(e){cases.push({name,status:'FAIL',error:String(e)});}await ctx.close();console.log(name+' '+cases.at(-1).status);
}
await browser.close();
if(process.env.CITY_REVIEW_CIV||process.env.CITY_REVIEW_PHASE||process.env.CITY_REVIEW_AGE){const previous=JSON.parse(fs.readFileSync(output+`/result-${suite}.json`));const names=new Set(cases.map(c=>c.name));cases.push(...previous.cases.filter(c=>!names.has(c.name)));errors.push(...previous.errors);}
const result={baseline:'846e98ca1abc6eddda009cd6d08ce4600e2fbeaf',fixture:'Validated synthetic Formal world; same fixture added to baseline for academy/workshop/embassy. Actual Shell/CityScenes/FormalWorldMap, no private saves. Candidates replace display constant in served module only.',physicalPhone:'待驗',status:errors.length||cases.some(c=>c.status!=='PASS')?'FAIL':'PASS',cases,errors,counts:{passed:cases.filter(c=>c.status==='PASS').length,failed:cases.filter(c=>c.status!=='PASS').length}};
fs.writeFileSync(output+`/result-${suite}.json`,JSON.stringify(result));console.log(JSON.stringify({status:result.status,counts:result.counts,errors:errors.length}));if(result.status!=='PASS')process.exitCode=1;
