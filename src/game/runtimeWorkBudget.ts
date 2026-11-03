import type {CooperativeAdvanceOptions} from './formal/reducer';
/** JS service opportunity only. Formal event/FIFO order never enters this
 * budget. Under intake pressure each world slice still completes events and
 * intake gets a 2ms requested pause and a 4ms opening before a draft starts.
 * These are timer requests, not hard wall-clock guarantees. No unbounded wait. */
export class RuntimeWorkBudget {
 private pending=0;
 trackIntake(work:Promise<unknown>){this.pending++;const settled=()=>{this.pending--;};void work.then(settled,settled);}
 readonly advance:CooperativeAdvanceOptions={yieldIntervalMs:8,yieldBeforeStart:true,shouldYield:elapsed=>this.pending>0&&elapsed>=2,yieldControl:boundary=>new Promise<void>(resolve=>setTimeout(resolve,boundary==='start'?4:this.pending>0?2:0))};
}
