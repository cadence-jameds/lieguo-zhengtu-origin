import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {WorldRead} from '../presentationModel';
import {effectiveSpeed} from '../formal/playtest';
import {useDisplayTime} from './liveClock';
import {clock} from './UI';
import {shieldPlacement,type ShieldBox} from './protectionPlacement';
const countdown=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export function ProtectionStatus({world,view='city',cityId='',surfaceRef}:{world:WorldRead;view?:string;cityId?:string;surfaceRef?:RefObject<HTMLElement|null>}){
 const scope=view+':'+cityId+':'+world.campaignId,[openFor,setOpenFor]=useState<string>(),open=openFor===scope,setOpen=(value:boolean)=>setOpenFor(value?scope:undefined),[host,setHost]=useState<HTMLElement|null>(null),[floating,setFloating]=useState<{left:number;top:number;anchor:string}>(),lastScene=useRef(''),root=useRef<HTMLElement>(null),button=useRef<HTMLButtonElement>(null),details=useRef<HTMLElement>(null),[position,setPosition]=useState({left:12,top:12,maxHeight:300});
 const f=world.factions.find(f=>f.id===world.playerFactionId),time=useDisplayTime(world,1000),left=Math.max(0,(f?.protectionUntil??0)-time),label=f?.protectionKind==='rebirth'?'復國':'新手',real=left/effectiveSpeed(world);
 useLayoutEffect(()=>{setHost(document.body);},[]);
 useLayoutEffect(()=>{
  if(!host||left<=0)return;
  const surface=surfaceRef?.current,shell=surface?.closest('.formal-shell'),viewport=window.visualViewport;let frame=0,scene:Element|null=null;
  const box=(el:Element|undefined|null)=>el?.getBoundingClientRect();
  const layout=()=>{
   frame=0;const edge=8,w=button.current?.offsetWidth||84,h=28,main=box(surface),header=box(shell?.querySelector('.topbar')),nav=box(shell?.querySelector('.mobile-nav')),footer=box(shell?.querySelector('.statusbar'));
   const bounds:ShieldBox={left:Math.max(edge,viewport?.offsetLeft??0,main?.left??0)+edge,top:Math.max(edge,viewport?.offsetTop??0,header?.bottom??0,main?.top??0)+edge,right:Math.min((viewport?.offsetLeft??0)+(viewport?.width??window.innerWidth),main?.right??window.innerWidth)-edge,bottom:Math.min((viewport?.offsetTop??0)+(viewport?.height??window.innerHeight),nav?.top??footer?.top??window.innerHeight,main?.bottom??window.innerHeight)-edge};
   const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>bounds.top&&r.top<bounds.bottom&&r.right>bounds.left&&r.left<bounds.right;};
   const local=[...(surface?.querySelectorAll('button,a,input,select,textarea,summary,[role=button],.context-strip>span')??[])].filter(visible),floats=[...document.querySelectorAll('.quick-settings-gear,.toast,.update-alert,.map-float-panel,.map-tools,.map-help,.formal-map-scale')].filter(visible),controls=[...local,...floats].map(el=>el.getBoundingClientRect());
   scene=surface?.querySelector('.city-scene-viewport')??null;const sceneBox=box(scene),district=scene?.getAttribute('data-protection-scene')??'',sceneKey=view+':'+cityId+':'+district;
   if(lastScene.current&&lastScene.current!==sceneKey)setOpenFor(undefined);lastScene.current=sceneKey;
   let point,anchor=view;
   if(view==='city'&&sceneBox&&sceneBox.width>0){
    anchor=district;const preferred={left:sceneBox.left+sceneBox.width*.4-w/2,top:sceneBox.top+sceneBox.height*.08-h/2};
    // Resource sprites have transparent hit boxes. Preserve the requested mountain
    // anchor; only other floating controls can displace it, never horizontal artwork scroll.
    const inScene=preferred.top>=bounds.top&&preferred.top+h<=bounds.bottom;
    const blockers=district==='outskirts'&&inScene?floats.map(el=>el.getBoundingClientRect()):controls;
    if(!inScene)anchor='city';
    point=shieldPlacement(bounds,w,h,inScene?[preferred]:[{left:bounds.right-w,top:bounds.bottom-h}],blockers);
   }else if(view==='map'){
    const strip=box(surface?.querySelector('.context-strip'));
    if(strip&&strip.height>=h)point=shieldPlacement({left:strip.left+edge,right:strip.right-edge,top:strip.top+(strip.height-h)/2,bottom:strip.top+(strip.height+h)/2},w,h,[{left:strip.right-w-edge,top:strip.top+(strip.height-h)/2}],controls);
    else point=shieldPlacement(bounds,w,h,[{left:bounds.left,top:bounds.top}],controls);
   }else point=shieldPlacement(bounds,w,h,[{left:bounds.right-w,top:bounds.bottom-h},{left:bounds.right-w,top:bounds.top}],controls);
   setFloating(previous=>previous?.left===point.left&&previous.top===point.top&&previous.anchor===anchor?previous:{...point,anchor});
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};
  layout();const resize=new ResizeObserver(schedule);for(const el of [surface,scene,shell?.querySelector('.topbar'),shell?.querySelector('.mobile-nav')])if(el)resize.observe(el);
  const mutations=new MutationObserver(schedule);if(surface)mutations.observe(surface,{childList:true,subtree:true,attributes:true,attributeFilter:['data-protection-scene','aria-expanded','open']});
  const drag=(e:PointerEvent)=>{if(e.buttons)schedule();};
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);document.addEventListener('pointermove',drag);document.addEventListener('pointerup',schedule);viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);document.removeEventListener('pointermove',drag);document.removeEventListener('pointerup',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);};
 },[host,view,cityId,surfaceRef,left>0]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!details.current?.contains(e.target as Node))setOpen(false);},escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 useEffect(()=>{if(left<=0)setOpen(false);},[left]);
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{
   const anchor=button.current?.getBoundingClientRect();if(!anchor)return;
   const edge=12,width=Math.min(350,window.innerWidth-edge*2),nav=document.querySelector('.mobile-nav')?.getBoundingClientRect(),bottom=Math.min(window.innerHeight-edge,nav?.top??Infinity),height=Math.min(360,(details.current?.scrollHeight??298)+2);
   const topEdge=Math.max(edge,(document.querySelector('.topbar')?.getBoundingClientRect().bottom??0)+8);
   if(anchor.bottom<topEdge||anchor.top>bottom){setOpen(false);return;}
   const below=bottom-anchor.bottom-8,above=anchor.top-topEdge-8,useBelow=below>=Math.min(height,360)||below>=above,maxHeight=Math.max(60,Math.min(360,useBelow?below:above));
   const top=Math.max(topEdge,useBelow?anchor.bottom+8:anchor.top-8-Math.min(height,maxHeight));
   setPosition({left:Math.max(edge,Math.min(anchor.left,window.innerWidth-edge-width)),top,maxHeight});
  };
  place();const observer=new ResizeObserver(place);if(details.current)observer.observe(details.current);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open,floating?.left,floating?.top]);
 if(left<=0)return null;
 const shield=<aside ref={root} data-protection-view={view} data-protection-anchor={floating?.anchor} style={{left:floating?.left??0,top:floating?.top??0,visibility:host&&!floating?'hidden':undefined}} className="formal-protection-status" aria-label="勢力保護狀態"><button ref={button} className="protection-shield" aria-label={label+'保護 '+countdown(real)} aria-expanded={open} aria-controls="protection-details" onClick={()=>setOpen(!open)}>🛡️ <time>{countdown(real)}</time></button>{open&&createPortal(<section ref={details} style={position} className="protection-details card" id="protection-details" aria-label="保護詳情"><div><strong>{label}保護</strong><button aria-label="關閉保護詳情" onClick={()=>{setOpen(false);button.current?.focus();}}>×</button></div><p>剩餘世界時間：{clock(left)}</p><p>剩餘現實時間：{countdown(real)}</p><p>保護持續 48 世界小時；期間敵方無法偵察或攻擊你的城市。</p><p>主動宣戰、偵察、掠奪或征服其他領主城市，以及破壞敵方奇觀，會提前解除保護。解除後撤軍或重新載入不會恢復。</p>{(world.developer?.shieldUntil??0)>time&&<small>開發者保護罩另行計算。</small>}</section>,document.body)}</aside>;
 return host?createPortal(shield,host):shield;
}
