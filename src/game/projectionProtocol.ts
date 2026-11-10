import type {PresentationWorld} from './presentationModel';
export const PROJECTION_PROTOCOL=2 as const;
export const entityKeys=['cities','armies','factions','researchProjects','largeProjects','logistics','settlements','colonizationUnits','governors','sites'] as const;
export type EntityKey=typeof entityKeys[number];
export const sectionKeys=['metadata','economyVersion','growthTasks','victory','modernAwareness','extinction','politics','developer','seed','speed','time','offlineHours','clockMode','dimensions','playerFactionId','sequences','combat','nextEventAt','derived','battleEffects','staticMap'] as const;
export type SectionKey=typeof sectionKeys[number];
export type VersionMap={entities:Record<EntityKey,Record<string,number>>;sections:Record<SectionKey,number>};
export type ProjectionHeader={protocolVersion:2;campaignId:string|null;branch:number;writerEpoch:number;sessionId:string;baseRevision:number|null;nextRevision:number;baseSequence:number|null;projectionSequence:number};
export type EntityChange={op:'add'|'update';id:string;baseVersion:number;nextVersion:number;value:unknown}|{op:'remove';id:string;baseVersion:number;nextVersion:number};
export type SectionChange={baseVersion:number;nextVersion:number;value:unknown};
export type ProjectionSnapshot=ProjectionHeader&{kind:'snapshot';world:PresentationWorld|null;versions:VersionMap};
export type ProjectionPatch=ProjectionHeader&{kind:'patch';entities:Partial<Record<EntityKey,EntityChange[]>>;sections:Partial<Record<SectionKey,SectionChange>>;orders:Partial<Record<EntityKey,string[]>>};
export type ProjectionMessage=ProjectionSnapshot|ProjectionPatch;
export const entityId=(key:EntityKey,value:any):string=>String(value[key==='researchProjects'||key==='largeProjects'||key==='settlements'?'projectId':key==='logistics'?'shipmentId':key==='governors'?'cityId':'id']);
export const entities=(w:PresentationWorld,key:EntityKey):readonly unknown[]=>key==='sites'?w.worldLayer?.wildSites??[]:w[key]??[];
export const section=(w:PresentationWorld,key:SectionKey):unknown=>key==='staticMap'?w.worldLayer?{regionSize:w.worldLayer.regionSize,terrain:w.worldLayer.terrain,mountains:w.worldLayer.mountains}:undefined:w[key];
/** Structural comparison, no JSON strings/canonical materialization. */
export function equalData(a:unknown,b:unknown):boolean{
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const x=Object.keys(a),y=Object.keys(b);return x.length===y.length&&x.every(k=>Object.hasOwn(b,k)&&equalData((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
export const emptyVersions=():VersionMap=>({entities:Object.fromEntries(entityKeys.map(k=>[k,{}])) as VersionMap['entities'],sections:Object.fromEntries(sectionKeys.map(k=>[k,0])) as VersionMap['sections']});
