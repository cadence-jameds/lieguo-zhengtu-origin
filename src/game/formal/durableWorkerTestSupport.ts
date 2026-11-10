import {commandFingerprint,confirmationAck,resultState,terminalCommand,COMMAND_TTL,type InboxCommand} from '../durableCommands';
import type {FormalOrder,FormalWorld,CommandAck} from './model';
/** Protocol adapter for existing Worker domain labs. Storage atomicity/faults use
 * the real FormalPersistence in durableCommands.test and the Chromium harness. */
export function durableWorkerStorage(storage:Record<string,any>){
 let branch=0,epoch=0,sequence=0,foregroundRevision=0;const rows=new Map<string,InboxCommand>();
 const key=(campaign:string,id:string)=>campaign+'/'+id;
 const switchBranch=()=>{branch++;for(const row of rows.values())if(!terminalCommand(row)){row.state='needs-confirmation';row.ack=confirmationAck(row,0,'戰役分支已切換，請重新確認。');}};
 const result=(row:InboxCommand,ack:CommandAck)=>{const stored=rows.get(key(row.campaignId,row.commandId))!;stored.ack=ack;stored.state=resultState(ack);};
 return{...storage,
  acquireWriter:async()=>{rows.clear();branch=0;sequence=0;foregroundRevision=0;return{writerEpoch:++epoch,branch};},writerContext:async()=>({writerEpoch:epoch,branch}),
  receiveCommand:async(order:FormalOrder,intent:object={},originalBranch=branch)=>{const k=key(order.campaignId,order.commandId),old=rows.get(k);if(old){if(old.fingerprint!==commandFingerprint(order))throw Error('CommandId 已用於不同命令。');return old;}
   const row:InboxCommand={...intent,sequence:++sequence,campaignId:order.campaignId,commandId:order.commandId,issuerId:order.issuerId,order,fingerprint:commandFingerprint(order),originalRevision:order.expectedRevision,branch:originalBranch,writerEpoch:epoch,state:'pending',createdAt:Date.now(),deadline:Date.now()+COMMAND_TTL,attempts:0,nextAttemptAt:0};if(order.expectedRevision<foregroundRevision){row.state='needs-confirmation';row.ack=confirmationAck(row,foregroundRevision);}rows.set(k,row);return row;},
  commandStatus:async(campaign:string,id:string)=>rows.get(key(campaign,id)),pendingCommands:async()=>[...rows.values()].filter(r=>!terminalCommand(r)),commandPage:async()=>[...rows.values()].reverse().slice(0,100),
  finishCommand:async(row:InboxCommand,ack:CommandAck)=>{result(row,ack);return ack;},
  noteCommandFailure:async(row:InboxCommand,text:string)=>{const stored=rows.get(key(row.campaignId,row.commandId))!;result(stored,confirmationAck(stored,0,text+'；請重新確認。'));return stored;},
  save:async(...args:any[])=>{const world=await storage.save(...args);if(args[4]){result(args[4].row,args[4].ack);if(args[4].ack.status==='committed')foregroundRevision=world.revision;}return world;},
  ...Object.fromEntries(['startCampaign','restore','importSave','clearSavedGames'].map(name=>[name,async(...args:any[])=>{const w:FormalWorld=await storage[name](...args);switchBranch();return w;}]))
 };
}
