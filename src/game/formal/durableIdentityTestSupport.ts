import type {FormalPersistence} from '../persistence';
import type {FormalOrder} from './model';
import {intakeEpoch,playerCommandId} from '../replayFence';
/** Test fixture assembly only: legacy human-readable labels are assigned a real
 * intake identity BEFORE invoking production T1. This helper never changes the
 * payload/revision/intent or adds a production compatibility path. Already formed
 * transport IDs (including stale epochs) always pass through unchanged.
 * A label remains the same identity across DB reconnections and branch changes.
 */
const labels=new Map<string,FormalOrder['commandId']>(),sequences=new Map<string,number>();
export async function durableTestOrder(p:FormalPersistence,order:FormalOrder){
 if(order.commandId.startsWith('command:p.'))return order;
 const key=p.db.name+'/'+order.campaignId+'/'+order.commandId,known=labels.get(key);
 if(known){order.commandId=known;return order;}
 const meta=await p.db.RuntimeMeta.get('runtime');if(!meta?.fence)return order;
 const epoch=intakeEpoch(meta.fence),next=Math.max(sequences.get(epoch)??0,meta.fence.acceptedThrough)+1;sequences.set(epoch,next);
 const id=playerCommandId(epoch,next);labels.set(key,id);order.commandId=id;return order;
}
export async function receiveDurableFixture(p:FormalPersistence,...args:Parameters<FormalPersistence['receiveCommand']>){await durableTestOrder(p,args[0]);return p.receiveCommand(...args);}
/** Real Runtime tests assemble transport IDs from the actual writer notification,
 * exactly as useGame does; no persistence mock rewrites the request in T1. */
export function runtimeFixtureIdentity(data:unknown,messages:readonly {commandEpoch?:string}[]){
 const request=data as {type?:string;order?:FormalOrder};if(request.type!=='command'||!request.order||request.order.commandId.startsWith('command:p.'))return data;
 let epoch:string|undefined;for(let i=messages.length-1;i>=0;i--)if(messages[i].commandEpoch){epoch=messages[i].commandEpoch;break;}if(!epoch)throw Error('Runtime fixture has no authoritative intake epoch.');
 const order=request.order,key=epoch+'/'+order.campaignId+'/'+order.commandId,known=labels.get(key);if(known){order.commandId=known;return data;}
 const next=(sequences.get(epoch)??0)+1;sequences.set(epoch,next);order.commandId=playerCommandId(epoch,next);labels.set(key,order.commandId);return data;
}
