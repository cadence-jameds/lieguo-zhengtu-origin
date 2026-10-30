import {pathToFileURL} from 'node:url';
import path from 'node:path';
const [modulePath,base='http://127.0.0.1:4175',root='docs/art-unification/technology-repair']=process.argv.slice(2);
if(!modulePath)throw Error('Pass Playwright module path, dev URL and optional output folder');
const {chromium}=await import(pathToFileURL(path.resolve(modulePath)));
import fs from 'node:fs';
const expected=JSON.parse(fs.readFileSync('docs/art-unification/coverage.json')).technologies;fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[],cases=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+':'+r.status());});
for(const width of [320,390,1440]){
 await page.setViewportSize({width,height:844});await page.goto(base+'/scripts/art-preview.html?mode=technology-gallery');await page.locator('[data-tech-id]').first().waitFor();
 const rows=await page.locator('[data-tech-id]').evaluateAll(async els=>Promise.all(els.map(async el=>{const img=el.querySelector('.formal-art-image');if(img){img.loading='eager';await img.decode();}return {id:el.dataset.techId,path:img?new URL(img.src).pathname.replace(/^\//,'' ):null,svg:!!el.querySelector('.formal-art svg'),fallback:!!el.querySelector('.formal-art .formal-icon'),width:img?.naturalWidth};})));
 if(rows.length!==82||rows.some(r=>r.svg||r.fallback||r.width!==512||r.path!==expected.find(t=>t.id===r.id)?.path))throw Error('Wrong frontend art mapping '+JSON.stringify(rows));
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow');await page.screenshot({path:root+'/'+width+'-all-technologies.png',fullPage:true});cases.push({width,mode:'technology-gallery',status:'PASS',rows});
}
for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'])for(const width of [390,1440]){
 await page.setViewportSize({width,height:844});await page.goto(base+'/scripts/art-preview.html?mode=research&age=3&civ='+civ);await page.locator('.research-view').waitFor();
 for(const stage of ['I','II','modern']){const modern=stage==='modern';
  await page.getByRole('button',{name:modern?'現代科研':'傳統科技',exact:true}).click();if(!modern&&width===390)await page.getByRole('group',{name:'傳統科技時代'}).getByRole('button',{name:stage==='I'?'城堡':'帝王',exact:true}).click();
  const target=expected.find(t=>t.civilizationId===civ&&(modern?t.scope==='modern-civilization':t.age===(stage==='I'?2:3)&&!t.id.startsWith('modern.')));const node=page.locator('[data-tech-id="'+target.id+'"]');await node.scrollIntoViewIfNeeded();const img=node.locator('.formal-art-image');await img.evaluate(async im=>{im.loading='eager';await im.decode();});if(!(await img.getAttribute('src')).endsWith(target.path))throw Error('Research mapping');await node.getByRole('button').first().click();await page.screenshot({path:root+'/'+width+'-'+civ+'-'+(modern?'modern':'traditional-'+stage)+'.png'});cases.push({width,civ,id:target.id,path:target.path,mode:'actual ResearchView detail',status:'PASS'});if(width===390)await page.getByRole('button',{name:'關閉對話框',exact:true}).click();
 }
}
await browser.close();fs.writeFileSync(root+'/browser.json',JSON.stringify({status:errors.length?'FAIL':'PASS',errors,cases,physicalPhone:'待驗'},null,2));console.log(cases.length+' cases PASS; errors '+errors.length);if(errors.length)process.exitCode=1;
