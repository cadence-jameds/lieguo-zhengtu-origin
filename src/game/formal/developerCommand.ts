import type {FormalCity,FormalWorld} from './model';
import {SHIELD_DURATION,refillDeveloperStock,effectiveSpeed} from './playtest';
import {tacticalRoundWorldMs} from './battles';
import {EventScheduler} from './scheduler';
import {requireRule,settleFaction} from './economy';
import {reconcileSiegeStorage} from './siege';
export function configureDeveloper(w:FormalWorld,c:FormalCity,p:{enabled:boolean;speed:50|200;shield?:boolean}){
 requireRule(c.ownerFactionId===w.playerFactionId,'只有玩家可開啟開發者模式。');
 requireRule(p.enabled||p.shield===undefined,'保護罩選項需要開發者模式。');
 settleFaction(w,w.playerFactionId);const oldSpeed=effectiveSpeed(w);w.developer={enabled:p.enabled,speed:p.speed};const newSpeed=effectiveSpeed(w);
 // Preserve remaining tactical time and EventId when switching an active 50X/200X clock.
 if(oldSpeed!==newSpeed){for(const b of w.combat?.battles??[]){const event=w.events.find(e=>e.id===b.roundEventId&&e.type==='combat.round');if(!event)continue;b.nextRoundAt=w.time+Math.max(1,Math.ceil((b.nextRoundAt-w.time)*tacticalRoundWorldMs(newSpeed)/tacticalRoundWorldMs(oldSpeed)));event.at=b.nextRoundAt;}w.events=new EventScheduler(w.events).snapshot();}
 for(const city of w.cities.filter(c=>c.ownerFactionId===w.playerFactionId)){
  if(p.enabled){city.developerResources=true;refillDeveloperStock(city);}else{delete city.developerResources;reconcileSiegeStorage(w,city);}
 }
 if(p.shield!==undefined)w.factions.find(f=>f.id===w.playerFactionId)!.protectionUntil=p.shield?w.time+SHIELD_DURATION:w.time;
}
