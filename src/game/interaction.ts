import type {CommandAck,FormalOrder,FormalWorld} from './formal/model';

/** Background messages cannot release a foreground request's busy state. */
export class PendingRequests {
 private ids=new Set<string>();
 add(id:string){this.ids.add(id);}
 finish(id:string){this.ids.delete(id);}
 clear(){this.ids.clear();}
 get busy(){return this.ids.size>0;}
}
/** Re-submit only a rejected order crossed by clock-only checkpoints. The
 * reducer still checks the current revision and all rules on every attempt.
 * Never retry across an event, another command, or a branch/campaign switch. */
export class ClockConflictRetry {
 private pending=new Map<string,{order:FormalOrder;retry:boolean;waiting:boolean}>();
 track(order:FormalOrder){this.pending.set(order.commandId,{order,retry:false,waiting:false});}
 acknowledge(ack:CommandAck){const p=this.pending.get(ack.commandId);if(!p)return;
  if(ack.status==='rejected'&&ack.reason==='世界版本已更新，請重新確認狀態。'&&!p.retry)p.waiting=true;
  else this.pending.delete(ack.commandId);
 }
 refresh(world:FormalWorld|null,passiveBase:number):FormalOrder[]{const out:FormalOrder[]=[];
  for(const [id,p] of this.pending){if(!p.waiting)continue;
   if(world&&world.campaignId===p.order.campaignId&&Number.isSafeInteger(passiveBase)&&p.order.expectedRevision>=passiveBase&&p.order.expectedRevision<world.revision){
    p.order={...p.order,expectedRevision:world.revision,issuedWorldTime:world.time};p.retry=true;p.waiting=false;out.push(p.order);
   }else this.pending.delete(id);
  }return out;
 }
 clear(){this.pending.clear();}
}
/** Reuse unchanged graph branches so presentation caches survive checkpoints. */
export function reconcileWorld(prior:FormalWorld|null,next:FormalWorld|null):FormalWorld|null{
 if(!prior||!next||prior.campaignId!==next.campaignId)return next;
 if(prior.revision===next.revision&&prior.time===next.time)return prior;
 const result={...next};
 const reuse=<K extends keyof FormalWorld>(key:K)=>{const a=prior[key],b=next[key];if(a===b||JSON.stringify(a)===JSON.stringify(b))result[key]=a;};
 for(const key of Object.keys(next) as (keyof FormalWorld)[])reuse(key);
 return result;
}
