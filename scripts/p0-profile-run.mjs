import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import inspector from 'node:inspector';
import {MessageChannel} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {profiler} from './p0-profile-metrics.mjs';

const directory=path.resolve(process.env.P0_SOURCE_DIR??path.join(process.cwd(),'artifacts/p0/compiled'));
const savePath=process.env.P0_SAVE_PATH;
const synthetic=process.env.P0_SYNTHETIC==='1';
if(!savePath&&!synthetic)throw new Error('P0_SAVE_PATH or P0_SYNTHETIC=1 is required.');
if(savePath&&synthetic)throw new Error('Choose either private save or synthetic input.');
const hours=Number(process.env.P0_HOURS??0),speed=Number(process.env.P0_SPEED??10);
if(![0,0.1,0.25,1,6,24].includes(hours)||![1,10,50].includes(speed))throw new Error('Unsupported benchmark duration/speed');
const label=process.env.P0_LABEL??`${synthetic?'synthetic':'private'}-${hours}h-${speed}x`,resultsDir=path.resolve(process.env.P0_RESULTS_DIR??path.join(process.cwd(),'artifacts/p0/results'));
if(!/^[A-Za-z0-9_.-]+$/.test(label))throw new Error('P0_LABEL must contain only letters, numbers, underscores, periods or hyphens.');
fs.mkdirSync(resultsDir,{recursive:true,mode:0o700});
const metadata=JSON.parse(fs.readFileSync(path.join(directory,'source-metadata.json'),'utf8'));
const require=createRequire(path.join(directory,'package.json'));
const {TraceMap,originalPositionFor}=require('@jridgewell/trace-mapping');
const cpuEnabled=process.env.P0_CPU_PROFILE!=='0';
if(metadata.instrumented)profiler.installGlobals();
await import(path.join(directory,'node_modules/fake-indexeddb/auto/index.mjs'));
const {FormalPersistence}=await import(path.join(directory,'src/game/persistence.js'));
const {decodeSave,encodeSave}=await import(path.join(directory,'src/game/formal/saveCodec.js'));
const {canonicalJSON}=await import(path.join(directory,'src/game/formal/canonical.js'));
const {worldPatch,applyWorldPatch}=await import(path.join(directory,'src/game/worldStream.js'));
const stableHash=value=>createHash('sha256').update(canonicalJSON(value)).digest('hex');
const originalStringify=JSON.stringify.bind(JSON);
const stages={},stagesMetrics={};
async function stage(name,run){const start=performance.now();const result=await run();stages[name]=performance.now()-start;stagesMetrics[name]=profiler.snapshot();profiler.reset();return result;}
const session=new inspector.Session();if(cpuEnabled)session.connect();
const post=(method,args={})=>new Promise((resolve,reject)=>session.post(method,args,(error,result)=>error?reject(error):resolve(result)));
if(cpuEnabled){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');}
const wallStarted=performance.now();
let raw;
if(synthetic){
 const {createFormalWorld}=await import(path.join(directory,'src/game/formal/generator.js'));
 const {enableAutonomy}=await import(path.join(directory,'src/game/formal/autonomy.js'));
 const history=Number(process.env.P0_SYNTHETIC_HISTORY??0),seed=Number(process.env.P0_SYNTHETIC_SEED??90217);
 if(!Number.isSafeInteger(history)||history<0||history>1000000)throw new Error('P0_SYNTHETIC_HISTORY must be an integer from 0 to 1000000.');
 const fixture=await stage('generateSynthetic',()=>{
  const w=createFormalWorld({campaign:'p0-public-benchmark',seed,speed,name:'P0 benchmark',offlineHours:hours===24?24:6});enableAutonomy(w);
  for(let i=0;i<history;i++)w.commandReceipts.push({commandId:`command:p0-history-${String(i).padStart(7,'0')}`,issuerId:w.playerFactionId,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'city.rename',cityId:w.cities[0].id,name:'P0 benchmark'}}),committedRevision:i+1,disposition:'applied'});
  w.revision=history;return w;
 });
 raw=await stage('encodeSynthetic',async()=>JSON.stringify(await encodeSave(fixture)));
}else raw=await stage('fileRead',()=>fs.readFileSync(savePath,'utf8'));
const envelope=await stage('JSON.parse',()=>JSON.parse(raw));
const decoded=await stage('decodeSchemaChecksumMigration',()=>decodeSave(envelope));
const world=decoded.world;
const factionRoleById=new Map(world.factions.map(f=>[f.id,f.role]));
const inputStats={bytes:Buffer.byteLength(raw),version:world.metadata.appVersion,schema:world.metadata.schemaVersion,revision:world.revision,time:world.time,factions:world.factions.length,aiFactions:world.factions.filter(f=>f.role==='ai').length,cities:world.cities.length,autonomyAgents:world.autonomy?.agents.length??0,commandReceipts:world.commandReceipts.length,aiCommandReceipts:world.commandReceipts.filter(r=>factionRoleById.get(r.issuerId)==='ai').length,autonomousCommandIdPrefixReceipts:world.commandReceipts.filter(r=>r.commandId.startsWith('command:ai-')).length,pendingEvents:world.events.length,combatReceipts:world.combat?.receipts.length??0,bundledReports:decoded.reports?.length??0,speed:world.speed,offlineHours:world.offlineHours};
// Only a private test copy changes the legal offline cap/speed; the original is never written.
if(hours===24)world.offlineHours=24;
world.speed=speed;
if(world.developer?.enabled)world.developer.speed=speed;
const savedAt=1700000000000,controlledNow=savedAt+hours*3600000;
const originalDateNow=Date.now;Date.now=()=>controlledNow;
const inputHash=await stage('inputDeterministicHash',()=>stableHash(world));
const seedEnvelope=await stage('encodeSeed',()=>encodeSave(world));
const store=new FormalPersistence({suffix:`p0-private-${process.pid}`});
await stage('seedFakeIndexedDB',()=>store.db.transaction('rw',store.db.saves,store.db.backups,store.db.BattleReports,async()=>{
 await store.db.saves.bulkPut([
  {id:'current',kind:'world',at:savedAt,data:seedEnvelope},
  {id:'authority',kind:'authority',revision:world.revision,sequences:{...world.sequences},campaigns:[{campaignId:world.campaignId,receipts:world.commandReceipts}]}
 ]);
 await store.db.backups.add({at:savedAt,label:'private baseline',campaignId:world.campaignId,gameTime:world.time,reportCursor:world.sequences.report,data:seedEnvelope});
 if(decoded.reports?.length)await store.db.BattleReports.bulkPut(decoded.reports.map(r=>({...r,key:r.campaignId+'/'+r.id})));
}));
profiler.reset();
const progress=[];
let loadStage='',lastStageAt=performance.now(),lastProgressAt=lastStageAt,lastEvents=0;
const loadStarted=performance.now();
const loadResourceStarted=process.resourceUsage();
const loadResult=await store.loadWithOffline(controlledNow,(name,fraction,events)=>{
 const at=performance.now();profiler.sampleMemory();
 if(name!==loadStage){if(loadStage)stages[`loadWithOffline.${loadStage}`]=at-lastStageAt;loadStage=name;lastStageAt=at;}
 if(events!==undefined)lastEvents=events;
 if(name==='offline'&&fraction!==undefined&&(at-lastProgressAt>15000||fraction===1)){
  const update={label,elapsedMs:at-loadStarted,fraction,events};progress.push(update);
  fs.writeFileSync(path.join(resultsDir,`${label}.interim.private.json`),originalStringify({update,...profiler.snapshot()}),{mode:0o600});
  fs.appendFileSync(path.join(resultsDir,`${label}.progress.jsonl`),originalStringify(update)+'\n');
  console.log(originalStringify({progress:update}));lastProgressAt=at;
 }
});
stages[`loadWithOffline.${loadStage}`]=performance.now()-lastStageAt;
stages.loadWithOffline=performance.now()-loadStarted;
const pipelineProfile=profiler.snapshot();profiler.reset();
if(metadata.instrumented||metadata.recordEvents){
 const counted=Object.entries(pipelineProfile.metrics).filter(([k])=>k.startsWith('event.')).reduce((n,[,m])=>n+m.count,0);
 if(pipelineProfile.eventCount!==lastEvents||counted!==lastEvents)throw new Error('Event instrumentation and production progress counts disagree.');
}
const pipelineResource=process.resourceUsage();
const profile=cpuEnabled?(await post('Profiler.stop')).profile:{nodes:[],samples:[],timeDeltas:[]};if(cpuEnabled)session.disconnect();
if(cpuEnabled)fs.writeFileSync(path.join(resultsDir,`${label}.cpuprofile`),originalStringify(profile),{mode:0o600});
const finalWorld=loadResult.game;
if(!finalWorld)throw new Error('No final world');
const finalHash=await stage('outputDeterministicHash',()=>stableHash(finalWorld));
// Golden private snapshots support later baseline/optimized state equality checks.
fs.writeFileSync(path.join(resultsDir,`${label}.world.private.json`),originalStringify(finalWorld),{mode:0o600});
const rows=await stage('readPersistedRowsFakeIndexedDB',()=>store.db.transaction('r',store.db.saves,store.db.backups,store.db.BattleReports,async()=>({saves:await store.db.saves.toArray(),backups:await store.db.backups.toArray(),reports:await store.db.BattleReports.toArray()})));
await stage('IndexedDB.backupEnvelopesToArray',()=>store.db.backups.orderBy('id').toArray());
await stage('IndexedDB.backupPrimaryKeys',()=>store.db.backups.orderBy('id').primaryKeys());
fs.writeFileSync(path.join(resultsDir,`${label}.database.private.json`),originalStringify(rows),{mode:0o600});
const reportsHash=await stage('reportHistoryHash',()=>stableHash(rows.reports));
const reloaded=await stage('loadSavePostReplay',()=>store.loadSave());
const reloadHash=await stage('reloadDeterministicHash',()=>stableHash(reloaded.game));
await stage('JSON.stringify.fullWorld',()=>JSON.stringify(finalWorld));
await stage('structuredClone.fullWorld',()=>structuredClone(finalWorld));
const patch=await stage('worldStream.worldPatch',()=>worldPatch(world,finalWorld));
const patched=await stage('worldStream.applyWorldPatch',()=>applyWorldPatch(world,patch));
const patchedHash=await stage('patchDeterministicHash',()=>stableHash(patched));
async function transfer(value){const {port1,port2}=new MessageChannel();try{const start=performance.now();const done=new Promise(resolve=>port2.once('message',resolve));port1.postMessage(value);await done;return performance.now()-start;}finally{port1.close();port2.close();}}
const fullTransferMs=await stage('workerMessageChannel.fullWorld',()=>transfer({type:'state',world:finalWorld}));
const patchTransferMs=await stage('workerMessageChannel.worldPatch',()=>transfer({type:'state',patch}));
const topCPU=cpuTop(profile);
const eventMetrics=Object.fromEntries(Object.entries(pipelineProfile.metrics).filter(([k])=>k.startsWith('event.')).map(([k,v])=>[k.slice(6),v]));
const functionSelfTop=Object.entries(pipelineProfile.metrics).filter(([k])=>!k.startsWith('event.')).sort((a,b)=>b[1].selfMs-a[1].selfMs).slice(0,10).map(([name,value])=>({name,...value}));
const quota=fs.existsSync('/sys/fs/cgroup/cpu.max')?fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim():null;
const quotaParts=quota?.split(' '),cpuQuota=quotaParts&&quotaParts[0]!=='max'?Number(quotaParts[0])/Number(quotaParts[1]):null;
const memoryLimit=fs.existsSync('/sys/fs/cgroup/memory.max')?fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim():null;
const result={
 label,source:metadata,
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,cgroupCpuMax:quota,cgroupCPUQuota:cpuQuota,cgroupMemoryLimitBytes:memoryLimit&&memoryLimit!=='max'?Number(memoryLimit):null,totalHostMemoryBytes:os.totalmem(),method:'Node V8 CPU sampling + private TypeScript function/event timers; fake-indexeddb; Node MessageChannel; controlled wall clock. Not Android or Chromium.',instrumentation:metadata.instrumented,cpuProfiling:cpuEnabled,contentionNote:process.env.P0_CONTENTION??'not recorded'},
 configuration:{hours,speed,savedAt,now:controlledNow,offlineCapHours:world.offlineHours,synthetic},inputStats,elapsedMs:performance.now()-wallStarted,stagesMs:stages,
 pausedMs:pipelineProfile.pausedMs,activeLoadElapsedMs:stages.loadWithOffline-pipelineProfile.pausedMs,activeOfflineElapsedMs:stages['loadWithOffline.offline']-pipelineProfile.pausedMs,
 pipelineCPU:{userMs:(pipelineResource.userCPUTime-loadResourceStarted.userCPUTime)/1000,systemMs:(pipelineResource.systemCPUTime-loadResourceStarted.systemCPUTime)/1000},
 processedEvents:pipelineProfile.eventCount||lastEvents,eventMetrics,functionSelfTop,cpuTop10:topCPU.filter(c=>c.name!=='(idle)').slice(0,10),cpuSampledMs:topCPU.reduce((n,c)=>n+c.selfSampledMs,0),peakMemoryBytes:pipelineProfile.peakMemoryBytes,peakRSSResourceBytes:pipelineResource.maxRSS*1024,pipelineMetrics:pipelineProfile.metrics,stageMetrics:stagesMetrics,
 workerTransfer:{fullTransferMs,patchTransferMs,patchKeys:Object.keys(patch.changes)},
 output:{time:finalWorld.time,revision:finalWorld.revision,commandReceipts:finalWorld.commandReceipts.length,combatReceipts:finalWorld.combat?.receipts.length??0,pendingEvents:finalWorld.events.length,reports:rows.reports.length,autonomyDecisions:finalWorld.autonomy?.agents.reduce((n,a)=>n+a.decisions,0)??0,acceptedAI:finalWorld.autonomy?.accepted,rejectedAI:finalWorld.autonomy?.rejected},
 consistency:{inputHash,worldHash:finalHash,reportHistoryHash:reportsHash,eventOrderHash:pipelineProfile.eventOrderHash,reloadHash,patchHash:patchedHash,reloadMatches:reloadHash===finalHash,patchMatches:patchedHash===finalHash},progress
};
fs.writeFileSync(path.join(resultsDir,`${label}.metrics.private.json`),originalStringify(result,null,2),{mode:0o600});
// Summary contains aggregate counts/timings only; raw worlds/profiles remain private.
console.log(originalStringify({summary:{label,configuration:result.configuration,inputStats,stagesMs:stages,processedEvents:result.processedEvents,eventMetrics,cpuTop10:result.cpuTop10,functionSelfTop,peakMemoryBytes:result.peakMemoryBytes,peakRSSResourceBytes:result.peakRSSResourceBytes,output:result.output,consistency:result.consistency,workerTransfer:result.workerTransfer}},null,2));
store.db.close();await store.db.delete();Date.now=originalDateNow;

function cpuTop(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const totals=new Map();
 for(let i=0;i<(profile.samples?.length??0);i++){const frame=nodes.get(profile.samples[i]).callFrame,dt=(profile.timeDeltas?.[i]??1000)/1000,key=[frame.functionName,frame.url,frame.lineNumber].join('|');if(!totals.has(key))totals.set(key,{frame,selfSampledMs:0});totals.get(key).selfSampledMs+=dt;}
 const grand=[...totals.values()].reduce((n,v)=>n+v.selfSampledMs,0),active=[...totals.values()].filter(v=>v.frame.functionName!=='(idle)').reduce((n,v)=>n+v.selfSampledMs,0);
 const maps=new Map();
 return [...totals.values()].map(({frame,selfSampledMs})=>{let url=frame.url.replace('file://'+directory+'/','').replace(directory+'/','').replace(/.*node_modules\//,'node_modules/'),line=frame.lineNumber+1;
  if(frame.url.startsWith('file://'+directory+'/src/')){
   const file=frame.url.slice(7)+'.map';
   if(!maps.has(file))maps.set(file,fs.existsSync(file)?new TraceMap(JSON.parse(fs.readFileSync(file,'utf8'))):null);
   const map=maps.get(file),position=map?originalPositionFor(map,{line:frame.lineNumber+1,column:Math.max(0,frame.columnNumber)}):null;
   if(position?.line){line=position.line;url=position.source?.includes('/src/')?position.source.slice(position.source.lastIndexOf('/src/')+1):url.replace(/\.js$/,'.ts');}
  }
  return{name:frame.functionName||'(anonymous)',file:url,line,selfSampledMs,percent:selfSampledMs/grand*100,activePercent:selfSampledMs/active*100};}).sort((a,b)=>b.selfSampledMs-a.selfSampledMs);
}
