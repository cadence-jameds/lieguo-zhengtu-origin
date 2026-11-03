import type {CooperativeAdvanceOptions} from './formal/reducer';
/** JS service opportunity only. Formal event/FIFO order never enters this
 * budget. Under intake pressure each world slice still completes events and
 * intake gets at most a 2ms requested pause; no await of an unbounded queue. */
export class RuntimeWorkBudget {
 private pending=0;
 trackIntake(work:Promise<unknown>){this.pending++;const settled=()=>{this.pending--;};void work.then(settled,settled);}
 readonly advance:CooperativeAdvanceOptions={yieldIntervalMs:8,yieldBeforeStart:true,shouldYield:elapsed=>this.pending>0&&elapsed>=2,yieldControl:()=>new Promise<void>(resolve=>setTimeout(resolve,this.pending>0?2:0))};
}
