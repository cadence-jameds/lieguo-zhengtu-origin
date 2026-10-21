import type {FormalCity,FormalWorld} from './model';
import {SHIELD_DURATION,refillDeveloperStock,effectiveSpeed} from './playtest';
import {retimeCombatClock} from './campaignTime';
import {requireRule,settleFaction} from './economy';
import {reconcileSiegeStorage} from './siege';
export function configureDeveloper(w:FormalWorld,c:FormalCity,p:{enabled:boolean;speed:50|100;shield?:boolean}){
 requireRule(c.ownerFactionId===w.playerFactionId,'只有玩家可開啟開發者模式。');
 requireRule(p.enabled||p.shield===undefined,'保護罩選項需要開發者模式。');
 settleFaction(w,w.playerFactionId);const oldSpeed=effectiveSpeed(w);w.developer={enabled:p.enabled,speed:p.speed};const newSpeed=effectiveSpeed(w);
 retimeCombatClock(w,oldSpeed,newSpeed);
 for(const city of w.cities.filter(c=>c.ownerFactionId===w.playerFactionId)){
  if(p.enabled){city.developerResources=true;refillDeveloperStock(city);}else{delete city.developerResources;reconcileSiegeStorage(w,city);}
 }
 if(p.shield!==undefined)w.factions.find(f=>f.id===w.playerFactionId)!.protectionUntil=p.shield?w.time+SHIELD_DURATION:w.time;
}
