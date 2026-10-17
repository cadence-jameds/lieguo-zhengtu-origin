const fs=require('fs'),{Worker}=require('worker_threads'),assert=require('assert/strict');
(async()=>{
 const file=fs.readdirSync('dist/assets').find(n=>/^terrainRaster\.worker-.*\.js$/.test(n));
 const source=fs.readFileSync('dist/assets/'+file,'utf8');
 const worker=new Worker("const {parentPort}=require('worker_threads');globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};"+source+"\n;parentPort.on('message',data=>self.onmessage({data}));",{eval:true});
 let ticks=0;const interval=setInterval(()=>ticks++,10),start=performance.now();
 const wait=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject)});
 worker.postMessage({x:144,y:64,seed:902,version:1,scale:2,generation:7,clearings:[]});
 const result=await wait;clearInterval(interval);await worker.terminate();
 assert.equal(result.generation,7);assert.equal(result.error,undefined);assert.equal(result.pixels.width,1408);assert.equal(result.pixels.height,768);assert.equal(result.pixels.data.length,1408*768*4);assert.ok(ticks>0,'main event loop remained responsive');
 console.log(JSON.stringify({builtWorker:file,width:result.pixels.width,height:result.pixels.height,elapsedMs:Math.round(performance.now()-start),mainThreadHeartbeats:ticks}));
})().catch(e=>{console.error(e);process.exitCode=1});
