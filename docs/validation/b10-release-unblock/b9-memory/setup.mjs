import {afterAll} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import v8 from 'node:v8';
import {Session} from 'node:inspector';
import {performance,PerformanceObserver} from 'node:perf_hooks';

const out=process.env.B9_MEMORY_OUT;if(!out)throw Error('B9_MEMORY_OUT required');fs.mkdirSync(out,{recursive:true});
const cpuProfile=process.env.B9_MEMORY_CPU==='1',snapshot=process.env.B9_MEMORY_SNAPSHOT==='1';
if(typeof global.gc!=='function')throw Error('Independent diagnostic must expose GC; it will not be invoked during the original tests.');
const points=[],weakReaders=[],boundaries={},start=performance.now(),cpu=process.cpuUsage();let world,trips=0,hookStart,work=true;
const peak={rss:0,heapUsed:0,heapTotal:0,external:0,arrayBuffers:0},gc={count:0,ms:0,kinds:{}};
globalThis.__memReader=ref=>weakReaders.push(ref);
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){gc.count++;gc.ms+=e.duration;gc.kinds[e.detail.kind]=(gc.kinds[e.detail.kind]??0)+1;}});observer.observe({entryTypes:['gc']});
function cacheStats(){let alive=0,entries=0,frozen=0,stringUnits=0;const schemas=new Set();
 for(const ref of weakReaders){const reader=ref.deref();if(!reader)continue;alive++;schemas.add(reader.syntax);entries+=reader.entries.size;
  for(const entry of reader.entries.values()){const row=entry.value;if(Object.isFrozen(row)&&Object.isFrozen(row.resources)&&Object.isFrozen(row.authorizationSnapshot))frozen++;for(const v of [...Object.values(row),...Object.values(row.authorizationSnapshot)])if(typeof v==='string')stringUnits+=v.length;}
 }return{registeredWeakRefs:weakReaders.length,readersAlive:alive,schemas:schemas.size,entries,frozenSnapshots:frozen,stringUnits};
}
function sample(label,keep=true){const memory=process.memoryUsage(),row={label,ms:performance.now()-start,...memory,maxRssBytes:process.resourceUsage().maxRSS*1024};
 if(work)for(const key of Object.keys(peak))peak[key]=Math.max(peak[key],memory[key]);
 if(keep){row.gc=structuredClone(gc);row.cache=cacheStats();points.push(row);}return row;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const session=cpuProfile?new Session():undefined;
const send=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
if(session){session.connect();await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:1000});await send('Profiler.start');}
sample('setup');
// Generated per immutable variant. Only B imports the real cache scope; A's
// post-test read-only cache-churn adapter delegates to the original parser.
const {largeProjectSchema,scope}=await import('./interface.mjs');
globalThis.__memStart=()=>{hookStart=performance.now();sample('hook_start');};
globalThis.__memBoundary=name=>{boundaries[name]=(boundaries[name]??0)+1;sample(name,false);};
globalThis.__memTrip=()=>{if(++trips%128===0)sample('trip_'+trips);};
globalThis.__memHookDone=async value=>{
 world=value;sample('hook_end');
 if(session){let result=await send('Profiler.stop');sample('profiler_stopped_object_live');fs.writeFileSync(path.join(out,'profile.cpuprofile'),JSON.stringify(result.profile));result=undefined;session.disconnect();await pause(0);sample('profiler_disconnected_artifact_dropped');}
 fs.writeFileSync(path.join(out,'hook.json'),JSON.stringify({trips,hookMs:performance.now()-hookStart,points,observedPeak:peak,cpu:process.cpuUsage(cpu)},null,2));
};
async function collect(label){if(typeof global.gc!=='function')throw Error('Diagnostic requires --expose-gc; no GC is called before tests finish.');
 for(let i=0;i<3;i++){await pause(100);global.gc();}await pause(100);return sample(label);
}
afterAll(async()=>{
 sample('suite_end');work=false;
 for(let i=1;i<=4;i++){await pause(5000);sample('idle_'+i*5+'s');}
 await collect('post_suite_gc');
 // Supplemental lifetime probe, NOT simulated commands or a Gate result:
 // repeatedly parse the same real 800+2000 paid shipment records while changing
 // only the diagnostic cache context. No resources, events or world are changed.
 if(world){for(let i=1;i<=60;i++){
  const context={...world,campaignId:'campaign:memory-context-'+i};
  scope(context,()=>{for(const project of world.largeProjects)largeProjectSchema.parse(project);});
  if([10,30,60].includes(i))await collect('context_churn_'+i+'_gc');
 }
 if(snapshot)v8.writeHeapSnapshot(path.join(out,'cache-live-post-gc.heapsnapshot'));
 scope({...world,campaignId:'campaign:memory-release',largeProjects:[]},()=>{});
 await collect('cache_context_cleared_gc');
 }
 if(snapshot){v8.writeHeapSnapshot(path.join(out,'post-gc.heapsnapshot'));sample('after_heap_snapshot');}
 await pause(5000);sample('final_idle');observer.disconnect();
 const report={variant:process.env.B9_MEMORY_VARIANT,cpuProfile,node:process.version,execArgv:process.execArgv,cpuModel:os.cpus()[0].model,cpuQuota:fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim(),memoryLimit:fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),heapLimit:v8.getHeapStatistics().heap_size_limit,trips,boundaries,observedPeak:peak,maxRssBytes:process.resourceUsage().maxRSS*1024,points,cpu:process.cpuUsage(cpu),gc,note:'Independent diagnostic, original 800+2000 workload and 240s Hook unchanged. Exposed GC is invoked ONLY after all original tests and 20s idle. Heap peaks are observed at clone/schema/trip boundaries; OS RSS high-water includes startup and optional final snapshot. Context churn is read-only syntax lifetime stress, not extra gameplay or a Gate.'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 world=undefined;delete globalThis.__memReader;delete globalThis.__memStart;delete globalThis.__memBoundary;delete globalThis.__memTrip;delete globalThis.__memHookDone;
},180000);
