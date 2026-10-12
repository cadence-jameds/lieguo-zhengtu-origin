/// <reference lib="webworker" />
import {DeveloperSession} from './session';
import {runDeveloperChecks,type CheckResult} from './checks';
import type {DeveloperConfig} from './scenarios';
import type {FormalCommand} from '../formal/model';
import {trialPreview,type TrialRequest,type TrialInfo} from './specTrials';
export type DeveloperRequest={type:'start';config:DeveloperConfig}|{type:'trial';request:TrialRequest}|{type:'command';payload:FormalCommand}|{type:'advance';realMs:number;next?:boolean}|{type:'reload'|'restore'|'checks'|'close'};
const session=new DeveloperSession(),post=(data:unknown)=>self.postMessage(data);let queue:Promise<unknown>=Promise.resolve(),results:CheckResult[]=[],checksConfig:DeveloperConfig|null=null;
let trial:TrialInfo|null=null,preview:ReturnType<typeof trialPreview>=null;
self.onmessage=({data}:{data:DeveloperRequest})=>{
 queue=queue.then(async()=>{
  if(data.type==='close'){await session.dispose();post({type:'closed'});return;}
  if(data.type==='start'){await session.start(data.config);trial=null;preview=null;}
  if(data.type==='trial'){trial=await session.startTrial(data.request);preview=trialPreview(session.world!,trial);}
  if(data.type==='command'){const ack=await session.command(data.payload);post({type:'notice',text:ack?.reason??'命令已保存。'});}
  if(data.type==='advance')await session.advance(data.realMs,data.next);
  if(data.type==='reload')await session.reload();
  if(data.type==='restore')await session.restore();
  if(data.type==='checks'){
   if(!session.config)throw new Error('請先建立測試情境。');results=[];checksConfig={...session.config};post({type:'checksStarted',config:checksConfig});
   results=await runDeveloperChecks(result=>post({type:'check',result}),session.config);
  }
  post({type:'state',world:session.world,logs:session.logs,config:session.config,results,checksConfig,trial,preview});
 }).catch(e=>post({type:'error',text:e instanceof Error?e.message:String(e)})).finally(()=>post({type:'done'}));
};
