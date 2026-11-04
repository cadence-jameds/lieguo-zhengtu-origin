import type {CommandId} from './formal/ids';
/** A database incarnation is never restored from a portable world/checkpoint.
 * A writer acquisition and every branch switch close the previous intake epoch.
 * Exact durable rows are resolved BEFORE this fence, so closed epochs do not
 * cancel commands already accepted by T1. */
export type ReplayFence={format:1;incarnation:string;writerEpoch:number;branch:number;acceptedThrough:number};
export const RECENT_OUTCOME_LIMIT=1024;
const token=/^[a-f0-9]{32}$/;
export function createReplayFence(incarnation=crypto.randomUUID().replaceAll('-','')):ReplayFence{
 if(!token.test(incarnation))throw Error('無效的命令資料庫世代。');
 return {format:1,incarnation,writerEpoch:0,branch:0,acceptedThrough:0};
}
export function validateReplayFence(value:ReplayFence){
 if(!value||Object.keys(value).sort().join(',')!=='acceptedThrough,branch,format,incarnation,writerEpoch'||value.format!==1||!token.test(value.incarnation)||![value.writerEpoch,value.branch,value.acceptedThrough].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('命令防重播水位損毀，原資料保留。');
 return value;
}
export function intakeEpoch(fence:ReplayFence){validateReplayFence(fence);return `${fence.incarnation}.${fence.writerEpoch.toString(36)}.${fence.branch.toString(36)}`;}
export function playerCommandId(epoch:string,sequence:number):CommandId{
 if(!/^[a-f0-9]{32}\.[a-z0-9]+\.[a-z0-9]+$/.test(epoch)||!Number.isSafeInteger(sequence)||sequence<1)throw Error('無效的玩家命令序號。');
 return `command:p.${epoch}.${sequence.toString(36)}` as CommandId;
}
export class RetiredCommand extends Error{constructor(){super('此命令身份已超出結果保留範圍或屬於已關閉的操作世代，不會再次執行。請查閱目前世界並重新確認操作。');this.name='RetiredCommand';}}
/** Pure preparation only. Caller MUST persist this result with the Inbox row in
 * ONE T1 transaction under its writer/branch CAS. Gaps are allowed, never filled
 * later: no absent operation has been acknowledged as durable. */
export function acceptCommandIdentity(fence:ReplayFence,id:string):ReplayFence{
 const prefix=`command:p.${intakeEpoch(fence)}.`;
 if(!id.startsWith(prefix))throw new RetiredCommand();
 const encoded=id.slice(prefix.length);
 if(!/^[1-9a-z][0-9a-z]*$/.test(encoded))throw new RetiredCommand();
 const sequence=Number.parseInt(encoded,36);
 if(!Number.isSafeInteger(sequence)||sequence<=fence.acceptedThrough||sequence.toString(36)!==encoded)throw new RetiredCommand();
 return {...fence,acceptedThrough:sequence};
}
export function nextIntakeEpoch(fence:ReplayFence,writerEpoch:number,branch:number):ReplayFence{
 validateReplayFence(fence);
 if(!Number.isSafeInteger(writerEpoch)||!Number.isSafeInteger(branch)||writerEpoch<fence.writerEpoch||branch<fence.branch||writerEpoch===fence.writerEpoch&&branch===fence.branch)throw Error('操作世代不得倒退或重用。');
 return {...fence,writerEpoch,branch,acceptedThrough:0};
}
