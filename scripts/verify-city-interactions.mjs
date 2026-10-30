import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,url='http://127.0.0.1:4175',output='docs/art-unification/city-fit/browser']=process.argv.slice(2);if(!modulePath)throw Error('Pass Playwright module path');
const {chromium}=await import(pathToFileURL(path.resolve(modulePath))),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const cases=[],errors=[];
for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'])for(const width of [320,390,1440]){
 if(process.env.CITY_INTERACTION_CIV&&civ!==process.env.CITY_INTERACTION_CIV)continue;
 if(process.env.CITY_INTERACTION_WIDTH&&width!==Number(process.env.CITY_INTERACTION_WIDTH))continue;
 const ctx=await browser.newContext({viewport:{width,height:width>760?1000:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage(),name=`interaction-${width}-${civ}`;
 page.on('pageerror',e=>errors.push({name,error:String(e)}));page.on('response',r=>{if(r.status()>=400)errors.push({name,url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{localStorage.setItem('lieguo-formal-map-labels-v0309','true');window.__mapTexts=[];const old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(...args){window.__mapTexts.push(args.slice(0,3));if(window.__mapTexts.length>400)window.__mapTexts.shift();return old.apply(this,args);};});
 try{
  await page.goto(url+'/scripts/art-preview.html?'+new URLSearchParams({civ,age:3,mode:'map'}));await page.locator('canvas[data-camera]').waitFor();
  for(const step of process.env.CITY_INTERACTION_MODE==='construction'?[]:[0,1,3]){
   for(let n=step===3?1:0;n<step;n++)await page.getByRole('button',{name:'放大地圖',exact:true}).click();
   await page.waitForFunction(()=>window.__mapTexts.some(t=>t[0]==='帝'));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   if(step===1)await page.screenshot({path:`${output}/${name}-labels-map.jpg`,type:'jpeg',quality:88});
   const canvas=page.locator('canvas[data-camera]'),b=await canvas.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
   const dialog=page.locator('dialog.formal-target-dialog');await dialog.waitFor();const title=await dialog.locator('.dialog-title h2').textContent();if(!title.includes('美術驗收城'))throw Error('World city hit target changed: '+title);
   const texts=await page.evaluate(()=>window.__mapTexts.slice(-100));await dialog.getByRole('button',{name:'關閉對話框',exact:true}).click();cases.push({name:name+'-z'+step,status:'PASS',civ,width,kind:'map-hit-and-labels',title,texts});
  }
  await page.goto(url+'/scripts/art-preview.html?'+new URLSearchParams({civ,age:3,state:'construction'}));await page.getByRole('tab',{name:'城內',exact:true}).click();
  await page.locator('.town-lot.constructing .construction-sprite').first().waitFor();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  const sprites=await page.locator('.town-lot.constructing').evaluateAll(es=>es.map(e=>({scale:e.querySelector('.town-building-art').getAttribute('data-scale'),src:e.querySelector('img').src,anchor:{left:e.style.left,top:e.style.top}})));
  if(sprites.length!==2||sprites.some(s=>!s.src.includes('/construction/')))throw Error('Two concurrent construction images changed '+JSON.stringify(sprites));
  if(await page.locator('.construction-overlays [role=progressbar]').count()!==2)throw Error('Two concurrent progress overlays changed');
  if(width<=760&&await page.locator('.mobile-nav-track button').count()!==6)throw Error('Six shortcuts changed');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Overflow');
  await page.screenshot({path:`${output}/${name}-construction.jpg`,type:'jpeg',quality:88});cases.push({name:name+'-construction',status:'PASS',civ,width,kind:'construction',sprites});
 }catch(e){console.log(name,String(e));cases.push({name,status:'FAIL',error:String(e)});}await ctx.close();console.log(name+' '+cases.at(-1).status);
}
await browser.close();const result={status:errors.length||cases.some(c=>c.status!=='PASS')?'FAIL':'PASS',cases,errors,counts:{passed:cases.filter(c=>c.status==='PASS').length,failed:cases.filter(c=>c.status!=='PASS').length},physicalPhone:'待驗'};fs.writeFileSync(output+'/result-interactions.json',JSON.stringify(result));console.log(JSON.stringify({status:result.status,counts:result.counts,errors:errors.length}));if(result.status!=='PASS')process.exitCode=1;
