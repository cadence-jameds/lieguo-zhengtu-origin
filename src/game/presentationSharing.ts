import type {PresentationWorld} from './presentationModel';
import {entityKeys,entities,entityId,equalData} from './projectionProtocol';
function shareRows<T>(before:readonly T[]|undefined,after:T[]|undefined,id:(value:T)=>string):T[]|undefined{
 if(!before||!after)return after;const old=new Map(before.map(value=>[id(value),value])),rows=after.map(value=>{const prior=old.get(id(value));return prior!==undefined&&equalData(prior,value)?prior:value;});
 return rows.length===before.length&&rows.every((value,i)=>value===before[i])?before as T[]:rows;
}
/** Full display resyncs reuse equal data only inside the same campaign/branch/
 * writer session. A Recovery or handoff always gets a fresh object graph. */
export function reconcilePresentation(prior:PresentationWorld|null,next:PresentationWorld|null):PresentationWorld|null{
 if(!prior||!next||prior.campaignId!==next.campaignId||prior.projection.branch!==next.projection.branch||prior.projection.writerEpoch!==next.projection.writerEpoch||prior.projection.sessionId!==next.projection.sessionId)return next;
 const result={...next};
 for(const key of Object.keys(next) as (keyof PresentationWorld)[])if(key!=='worldLayer'&&equalData(prior[key],next[key]))Object.assign(result,{[key]:prior[key]});
 for(const key of entityKeys){if(key==='sites')continue;const rows=shareRows(entities(prior,key),next[key],value=>entityId(key,value));Object.assign(result,{[key]:rows});}
 if(next.worldLayer&&prior.worldLayer){const sites=shareRows(prior.worldLayer.wildSites,next.worldLayer.wildSites,s=>s.id)!,mountains=equalData(prior.worldLayer.mountains,next.worldLayer.mountains)?prior.worldLayer.mountains:next.worldLayer.mountains;result.worldLayer=sites===prior.worldLayer.wildSites&&mountains===prior.worldLayer.mountains&&next.worldLayer.terrain===prior.worldLayer.terrain&&next.worldLayer.regionSize===prior.worldLayer.regionSize?prior.worldLayer:{...next.worldLayer,mountains,wildSites:sites};}
 if(next.combat&&prior.combat)result.combat=result.combat===prior.combat?prior.combat:{...next.combat,battles:shareRows(prior.combat.battles,next.combat.battles,b=>b.id)!};
 return Object.keys(result).every(key=>result[key as keyof PresentationWorld]===prior[key as keyof PresentationWorld])?prior:result;
}
