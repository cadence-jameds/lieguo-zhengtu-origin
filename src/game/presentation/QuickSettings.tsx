import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {FormalCommand,FormalWorld} from '../formal/model';
import type {CityId} from '../formal/ids';
import {CampaignSettings} from './CampaignSettings';
export const QUICK_SETTINGS_KEY='lieguo-quick-settings-v1';
const GEAR_SIZE=44,EDGE_DISTANCE=24;
type GearEdge='left'|'right'|'top'|'bottom';
export type QuickPreference={visible:boolean;x:number;y:number;edge?:GearEdge};
const isEdge=(edge:unknown):edge is GearEdge=>['left','right','top','bottom'].includes(edge as string);
/** Coordinates stay in the viewport; docking is a device preference, never campaign data. */
export function clampGear(p:QuickPreference,width:number,height:number):QuickPreference{
 const edge=isEdge(p.edge)?p.edge:undefined,maxX=Math.max(0,width-GEAR_SIZE),maxY=Math.max(0,height-GEAR_SIZE);
 return {...p,edge,x:edge==='left'?0:edge==='right'?maxX:Math.max(0,Math.min(maxX,Number.isFinite(p.x)?p.x:width-60)),y:edge==='top'?0:edge==='bottom'?maxY:Math.max(0,Math.min(maxY,Number.isFinite(p.y)?p.y:height/2))};
}
export function dockGear(p:QuickPreference,width:number,height:number):QuickPreference{
 const q=clampGear({...p,edge:undefined},width,height);
 const distances:[GearEdge,number][]=[['left',q.x],['right',width-GEAR_SIZE-q.x],['top',q.y],['bottom',height-GEAR_SIZE-q.y]];
 distances.sort((a,b)=>a[1]-b[1]);
 return clampGear({...q,edge:distances[0][1]<=EDGE_DISTANCE?distances[0][0]:undefined},width,height);
}
export function readQuickPreference():QuickPreference{
 try{const p=JSON.parse(localStorage.getItem(QUICK_SETTINGS_KEY)??'{}');return clampGear({visible:p.visible!==false,x:p.x,y:p.y,edge:p.edge},innerWidth,innerHeight);}
 catch{return clampGear({visible:true,x:innerWidth-60,y:innerHeight/2},innerWidth,innerHeight);}
}
/** Portals escape page stacking contexts while remaining inside an active modal's focus boundary. */
function useFloatingSurface(){
 const [surface,setSurface]=useState<Element>(document.body);
 useEffect(()=>{
  const update=()=>{const dialogs=[...document.querySelectorAll('dialog[open]')];setSurface(dialogs.at(-1)??document.fullscreenElement??document.body);};
  const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('fullscreenchange',update);update();
  return()=>{observer.disconnect();document.removeEventListener('fullscreenchange',update);};
 },[]);
 return surface;
}
function GearIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fillRule="evenodd" d="m9.5 2-.6 2.6-1.4.8-2.6-.7-2.5 4.3 1.9 1.9v1.6l-1.9 1.9 2.5 4.3 2.6-.7 1.4.8.6 2.6h5l.6-2.6 1.4-.8 2.6.7 2.5-4.3-1.9-1.9v-1.6l1.9-1.9-2.5-4.3-2.6.7-1.4-.8L14.5 2h-5ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>;}
export function QuickSettings({world,cityId,issue,busy,preference,onPreference}:{world:FormalWorld;cityId:CityId;issue:(p:FormalCommand)=>void;busy:boolean;preference:QuickPreference;onPreference:(p:QuickPreference)=>void}){
 const [open,setOpen]=useState(false),[dragging,setDragging]=useState(false),surface=useFloatingSurface();
 const drag=useRef<{id:number;x:number;y:number;px:number;py:number;moved:boolean;next:QuickPreference}|undefined>(undefined),suppressClick=useRef(false);
 useEffect(()=>{if(!preference.visible)setOpen(false);},[preference.visible]);
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){e.preventDefault();e.stopPropagation();setOpen(false);}};document.addEventListener('keydown',close,true);return()=>document.removeEventListener('keydown',close,true);},[open,busy]);
 if(!preference.visible)return null;
 const edge=preference.edge,position={left:preference.x+(edge==='right'?22:0),top:preference.y+(edge==='bottom'?22:0)};
 return createPortal(<><button className="quick-settings-gear" data-edge={edge} data-dragging={dragging||undefined} aria-label={edge?'展開快速設定':'懸浮快速設定'} title={edge?'點擊展開快速設定':'快速設定（可拖曳）'} aria-expanded={open} style={position}
 onPointerDown={e=>{if(e.button!==0||drag.current)return;suppressClick.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,px:preference.x,py:preference.y,moved:false,next:preference};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>6)d.moved=true;if(d.moved){suppressClick.current=true;setDragging(true);d.next=clampGear({...preference,edge:undefined,x:d.px+e.clientX-d.x,y:d.py+e.clientY-d.y},innerWidth,innerHeight);onPreference(d.next);}}}
 onPointerUp={e=>{const d=drag.current;if(d?.id!==e.pointerId)return;suppressClick.current=d.moved;drag.current=undefined;setDragging(false);if(d.moved)onPreference(dockGear(d.next,innerWidth,innerHeight));e.currentTarget.releasePointerCapture(e.pointerId);}}
 onPointerCancel={()=>{suppressClick.current=true;drag.current=undefined;setDragging(false);}}
 onLostPointerCapture={()=>{drag.current=undefined;setDragging(false);}}
 onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')suppressClick.current=false;}}
 onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}if(edge){onPreference({...preference,edge:undefined});return;}setOpen(v=>!v);}}><GearIcon/></button>
 {open&&<div className="quick-settings-backdrop" onClick={()=>{if(!busy)setOpen(false);}}><div className="quick-settings-panel" role="dialog" aria-modal="true" aria-label="快速戰役設定" onClick={e=>e.stopPropagation()}><CampaignSettings world={world} cityId={cityId} issue={issue} busy={busy} onClose={()=>setOpen(false)}/></div></div>}</>,surface);
}
export function useQuickPreference(){
 const [preference,setPreference]=useState(readQuickPreference);
 useEffect(()=>{try{localStorage.setItem(QUICK_SETTINGS_KEY,JSON.stringify(preference));}catch{/* Device-only preference; no effect on durable campaign settings. */}},[preference]);
 useEffect(()=>{const resize=()=>setPreference(p=>clampGear(p,innerWidth,innerHeight));addEventListener('resize',resize);return()=>removeEventListener('resize',resize);},[]);
 return [preference,setPreference] as const;
}
