/** Versioned, single-city, read-only display contract. Never accepted by Runtime as a command. */
import type {FormalCity,Resources} from './formal/model';
import type {CityId} from './formal/ids';
import type {BuildPayload,quoteConstruction} from './formal/constructionRules';
export const PREVIEW_PROTOCOL=1 as const;
export type PreviewTarget={key:string;slot?:number;lane?:0|1}|{field:number;lane?:0|1}|{craftsmanId:string};
export type PreviewContext={version:1;time:number;paused:boolean;issuerId:string;age:number;city:FormalCity;crafts:Record<string,boolean>};
export type PreviewStamp={protocolVersion:1;campaignId:string;branch:string;revision:number;cityId:CityId;requestId:number;generation:number};
export type PreviewRequest=PreviewStamp&{context:PreviewContext;targets:PreviewTarget[]};
export type PreviewQuote=ReturnType<typeof quoteConstruction>;
export type PreviewResult={status:'ready';quote:PreviewQuote}|{status:'invalid'|'unavailable';reason:string};
export type PreviewResponse=PreviewStamp&{results:PreviewResult[]};
export const previewTargetKey=(t:PreviewTarget)=>JSON.stringify(t);
export function previewPayload(cityId:CityId,t:Exclude<PreviewTarget,{craftsmanId:string}>):BuildPayload{
 return 'field' in t?{type:'field.upgrade',cityId,slot:t.field,...(t.lane===undefined?{}:{lane:t.lane})}:{type:'building.upgrade',cityId,key:t.key,...(t.slot===undefined?{}:{slot:t.slot}),...(t.lane===undefined?{}:{lane:t.lane})};
}
export const previewCost=(r:PreviewResult|undefined):Resources|undefined=>r?.status==='ready'?r.quote.paidResources:undefined;
export function samePreviewStamp(a:PreviewStamp,b:PreviewStamp){return a.protocolVersion===b.protocolVersion&&a.campaignId===b.campaignId&&a.branch===b.branch&&a.revision===b.revision&&a.cityId===b.cityId&&a.requestId===b.requestId&&a.generation===b.generation;}
