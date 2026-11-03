// Separate one-sample Main CPU diagnosis, not a replacement for paired samples.
// Reuses the exact real-GameApp cold harness. No production code changes.
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const launch=chromium.launch.bind(chromium),reports=[],base=process.env.B10_BROWSER_URL??'http://127.0.0.1:5184';
chromium.launch=async(...args)=>{const browser=await launch(...args),newPage=browser.newPage.bind(browser),close=browser.close.bind(browser);let session;
 browser.newPage=async(...args)=>{const page=await newPage(...args),goto=page.goto.bind(page);page.goto=async(url,...rest)=>{if(url===base+'/'){session=await page.context().newCDPSession(page);await session.send('Profiler.enable');await session.send('Profiler.start');}return goto(url,...rest);};return page;};
 browser.close=async()=>{if(session){const {profile}=await session.send('Profiler.stop'),nodes=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map(),gaps=[];for(let i=0;i<profile.samples.length;i++){const f=nodes.get(profile.samples[i]).callFrame,key=f.functionName+' @ '+f.url.split('/').at(-1),ms=profile.timeDeltas[i]/1000;totals.set(key,(totals.get(key)??0)+ms);if(ms>50)gaps.push({ms,function:key});}reports.push({durationMs:(profile.endTime-profile.startTime)/1000,topLeafSampleMs:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,30),largeSampleGaps:gaps,caveat:'Sampled Main CPU/idle wall intervals, not exact Native Worker GC. Profiler adds overhead; diagnostic only.'});await fs.writeFile('artifacts/b10-r3-05/main-cpu-diagnostic.json',JSON.stringify(reports,null,2));}return close();};return browser;
};
process.env.B10_COUNTS='60000';process.env.B10_SAMPLES='1';process.env.B10_COLD_OUT='artifacts/b10-r3-05/main-cpu-cold-run.json';await import('./benchmark-persistence-cold-browser.mjs');
