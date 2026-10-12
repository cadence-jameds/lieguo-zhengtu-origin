import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import readline from 'node:readline';
const outDir=path.dirname(fileURLToPath(import.meta.url));
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-TW',timezoneId:'Asia/Taipei'});
await context.addInitScript(()=>{
 window.__runtime=[];
 const Native=window.Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);this.addEventListener('message',e=>{
   const d=e.data;
   if(['state','switched','commandAck'].includes(d.type))window.__runtime.push({direction:'response',at:performance.now(),type:d.type,ack:d.ack,revision:d.world?.revision??d.patch?.changes.revision,patch:d.patch?{base:d.patch.baseRevision,revision:d.patch.changes.revision}:undefined,passiveRevisionBase:d.passiveRevisionBase});
  });}
  postMessage(d,...args){if(d.type==='command')window.__runtime.push({direction:'request',at:performance.now(),...d});return super.postMessage(d,...args);}
 };
});
const page=await context.newPage(),logs=[],actions=[];
page.on('console',m=>logs.push({type:'console',level:m.type(),text:m.text(),at:new Date().toISOString()}));
page.on('pageerror',e=>logs.push({type:'pageerror',message:e.message}));
page.on('requestfailed',r=>logs.push({type:'requestfailed',url:r.url(),failure:r.failure()}));
page.on('response',r=>{if(r.status()>=400)logs.push({type:'http-error',url:r.url(),status:r.status()});});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
page.setDefaultTimeout(10000);
const flush=async()=>{
 await fs.writeFile(path.join(outDir,'console.json'),JSON.stringify(logs,null,2));
 await fs.writeFile(path.join(outDir,'actions.json'),JSON.stringify(actions,null,2));
 await fs.writeFile(path.join(outDir,'runtime.json'),JSON.stringify(await page.evaluate(()=>window.__runtime),null,2));
};
console.log(JSON.stringify({ready:true,browser:browser.version(),text:await page.locator('body').innerText()}));
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 if(!line.trim())continue;let task;
 try{task=JSON.parse(line);const result=await new Function('page','context','browser','fs','path','outDir',`return (async()=>{${task.code}})();`)(page,context,browser,fs,path,outDir);
  if(task.shot)await page.screenshot({path:path.join(outDir,task.shot),fullPage:true});
  actions.push({at:new Date().toISOString(),...task,result});await flush();console.log(JSON.stringify({ok:true,id:task.id,result}));
  if(task.close){await browser.close();break;}
 }catch(e){actions.push({at:new Date().toISOString(),...task,error:String(e),stack:e.stack});await flush();console.log(JSON.stringify({ok:false,id:task?.id,error:String(e)}));}
}
