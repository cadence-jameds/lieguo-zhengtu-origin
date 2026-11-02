import {z} from 'zod';
import {reconcilePresentation} from './presentationSharing';
import {presentationValueSchema,presentationBattleEffectSchema} from './formal/schema';
import type {PresentationWorld} from './presentationModel';
import {entityKeys,sectionKeys,entities,entityId,equalData,emptyVersions,type EntityKey,type SectionKey,type VersionMap,type ProjectionMessage,type ProjectionHeader} from './projectionProtocol';
const number=z.number().int().nonnegative().safe(),text=z.string().min(1),identity=z.object({protocolVersion:z.literal(2),campaignId:text,branch:number,writerEpoch:number,sessionId:text,projectionSequence:number.positive(),revision:number}).strict();
const header=z.object({protocolVersion:z.literal(2),campaignId:text.nullable(),branch:number,writerEpoch:number,sessionId:text,baseRevision:number.nullable(),nextRevision:number,baseSequence:number.nullable(),projectionSequence:number.positive()});
const versionsSchema=z.object({entities:z.object(Object.fromEntries(entityKeys.map(k=>[k,z.record(number.positive())]))).strict(),sections:z.object(Object.fromEntries(sectionKeys.map(k=>[k,number]))).strict()}).strict();
const change=z.discriminatedUnion('op',[z.object({op:z.enum(['add','update']),id:text,baseVersion:number,nextVersion:number.positive(),value:z.unknown()}).strict(),z.object({op:z.literal('remove'),id:text,baseVersion:number.positive(),nextVersion:number.positive()}).strict()]);
const snapshotSchema=header.extend({kind:z.literal('snapshot'),world:z.unknown(),versions:versionsSchema}).strict();
const patchSchema=header.extend({kind:z.literal('patch'),entities:z.object(Object.fromEntries(entityKeys.map(k=>[k,z.array(change).optional()]))).strict(),sections:z.object(Object.fromEntries(sectionKeys.map(k=>[k,z.object({baseVersion:number,nextVersion:number.positive(),value:z.unknown()}).strict().optional()]))).strict(),orders:z.object(Object.fromEntries(entityKeys.map(k=>[k,z.array(text).optional()]))).strict()}).strict();
const unwrap=(value:z.ZodTypeAny):z.ZodTypeAny=>value instanceof z.ZodOptional?unwrap(value.unwrap()):value;
const mapSchema=unwrap(presentationValueSchema.shape.worldLayer) as z.AnyZodObject;
const battleEffectsSchema=z.object({cursor:number,recent:z.array(presentationBattleEffectSchema).max(128)}).strict();
const nextAtSchema=number.nullable(),derivedSchema=z.object({staticMapDigest:z.string().regex(/^[0-9a-f]{64}$/),castleSources:z.record(text),governance:z.record(z.string())}).strict();
function entityValue(key:EntityKey,value:unknown){const shape=key==='sites'?mapSchema.shape.wildSites:presentationValueSchema.shape[key],array=unwrap(shape) as z.ZodArray<z.ZodTypeAny>;const parsed=array.element.parse(value);if(!equalData(value,parsed))throw Error('實體資料包含不支援欄位。');return parsed;}
function sectionValue(key:SectionKey,value:unknown){if(key==='staticMap')return value===undefined?undefined:mapSchema.omit({wildSites:true}).parse(value);if(key==='nextEventAt')return nextAtSchema.parse(value);if(key==='derived')return derivedSchema.parse(value);if(key==='battleEffects')return battleEffectsSchema.parse(value);return presentationValueSchema.shape[key].parse(value);}
function readWorld(value:unknown,h:ProjectionHeader):PresentationWorld|null{
 if(value===null){if(h.campaignId!==null||h.nextRevision!==0)throw Error('空畫面版本不一致。');return null;}
 if(!value||typeof value!=='object')throw Error('缺少展示快照。');
 const {kind,presentationVersion,projection,nextEventAt,derived,battleEffects,...base}=value as PresentationWorld;
 if(kind!=='presentation'||presentationVersion!==2)throw Error('不支援的展示版本。');
 const parsed=presentationValueSchema.parse(base),id=identity.parse(projection);
 if(id.campaignId!==h.campaignId||id.branch!==h.branch||id.writerEpoch!==h.writerEpoch||id.sessionId!==h.sessionId||id.projectionSequence!==h.projectionSequence||id.revision!==h.nextRevision||parsed.campaignId!==h.campaignId||parsed.revision!==h.nextRevision)throw Error('展示快照版本不一致。');
 return {...parsed,kind,presentationVersion,projection:id,nextEventAt:nextAtSchema.parse(nextEventAt),derived:derivedSchema.parse(derived),battleEffects:battleEffectsSchema.parse(battleEffects)};
}
function references(w:PresentationWorld|null){
 if(!w)return;
 const factions=new Set(w.factions.map(f=>f.id));
 for(const key of entityKeys){const rows=entities(w,key),ids=new Set(rows.map(e=>entityId(key,e)));if(ids.size!==rows.length)throw Error('展示實體身份重複。');}
 if(!factions.has(w.playerFactionId)||w.cities.some(c=>!factions.has(c.ownerFactionId))||w.armies.some(a=>!factions.has(a.ownerFactionId)))throw Error('展示實體來源缺失。');
 if(w.nextEventAt!==null&&w.nextEventAt<w.time)throw Error('展示事件界線過期。');
 if(Object.keys(w.derived.castleSources).length!==w.cities.length||Object.keys(w.derived.governance).length!==w.cities.length||w.cities.some(c=>!w.derived.castleSources[c.id]||w.derived.governance[c.id]===undefined))throw Error('展示來源前提缺失。');
}
function freezeView<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeView);Object.freeze(value);}return value;}
export type ProjectionHealth={state:'empty'|'ready'|'recovering'|'blocked';reason:string};
/** A view store only. Rejects the entire message before publishing any change.
 * One current snapshot and version maps; no command ledger or snapshot history. */
export class PresentationStore {
 private world:PresentationWorld|null=null;private head?:ProjectionHeader;private versions:VersionMap=emptyVersions();
 private listeners=new Set<()=>void>();private health:ProjectionHealth={state:'empty',reason:''};
 getWorld=()=>this.world;
 getHealth=()=>this.health;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 private emit(){for(const listener of this.listeners)listener();}
 recovering(reason:string){if(this.health.state==='ready'||this.health.state==='empty'||this.health.state==='blocked'){this.health={state:'recovering',reason};this.emit();}}
 block(reason:string){this.health={state:'blocked',reason};this.emit();}
 receive(raw:unknown):{accepted:boolean;reason?:string}{
  try{
   const msg=(raw as {kind?:string})?.kind==='snapshot'?snapshotSchema.parse(raw):patchSchema.parse(raw),h=msg as ProjectionHeader,prior=this.head;
   if(prior){
    if(h.writerEpoch<prior.writerEpoch||h.branch<prior.branch||h.writerEpoch===prior.writerEpoch&&h.sessionId!==prior.sessionId)throw Error('舊引擎或分支回覆。');
    if(h.sessionId===prior.sessionId&&h.projectionSequence<=prior.projectionSequence)throw Error('重複或過期的展示訊息。');
   }
   let next:PresentationWorld|null,versions:VersionMap;
   if(msg.kind==='snapshot'){
    if(h.baseSequence!==null)throw Error('快照不應要求前序訊息。');
    if(prior&&h.branch===prior.branch&&h.campaignId===prior.campaignId&&h.nextRevision<prior.nextRevision)throw Error('快照版本倒退。');
    next=reconcilePresentation(this.world,readWorld(msg.world,h));versions=msg.versions as VersionMap;for(const key of sectionKeys)if(versions.sections[key]!==Number(!!next))throw Error('快照區段版本不完整。');
    for(const key of entityKeys){const rows=next?entities(next,key):[],ids=rows.map(e=>entityId(key,e));if(ids.length!==Object.keys(versions.entities[key]).length||ids.some(id=>!versions.entities[key][id]))throw Error('快照實體版本不完整。');}
   }else{
    if(!prior||!this.world||h.campaignId!==prior.campaignId||h.branch!==prior.branch||h.writerEpoch!==prior.writerEpoch||h.sessionId!==prior.sessionId||h.baseRevision!==prior.nextRevision||h.nextRevision<prior.nextRevision||h.baseSequence!==prior.projectionSequence||h.projectionSequence!==prior.projectionSequence+1)throw Error('展示差量不連續，需重新同步。');
    const p=msg as unknown as Extract<ProjectionMessage,{kind:'patch'}>;
    next={...this.world};versions={entities:{...this.versions.entities},sections:{...this.versions.sections}};
    for(const key of sectionKeys){
     const c=p.sections[key];if(!c)continue;if(!Object.hasOwn(c,'value'))throw Error('區段差量缺少資料。');if(c.baseVersion!==versions.sections[key]||c.nextVersion!==c.baseVersion+1)throw Error('區段版本不連續。');
     const value=sectionValue(key,c.value);if(key==='staticMap'){next.worldLayer=value?{...value as Omit<NonNullable<PresentationWorld['worldLayer']>,'wildSites'>,wildSites:next.worldLayer?.wildSites??[]}:undefined;}else Object.assign(next,{[key]:value});versions.sections[key]=c.nextVersion;
    }
    for(const key of entityKeys){
     const changes=p.entities[key]??[],order=p.orders[key];if(!changes.length&&!order)continue;
     const rows=entities(this.world,key),map=new Map(rows.map(e=>[entityId(key,e),e])),rev={...versions.entities[key]},seen=new Set<string>();
     for(const c of changes){
      if(seen.has(c.id)||c.baseVersion!==(rev[c.id]??0)||c.nextVersion!==c.baseVersion+1||c.op==='add'&&map.has(c.id)||c.op!=='add'&&!map.has(c.id))throw Error('實體差量版本不連續。');seen.add(c.id);
      if(c.op==='remove'){map.delete(c.id);delete rev[c.id];}else{const value=entityValue(key,c.value);if(entityId(key,value)!==c.id)throw Error('差量身份不符。');const old=map.get(c.id);map.set(c.id,old!==undefined&&equalData(old,value)?old:value);rev[c.id]=c.nextVersion;}
     }
     const ids=order??rows.map(e=>entityId(key,e)).filter(id=>map.has(id));if(ids.length!==map.size||new Set(ids).size!==ids.length||ids.some(id=>!map.has(id)))throw Error('實體順序不完整。');
     const list=ids.map(id=>map.get(id));if(key==='sites'){if(!next.worldLayer){if(list.length)throw Error('缺少地圖來源。');}else next.worldLayer={...next.worldLayer,wildSites:list as NonNullable<PresentationWorld['worldLayer']>['wildSites']};}else Object.assign(next,{[key]:list});versions.entities[key]=rev;
    }
    next.revision=h.nextRevision;next.projection={protocolVersion:2,campaignId:next.campaignId,branch:h.branch,writerEpoch:h.writerEpoch,sessionId:h.sessionId,projectionSequence:h.projectionSequence,revision:h.nextRevision};
   }
   references(next);const empty=msg.kind==='patch'&&h.nextRevision===prior?.nextRevision&&!Object.keys(msg.entities).length&&!Object.keys(msg.sections).length&&!Object.keys(msg.orders).length;this.world=empty?this.world:freezeView(next);this.head={protocolVersion:2,campaignId:h.campaignId,branch:h.branch,writerEpoch:h.writerEpoch,sessionId:h.sessionId,baseRevision:h.baseRevision,nextRevision:h.nextRevision,baseSequence:h.baseSequence,projectionSequence:h.projectionSequence};this.versions=versions;const state=next?'ready':'empty';if(this.health.state!==state||this.health.reason)this.health={state,reason:''};this.emit();return {accepted:true};
  }catch(error){const reason=error instanceof Error?error.message:'畫面資料無法同步。';this.health={state:'recovering',reason};this.emit();return {accepted:false,reason};}
 }
}
