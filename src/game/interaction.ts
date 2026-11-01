import type {CommandAck,FormalWorld} from './formal/model';

/** Background messages cannot release a foreground request's busy state. */
export class PendingRequests {
 private ids=new Set<string>();
 add(id:string){this.ids.add(id);}
 finish(id:string){this.ids.delete(id);}
 clear(){this.ids.clear();}
 get busy(){return this.ids.size>0;}
}
/** A rejection is terminal. Only the current click may update its notice;
 * delayed receipts and acknowledgements cannot replace a newer result. */
export class PendingCommand {
 private ids=new Set<string>();
 track(id:string){this.ids.add(id);}
 matches(id:string){return [...this.ids].at(-1)===id;}
 acknowledge(ack:CommandAck){const latest=this.matches(ack.commandId);this.ids.delete(ack.commandId);return latest;}
 finish(id:string){this.ids.delete(id);}
 clear(){this.ids.clear();}
 get busy(){return this.ids.size>0;}
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
