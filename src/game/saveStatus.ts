import {retryableStorageError} from './durableCommands';
export type SaveStatus={state:'healthy'|'retrying'|'blocked'|'recovered';failures:number;recovery:'save'|'reload';code:string};
export const healthySave:SaveStatus={state:'healthy',failures:0,recovery:'save',code:''};
/** Observes real persistence outcomes; never schedules work or changes retry rules. */
export class SaveHealth{
 status:SaveStatus={...healthySave};
 failure(error:unknown,canAutoRetry:boolean):SaveStatus|undefined{
  const failures=Math.min(3,this.status.failures+1),state=canAutoRetry&&retryableStorageError(error)&&failures<3?'retrying':'blocked',recovery=canAutoRetry?'save':'reload',code=state==='retrying'?'SAVE_RETRY':'SAVE_BLOCKED';
  const changed=this.status.state!==state||this.status.recovery!==recovery;
  this.status={state,failures,recovery,code};return changed?{...this.status}:undefined;
 }
 committed():SaveStatus|undefined{
  if(this.status.state!=='retrying'&&this.status.state!=='blocked')return;
  this.status={state:'recovered',failures:0,recovery:'save',code:'SAVE_RECOVERED'};return {...this.status};
 }
}
