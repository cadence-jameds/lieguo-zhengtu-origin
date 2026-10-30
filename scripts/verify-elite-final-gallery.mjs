import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,base='http://127.0.0.1:4175',output='docs/art-unification/elite-final-20261030/browser/gallery']=process.argv.slice(2);
const {chromium}=await import(pathToFileURL(path.resolve(modulePath)));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
fs.mkdirSync(output,{recursive:true});
const rows=[],errors=[];
for(const width of [320,390,1440]){
 const context=await browser.newContext({viewport:{width,height:width<760?844:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push({width,error:String(e)}));page.on('response',r=>{if(r.status()>=400)errors.push({width,status:r.status(),url:r.url()});});
 await page.goto(base+'/scripts/elite-final.html');await page.locator('[data-candidate]').first().waitFor();
 await page.evaluate(()=>Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();})));
 const cards=await page.locator('.cards .formal-art').evaluateAll(es=>es.map(e=>({size:Number(e.closest('[data-native-size]').dataset.nativeSize),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,path:e.querySelector('img')?.getAttribute('src')??e.querySelector('svg image')?.getAttribute('href'),candidate:e.closest('[data-candidate]')?.dataset.candidate??null})));
 if(cards.length!==10||cards.some(c=>c.width!==c.size||c.height!==c.size))errors.push({width,error:'Incorrect native Japanese card sizes'});
 for(const c of cards.filter(c=>c.candidate))if(!c.path.includes('/docs/art-unification/elite-final-20261030/japan/candidates/'+c.candidate+'.webp'))errors.push({width,error:'Wrong candidate source '+c.path});
 const china=await page.locator('[data-china-size]').evaluateAll(es=>es.map(e=>({size:Number(e.dataset.chinaSize),width:e.querySelector('.formal-art').getBoundingClientRect().width,height:e.querySelector('.formal-art').getBoundingClientRect().height,path:e.querySelector('img.formal-art-image').getAttribute('src')})));
 if(china.length!==3||china.some(c=>c.width!==c.size||c.height!==c.size||!c.path.includes('elite.guard.civ_zhongguo.approved-3798a7f.webp')))errors.push({width,error:'Chinese formal512/128/64 image mapping or size'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))errors.push({width,error:'Document horizontal overflow'});
 await page.screenshot({path:output+'/'+width+'-review.jpg',fullPage:true,type:'jpeg',quality:90});
 rows.push({width,cards,china,status:'PASS'});await context.close();
}
await browser.close();const result={status:errors.length?'FAIL':'PASS',rows,errors,viewports:3,japaneseNativeCards:30,chineseNativeCards:9,fixture:'Actual Art and unitArt components, review-only entry. Japanese candidates are documentation URLs, not Runtime registry entries.',physicalPhone:'待驗'};
fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,viewports:3,japaneseNativeCards:30,chineseNativeCards:9,errors}));if(errors.length)process.exitCode=1;
