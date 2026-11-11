import {useEffect,useRef,useState} from 'react';
import type {WorldRead} from '../presentationModel';
import {effectiveSpeed} from '../formal/playtest';
import {useDisplayTime} from './liveClock';
import {clock} from './UI';
const countdown=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export function ProtectionStatus({world}:{world:WorldRead}){
 const [open,setOpen]=useState(false),root=useRef<HTMLElement>(null),button=useRef<HTMLButtonElement>(null);
 const f=world.factions.find(f=>f.id===world.playerFactionId),time=useDisplayTime(world,1000),left=Math.max(0,(f?.protectionUntil??0)-time),label=f?.protectionKind==='rebirth'?'復國':'新手',real=left/effectiveSpeed(world);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);},escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 useEffect(()=>{if(left<=0)setOpen(false);},[left]);
 if(left<=0)return null;
 return <aside ref={root} className="formal-protection-status" aria-label="勢力保護狀態"><button ref={button} className="protection-shield" aria-expanded={open} aria-controls="protection-details" onClick={()=>setOpen(v=>!v)}>🛡️ {label}保護 <time>{countdown(real)}</time></button>{open&&<section className="protection-details card" id="protection-details" aria-label="保護詳情"><div><strong>{label}保護</strong><button aria-label="關閉保護詳情" onClick={()=>{setOpen(false);button.current?.focus();}}>×</button></div><p>剩餘世界時間：{clock(left)}</p><p>剩餘現實時間：{countdown(real)}</p><p>保護持續 48 世界小時；期間敵方無法偵察或攻擊你的城市。</p><p>主動宣戰、偵察、掠奪或征服其他領主城市，以及破壞敵方奇觀，會提前解除保護。解除後撤軍或重新載入不會恢復。</p>{(world.developer?.shieldUntil??0)>time&&<small>開發者保護罩另行計算。</small>}</section>}</aside>;
}
