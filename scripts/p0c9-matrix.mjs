import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const [compiledArg='artifacts/p0c9/compiled',outArg='artifacts/p0c9/results',parallelArg='2']=process.argv.slice(2);
const compiled=path.resolve(compiledArg),out=path.resolve(outArg),parallel=Number(parallelArg);
if(!Number.isInteger(parallel)||parallel<1||parallel>2)throw Error('Use one or two isolated benchmark processes.');
fs.mkdirSync(out,{recursive:true});
const metadata=JSON.parse(fs.readFileSync(path.join(compiled,'p0c9-harness.json'),'utf8'));
const modes=['A48','V2B48','V3Parallel48','WildPriority60','WildParallel48','equal','traits'];
const jobs=[];for(const hours of [168,360,720])for(const seed of hours===720?[90217]:[90217,104729])for(const mode of modes)jobs.push({seed,hours,mode});
// Discover late-run blockers early while the other process produces the paired 168h baseline.
jobs.sort((a,b)=>(a.hours===720&&a.mode==='traits'?-1:0)-(b.hours===720&&b.mode==='traits'?-1:0));
let next=0,failed=0,completed=0;
async function worker(){
 while(next<jobs.length){
  const job=jobs[next++],label=`${job.seed}-${job.hours}-${job.mode}`,file=path.join(out,label+'.json');
  if(fs.existsSync(file)){
   const r=JSON.parse(fs.readFileSync(file,'utf8'));if(r.head===metadata.head&&r.sourceTreeHash===metadata.sourceTreeHash){completed++;console.log(JSON.stringify({reused:label,head:metadata.head}));continue;}
   throw Error('Existing evidence belongs to another input; use a separate output directory: '+file);
  }
  const fd=fs.openSync(path.join(out,label+'.log'),'w');
  const code=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['scripts/p0c9-simulate.mjs',compiled,String(job.seed),String(job.hours),job.mode,out],{stdio:['ignore',fd,fd]});
   child.on('error',reject);child.on('exit',(code,signal)=>resolve(code??signal??1));
  });fs.closeSync(fd);
  if(code===0)completed++;else{failed++;fs.writeFileSync(path.join(out,label+'.failure.json'),JSON.stringify({...job,head:metadata.head,sourceTreeHash:metadata.sourceTreeHash,exit:code}));}
  console.log(JSON.stringify({label,exit:code,completed,failed,total:jobs.length}));
 }
}
await Promise.all(Array.from({length:parallel},worker));
fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify({head:metadata.head,sourceTreeHash:metadata.sourceTreeHash,jobs,completed,failed,parallel},null,2));
if(failed)process.exitCode=1;
