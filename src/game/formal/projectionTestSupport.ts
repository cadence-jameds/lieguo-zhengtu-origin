import {createHash} from 'node:crypto';
import {canonicalJSON} from './canonical';
import {mapIntentData} from '../admissionMap';
/** Test-only observation bridge. Domain labs retain their full-world assertions,
 * while the real v2 stream/store must reconstruct the complete read projection.
 * No observer, ledger materialization or legacy wire exists in production. */
import {WorldProjection,projectionValues} from '../worldProjection';
import {PresentationStore} from '../presentationStore';
import {equalData} from '../projectionProtocol';
import type {FormalWorld} from './model';
import type {ProjectionIdentity,PresentationWorld} from '../presentationModel';
import {castleSource} from './buildingDetailData';
import {governanceBase} from '../governanceAdmission';
import {projectWorld} from './commandLedger';
export class ProjectionTestBridge {
 readonly store=new PresentationStore();readonly wires:any[]=[];source:FormalWorld|null=null;private expected:PresentationWorld|null=null;private notification=0;
 readonly verified=new WorldProjection();
 constructor(private strict=false){}
 readonly reader={build:(world:FormalWorld,id:ProjectionIdentity)=>{this.source=world;this.expected=this.strict?this.verified.build(world,id):fixtureProjection(world,id);return this.expected;},reset:()=>{this.verified.reset();}};
 receive(message:any){
  this.wires.push(message);
  if(message.notificationSequence!==undefined){if(message.notificationSequence<=this.notification)throw Error('Nonmonotonic Runtime notification');this.notification=message.notificationSequence;}
  const {runtimeSession:_session,notificationSequence:_sequence,writerEpoch:_epoch,branch,projection,...rest}=message;
  if(!projection)return rest;
  if(projection.kind==='snapshot'&&projection.world===null){this.source=null;this.expected=null;}
  const accepted=this.store.receive(projection);if(!accepted.accepted)throw Error('Real v2 projection rejected: '+accepted.reason);
  // Same-revision empty patches preserve the display reference and its original
  // click identity. Compare all content independently of that transport stamp.
  const displayed=this.store.getWorld(),content=(w:PresentationWorld|null)=>{if(!w)return null;const {projection:_identity,...data}=w;return data;};
  if(!equalData(content(displayed),content(this.expected)))throw Error('UI projection diverged from committed source');
  if(projection.kind==='snapshot'&&projection.world&&('commandReceipts'in projection.world||'ledger'in projection.world||'events'in projection.world))throw Error('Authority data leaked onto UI wire');
  return {...rest,branch,world:this.source?projectWorld(this.source):null};
 }
}
/** Pure, unbound domain fixtures are intentionally not production snapshots.
 * Only their test reader supplies facts; verified/native labs use strict=true. */
export function fixtureProjection(world:FormalWorld,id:ProjectionIdentity):PresentationWorld{
 return projectionValues(world,id,{staticMapDigest:createHash('sha256').update(canonicalJSON(mapIntentData(world))).digest('hex'),castleSources:Object.fromEntries(world.cities.map(c=>[c.id,castleSource(world,c)])),governance:Object.fromEntries(world.cities.map(c=>[c.id,governanceBase(world,c.id).fingerprint]))});
}
