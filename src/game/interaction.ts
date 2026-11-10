import type {CommandAck} from './formal/model';

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
 private ids=new Set<string>();private latest:string|null=null;
 track(id:string){this.ids.add(id);this.latest=id;}
 matches(id:string){return this.latest===id&&this.ids.has(id);}
 acknowledge(ack:CommandAck){const latest=this.matches(ack.commandId);this.ids.delete(ack.commandId);return latest;}
 finish(id:string){this.ids.delete(id);}
 clear(){this.ids.clear();this.latest=null;}
 get busy(){return this.ids.size>0;}
}
/** Display snapshots only; authority worlds never enter the React reconciler. */
export {reconcilePresentation as reconcileWorld} from './presentationSharing';
