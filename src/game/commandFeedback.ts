import type {CommandAck} from './formal/model';
export type CommandFeedback={kind:'idle'|'sending'|'pending'|'success'|'error'|'uncertain';text:string};
export const feedbackForAck=(ack:CommandAck):CommandFeedback=>ack.status==='committed'||ack.status==='duplicate'?{kind:'success',text:ack.status==='duplicate'?'此命令已提交，不會重複執行。':'命令已提交。'}:{kind:'error',text:ack.reason??'命令未提交，請重新確認狀態。'};
export const feedbackDuration=(kind:CommandFeedback['kind'])=>kind==='success'?1500:kind==='error'?6000:0;
export const uncertainFeedback:CommandFeedback={kind:'uncertain',text:'尚未收到保存結果，命令仍在確認；請勿重複下單。'};
