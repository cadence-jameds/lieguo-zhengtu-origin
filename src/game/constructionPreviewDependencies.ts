import {resourceKeys} from './formal/model';
import type {PreviewContext,PreviewResult,PreviewTarget} from './constructionPreviewProtocol';
/** Admission inputs only. Empty-queue quotes translate with time; settlement bookkeeping,
 * population below permanent milestones, military queues and world revision are not rules. */
export function constructionDependencyKey(context:PreviewContext,targets:PreviewTarget[],includeStock=false){
 const c=context.city,e=c.economy;
 return JSON.stringify([context.version,e?.construction.length===0?null:context.time,context.paused,context.issuerId,context.age,c.id,c.ownerFactionId,c.housing,c.buildings,c.fields,c.wallLevel,c.cityPromotionCompleted,e?.milestones,e?.slots,e?.construction,context.crafts,targets,...(includeStock?[resourceKeys.map(k=>c.stock[k])]:[])]);
}
/** A display estimate can move with an empty queue. It is never command authorization. */
export function translatePreviewResults(results:PreviewResult[],from:number,context:PreviewContext):PreviewResult[]{
 const delta=context.city.economy?.construction.length===0?context.time-from:0;
 return results.map(r=>r.status==='ready'?{...r,quote:{...r.quote,createdAt:context.time,startsAt:r.quote.startsAt+delta}}:r);
}
