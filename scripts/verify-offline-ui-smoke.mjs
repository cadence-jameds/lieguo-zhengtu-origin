// Local application-page UI smoke. No private input is accepted. Run against a
// loopback Vite dev server with matching HEAD; not a release build speed gate.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
if(process.argv.length!==4)throw Error('Usage: node scripts/verify-offline-ui-smoke.mjs http://127.0.0.1:5173/ /tmp/offline-ui-smoke.json');
const base=new URL(process.argv[2]);
assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.equal(base.pathname,'/');assert.equal(base.search,'');
const output=process.argv[3];
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,chromiumSandbox:true});
const HOUR=3_600_000;
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const seedPage=await ctx.newPage();await seedPage.goto(new URL('version.json',base).href);
 const seed=await seedPage.evaluate(async hour=>{
  const {FormalPersistence}=await import('/src/game/persistence.ts');
  const {createFormalWorld}=await import('/src/game/formal/generator.ts');
  const {changeCityOwner}=await import('/src/game/formal/economy.ts');
  const {configureReplayCopy}=await import('/scripts/offline-benchmark/lab.mjs');
  const w=createFormalWorld({campaign:'native-offline-ui-smoke',seed:90217,speed:3,offlineHours:1});
  changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');
  w.cities[0].name='離線測試甲城';w.cities[1].name='離線測試乙城';
  const p=new FormalPersistence();
  try{
   await p.acquireWriter();const initial=await p.start(w);
   if(initial.speed!==3||initial.offlineHours!==1)throw Error('Synthetic initial values were not persisted');
   const configured=await configureReplayCopy(p,initial,Date.now()-hour);
   p.db.close();
   const independent=new FormalPersistence();
   try{
    const loaded=await independent.loadSave(),saved=loaded.game;
    if(loaded.recovered||!saved||saved.speed!==25||saved.offlineHours!==12||saved.revision!==configured.revision)throw Error('Native settings reopen mismatch');
    return {time:saved.time,revision:saved.revision,speed:saved.speed,cap:saved.offlineHours,secondCity:saved.cities[1].id};
   }finally{independent.db.close();}
  }finally{p.db.close();}
 },HOUR);
 await seedPage.close();
 await ctx.addInitScript(()=>{
  window.smoke={commands:0,loaded:null};
  const Native=window.Worker;
  window.Worker=class extends Native{
   constructor(...args){super(...args);this.addEventListener('message',({data:m})=>{if(m?.type==='loaded'&&m.offline&&m.offline.advancedWorldMs>=(window.smoke.loaded?.advancedWorldMs??-1))window.smoke.loaded={cap:m.offline.capHours,advancedWorldMs:m.offline.advancedWorldMs,recovered:m.recovered};});}
   postMessage(m,...args){if(m?.type==='command')window.smoke.commands++;return super.postMessage(m,...args);}
  };
 });
 const page=await ctx.newPage();page.setDefaultTimeout(90_000);
 const launch=performance.now();
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const load=page.getByRole('button',{name:'載入進度',exact:true});
 const ready=await load.isVisible();
 await load.waitFor();
 const click=performance.now();await load.click();
 const panel=page.locator('.formal-city-panel');await panel.waitFor();
 await page.waitForFunction(()=>window.smoke.loaded!==null);
 const summary=page.getByRole('dialog').filter({hasText:'你離開後的河谷'});
 if(await summary.isVisible())await summary.getByRole('button',{name:'關閉對話框',exact:true}).click();
 const {loaded,commands}=await page.evaluate(()=>window.smoke);
 assert.equal(loaded.recovered,false);assert.equal(loaded.cap,12);
 // Startup delay after backdating means slightly more than 25h can elapse.
 // Engine-reported advance, not label text, must lie inside the measured window.
 assert(loaded.advancedWorldMs>=25*HOUR&&loaded.advancedWorldMs<26*HOUR,'Synthetic UI replay outside the expected 25–26 world-hour window');
 const picker=page.getByRole('combobox',{name:'切換目前城市',exact:true});
 const selectStart=performance.now();
 await picker.selectOption(seed.secondCity);
 await panel.getByRole('heading',{name:'離線測試乙城',exact:true}).waitFor();
 const interactive=performance.now();
 assert.equal(await page.evaluate(()=>window.smoke.commands),commands);
 await page.close();
 const reopen=await ctx.newPage();await reopen.goto(new URL('version.json',base).href);
 const persisted=await reopen.evaluate(async()=>{
  const {FormalPersistence}=await import('/src/game/persistence.ts');const p=new FormalPersistence();
  try{const x=await p.loadSave(),w=x.game;return {found:!!w,recovered:x.recovered,speed:w?.speed,cap:w?.offlineHours,revision:w?.revision,time:w?.time};}
  finally{p.db.close();}
 });
 assert(persisted.found&&!persisted.recovered&&persisted.speed===25&&persisted.cap===12&&persisted.revision>seed.revision&&persisted.time>=seed.time+loaded.advancedWorldMs);
 await fs.writeFile(output,JSON.stringify({engine:'native Chromium, mobile viewport, actual Vite app, synthetic only',browser:browser.version(),initialButtonVisibleAtFirstCheck:ready,
   storedSpeed:seed.speed,storedCap:seed.cap,advancedWorldMs:loaded.advancedWorldMs,freshPersistenceReopen:true,noGameCommandDuringSelection:true,
   launchToInteractiveMs:interactive-launch,continueToInteractiveMs:interactive-click,selectToMatchedPanelMs:interactive-selectStart},null,2),{mode:0o600});
}finally{await browser.close();}
