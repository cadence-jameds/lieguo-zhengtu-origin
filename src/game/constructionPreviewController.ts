import {resourceKeys} from './formal/model';
import {samePreviewStamp,type PreviewRequest,type PreviewResponse} from './constructionPreviewProtocol';
type Port=Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;
type Work={request:PreviewRequest;resolve:(r:PreviewResponse)=>void;reject:(e:Error)=>void;cacheKey:string};
/** One worker, one in-flight batch, one latest queued batch per mounted channel. */
export class ConstructionPreviewController{
 private worker?:Port;
 private active?:Work&{channel:number;timer:ReturnType<typeof setTimeout>};
 private queue=new Map<number,Work>();
 private cache=new Map<string,{time:number;stock:Record<string,number>;results:PreviewResponse['results']}>();
 readonly metrics={calculations:0,discarded:0,cacheHits:0};
 constructor(private factory:()=>Port=()=>new Worker(new URL('./constructionPreview.worker.ts',import.meta.url),{type:'module'})){}
 request(channel:number,request:PreviewRequest,resolve:Work['resolve'],reject:Work['reject']){
  this.cancel(channel);
  // Compact context only, outside React render. Includes time, stock, slots, queues and qualification.
  const {context}=request,c=context.city,e=c.economy;
  // Only actual admission dependencies form the cache. Empty-queue schedules are translation
  // invariant in time; ready entries can be reused while stocks still cover their exact payment.
  const empty=e?.construction.length===0;
  const cacheKey=JSON.stringify([request.campaignId,request.branch,context.version,empty?null:context.time,context.paused,context.issuerId,context.age,c.id,c.ownerFactionId,c.housing,c.buildings,c.fields,c.wallLevel,c.cityPromotionCompleted,e?.milestones,e?.slots,e?.construction,context.crafts,request.targets]);
  const hit=this.cache.get(cacheKey);
  if(hit&&hit.results.every(r=>r.status==='ready'?resourceKeys.every(k=>c.stock[k]>=r.quote.paidResources[k]):r.status==='invalid'&&(r.reason!=='城市實際庫存不足。'||resourceKeys.every(k=>c.stock[k]===hit.stock[k])))){
   this.metrics.cacheHits++;this.cache.delete(cacheKey);this.cache.set(cacheKey,hit);
   const delta=empty?context.time-hit.time:0;
   const results=hit.results.map(r=>r.status==='ready'?{...r,quote:{...r.quote,createdAt:context.time,startsAt:r.quote.startsAt+delta}}:r);
   resolve({...request,results});return;
  }
  if(this.queue.size>=8){reject(new Error('預覽請求繁忙，請重新查詢。'));return;}
  this.queue.set(channel,{request,resolve,reject,cacheKey});this.pump();
 }
 cancel(channel:number){
  this.queue.delete(channel);
  if(this.active?.channel===channel){this.active.resolve=()=>{this.metrics.discarded++;};this.active.reject=()=>{};}
 }
 private pump(){
  if(this.active||!this.queue.size)return;
  const [channel,work]=this.queue.entries().next().value!;this.queue.delete(channel);
  try{
   if(!this.worker){this.worker=this.factory();this.worker.onmessage=e=>this.receive(e.data as PreviewResponse);this.worker.onerror=this.worker.onmessageerror=()=>this.fail(new Error('預覽 Worker 中斷，無法提供最新預估。'));}
   this.active={...work,channel,timer:setTimeout(()=>this.fail(new Error('預覽等待逾時，請重新查詢。')),5000)};
   this.metrics.calculations++;this.worker.postMessage(work.request);
  }catch(e){this.fail(e instanceof Error?e:new Error('無法啟動預覽 Worker。'),work);}
 }
 private receive(response:PreviewResponse){
  const work=this.active;
  if(!work||!samePreviewStamp(work.request,response)){this.metrics.discarded++;return;}
  clearTimeout(work.timer);this.active=undefined;
  if(response.results.length!==work.request.targets.length){work.reject(new Error('預覽回覆不完整。'));this.pump();return;}
  this.cache.set(work.cacheKey,{time:work.request.context.time,stock:{...work.request.context.city.stock},results:response.results});if(this.cache.size>64)this.cache.delete(this.cache.keys().next().value!);
  work.resolve(response);this.pump();
 }
 private fail(error:Error,fallback?:Work){
  this.worker?.terminate();this.worker=undefined;
  const active=this.active;this.active=undefined;if(active){clearTimeout(active.timer);active.reject(error);}else fallback?.reject(error);
  for(const work of this.queue.values())work.reject(error);this.queue.clear();
 }
 dispose(){this.fail(new Error('預覽已關閉。'));this.cache.clear();}
}
export const constructionPreviews=new ConstructionPreviewController();
