// C4-only clone changes need compatibility, not another unconditional 35-case C9 study.
// Manual dispatch and every other Runtime/AI/measurement change retain the full matrix.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const base='9f08fd63d8e7928add4048ff5f7c3aa2d1048fc7';
export function matrixFor(files,event){
const runtime=files.filter(p=>p.startsWith('src/')&&!/\.test\.tsx?$/.test(p));
const measurement=files.some(p=>/^scripts\/p0c9-(prepare|simulate|matrix)\.mjs$/.test(p));
const narrow=event==='push'&&!measurement&&runtime.length>0&&runtime.every(p=>['src/game/formal/reducer.ts','src/game/formal/worldDraft.ts','src/game/worldStream.ts'].includes(p));
const modes=['traits','A48','V2B48','V3Parallel48','WildPriority60','WildParallel48','equal'],include=[];
if(narrow)include.push({hours:168,seed:90217,policy:'traits'});
else for(const hours of [720,360,168])for(const seed of hours===720?[90217]:[90217,104729])for(const policy of modes)include.push({hours,seed,policy});
return {scope:narrow?'C4 draft/stream-only: natural 99 AI compatibility; prior full C9 evidence retained':'full C9 natural-world matrix',base,runtime,include};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const files=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),result=matrixFor(files,process.env.GITHUB_EVENT_NAME);const {include}=result;
console.log(JSON.stringify(result));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify({include})+'\n');

}
