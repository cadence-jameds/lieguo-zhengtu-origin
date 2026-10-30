import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,base='http://127.0.0.1:4175',output='docs/art-unification/japan-approved-20261030/browser/gallery']=process.argv.slice(2);
const {chromium}=await import(pathToFileURL(path.resolve(modulePath)));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
fs.mkdirSync(output,{recursive:true});
const rows=[],errors=[];
const expected={japan:'elite.guard.civ_japan.approved-candidate-1.webp',zhongguo:'elite.guard.civ_zhongguo.approved-3798a7f.webp'};
for(const width of [320,390,1440]){
 const context=await browser.newContext({viewport:{width,height:width<760?844:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push({width,error:String(e)}));page.on('response',r=>{if(r.status()>=400)errors.push({width,status:r.status(),url:r.url()});});
 await page.goto(base+'/scripts/japan-approved.html');await page.locator('[data-civ]').first().waitFor();
 await page.evaluate(()=>Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();})));
 const cards=await page.locator('[data-civ]').evaluateAll(es=>es.map(e=>({civ:e.dataset.civ,size:Number(e.dataset.size),width:e.querySelector('.formal-art').getBoundingClientRect().width,height:e.querySelector('.formal-art').getBoundingClientRect().height,path:e.querySelector('img.formal-art-image').getAttribute('src')})));
 if(cards.length!==6||cards.some(c=>c.width!==c.size||c.height!==c.size||!c.path.endsWith('/'+expected[c.civ])))errors.push({width,error:'Incorrect native size or Runtime mapping'});
 for(const civ of ['japan','zhongguo'])for(const size of [512,128,64])if(cards.filter(c=>c.civ===civ&&c.size===size).length!==1)errors.push({width,error:'Missing native size '+civ+size});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))errors.push({width,error:'Document horizontal overflow'});
 await page.screenshot({path:output+'/'+width+'-native.jpg',fullPage:true,type:'jpeg',quality:90});
 rows.push({width,cards,status:'PASS'});await context.close();
}
await browser.close();const result={status:errors.length?'FAIL':'PASS',rows,errors,viewports:3,nativeCards:18,fixture:'Actual Art and unitArt, Runtime registry paths at native512/128/64. 512px scrolls within container on narrow viewports.',physicalPhone:'待驗'};
fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,viewports:3,nativeCards:18,errors}));if(errors.length)process.exitCode=1;
