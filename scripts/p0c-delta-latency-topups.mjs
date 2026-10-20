// Only fill groups below the original 30-valid target; keep original attempts intact.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
const [pw,fixtures,primary,statistics,out]=process.argv.slice(2),stats=JSON.parse(fs.readFileSync(statistics,'utf8')),groups=new Map();
for(const g of stats.groups)if(g.n<30)groups.set(`${g.hours}-${g.mobile}-${g.speed}`,g);
fs.mkdirSync(out,{recursive:true});const runs=[];
for(const g of groups.values())for(const [pass,variant] of ['main','candidate','candidate','main'].entries()){
 const name=`supplement-${g.hours}h-${g.mobile?'mobile':'desktop'}-${g.speed}x-${pass}-${variant}`,dir=path.join(out,name),log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');
 console.log(JSON.stringify({start:name}));const r=spawnSync(process.execPath,['scripts/p0c-master-mixed-latency.mjs',pw,fixtures,dir,variant==='main'?'http://127.0.0.1:4313/lieguo-zhengtu-origin/':'http://127.0.0.1:4311/lieguo-zhengtu-origin/'],{stdio:['ignore',fd,fd],env:{...process.env,P0C_INPUT_HOURS:String(g.hours),P0C_MOBILE:g.mobile?'1':'0',P0C_MEASURE_SPEEDS:JSON.stringify([g.speed]),P0C9_LATENCY_SAMPLES:'5'}});fs.closeSync(fd);
 runs.push({name,variant,hours:g.hours,mobile:g.mobile,pass,supplement:true,measuredSpeed:g.speed,hostLoad:os.loadavg(),freeMemory:os.freemem(),exit:r.status,result:fs.existsSync(path.join(dir,'result.json'))?JSON.parse(fs.readFileSync(path.join(dir,'result.json'),'utf8')):null});
 fs.writeFileSync(path.join(out,'runs.json'),JSON.stringify(runs,null,2));console.log(JSON.stringify({done:name,exit:r.status}));
}
const combined=path.join(out,'combined');fs.mkdirSync(combined,{recursive:true});const base=JSON.parse(fs.readFileSync(path.join(primary,'runs.json'),'utf8')),summary=JSON.parse(fs.readFileSync(path.join(primary,'summary.json'),'utf8'));
fs.writeFileSync(path.join(combined,'runs.json'),JSON.stringify([...base,...runs],null,2));
fs.writeFileSync(path.join(combined,'summary.json'),JSON.stringify({environment:summary.environment,baselineRole:summary.baselineRole,method:'Original 24-pass ABBA, 15 attempts/pass, 30 planned per variant/group; only below-target groups receive an additional matched five-command ABBA. Original failed attempts retained.',primaryRuns:base.length,supplementaryRuns:runs.length},null,2));
