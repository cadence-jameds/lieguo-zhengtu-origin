import type {FormalCommand,FormalOrder,FormalWorld} from './formal/model';
import {buildingKind,buildingLevel} from './formal/catalogB3';
import {buildingRequirements} from './formal/buildingDetailData';
import {spatial} from './formal/spatial';
import {canReinforce} from './formal/armies';
import {empireOf,diplomaticRelation,politicalScope} from './formal/politics';
import {protectedFaction} from './formal/playtest';

/** The UI records only the intended action's relevant preconditions.
 * Production, elapsed time and unrelated AI factions do not invalidate
 * an unchanged player order. The formal reducer still validates all current
 * costs, ownership, queues and requirements at admission time. */
export type PlayerOrderBase={revision:number;fingerprint:string};

function intentState(w:FormalWorld,p:FormalCommand):unknown[]|undefined {
 const city=w.cities.find(c=>c.id===p.cityId);
 if(!city||city.ownerFactionId!==w.playerFactionId)return;
 const faction=w.factions.find(f=>f.id===w.playerFactionId);
 if(!faction)return;
 const construction=city.economy?.construction;
 const targetJobs=(construction??[]).filter(j=>p.type==='field.upgrade'?j.target.kind==='field'&&j.target.slot===p.slot:
  p.type==='building.upgrade'&&j.target.kind==='building'&&j.target.key===p.key);
 const jobs=targetJobs.map(j=>[j.commandId,j.eventId,j.fromLevel,j.toLevel,j.action,j.lane]);
 const secondLane='lane' in p&&p.lane===1?!!city.economy?.milestones.includes(15000):null;
 switch(p.type){
  case 'army.dispatch':{
   // Stamp public destination identity/authority and the selected own units,
   // never hidden enemy troops. The reducer rechecks all current legality and
   // computes a fresh route before the unchanged atomic save/CAS boundary.
   const requested=p.target;
   const target=requested.kind==='city'?w.cities.find(c=>c.id===requested.cityId):spatial(w).sites.get(requested.siteId);
   const destination=target&&('ownerFactionId' in target?
    [target.id,target.x,target.y,target.ownerFactionId,politicalScope(w,target.ownerFactionId),diplomaticRelation(w,faction.id,target.ownerFactionId),canReinforce(w,faction.id,target.ownerFactionId),protectedFaction(w,target.ownerFactionId)]:
    [target.id,target.x,target.y,target.generation,target.phase??'active']);
   return[city.x,city.y,Object.keys(p.units).sort().map(id=>[id,city.military?.units[id]??0]),faction.civilizationId,faction.age,faction.techIds,politicalScope(w,faction.id),destination,w.dimensions,w.worldLayer?.terrain,w.worldLayer?.mountains];
  }
  case 'wonder.start':{
   const empire=empireOf(w,faction.id),host=w.cities.find(c=>c.id===p.hostCityId);
   return[empire?.id,empire?.leader,host?.ownerFactionId,host?empireOf(w,host.ownerFactionId)?.id:null,w.largeProjects.filter(p=>p.kind==='world-wonder'&&p.owner.kind==='empire'&&p.owner.empireId===empire?.id)];
  }
  case 'breakthrough.start':return[empireOf(w,faction.id),w.largeProjects.filter(t=>t.owner.kind==='empire'&&t.owner.empireId===faction.empireId),w.cities.map(c=>[c.id,c.ownerFactionId])];
  case 'breakthrough.ship':
  case 'wonder.ship':return[empireOf(w,faction.id)?.id,w.largeProjects.find(t=>t.projectId===p.projectId),city.buildings,w.logistics?.filter(t=>t.sourceCityId===city.id),w.cities.find(c=>c.id===w.largeProjects.find(t=>t.projectId===p.projectId)?.initiatingCityId)?.ownerFactionId];
  case 'campaign.configure':return[w.speed,w.offlineHours??12];
  case 'developer.configure':return[w.developer??null,faction.protectionUntil??null];
  case 'tasks.claim':return[w.growthTasks?.completed[p.taskId]??null,w.growthTasks?.claimed[p.taskId]??null,city.buildings,city.cityPromotionCompleted,city.economy?.reservedIncoming];
  case 'city.rename':return[city.name];
  case 'field.upgrade':{
   const field=city.fields?.find(f=>f.slot===p.slot),from=targetJobs.at(-1)?.toLevel??field?.level??0;
   return[field,jobs,buildingLevel(city,'center'),secondLane,from>=10?
    [!!city.cityPromotionCompleted,!!city.economy?.milestones.includes(10000),city.housing>=10000]:null];
  }
  case 'building.upgrade':{
   const kind=buildingKind(p.key),level=kind==='wall'?city.wallLevel??0:city.buildings[p.key]??0;
   const next=(targetJobs.at(-1)?.toLevel??level)+1,slots=city.economy?.slots??{};
   const requestedSlot=p.slot===undefined?null:Object.entries(slots).find(([,slot])=>slot===p.slot)?.[0]??null;
   const requirements=kind?buildingRequirements(w,city,kind,next).map(r=>[r.kind,r.id,r.required,r.met]):null;
   return[level,jobs,slots[p.key]??null,requestedSlot,requirements,kind==='center'?null:buildingLevel(city,'center'),secondLane];
  }
  case 'building.demolish':return[city.buildings,city.wallLevel,construction,city.economy?.slots,city.economy?.milestones,faction.age,faction.techIds];
  case 'construction.cancel':{
   const job=construction?.find(j=>j.commandId===p.constructionCommandId);
   return[job?[job.commandId,job.eventId,job.target,job.fromLevel,job.toLevel,job.action,job.startsAt>w.time?'queued':'active']:null];
  }
  case 'military.recruit':return[city.military,city.buildings,city.castleCivilizationId,city.economy?.milestones,faction.age,faction.techIds];
  case 'military.cancel':return[city.military?.queue];
  case 'age.start':return[faction.age,faction.ageQueue,city.buildings];
  case 'research.start':return[faction.techIds,faction.researchQueue,faction.modernQualification,faction.researchCooperation,city.buildings,city.economy?.milestones,w.researchProjects.filter(t=>t.ownerFactionId===faction.id)];
  case 'research.contribute':return[w.researchProjects.find(t=>t.projectId===p.projectId),faction.researchQueue];
  case 'city.promote':return[city.cityPromotionCompleted,city.economy?.promotion,city.buildings,city.economy?.milestones];
  case 'logistics.auto.set':return[city.autoLogistics,city.buildings,construction];
  // No automatic admission for other combat, diplomacy, withdrawal,
  // disbanding or cross-city movement.
  default:return;
 }
}

/** Immutable semantic intent stamp, not an authorization to skip validation. */
export function playerOrderBase(w:FormalWorld,p:FormalCommand):PlayerOrderBase|undefined {
 const state=intentState(w,p);
 if(!state)return;
 return {revision:w.revision,fingerprint:JSON.stringify([w.campaignId,w.playerFactionId,p,state])};
}

/** A bounded, one-shot rebase of an uncommitted user action.
 * A newer player command is a hard fence, even if its effect was later undone.
 * The serialized Worker may supply its own durable foreground fence: governor
 * replay uses the player's issuer too. It never trusts a request or ID prefix
 * to identify a foreground command. Other callers keep the receipt fence.
 * All serializations are in-memory; save schema and CAS stay unchanged. */
export function playerOrderWithBase(w:FormalWorld,order:FormalOrder,base?:PlayerOrderBase,branchRevision=0,foregroundRevision?:number):FormalOrder {
 if(!base||!Number.isSafeInteger(order.expectedRevision)||order.expectedRevision<0||
    base.revision!==order.expectedRevision||!Number.isSafeInteger(branchRevision)||branchRevision<0||
    foregroundRevision!==undefined&&(!Number.isSafeInteger(foregroundRevision)||foregroundRevision<0||foregroundRevision>w.revision||order.expectedRevision<foregroundRevision)||
    order.expectedRevision<branchRevision||order.expectedRevision>=w.revision||
    order.campaignId!==w.campaignId||order.issuerId!==w.playerFactionId||
    !Number.isSafeInteger(order.issuedWorldTime)||order.issuedWorldTime<0||
    order.issuedWorldTime>w.time||
    w.commandReceipts.some(r=>r.commandId===order.commandId||
      foregroundRevision===undefined&&r.issuerId===order.issuerId&&r.committedRevision>order.expectedRevision))return order;
 const current=playerOrderBase(w,order.payload);
 if(!current||current.fingerprint!==base.fingerprint)return order;
 return {...order,expectedRevision:w.revision,issuedWorldTime:w.time};
}
