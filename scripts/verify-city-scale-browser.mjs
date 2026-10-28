import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,after='http://127.0.0.1:4175',before='http://127.0.0.1:4180',output='docs/art-unification/city-scale/browser']=process.argv.slice(2);
if(!modulePath)throw Error('Pass Playwright module path, current dev URL, baseline dev URL, output folder');
const {chromium}=await import(pathToFileURL(path.resolve(modulePath)));fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});const cases=[],errors=[];
for(const phase of ['before','after'])for(const civ of ['civ_zhongguo','civ_japan','civ_mongolia'])for(const width of [320,390,1440])for(const age of phase==='before'?[3]:[2,3])for(const mode of ['city','map']){
 const ctx=await browser.newContext({viewport:{width,height:width>760?1000:844},serviceWorkers:'block'});const page=await ctx.newPage();const name=[phase,width,civ,age,mode].join('-');
 page.on('pageerror',e=>errors.push({case:name,error:String(e)}));page.on('response',r=>{if(r.status()>=400)errors.push({case:name,status:r.status(),url:r.url()});});
 await page.addInitScript(()=>{window.__cityDraws=[];const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im?.src&&/cities-imperial|center.imperial|building-atlas|buildings-dark|buildings-feudal/.test(im.src))window.__cityDraws.push({src:im.src,args});return original.call(this,im,...args);};});
 try{
 await page.goto((phase==='before'?before:after)+'/scripts/art-preview.html?'+new URLSearchParams({civ,age,mode}));await page.locator('.formal-shell').waitFor();
 let geometry;
 if(mode==='map'){
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'放大地圖',exact:true}).click();
  const expected=phase==='before'?'cities-imperial':age===3?'center.imperial.'+(civ==='civ_mongolia'?'civ_mongol':civ):'building-atlas';
  await page.waitForFunction(expected=>window.__cityDraws.some(d=>d.src.includes(expected)),expected);
  geometry=await page.evaluate(()=>({draws:window.__cityDraws.slice(-300),scale:document.querySelector('.formal-map-scale')?.textContent,viewport:document.querySelector('.map-overlay')?.getBoundingClientRect().toJSON()}));
 }else{
  await page.locator('.miniature-city-art').waitFor();geometry=await page.locator('.miniature-city-art').evaluate(async el=>{const bg=getComputedStyle(el).backgroundImage;const url=bg.match(/url\(["']?([^"')]+)/)[1];const image=new Image();image.src=url;await image.decode();return {background:bg,bounds:el.getBoundingClientRect().toJSON(),backgroundSize:getComputedStyle(el).backgroundSize,mask:getComputedStyle(el).maskImage};});
  if(!geometry.background.includes(age===3?'cities-imperial':'cities-age-2'))throw Error('Wrong MiniatureCity image');
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw Error('Document overflow');
 if(width<=760&&await page.locator('.mobile-nav-track button').count()!==6)throw Error('Six shortcuts changed');
 await page.screenshot({path:output+'/'+name+'.jpg',type:'jpeg',quality:95});cases.push({name,phase,civ,width,age,mode,status:'PASS',geometry});
 }catch(e){cases.push({name,status:'FAIL',error:String(e)});await page.screenshot({path:output+'/'+name+'-FAIL.jpg',type:'jpeg',quality:95});}
 await ctx.close();
}
await browser.close();const result={status:errors.length||cases.some(c=>c.status!=='PASS')?'FAIL':'PASS',cases,errors,counts:{passed:cases.filter(c=>c.status==='PASS').length,failed:cases.filter(c=>c.status!=='PASS').length},physicalPhone:'待驗',fixture:'Valid synthetic Formal world; real Shell, CityScenes, MiniatureCity, FormalWorldMap; canvas instrumentation records calls without changing drawing.'};fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,counts:result.counts,errors:errors.length}));if(result.status!=='PASS')process.exitCode=1;
