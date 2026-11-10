import {admissionMapDigest} from './admissionMap';
import type {FormalWorld,CommandReceipt} from './formal/model';
import type {PresentationWorld,ProjectionIdentity} from './presentationModel';
import {worldLedger,type VerifiedLedger} from './formal/commandLedger';
import {buildingLevel} from './formal/catalogB3';
import {castleSource} from './formal/buildingDetailData';
import {governanceIntentBase} from './governanceAdmission';
type Write={revision:number;ordinal:number;evidence:unknown};
const newer=(a:Write|undefined,b:Write|undefined)=>!a?b:!b?a:a.revision>b.revision||a.revision===b.revision&&a.ordinal<b.ordinal?a:b;
/** One current proof + bounded city-derived facts. Ordinary commits consume only
 * appended identities. Branch/reload rebuilds are explicit cold work, never UI history. */
export class WorldProjection {
 private proof?:VerifiedLedger;
 private writes=new Map<string,Write>();private malformed?:Write;
 private governanceCache=new Map<string,{dependencies:unknown[];fingerprint:string}>();
 readonly metrics={receiptsRead:0,rebuilds:0,builds:0};
 private observe(r:CommandReceipt,ordinal:number){
  this.metrics.receiptsRead++;if(r.disposition!=='applied')return;
  const write={revision:r.committedRevision,ordinal,evidence:[r.commandId,r.committedRevision]};
  try{const p=JSON.parse(r.fingerprint).payload;if(p?.type==='governance.set'&&typeof p.cityId==='string')this.writes.set(p.cityId,newer(this.writes.get(p.cityId),write)!);}
  catch{this.malformed=newer(this.malformed,{...write,evidence:[r.commandId,r.committedRevision,r.fingerprint]});}
 }
 build(w:FormalWorld,id:ProjectionIdentity):PresentationWorld{
  const next=worldLedger(w),m=next.manifest,a=w.ledger!.anchor;
  if(w.ledger!.pending.length||w.ledger!.outcomes?.length||a.worldRevision!==w.revision||id.revision!==w.revision||id.campaignId!==w.campaignId||id.branch!==a.branch||id.writerEpoch<a.writerEpoch)throw Error('只能投影已提交且版本一致的世界。');
  const previous=this.proof,append=previous&&previous.manifest.campaignId===m.campaignId&&previous.manifest.branch===m.branch&&previous.count<=next.count&&previous.manifest.orderPrefix===m.orderPrefix&&(!previous.history.segments.length||next.history.segments[previous.history.segments.length-1]?.checksum===previous.history.segments.at(-1)!.checksum);
  if(!append){this.writes.clear();this.malformed=undefined;this.governanceCache.clear();this.metrics.rebuilds++;}
  for(let i=append?previous.count:0;i<next.count;i++)this.observe(next.at(i)!,i);
  this.proof=next;this.metrics.builds++;
  const castleSources:Record<string,string>={},governance:Record<string,string>={};
  const currentCities=new Set<string>(w.cities.map(c=>c.id));for(const key of this.governanceCache.keys())if(!currentCities.has(key))this.governanceCache.delete(key);
  for(const city of w.cities){
   castleSources[city.id]=castleSource(w,city);
   const evidence=newer(this.writes.get(city.id),this.malformed)?.evidence??null,g=w.governors?.find(g=>g.cityId===city.id),dependencies=[w.campaignId,w.playerFactionId,city.ownerFactionId,buildingLevel(city,'townhall'),!!city.economy,g?.ownerFactionId,g?.enabled,g?.policy,g?.budget,g?.reserve,evidence],prior=this.governanceCache.get(city.id);
   const fingerprint=prior&&dependencies.every((d,i)=>d===prior.dependencies[i])?prior.fingerprint:governanceIntentBase(w,city.id,evidence).fingerprint;
   this.governanceCache.set(city.id,{dependencies,fingerprint});governance[city.id]=fingerprint;
  }
  const staticMapDigest=admissionMapDigest(w);if(!staticMapDigest)throw Error('靜態地圖意圖前提尚未準備。');
  return projectionValues(w,id,{staticMapDigest,castleSources,governance});
 }
 reset(){this.proof=undefined;this.writes.clear();this.malformed=undefined;this.governanceCache.clear();}
}

/** Pure field selection; the production builder above verifies the committed source first. */
export function projectionValues(w:FormalWorld,id:ProjectionIdentity,derived:PresentationWorld['derived']):PresentationWorld{
 // Explicit fields: never spread an authority object or invoke its receipt getter.
  return {kind:'presentation',presentationVersion:2,projection:id,nextEventAt:w.events.length?w.events.reduce((at,e)=>Math.min(at,e.at),Infinity):null,derived,
   metadata:w.metadata,campaignId:w.campaignId,economyVersion:w.economyVersion,growthTasks:w.growthTasks?{version:w.growthTasks.version,startedAt:w.growthTasks.startedAt,recordedThrough:w.growthTasks.recordedThrough,facts:w.growthTasks.facts,completed:w.growthTasks.completed,claimed:w.growthTasks.claimed}:undefined,victory:w.victory,modernAwareness:w.modernAwareness,governors:w.governors??[],extinction:w.extinction,politics:w.politics?{legions:w.politics.legions,empires:w.politics.empires,requests:w.politics.requests,relations:w.politics.relations,joints:w.politics.joints,reserves:w.politics.reserves}:undefined,developer:w.developer,worldLayer:w.worldLayer,seed:w.seed,speed:w.speed,time:w.time,offlineHours:w.offlineHours,clockMode:w.clockMode,dimensions:w.dimensions,playerFactionId:w.playerFactionId,revision:w.revision,sequences:w.sequences,factions:w.factions,cities:w.cities,armies:w.armies,researchProjects:w.researchProjects,largeProjects:w.largeProjects,logistics:w.logistics??[],settlements:w.settlements??[],colonizationUnits:w.colonizationUnits??[],combat:w.combat?{battles:w.combat.battles,statistics:w.combat.statistics}:undefined,battleEffects:{cursor:w.combat?.receipts.length??0,recent:w.combat?.receipts.slice(-128)??[]}};
}
