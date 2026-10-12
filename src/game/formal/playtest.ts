import type {FormalCity,FormalWorld} from './model';
import type {FactionId} from './ids';
import {resourceKeys} from './model';
/** DEMO protection lasts 20 world hours; hostile city orders end it permanently. */
export const SHIELD_DURATION=20*3600000;
export const effectiveSpeed=(w:FormalWorld)=>w.developer?.enabled?w.developer.speed:w.speed;
export const protectedFaction=(w:FormalWorld,id:FactionId,at=w.time)=>at<(w.factions.find(f=>f.id===id)?.protectionUntil??0);
/** The isolated B5 lab keeps finite stocks for carry/loot verification. */
export const developerStock=(w:FormalWorld,c:FormalCity)=>!!w.developer?.enabled&&c.ownerFactionId===w.playerFactionId&&!w.campaignId.startsWith('campaign:b5lab-');
export const refillDeveloperStock=(c:FormalCity)=>{if(c.developerResources)for(const r of resourceKeys)c.stock[r]=Math.max(0,1000000000-(c.economy?.reservedIncoming[r]??0));};
