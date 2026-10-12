import type {FormalWorld,FormalCity,FormalCommand} from '../formal/model';
import {protectedFaction,SHIELD_DURATION} from '../formal/playtest';
import {useDisplayTime} from './liveClock';
import {realTime} from './UI';
export function DeveloperControls({world,city,issue,busy,onBattleLab}:{world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean;onBattleLab?:()=>void}){
 const enabled=!!world.developer?.enabled,speed=world.developer?.speed??50,time=useDisplayTime(world),shield=protectedFaction({...world,time},world.playerFactionId);
 const configure=(on:boolean,next:50|200=speed,protect?:boolean)=>issue({type:'developer.configure',cityId:city.id,enabled:on,speed:next,...(protect===undefined?{}:{shield:protect})});
 return <section className="card developer-controls"><h2>開發者模式</h2><p>在目前戰役中測試。開啟後，你的城市資源持續補滿；建造、科技、人口與兵種前置照常運作。</p><button disabled={busy} aria-pressed={enabled} onClick={()=>configure(!enabled)}>{enabled?'關閉開發者模式':'開啟開發者模式'}</button>{enabled&&<>{onBattleLab&&<button disabled={busy} onClick={onBattleLab}>B5 戰鬥測試台</button>}<label>世界時間加速<select aria-label="開發者世界時間加速" value={speed} disabled={busy} onChange={e=>configure(true,Number(e.target.value) as 50|200)}><option value={50}>50 倍</option><option value={200}>200 倍</option></select></label><label className="developer-shield"><input type="checkbox" aria-label="開啟保護罩" checked={shield} disabled={busy} onChange={e=>configure(true,speed,e.target.checked)}/>保護罩{shield&&' · 剩餘 '+realTime((world.factions.find(f=>f.id===world.playerFactionId)?.protectionUntil??time)-time,world)}</label><p>保護罩持續 {SHIELD_DURATION/3600000} 世界小時；主動對其他領主攻擊或偵察會立即解除。野外據點、己方運輸與增援不會解除。</p></>}</section>;
}
