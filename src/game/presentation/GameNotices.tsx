import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import type {SaveStatus} from '../saveStatus';
import {playerMessage} from '../playerMessage';
import {shieldPlacement} from './protectionPlacement';
/** The existing toast surface plus persistent recovery actions; no notification queue. */
export function GameNotices({text,error,onDismiss,saveStatus,onSave,onReload,onBackup,fatal,children}:{text:string;error:boolean;onDismiss:()=>void;saveStatus:SaveStatus;onSave:()=>void;onReload:()=>void;onBackup:()=>void;fatal?:string;children?:ReactNode}){
 const region=useRef<HTMLElement>(null),[host,setHost]=useState<HTMLElement|null>(null),[point,setPoint]=useState({left:8,top:8}),[collapsed,setCollapsed]=useState(false),[recovered,setRecovered]=useState(false);
 const active=saveStatus.state==='retrying'||saveStatus.state==='blocked';
 useEffect(()=>{setCollapsed(false);setRecovered(saveStatus.state==='recovered');if(saveStatus.state!=='recovered')return;const timer=setTimeout(()=>setRecovered(false),2000);return()=>clearTimeout(timer);},[saveStatus.state]);
 useLayoutEffect(()=>{
  let frame=0;const viewport=window.visualViewport;let tracked:Element[]=[];const floatingChanges=new MutationObserver(()=>schedule());
  const layout=()=>{
   frame=0;const dialog=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1),nextHost=dialog??document.body;setHost(old=>old===nextHost?old:nextHost);
   const root=region.current;if(!root)return;const edge=8,header=document.querySelector('.topbar')?.getBoundingClientRect(),nav=document.querySelector('.mobile-nav')?.getBoundingClientRect(),footer=document.querySelector('.statusbar')?.getBoundingClientRect();
   const bounds={left:(viewport?.offsetLeft??0)+edge,right:(viewport?.offsetLeft??0)+(viewport?.width??innerWidth)-edge,top:Math.max((viewport?.offsetTop??0)+edge,header?.bottom??edge)+edge,bottom:Math.min((viewport?.offsetTop??0)+(viewport?.height??innerHeight),nav?.top??footer?.top??innerHeight)-edge};
   const width=Math.min(280,bounds.right-bounds.left);root.style.width=width+'px';
   const floating=[...document.querySelectorAll('.formal-protection-status,.quick-settings-gear,.protection-details')];if(floating.length!==tracked.length||floating.some((el,i)=>el!==tracked[i])){floatingChanges.disconnect();for(const el of floating)floatingChanges.observe(el,{attributes:true,attributeFilter:['style']});tracked=floating;}
   // Keep the entire notice out of floating controls' rows, including its close
   // button. A small scrollable region preserves every independent recovery action.
   let bands=[bounds];for(const b of floating){const r=b.getBoundingClientRect();if(!r.width||!r.height||r.bottom<=bounds.top||r.top>=bounds.bottom)continue;bands=bands.flatMap(a=>[{...a,bottom:Math.min(a.bottom,r.top-6)},{...a,top:Math.max(a.top,r.bottom+6)}]).filter(a=>a.bottom>a.top);}
   const maxHeight=Math.max(0,...bands.map(a=>a.bottom-a.top))||Math.max(28,bounds.bottom-bounds.top);root.style.maxHeight=maxHeight+'px';
   const height=Math.min(root.getBoundingClientRect().height,maxHeight),surface=dialog??document.body;
   const controls=[...surface.querySelectorAll('button,a,input,select,textarea,summary,[role=button],.city-heading,.district-toolbar,.map-tools,.map-float-panel'),...document.querySelectorAll('.formal-protection-status,.quick-settings-gear,.protection-details')].filter(el=>!root.contains(el)).map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.bottom>bounds.top&&r.top<bounds.bottom);
   const fitting=bands.filter(a=>a.bottom-a.top>=height-.5),areas=fitting.length?fitting:[bounds],choices=areas.map(a=>shieldPlacement(a,width,height,[{left:a.right-width,top:a.top},{left:a.right-width,top:a.bottom-height}],controls));
   const impact=(p:{left:number;top:number})=>controls.reduce((n,b)=>{const x=(b.left+b.right)/2,y=(b.top+b.bottom)/2,center=x>=p.left&&x<=p.left+width&&y>=p.top&&y<=p.top+height;return n+(center?1e6:0)+Math.max(0,Math.min(p.left+width,b.right)-Math.max(p.left,b.left))*Math.max(0,Math.min(p.top+height,b.bottom)-Math.max(p.top,b.top));},0);
   const next=choices.reduce((best,p)=>impact(p)<impact(best)?p:best);setPoint(old=>old.left===next.left&&old.top===next.top?old:next);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};layout();const resize=new ResizeObserver(schedule);if(region.current)resize.observe(region.current);const main=document.querySelector('.main-surface');if(main)resize.observe(main);
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-expanded','data-game-view']});
  const drag=(e:PointerEvent)=>{if(e.buttons)schedule();};window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);document.addEventListener('pointermove',drag);document.addEventListener('pointerup',schedule);viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();floatingChanges.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);document.removeEventListener('pointermove',drag);document.removeEventListener('pointerup',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);};
 },[host]);
 const message=saveStatus.state==='blocked'?'目前無法保存進度，請勿關閉遊戲。':'自動存檔暫時失敗，正在重試。';
 const content=<aside ref={region} className="game-notice-region" style={point} aria-label="遊戲通知">
 {active&&<section className="toast save-notice" data-save-state={saveStatus.state} data-code={saveStatus.code} role={saveStatus.state==='blocked'?'alert':'status'} aria-live="polite">{collapsed?<button className="notice-reopen" onClick={()=>setCollapsed(false)}>{saveStatus.state==='blocked'?'保存需要處理':'保存仍在重試'} · 查看</button>:<><span className="notice-text">{message}</span><button className="notice-close" aria-label="收合保存提示" onClick={()=>setCollapsed(true)}/>{saveStatus.state==='blocked'&&<div className="notice-actions"><button onClick={saveStatus.recovery==='reload'?onReload:onSave}>{saveStatus.recovery==='reload'?'重新讀取並恢復':'重試保存'}</button><button onClick={onBackup}>匯出原始備份</button></div>}</>}</section>}
 {recovered&&!active&&<section className="toast save-notice" data-save-state="recovered" role="status"><span className="notice-text">遊戲進度已恢復保存。</span><button className="notice-close" aria-label="關閉保存提示" onClick={()=>setRecovered(false)}/></section>}
 {fatal&&<section className="toast error" role="alert"><span className="notice-text">{playerMessage(fatal,'操作暫時無法完成，原始進度保留。')}</span><div className="notice-actions"><button onClick={onReload}>重新讀取並恢復</button><button onClick={onBackup}>匯出原始備份</button></div></section>}
 {children}
 {text&&!fatal&&!(saveStatus.state!=='healthy'&&text==='進度已保存。')&&<section className={'toast '+(error?'error':'')} role="status" aria-live="polite"><span className="notice-text">{playerMessage(text)}</span><button className="notice-close" aria-label="關閉通知" onClick={onDismiss}/></section>}
 </aside>;
 return host?createPortal(content,host):content;
}
