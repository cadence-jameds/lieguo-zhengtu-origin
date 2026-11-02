import type {FormalWorld} from './formal/model';
import type {PresentationWorld} from './presentationModel';
import {WorldProjection} from './worldProjection';
import {entityKeys,sectionKeys,entities,entityId,section,equalData,emptyVersions,type VersionMap,type ProjectionMessage,type ProjectionPatch} from './projectionProtocol';
/** One emitter per Runtime. Sequence advances even when only an immutable result
 * changed at the same world revision. Lost T3 sends intentionally leave a gap. */
export class WorldStream {
 private prior:PresentationWorld|null=null;private sequence=0;private versions=emptyVersions();
 constructor(readonly sessionId:string=crypto.randomUUID(),readonly projection:Pick<WorldProjection,'build'|'reset'>=new WorldProjection()){}
 publish(world:FormalWorld|null,writer:{branch:number;writerEpoch:number},forceSnapshot=false):ProjectionMessage{
  const sequence=++this.sequence,header={protocolVersion:2 as const,campaignId:world?.campaignId??null,branch:writer.branch,writerEpoch:writer.writerEpoch,sessionId:this.sessionId,baseRevision:this.prior?.revision??null,nextRevision:world?.revision??0,baseSequence:sequence-1,projectionSequence:sequence};
  if(!world)this.projection.reset();
  const next=world?this.projection.build(world,{protocolVersion:2,campaignId:world.campaignId,branch:writer.branch,writerEpoch:writer.writerEpoch,sessionId:this.sessionId,projectionSequence:sequence,revision:world.revision}):null;
  if(forceSnapshot||!next||!this.prior||this.prior.campaignId!==next.campaignId||this.prior.projection.branch!==writer.branch||this.prior.projection.writerEpoch!==writer.writerEpoch){
   const versions=emptyVersions();if(next){for(const key of entityKeys)for(const e of entities(next,key))versions.entities[key][entityId(key,e)]=1;for(const key of sectionKeys)versions.sections[key]=1;}
   this.prior=next;this.versions=versions;return {...header,kind:'snapshot',baseSequence:null,world:next,versions};
  }
  const patch:ProjectionPatch={...header,kind:'patch',entities:{},sections:{},orders:{}},versions:VersionMap={entities:{...this.versions.entities},sections:{...this.versions.sections}};
  for(const key of entityKeys){
   const before=entities(this.prior,key),after=entities(next,key);if(before===after)continue;
   const old=new Map(before.map(e=>[entityId(key,e),e])),fresh=new Map(after.map(e=>[entityId(key,e),e]));
   const changes:NonNullable<ProjectionPatch['entities'][typeof key]>=[],rev={...versions.entities[key]};
   for(const [id,value] of fresh){const prior=old.get(id);if(prior!==undefined&&equalData(prior,value))continue;const baseVersion=rev[id]??0,nextVersion=baseVersion+1;changes.push({op:prior===undefined?'add':'update',id,baseVersion,nextVersion,value});rev[id]=nextVersion;}
   for(const id of old.keys())if(!fresh.has(id)){const baseVersion=rev[id];changes.push({op:'remove',id,baseVersion,nextVersion:baseVersion+1});delete rev[id];}
   if(changes.length){patch.entities[key]=changes;versions.entities[key]=rev;}
   if(before.length!==after.length||before.some((e,i)=>entityId(key,e)!==entityId(key,after[i]??{})))patch.orders[key]=[...fresh.keys()];
  }
  for(const key of sectionKeys){const value=section(next,key);if(equalData(section(this.prior,key),value))continue;const baseVersion=versions.sections[key];patch.sections[key]={baseVersion,nextVersion:baseVersion+1,value};versions.sections[key]++;}
  this.prior=next;this.versions=versions;return patch;
 }
 get projectionSequence(){return this.sequence;}
 reset(){this.prior=null;}
}
