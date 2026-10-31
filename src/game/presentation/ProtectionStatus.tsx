import type {FormalWorld} from '../formal/model';
import {effectiveSpeed} from '../formal/playtest';
import {useDisplayTime} from './liveClock';
import {clock} from './UI';
export function ProtectionStatus({world}:{world:FormalWorld}){
 const f=world.factions.find(f=>f.id===world.playerFactionId)!,time=useDisplayTime(world,1000),left=Math.max(0,(f.protectionUntil??0)-time),label=f.protectionKind==='rebirth'?'復國':'新手';
 return <aside className="formal-protection-status" aria-label="勢力保護狀態"><span>{left>0?label+'保護中':'保護已結束'}</span>{left>0?<small>剩餘 {clock(left)} 世界時間 · 約 {clock(Math.ceil(left/effectiveSpeed(world)))} 現實時間</small>:f.protectionEnded&&<small>提前解除：{f.protectionEnded.reason}</small>}{(world.developer?.shieldUntil??0)>time&&<small>開發者保護罩中（獨立）</small>}</aside>;
}
