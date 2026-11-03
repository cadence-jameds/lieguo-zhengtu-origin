// Run from the repository root after starting serve-runtime-validation with
// B10_OBSERVE=1. This extends, and preserves all assertions in, the original
// 600000ms soak. No synthetic clock messages or forced GC enter the run.
import fs from 'node:fs/promises';
let source=await fs.readFile('scripts/soak-runtime-browser.mjs','utf8');
source=source.replace("new URL('./fixtures/r306/'", "new URL('../scripts/fixtures/r306/'");
source=source.replace("const start=Date.now(),initial=", "const cpuStart=await fs.readFile('/sys/fs/cgroup/cpu.stat','utf8');const start=Date.now(),initial=");
source=source.replace("report.start=initial;", `report.start=initial;
 const cdp=await browser.newBrowserCDPSession(),targets=await cdp.send('Target.getTargets'),target=targets.targetInfos.find(t=>t.type==='worker'&&t.url.includes('/runtime-browser.js'));
 if(!target)throw Error('Runtime Worker CDP target missing');
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let sequence=0;
 const heap=()=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',receive);reject(Error('CDP heap deadline'));},10000),receive=m=>{if(m.sessionId!==sessionId)return;const r=JSON.parse(m.message);if(r.id!==id)return;clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',receive);r.error?reject(Error(JSON.stringify(r.error))):resolve(r.result);};cdp.on('Target.receivedMessageFromTarget',receive);cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method:'Runtime.getHeapUsage',params:{}})}).catch(reject);});
 report.initialWorkerHeap=await heap();`);
source=source.replace("report.points.push({elapsedMs:Date.now()-start,...data});", `
 await page.evaluate(()=>{window.metrics=null;window.runtime.postMessage({type:'harness-dump'});});await page.waitForFunction(()=>window.metrics);
 const evidence=await page.evaluate(()=>({observed:window.observed,metrics:window.metrics}));
 report.points.push({elapsedMs:Date.now()-start,...data,workerHeap:await heap(),cpuStat:await fs.readFile('/sys/fs/cgroup/cpu.stat','utf8'),evidence});
 await fs.writeFile('artifacts/b10-final/soak-progress.json',JSON.stringify(report,null,2));`);
source=source.replace("report.elapsedMs=Date.now()-start;", "report.cpuStart=cpuStart;report.cpuEnd=await fs.readFile('/sys/fs/cgroup/cpu.stat','utf8');report.elapsedMs=Date.now()-start;");
source=source.replace("artifacts/b10-r3-06/native-realtime-soak.json", "artifacts/b10-final/native-realtime-soak.json");
await fs.mkdir('artifacts/b10-final',{recursive:true});
await fs.writeFile('artifacts/b10-final-soak.mjs',source);
await import('../../../artifacts/b10-final-soak.mjs');
