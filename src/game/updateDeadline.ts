/** Browser SW promises cannot be cancelled. Bound observation and discard late results.
 * Wall-clock checks on resume also cover Android's suspended page timers. */
export class UpdateTimeoutError extends Error {
 constructor(readonly step:string){super('更新階段逾時');this.name='UpdateTimeoutError';}
}
export function assertUpdateActive(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Update attempt ended','AbortError');}
export function updateDeadline<T>(operation:PromiseLike<T>,ms:number,step:string,signal?:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const end=Date.now()+ms;let settled=false;
  const finish=(error?:unknown,value?:T)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',aborted);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);error?reject(error):resolve(value as T);};
  const aborted=()=>finish(new DOMException('Update attempt ended','AbortError'));
  const resume=()=>{if(signal?.aborted)aborted();else if(Date.now()>=end)finish(new UpdateTimeoutError(step));};
  const timer=setTimeout(()=>finish(new UpdateTimeoutError(step)),ms);
  signal?.addEventListener('abort',aborted,{once:true});document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
  Promise.resolve(operation).then(value=>{resume();if(!settled)finish(undefined,value);},error=>{resume();if(!settled)finish(error);});resume();
 });
}
export const UPDATE_LIMITS={registration:12000,download:30000,identity:3000,save:35000,activation:15000,navigation:5000,metadata:8000,total:150000} as const;
export const UPDATE_PHASE_LABELS={idle:'',preparing:'正在準備新版…',downloading:'正在下載新版…',verifying:'正在驗證新版…',saving:'正在保存遊戲進度…',saved:'遊戲進度已成功保存。',activating:'正在啟用新版…',reloading:'正在重新載入…',failed:'更新失敗，可安全重試'} as const;
export type UpdatePhase=keyof typeof UPDATE_PHASE_LABELS;
