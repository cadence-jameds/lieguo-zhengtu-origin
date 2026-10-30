import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,base='http://127.0.0.1:4174',output='work/art-browser']=process.argv.slice(2);
if(!modulePath)throw Error('Usage: node scripts/verify-art-browser.mjs <playwright module> [dev URL] [output directory]');
const {chromium}=await import(pathToFileURL(path.resolve(modulePath)));
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block',locale:'zh-TW'}),page=await context.newPage();page.setDefaultTimeout(20000);
const result={browser:browser.version(),fixture:'Synthetic art-review fixture; real Formal Shell/City/Army/Research/Map components. No private saves or production deployment.',cases:[],errors:[],physicalPhone:'待驗',networkPerformance:'Local Chromium only; mobile hardware and slow-network performance remain 待驗.'};let current='';
page.on('pageerror',e=>result.errors.push({case:current,type:'pageerror',message:e.message}));
page.on('response',r=>{if(r.status()>=400)result.errors.push({case:current,type:'http',status:r.status(),url:r.url()});});
async function images(){return page.evaluate(async()=>{
 const urls=new Set();document.querySelectorAll('img').forEach(im=>{im.loading='eager';if(im.src)urls.add(im.src);});
 document.querySelectorAll('svg image').forEach(im=>{const href=im.getAttribute('href');if(href)urls.add(new URL(href,location.href).href);});
 document.querySelectorAll('*').forEach(el=>{const bg=getComputedStyle(el).backgroundImage;for(const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(new URL(m[1],location.href).href);});
 const failures=[];await Promise.all([...urls].map(async url=>{const im=new Image();im.src=url;try{await im.decode();if(!im.naturalWidth)failures.push(url);}catch{failures.push(url);}}));
 return {count:urls.size,failures};
});}
async function visit(label,width,params,{town=false,fullPage=false,action}={}){
 current=label;await page.setViewportSize({width,height:width>760?1000:844});const start=performance.now();
 try{
  await page.goto(base+'/scripts/art-preview.html?'+new URLSearchParams(params));await page.locator('.formal-shell').waitFor();
  if(town)await page.getByRole('tab',{name:'城內',exact:true}).click();
  if(action)await action();const loaded=await images();const geometry=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,anchors:[...document.querySelectorAll('[data-testid^="town-anchor-"]')].map(el=>({id:el.getAttribute('data-testid'),left:el.style.left,top:el.style.top})),mobileButtons:document.querySelectorAll('.mobile-nav-track button').length,more:!!document.querySelector('.mobile-nav .nav-more')}));
  if(loaded.failures.length)throw Error('Image decode failed: '+loaded.failures.join(', '));if(geometry.documentWidth>width+1)throw Error('Horizontal document overflow '+geometry.documentWidth);
  if(width<=760&&params.mode!=='gallery'&&(geometry.mobileButtons!==6||!geometry.more))throw Error('Six mobile shortcuts or fixed More changed');
  await page.screenshot({path:output+'/'+label+'.png',fullPage});
  result.cases.push({label,status:'PASS',width,params,loadAndDecodeMs:Math.round(performance.now()-start),images:loaded,geometry});
 }catch(error){result.cases.push({label,status:'FAIL',width,params,error:String(error)});await page.screenshot({path:output+'/'+label+'-FAIL.png',fullPage:false}).catch(()=>{});}
}
const civs=['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'];
for(const civ of civs)for(const age of [0,1,2,3])await visit(`390-${civ}-age${age}`,390,{civ,age:String(age),mode:'city'},{town:true});
for(const width of [320,1440])for(const civ of civs)await visit(`${width}-${civ}-imperial`,width,{civ,age:'3',mode:'city'},{town:true});
for(const width of [320,390,1440]){
 const common={civ:'civ_zhongguo',age:'3'};
 await visit(`${width}-outskirts`,width,{...common,mode:'city'});
 await visit(`${width}-army-base`,width,{...common,mode:'army',state:'base'});
 await visit(`${width}-army-elite`,width,{...common,mode:'army'});
 await visit(`${width}-army-modern`,width,{...common,mode:'army'},{action:()=>page.getByLabel('兵種世代').selectOption('modern')});
 await visit(`${width}-research`,width,{...common,mode:'research'});
 await visit(`${width}-construction`,width,{...common,mode:'city',state:'construction'},{town:true});
 await visit(`${width}-construction-detail`,width,{...common,mode:'city',state:'construction'},{town:true,action:()=>page.locator('[data-testid="town-anchor-6"]').click()});
 await visit(`${width}-queued-upgrade`,width,{...common,mode:'city',state:'queued'},{town:true});
 await visit(`${width}-field-construction`,width,{...common,mode:'city',state:'field-construction'});
 await visit(`${width}-field-detail`,width,{...common,mode:'city',state:'field-construction'},{action:()=>page.locator('[data-testid="field-anchor-0"]').click()});
 await visit(`${width}-gallery`,width,{...common,mode:'gallery'},{fullPage:true});
}
await visit('1440-world-map',1440,{civ:'civ_zhongguo',age:'3',mode:'map'});
result.passed=result.cases.filter(c=>c.status==='PASS').length;result.failed=result.cases.length-result.passed;result.status=result.failed||result.errors.length?'FAIL':'PASS';
await fs.writeFile(output+'/result.json',JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify({status:result.status,passed:result.passed,failed:result.failed,errors:result.errors.length,output}));if(result.status!=='PASS')process.exitCode=1;
