import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]??'/tmp/b9-memory'),plan=process.env.B9_MEMORY_PLAN??'B1,B2,A2,A3,B3,A4cpu,B4cpu';
const results=[];
for(const name of plan.split(',')){
 const variant=name[0],cwd=path.join(root,variant),out=path.join(root,'raw',name),report=path.join(root,'raw',name+'-tests.json');
 if(fs.existsSync(out))throw Error('Refusing to overwrite diagnostic evidence: '+out);fs.mkdirSync(out,{recursive:true,mode:0o700});
 const log=fs.openSync(path.join(root,name+'.log'),'w');console.log('START',name,new Date().toISOString());
 const result=spawnSync(process.execPath,['--expose-gc','node_modules/vitest/vitest.mjs','run','src/game/formal/breakthroughB92.test.ts','--config','docs/validation/b10-release-unblock/b9-memory/config.ts','--maxWorkers=2','--testTimeout=30000','--reporter=json','--outputFile='+report],{cwd,env:{...process.env,B9_MEMORY_VARIANT:variant,B9_MEMORY_OUT:out,B9_MEMORY_CPU:name.endsWith('cpu')?'1':'0',B9_MEMORY_SNAPSHOT:process.env.B9_MEMORY_SNAPSHOT??'0'},stdio:['ignore',log,log]});fs.closeSync(log);
 const tests=fs.existsSync(report)?JSON.parse(fs.readFileSync(report,'utf8')):undefined,memory=fs.existsSync(path.join(out,'report.json'))?JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8')):undefined;
 const row={name,status:result.status,success:tests?.success,passed:tests?.numPassedTests,failed:tests?.numFailedTests,trips:memory?.trips,peak:memory?.observedPeak,finished:new Date().toISOString()};results.push(row);fs.writeFileSync(path.join(root,'completed.json'),JSON.stringify(results,null,2));console.log('END',JSON.stringify(row));
 if(result.error||result.status!==0||!tests?.success||tests.numPassedTests!==11||memory?.trips!==2000)throw result.error??Error('Diagnostic failure; preserve evidence and stop: '+name);
}
