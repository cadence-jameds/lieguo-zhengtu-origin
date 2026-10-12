import type {FormalWorld} from './formal/model';
export type WorldPatch={campaignId:FormalWorld['campaignId'];baseRevision:number;changes:Partial<FormalWorld>};
/** Only committed, changed sections cross the Worker boundary. Static terrain
 * and unchanged sections retain their identity in the presentation process. */
export function worldPatch(prior:FormalWorld,next:FormalWorld):WorldPatch{
 const changes:Partial<FormalWorld>={};
 const copy=<K extends keyof FormalWorld>(key:K)=>{if(prior[key]!==next[key]&&JSON.stringify(prior[key])!==JSON.stringify(next[key]))changes[key]=next[key];};
 for(const key of Object.keys(next) as (keyof FormalWorld)[])copy(key);
 return {campaignId:prior.campaignId,baseRevision:prior.revision,changes};
}
export function applyWorldPatch(prior:FormalWorld|null,patch:WorldPatch):FormalWorld|undefined{
 if(!prior||prior.campaignId!==patch.campaignId||prior.revision!==patch.baseRevision)return undefined;
 if(!Object.keys(patch.changes).length)return prior;
 return {...prior,...patch.changes};
}
