/** Node built-worker contract check. This is NOT a browser/FPS benchmark. */
const fs=require('fs'),{Worker}=require('worker_threads'),assert=require('assert/strict');
(async()=>{
 const file=fs.readdirSync('dist/assets').find(n=>/^mapRaster\.worker-.*\.js$/.test(n));assert.ok(file,'Formal map pixel worker exists');
 const source=fs.readFileSync('dist/assets/'+file,'utf8'),scene=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const worker=new Worker("const {parentPort}=require('worker_threads');globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};"+source+"\n;parentPort.on('message',data=>self.onmessage({data}));",{eval:true});
 let ticks=0;const interval=setInterval(()=>ticks++,10),start=performance.now(),wait=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
 worker.postMessage({type:'init',world:{seed:90217,dimensions:{width:384,height:384},worldLayer:{terrain:scene.terrain}},generation:7});worker.postMessage({type:'paint',key:'80,150:2',cx:80,cy:150,quality:2});
 const r=await wait;clearInterval(interval);await worker.terminate();assert.equal(r.generation,7);assert.equal(r.error,undefined);assert.equal(r.pixels.width,1408);assert.equal(r.pixels.height,768);assert.equal(r.pixels.data.length,1408*768*4);assert.ok(ticks>0);
 console.log(JSON.stringify({status:'PASS',environment:'Node worker_threads; not browser',builtWorker:file,width:r.pixels.width,height:r.pixels.height,elapsedMs:Math.round(performance.now()-start),mainThreadHeartbeats:ticks}));
})().catch(e=>{console.error(e);process.exitCode=1;});
