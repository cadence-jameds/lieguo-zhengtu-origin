// Validation only. Both variants run the real uninstrumented persistence paths.
import {FormalPersistence} from '../../../../src/game/persistence';
import {createFormalWorld} from '../../../../src/game/formal/generator';
import {enableAutonomy} from '../../../../src/game/formal/autonomy';
import {submitFormalOrder} from '../../../../src/game/formal/reducer';
import {canonicalJSON,digest} from '../../../../src/game/formal/canonical';
import {captureIntent} from '../../../../src/game/durableCommands';
import type {FormalWorld,FormalOrder} from '../../../../src/game/formal/model';
const scope=self as unknown as DedicatedWorkerGlobalScope;let p:FormalPersistence,w:FormalWorld,sequence=0;
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);};
async function order(payload:FormalOrder['payload']):Promise<FormalOrder>{const context=await p.writerContext();return {campaignId:w.campaignId,commandId:('command:p.'+context.commandEpoch+'.'+(++sequence).toString(36)) as FormalOrder['commandId'],issuerId:w.playerFactionId,expectedRevision:w.revision,issuedWorldTime:w.time,payload};}
scope.onmessage=async e=>{try{
 if(e.data.action==='start'){
  p=new FormalPersistence({suffix:'paired-native-'+crypto.randomUUID()});await p.acquireWriter();const raw=createFormalWorld({campaign:'release-capacity',seed:90217,speed:25});enableAutonomy(raw);raw.revision=2;const cities=new Map(raw.cities.map(c=>[c.ownerFactionId,c]));
  raw.commandReceipts=Array.from({length:60000},(_,i)=>{const issuer=raw.factions[i%100].id;return {commandId:('command:'+(i%2?'ai-':'seed-')+String(i).padStart(6,'0')) as FormalOrder['commandId'],issuerId:issuer,committedRevision:1,disposition:'rolled-back' as const,fingerprint:canonicalJSON({campaignId:raw.campaignId,issuerId:issuer,payload:{type:'city.rename',cityId:cities.get(issuer)!.id,name:'等價合成操作'}})};});
  w=await p.start(raw);scope.postMessage({done:true,action:'start'});
 }else if(e.data.action==='next'){
  const rows:{name:string;ms:number}[]=[],measure=async<T>(name:string,fn:()=>Promise<T>)=>{const at=performance.now(),v=await fn();rows.push({name,ms:performance.now()-at});return v;};
  const o=await order({type:'city.rename',cityId:w.cities[0].id,name:'配對量測'+e.data.index}),row=await measure('T1',()=>p.receiveCommand(o,captureIntent(w,o))),t=submitFormalOrder(w,o);check(t.ack?.status==='committed','rename rejected');w=await measure('T2',()=>p.save(t.world,t.reports,w.revision,undefined,{row,ack:t.ack!}));
  const q=await measure('query',()=>p.commandStatus(o.campaignId,o.commandId));check(canonicalJSON(q?.ack)===canonicalJSON(t.ack),'original Ack mismatch');
  const r=await order({type:'city.rename',cityId:w.cities.find(c=>c.ownerFactionId!==w.playerFactionId)!.id,name:'不能改別人的城市'}),pending=await p.receiveCommand(r),rejected=submitFormalOrder(w,r);check(rejected.ack?.status==='rejected','missing rejection');w=await measure('rejectedT2',()=>p.finishCommand(pending,rejected.ack!,w.revision));
  scope.postMessage({done:true,action:'next',rows,gameplay:await digest({cities:w.cities,events:w.events,seed:w.seed,time:w.time,revision:w.revision,sequences:w.sequences})});
 }else if(e.data.action==='close'){await p.db.delete();scope.postMessage({done:true,action:'close'});}
 else throw Error('unknown action');
 }catch(error){scope.postMessage({done:true,error:String(error)});p?.db.close();}
};scope.postMessage({booted:true});
