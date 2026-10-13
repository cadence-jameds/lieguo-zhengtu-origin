import type {FormalCommand,FormalOrder,FormalWorld} from './formal/model';

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
 switch(p.type){
  case 'city.rename':return[city.name];
  case 'field.upgrade':return[city.fields?.find(f=>f.slot===p.slot),construction,city.cityPromotionCompleted,city.economy?.milestones,city.housing];
  case 'building.upgrade':
  case 'building.demolish':return[city.buildings,city.wallLevel,construction,city.economy?.slots,city.economy?.milestones,faction.age,faction.techIds];
  case 'construction.cancel':return[construction];
  case 'military.recruit':return[city.military,city.buildings,city.castleCivilizationId,city.economy?.milestones,faction.age,faction.techIds];
  case 'military.cancel':return[city.military?.queue];
  case 'age.start':return[faction.age,faction.ageQueue,city.buildings];
  case 'research.start':return[faction.techIds,faction.researchQueue,faction.modernQualification,faction.researchCooperation,city.buildings,city.economy?.milestones,w.researchProjects.filter(t=>t.ownerFactionId===faction.id)];
  case 'research.contribute':return[w.researchProjects.find(t=>t.projectId===p.projectId),faction.researchQueue];
  case 'city.promote':return[city.cityPromotionCompleted,city.economy?.promotion,city.buildings,city.economy?.milestones];
  case 'logistics.auto.set':return[city.autoLogistics,city.buildings,construction];
  // No automatic admission for combat, diplomacy, dispatch, withdrawal,
  // disbanding, developer tools or cross-city movement.
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
 * All serializations are in-memory; save schema and CAS stay unchanged. */
export function playerOrderWithBase(w:FormalWorld,order:FormalOrder,base?:PlayerOrderBase,branchRevision=0):FormalOrder {
 if(!base||!Number.isSafeInteger(order.expectedRevision)||order.expectedRevision<0||
    base.revision!==order.expectedRevision||!Number.isSafeInteger(branchRevision)||
    order.expectedRevision<branchRevision||order.expectedRevision>=w.revision||
    order.campaignId!==w.campaignId||order.issuerId!==w.playerFactionId||
    !Number.isSafeInteger(order.issuedWorldTime)||order.issuedWorldTime<0||
    order.issuedWorldTime>w.time||
    w.commandReceipts.some(r=>r.commandId===order.commandId||
      r.issuerId===order.issuerId&&r.committedRevision>order.expectedRevision))return order;
 const current=playerOrderBase(w,order.payload);
 if(!current||current.fingerprint!==base.fingerprint)return order;
 return {...order,expectedRevision:w.revision,issuedWorldTime:w.time};
}
