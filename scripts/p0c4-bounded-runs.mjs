// Bounded diagnosis/ABBA, not the >=30-per-group final performance gate.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
const [mode,pw,fixtures,prepared,beforeURL,afterURL,out]=process.argv.slice(2);if(!['trace','abba'].includes(mode))throw Error('mode: trace or abba');
fs.mkdirSync(out,{recursive:true});const runs=[];
const groups=mode==='trace'?[[168,true,10],[96,false,10],[168,false,50],[168,true,50],[0,false,10]]:[[168,true,10],[96,false,10],[168,false,50],[168,true,50]];
for(const [hours,mobile,speed]of groups)for(const [pass,variant]of (mode==='trace'?['after']:['before','after','after','before']).entries()){
 const name=`${hours}h-${mobile?'mobile':'desktop'}-${speed}x-${pass}-${variant}`,dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});const fd=fs.openSync(dir+'.log','w'),started=new Date().toISOString(),loadBefore=os.loadavg();console.log(JSON.stringify({start:name,mode}));
 const r=spawnSync(process.execPath,[mode==='trace'?'scripts/p0c4-trace-run.mjs':'scripts/p0c-master-mixed-latency.mjs',pw,fixtures,dir,variant==='before'?beforeURL:afterURL],{stdio:['ignore',fd,fd],env:{...process.env,P0C_PREPARED_INPUTS:prepared,P0C_INPUT_HOURS:String(hours),P0C_MOBILE:mobile?'1':'0',P0C_MEASURE_SPEEDS:JSON.stringify([speed]),P0C9_LATENCY_SAMPLES:'5',P0C_PROFILE:mode==='trace'?'1':'0'}});fs.closeSync(fd);
 const resultFile=path.join(dir,'result.json'),result=fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')):null;
 runs.push({name,mode,hours,mobile,speed,pass,variant,started,finished:new Date().toISOString(),exit:r.status,loadBefore,loadAfter:os.loadavg(),freeMemory:os.freemem(),valid:result?.cases.reduce((n,c)=>n+c.samples.length,0),invalid:result?.cases.reduce((n,c)=>n+c.invalid.length,0),inputHashes:result?.inputs,testedRelease:result?.testedRelease});
 fs.writeFileSync(path.join(out,'runs.json'),JSON.stringify(runs,null,2));console.log(JSON.stringify({done:name,exit:r.status,valid:runs.at(-1).valid,invalid:runs.at(-1).invalid}));
 if(!result)throw Error('Setup failed; original log retained. No missing run is counted as a command success.');
 if(r.status!==0)process.exitCode=1;
}
