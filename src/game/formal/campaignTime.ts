import type {FormalWorld} from './model';
import type {FactionId} from './ids';
import {effectiveSpeed} from './playtest';
import {tacticalRoundWorldMs} from './battles';
import {EventScheduler} from './scheduler';
import {requireRule} from './economy';
export const CAMPAIGN_SPEEDS=[1,3,6,10,25] as const;
export const OFFLINE_HOURS=[0,1,4,8,12] as const;
export type CampaignSpeed=typeof CAMPAIGN_SPEEDS[number];
export type OfflineHours=typeof OFFLINE_HOURS[number];
/** Existing tactical cadence rule, shared by every clock transition. IDs and other events stay unchanged. */
export function retimeCombatClock(w:FormalWorld,oldSpeed:number,newSpeed:number){
 if(oldSpeed===newSpeed)return;
 for(const b of w.combat?.battles??[]){const event=w.events.find(e=>e.id===b.roundEventId&&e.type==='combat.round');if(!event)continue;b.nextRoundAt=w.time+Math.max(1,Math.ceil((b.nextRoundAt-w.time)*tacticalRoundWorldMs(newSpeed)/tacticalRoundWorldMs(oldSpeed)));event.at=b.nextRoundAt;}
 w.events=new EventScheduler(w.events).snapshot();
}
export function setClockMode(w:FormalWorld,mode:'foreground'|'offline'){const old=effectiveSpeed(w);w.clockMode=mode;retimeCombatClock(w,old,effectiveSpeed(w));}
export function configureCampaign(w:FormalWorld,issuer:FactionId,p:{speed:CampaignSpeed;offlineHours:OfflineHours}){
 requireRule(issuer===w.playerFactionId,'只有玩家可變更戰役時間設定。');
 const old=effectiveSpeed(w);w.speed=p.speed;w.offlineHours=p.offlineHours;retimeCombatClock(w,old,effectiveSpeed(w));
}
