// Aggregate completed diagnostics only. Raw profiles/saves are never copied to Git.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]??'/tmp/b9-memory');
const names=['A1','B1','B2','A2','A3','B3','A4cpu','B4cpu'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=p=>({bytes:fs.statSync(p).size,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const fields=['rss','heapUsed','heapTotal','external','arrayBuffers'];
const stages=['hook_end','suite_end','idle_20s','post_suite_gc','context_churn_10_gc','context_churn_30_gc','context_churn_60_gc','cache_context_cleared_gc','final_idle'];
const rows=names.map(name=>{
 const folder=path.join(root,'raw',name),report=read(path.join(folder,'report.json')),tests=read(path.join(root,'raw',name+'-tests.json'));
 if(!tests.success||tests.numFailedTests!==0||tests.numPassedTests!==11||report.trips!==2000)throw Error('Incomplete/failed diagnostic: '+name);
 const points=Object.fromEntries(report.points.map(p=>[p.label,p]));
 for(const stage of stages)if(!points[stage])throw Error('Missing stage '+name+': '+stage);
 const artifacts=Object.fromEntries(fs.readdirSync(folder).filter(f=>['report.json','hook.json','profile.cpuprofile'].includes(f)).map(f=>[f,digest(path.join(folder,f))]));
 artifacts['tests.json']=digest(path.join(root,'raw',name+'-tests.json'));
 return{name,variant:report.variant,cpuProfile:report.cpuProfile,tests:{passed:tests.numPassedTests,failed:tests.numFailedTests,success:tests.success},trips:report.trips,
  environment:{node:report.node,execArgv:report.execArgv,cpuModel:report.cpuModel,cpuQuota:report.cpuQuota,memoryLimit:report.memoryLimit,heapLimit:report.heapLimit},
  boundaries:report.boundaries,observedWorkloadPeak:report.observedPeak,workloadOsMaxRssBytes:points.suite_end.maxRssBytes,
  hookMs:points.hook_end.ms-points.hook_start.ms,originalSuiteMs:points.suite_end.ms-points.hook_start.ms,
  originalSuiteGc:points.suite_end.gc,points:report.points.filter(p=>stages.includes(p.label)||p.label.startsWith('profiler_')),
  postGcHeapGrowth10To60Bytes:points.context_churn_60_gc.heapUsed-points.context_churn_10_gc.heapUsed,
  heapReleasedByContextClearBytes:points.context_churn_60_gc.heapUsed-points.cache_context_cleared_gc.heapUsed,
  finalIdleHeapGrowthBytes:points.final_idle.heapUsed-points.cache_context_cleared_gc.heapUsed,artifacts};
});
const distribution=values=>{const sorted=[...values].sort((a,b)=>a-b);return{n:sorted.length,min:sorted[0],median:sorted[Math.floor(sorted.length/2)],max:sorted.at(-1)};};
const groups=Object.fromEntries(['A','B'].map(variant=>{
 const members=rows.filter(r=>r.variant===variant&&!r.cpuProfile);
 return[variant,{n:members.length,stages:Object.fromEntries(stages.map(stage=>[stage,Object.fromEntries(fields.map(field=>[field,distribution(members.map(r=>r.points.find(p=>p.label===stage)[field]))]))])),
  workloadOsMaxRssBytes:distribution(members.map(r=>r.workloadOsMaxRssBytes)),observedWorkloadPeak:Object.fromEntries(fields.map(f=>[f,distribution(members.map(r=>r.observedWorkloadPeak[f]))])),
  hookMs:distribution(members.map(r=>r.hookMs)),originalSuiteGcMs:distribution(members.map(r=>r.originalSuiteGc.ms)),originalSuiteGcCount:distribution(members.map(r=>r.originalSuiteGc.count)),
  postGcHeapGrowth10To60Bytes:distribution(members.map(r=>r.postGcHeapGrowth10To60Bytes)),heapReleasedByContextClearBytes:distribution(members.map(r=>r.heapReleasedByContextClearBytes))}];
}));
const manifest=read(path.join(root,'manifest.json'));
const workloadHashes=Object.fromEntries(['src/game/formal/breakthroughB92.test.ts','src/game/formal/breakthroughTestSupport.ts'].map(f=>[f,{A:digest(path.join(root,'A',f)),B:digest(path.join(root,'B',f))}]));
const summary={date:'2026-11-10',manifest,workloadHashes,method:{normalOrder:['A1','B1','B2','A2','A3','B3'],normalSamplesPerVariant:3,cpuProfilerControlSamplesPerVariant:1,originalBeforeAllMs:240000,maxWorkers:2,
  units:'bytes and milliseconds; report prose uses decimal MB',gc:'--expose-gc in independent diagnostic only. Three collections after original tests plus 20s idle; none during original workload.',
  peaks:'OS maxRSS at suite_end is the original workload high-water. Other peaks are samples at clone/schema/trip boundaries, not guaranteed instantaneous heap maxima.',
  contextStress:'60 read-only re-parses of the real funded 800+2000 records with distinct diagnostic campaign contexts. Not additional commands or a formal Gate.',
  caveats:['Single test file permits at most 2 workers but has one active file worker; this does not reproduce concurrent full-suite contention.','All workers share cgroup quota 2 CPU / 8GiB. Runs are sequential, no concurrent browser/benchmark.','A1 config predates adding the inactive legacy CPU-plugin import in the parent. Active normal worker instrumentation is unchanged; do not treat small timing differences as precise speedup.','Natural idle GC timing varies. Post-GC heap is diagnostic live-heap evidence, not a production forced-GC technique.','CPU controls include Inspector and legacy profiling wrappers; n=1 is a tool-overhead probe, not a statistical comparison.','No Android/native-browser memory result is claimed.']},groups,runs:rows};
const output=path.join(root,'summary.json');fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
for(const variant of ['A','B']){const g=groups[variant];console.log(variant,JSON.stringify({peakRss:g.workloadOsMaxRssBytes,gcMs:g.originalSuiteGcMs,gcCount:g.originalSuiteGcCount,stages:g.stages,liveGrowth:g.postGcHeapGrowth10To60Bytes}));}
console.log(output);
