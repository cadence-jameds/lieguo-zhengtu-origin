import type {CommandAck,FormalOrder,FormalWorld} from './formal/model';
import {canonicalJSON} from './formal/canonical';
import {playerOrderBase,type PlayerOrderBase} from './orderAdmission';
import {governanceBase,type GovernanceBase} from './governanceAdmission';

export type InboxState='pending'|'retryable'|'committed'|'rolled-back'|'rejected'|'needs-confirmation';
export type CommandIntent={playerBase?:PlayerOrderBase;governanceBase?:GovernanceBase;extinctionBase?:string};
export type WriterContext={writerEpoch:number;branch:number};
export type InboxCommand=CommandIntent&{
 sequence?:number;campaignId:FormalOrder['campaignId'];commandId:FormalOrder['commandId'];issuerId:FormalOrder['issuerId'];
 order:FormalOrder;fingerprint:string;originalRevision:number;branch:number;writerEpoch:number;
 state:InboxState;createdAt:number;deadline:number;attempts:number;nextAttemptAt:number;ack?:CommandAck;lastError?:string;
};
export const COMMAND_TTL=120_000,MAX_COMMAND_ATTEMPTS=3;
export const commandFingerprint=(order:FormalOrder)=>canonicalJSON({campaignId:order.campaignId,issuerId:order.issuerId,payload:order.payload});
export const terminalCommand=(row:InboxCommand)=>row.state!=='pending'&&row.state!=='retryable';
export function extinctionBase(w:FormalWorld){return canonicalJSON([w.campaignId,w.playerFactionId,w.extinction,w.cities.filter(c=>c.ownerFactionId===w.playerFactionId).map(c=>c.id)]);}
export function captureIntent(w:FormalWorld,order:FormalOrder):CommandIntent{
 if(order.payload.type==='governance.set')return{governanceBase:governanceBase(w,order.payload.cityId)};
 if(order.payload.type==='player.rebirth'||order.payload.type==='player.end')return{extinctionBase:extinctionBase(w)};
 return{playerBase:playerOrderBase(w,order.payload)};
}
/** Preserve the original envelope. Only a fresh execution envelope can bridge a
 * revision, after equality of the exact player's semantic preconditions. Rules,
 * resource costs and target legality are always checked again by the reducer. */
export function revalidateInbox(w:FormalWorld,row:InboxCommand):FormalOrder|undefined{
 const order=row.order;
 if(order.campaignId!==w.campaignId||order.issuerId!==w.playerFactionId||order.issuedWorldTime>w.time)return;
 if(order.expectedRevision===w.revision)return order;
 if(order.expectedRevision>w.revision)return;
 const p=order.payload;
 const unchanged=p.type==='governance.set'?row.governanceBase?.revision===order.expectedRevision&&row.governanceBase.fingerprint===governanceBase(w,p.cityId).fingerprint:
  p.type==='player.rebirth'||p.type==='player.end'?row.extinctionBase!==undefined&&row.extinctionBase===extinctionBase(w):
  row.playerBase?.revision===order.expectedRevision&&row.playerBase.fingerprint===playerOrderBase(w,p)?.fingerprint;
 if(!unchanged)return;
 return{...order,expectedRevision:w.revision,issuedWorldTime:w.time};
}
export function resultState(ack:CommandAck):InboxState{
 if(ack.status==='committed'||ack.status==='duplicate')return'committed';
 if(ack.status==='rolled-back')return'rolled-back';
 return ack.reason?.includes('重新確認')?'needs-confirmation':'rejected';
}
export const confirmationAck=(row:InboxCommand,revision:number,reason=row.order.payload.type==='governance.set'?'治理狀態已更新，已刷新城市資料；請重新確認方針、預算及保留量後再次套用。':'世界狀態已變更，請重新確認原始操作。'):CommandAck=>({commandId:row.commandId,status:'rejected',revision,reason});
export class WriterConflict extends Error {constructor(){super('寫入權已變更，請重新載入；原命令與存檔保留。');}}
export class RevisionConflict extends Error {constructor(){super('存檔 revision 衝突，命令未提交。');}}
export function retryableStorageError(error:unknown){
 const name=error instanceof Error?error.name:'';
 // Quota, validation, CAS, unknown failures and permanent IDB errors need user action.
 return name==='AbortError'||name==='TimeoutError';
}
