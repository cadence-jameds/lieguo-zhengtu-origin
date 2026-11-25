import {admissionMapDigest} from './admissionMap';
import type {WorldRead} from './presentationModel';
import {commandHistory} from './formal/commandLedger';
import type {FormalCity,FormalCommand,FormalOrder,FormalWorld} from './formal/model';
import {buildingKind,buildingLevel} from './formal/catalogB3';
import {buildingRequirements} from './formal/buildingDetailData';
import {spatial} from './formal/spatial';
import {canReinforce} from './formal/armies';
import {canCoordinate,embassy,empireOf,legionOf,diplomaticRelation,politicalLeader,politicalScope,type CooperationCommand,type PoliticalCommand} from './formal/politics';
import {route,segmentTravelDistance} from './formal/routing';
import {marchSeconds} from './formal/combatModifiers';
import {UNIT_CATALOG} from './formal/unitCatalog';
import {protectedFaction} from './formal/playtest';

/** The UI records only the intended action's relevant preconditions.
 * Production, elapsed time and unrelated AI factions do not invalidate
 * an unchanged player order. The formal reducer still validates all current
 * costs, ownership, queues and requirements at admission time. */
export type PlayerOrderBase={revision:number;fingerprint:string};

/** Stamp the political parties named by the click, not the global revision. */
function politicalIntentState(w:WorldRead,p:PoliticalCommand):unknown[]{
 const me=w.playerFactionId,politics=w.politics;
 const request=p.requestId?politics?.requests.find(r=>r.id===p.requestId):undefined;
 const subjects=[...new Set([me,p.target,request?.from,request?.to])].filter(id=>id!==undefined);
 const party=(id:typeof me)=>{
  const faction=w.factions.find(f=>f.id===id),legion=legionOf(w,id),empire=empireOf(w,id);
  const constituentLegions=empire?.legions.map(legionId=>{
   const group=politics?.legions.find(l=>l.id===legionId);
   return [legionId,group?.leader,group?.members];
  });
  return [id,!!faction,w.cities.some(c=>c.ownerFactionId===id),legion?.id,legion?.leader,legion?.members,empire?.id,empire?.leader,constituentLegions];
 };
 const groups=subjects.map(party);
 const diplomat=p.action==='war'||p.action==='peace'||p.action==='friendly-end'||p.action==='friendly-propose'||request?.kind==='friendly';
 const scopes=new Set(subjects.map(id=>politicalScope(w,id))),relations=(politics?.relations??[]).filter(r=>scopes.has(r.a as typeof me)&&scopes.has(r.b as typeof me));
 const requestKind=p.action==='friendly-propose'?'friendly':p.action==='legion-apply'?'application':p.action==='legion-invite'?'invitation':p.action==='empire-propose'?'empire':undefined;
 const recipient=p.action==='legion-apply'&&p.target?legionOf(w,p.target)?.leader:p.target;
 const peerRequests=recipient&&requestKind?(politics?.requests??[]).filter(r=>r.kind===requestKind&&r.from===me&&r.to===recipient):[];
 if(diplomat)return [groups,subjects.map(id=>politicalLeader(w,id)),relations,request,
  p.action==='friendly-propose'?peerRequests:null];
 const relevantLegions=new Set(subjects.map(id=>legionOf(w,id)?.id).filter(Boolean));
 const relevantEmpires=new Set(subjects.map(id=>empireOf(w,id)?.id).filter(Boolean));
 const authorityMembers=new Set(subjects);
 for(const group of politics?.legions??[])if(relevantLegions.has(group.id)||relevantEmpires.has(group.empireId??undefined))
  for(const member of group.members)authorityMembers.add(member);
 // Local prerequisites, not stocks, AI turn counters or the clock. The
 // authority sets above also cover transfer/succession candidates.
 const eligibility=[...authorityMembers].sort().map(id=>[id,w.factions.find(f=>f.id===id)?.age,embassy(w,id)]);
 return [groups,eligibility,relations,request,peerRequests,
  p.action==='legion-edit'?legionOf(w,me)?.name:null,p.action==='legion-edit'?legionOf(w,me)?.description:null];
}

/** Rebase only the same cooperation contract. Never include another
 * faction's troop counts; special wonder missions still require fresh input. */
function cooperationIntentState(w:WorldRead,city:FormalCity,p:CooperationCommand,mapDigest?:string):unknown[]|undefined {
 const me=w.playerFactionId,faction=w.factions.find(f=>f.id===me)!;
 const authority=(id:typeof me,level:13|14)=>{
  const legion=legionOf(w,id),empire=empireOf(w,id);
  return [legion?.id,legion?.leader,!!legion&&embassy(w,legion.leader)>=level,
   empire?.id,empire?.leader,!!empire&&embassy(w,empire.leader)>=15];
 };
 const level=p.type==='defense.set'||p.type==='defense.dispatch'?13:14;
 const ownAuthority=authority(me,level);
 const reserve=w.politics?.reserves.find(r=>r.cityId===city.id);
 const count=(id:string)=>city.military?.units[id]??0;
 const selected=(units:Record<string,number>)=>Object.keys(units).sort().map(id=>[id,count(id)]);
 if(p.type==='defense.set')return [ownAuthority,reserve,selected(p.units)];
 const joint=p.type==='joint.join'?w.politics?.joints.find(j=>j.id===p.jointId):undefined;
 if(p.type==='joint.join'&&!joint)return;
 if((p.type==='joint.create'&&(p.mission==='wonder-destruction'||p.wonderPriority))||
    (joint&&(joint.mission==='wonder-destruction'||joint.wonderPriority)))return;
 const target=w.cities.find(c=>c.id===(p.type==='joint.join'?joint!.targetCityId:p.targetCityId));
 if(!target)return;
 const targetState=[target.id,target.x,target.y,target.ownerFactionId,politicalScope(w,target.ownerFactionId),
  diplomaticRelation(w,me,target.ownerFactionId),canReinforce(w,me,target.ownerFactionId)];
 const march=[city.x,city.y,faction.civilizationId,faction.age,faction.techIds,w.dimensions,
  ...(mapDigest?[{version:2,staticMapDigest:mapDigest}]:[w.worldLayer?.terrain,w.worldLayer?.mountains])];
 if(p.type==='defense.dispatch')return [ownAuthority,reserve,authority(target.ownerFactionId,level),
  canCoordinate(w,me,target.ownerFactionId,13),targetState,march,
  // All own troops can affect the reserve's minimum-garrison computation.
  Object.entries(city.military?.units??{}).sort(([a],[b])=>a.localeCompare(b))];
 const arrival=p.type==='joint.create'?p.arrivalAt:joint!.arrivalAt;
 let window:'expired'|'can-arrive'|'too-late'='expired';
 if(w.time<arrival){
  const units=Object.fromEntries(Object.entries(p.units).filter(([,n])=>n>0));
  if(!Object.keys(units).length||Object.keys(units).some(id=>!Object.hasOwn(UNIT_CATALOG,id)))return;
  try{
   const {path}=route(w,city,target),seconds=marchSeconds(units,faction);
   let duration=0;for(let i=1;i<path.length;i++)duration+=segmentTravelDistance(w,path[i-1],path[i])*seconds*1000;
   window=w.time+Math.max(1,Math.ceil(duration))<=arrival?'can-arrive':'too-late';
  }catch{return;}
 }
 // Past or no-longer-reachable joins aren't silently replayed. A create with
 // an immediate arrival request (the normal UI) still departs immediately.
 if(joint&&window!=='can-arrive')return;
 return [ownAuthority,targetState,march,selected(p.units),protectedFaction(w,target.ownerFactionId),window,
  joint?[joint.id,joint.targetCityId,joint.initiator,joint.scope,joint.arrivalAt,joint.mission,joint.armyIds,
   authority(joint.initiator,level),canCoordinate(w,me,joint.initiator,14),
   joint.armyIds.map(id=>w.armies.find(a=>a.id===id)?.status)]:null];
}

function intentState(w:WorldRead,p:FormalCommand,mapDigest?:string):unknown[]|undefined {
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
   return[city.x,city.y,Object.keys(p.units).sort().map(id=>[id,city.military?.units[id]??0]),faction.civilizationId,faction.age,faction.techIds,politicalScope(w,faction.id),destination,w.dimensions,...(mapDigest?[{version:2,staticMapDigest:mapDigest}]:[w.worldLayer?.terrain,w.worldLayer?.mountains])];
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
  case 'logistics.configure':{
   const project=p.settings.wonder?.enabled?w.largeProjects.find(t=>t.projectId===p.settings.wonder!.projectId):undefined;
   const host=project?w.cities.find(c=>c.id===project.initiatingCityId):undefined;
   // AI arrivals change demand, but do not change a player's allocation intent.
   return[city.autoLogistics,city.logisticsSettings,buildingLevel(city,'market'),faction.techIds.includes('logistics.auto'),
    p.rules.map(r=>[r.destinationCityId,w.cities.find(c=>c.id===r.destinationCityId)?.ownerFactionId]),
    project?[empireOf(w,faction.id)?.id,project.projectId,project.owner,project.wonder?.phase,host?.id,host?.ownerFactionId,host?empireOf(w,host.ownerFactionId)?.id:null]:null];
  }
  case 'logistics.auto.set':return[city.autoLogistics,city.buildings,construction];
  case 'politics':return politicalIntentState(w,p);
  case 'defense.set':case 'defense.dispatch':case 'joint.create':case 'joint.join':return cooperationIntentState(w,city,p,mapDigest);
  // No automatic admission for other combat, withdrawal,
  // disbanding or cross-city movement.
  default:return;
 }
}

/** Immutable semantic intent stamp, not an authorization to skip validation. */
export function playerOrderBase(w:WorldRead,p:FormalCommand,encoding?:1|2):PlayerOrderBase|undefined {
 const compact=(p.type==='army.dispatch'||p.type==='defense.dispatch'||p.type==='joint.create'||p.type==='joint.join')&&(encoding===2||encoding!==1&&w.kind==='presentation'),mapDigest=compact?(w.kind==='presentation'?w.derived.staticMapDigest:admissionMapDigest(w)):undefined;
 if(compact&&!mapDigest)return;
 const state=intentState(w,p,mapDigest);
 if(!state)return;
 return {revision:w.revision,fingerprint:(compact?'intent-v2:':'')+JSON.stringify([w.campaignId,w.playerFactionId,p,state])};
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
    foregroundRevision===undefined&&w.commandFacts!==undefined&&order.expectedRevision<w.commandFacts.foregroundRevision||
    order.expectedRevision<branchRevision||order.expectedRevision>=w.revision||
    order.campaignId!==w.campaignId||order.issuerId!==w.playerFactionId||
    !Number.isSafeInteger(order.issuedWorldTime)||order.issuedWorldTime<0||
    order.issuedWorldTime>w.time||
    commandHistory(w).some(r=>r.commandId===order.commandId||
      foregroundRevision===undefined&&r.issuerId===order.issuerId&&r.committedRevision>order.expectedRevision))return order;
 const current=playerOrderBase(w,order.payload,base.fingerprint.startsWith('intent-v2:')?2:1);
 if(!current||current.fingerprint!==base.fingerprint)return order;
 return {...order,expectedRevision:w.revision,issuedWorldTime:w.time};
}
