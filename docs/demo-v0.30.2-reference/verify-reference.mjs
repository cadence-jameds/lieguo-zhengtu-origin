import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/workspace/reference-baselines/demo-v0.30.2/browser';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const result={commit:'44728f749044c1a5f1ad4fe47f1eccc391c7d9b2',browser:browser.version(),scope:'DEMO reference acquisition; normal new campaign UI; no Formal changes',cases:[],errors:[]};
for(const mobile of [false,true]){
 const label=mobile?'mobile':'desktop',ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await ctx.newPage();
 page.on('pageerror',e=>result.errors.push({label,type:'pageerror',message:String(e)}));
 page.on('response',r=>{if(r.status()>=400)result.errors.push({label,type:'http',status:r.status(),url:r.url()});});
 const shot=async name=>{const file=label+'-'+name+'.png';await page.screenshot({path:out+'/'+file,fullPage:true});return file;};
 try{
  await page.goto('http://127.0.0.1:4302/');
  await page.getByRole('button',{name:'開始新遊戲',exact:true}).waitFor();
  await shot('home');
  await page.getByRole('button',{name:'開始新遊戲',exact:true}).click();
  await page.getByLabel('玩家名字',{exact:true}).fill('DEMO比較基準');
  await page.getByLabel('世界種子碼',{exact:true}).fill('92049');
  await shot('start');
  await page.getByRole('button',{name:'升起旗幟 · 開始戰役',exact:true}).click();
  await page.locator('.game-shell').waitFor({timeout:30000});
  await page.locator('.world-map canvas').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await shot('map');
  await page.getByRole('button',{name:'展開地圖工具',exact:true}).click();
  const toggle=page.getByRole('button',{name:/帝國\s*版圖/});
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');await toggle.click();
  assert.equal(await page.getByRole('button',{name:/關閉\s*版圖/}).getAttribute('aria-pressed'),'true');
  await shot('territory');
  await page.getByRole('button',{name:'放大地圖',exact:true}).click();
  await page.getByRole('button',{name:'縮小地圖',exact:true}).click();
  const nav=name=>page.locator(mobile?'.mobile-nav button':'nav button').filter({hasText:name}).first();
  await nav(mobile?'勢力':'天下勢力').click();
  await page.getByRole('button',{name:'領主',exact:true}).click();
  await page.locator('.faction-grid .faction').first().waitFor();
  const ranks=await page.locator('.faction-grid .faction h2').allTextContents();
  assert.ok(ranks.length>0&&ranks.every(s=>s.includes('名')));
  await shot('lords-ranking');
  await nav(mobile?'城市':'城市建設').click();await shot('city');
  await nav(mobile?'軍隊':'軍隊編組').click();await shot('army');
  result.cases.push({viewport:label,status:'PASS',seed:92049,rankRows:ranks.length,firstRanks:ranks.slice(0,3),territoryToggle:true,zoomButtons:true,databases:await page.evaluate(()=>indexedDB.databases()),documentOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 }catch(e){result.cases.push({viewport:label,status:'FAIL',error:String(e)});await shot('failure');}
 await ctx.close();
}
await browser.close();await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(result.cases.some(x=>x.status==='FAIL')||result.errors.length)process.exitCode=1;
