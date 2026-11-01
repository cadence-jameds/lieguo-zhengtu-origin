import {quoteConstruction,promoteConstructionJobs,requireCraftsmanCastle} from './formal/constructionRules';
import {RuleViolation,requireRule} from './formal/ruleViolation';
import {PREVIEW_PROTOCOL,previewPayload,type PreviewRequest,type PreviewResponse,type PreviewResult,type PreviewContext,type PreviewTarget} from './constructionPreviewProtocol';
/** Each target is an independent quote of the same snapshot, not a speculative command queue. */
export function calculateConstructionPreview(context:PreviewContext,target:PreviewTarget):PreviewResult{
 try{
  if(context.version!==1)return {status:'unavailable',reason:'預覽版本不相容，無法提供最新預估。'};
  requireRule(!context.paused,'滅國期間世界已暫停。');
  const c=structuredClone(context.city);
  requireRule(c.ownerFactionId===context.issuerId,'只能操作自己實際控制的城市。');
  promoteConstructionJobs(context.time,c);
  const craft='craftsmanId' in target;if(craft)requireCraftsmanCastle(c,context.crafts[target.craftsmanId]===true);
  const quote=quoteConstruction(context.time,c,context.age,previewPayload(c.id,craft?{key:'castle'}:target),craft?{authorized:true}:undefined);
  return {status:'ready',quote};
 }catch(e){return {status:e instanceof RuleViolation?'invalid':'unavailable',reason:e instanceof Error?e.message:'無法提供最新預估。'};}
}
export function calculatePreviewRequest(r:PreviewRequest):PreviewResponse{
 if(r.protocolVersion!==PREVIEW_PROTOCOL||r.targets.length>32||r.context.city.id!==r.cityId)throw new Error('無效預覽協定');
 const {context,targets,...stamp}=r;
 return {...stamp,results:targets.map(t=>calculateConstructionPreview(context,t))};
}
