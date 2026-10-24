import {useEffect,useRef,useState} from 'react';
import {aggregateReminders,NavigationBadge,type NavigationReminders} from './NavigationReminder';

function revealActive(el:HTMLDivElement){
  const active=el.querySelector<HTMLElement>('[aria-current="page"]');if(!active)return;
  const style=getComputedStyle(el),start=parseFloat(style.scrollPaddingLeft)||0,end=parseFloat(style.scrollPaddingRight)||0;
  const left=active.offsetLeft,right=left+active.offsetWidth;
  if(left<el.scrollLeft+start)el.scrollLeft=left-start;else if(right>el.scrollLeft+el.clientWidth-end)el.scrollLeft=right-el.clientWidth+end;
}

export function MobileNavigation<T extends string>({view,items,onNavigate,moreOpen,onMore,unread,alerts=unread,update,reminders,moreActive,hiddenIds=[]}:{view:T;items:{id:T;icon:string;name:string}[];onNavigate:(id:T)=>void;moreOpen:boolean;onMore:()=>void;unread:number;alerts?:number;update:boolean;reminders?:NavigationReminders<T>;moreActive?:boolean;hiddenIds?:T[]}){
  const list=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({left:false,right:false});
  const itemKey=items.map(n=>n.id).join(',');
  const statuses=reminders??({reports:{count:unread,attention:alerts>0}} as NavigationReminders<T>);
  const moreReminder=aggregateReminders(hiddenIds.map(id=>statuses[id]??{}));
  useEffect(()=>{
    const el=list.current!;const measure=()=>setEdges({left:el.scrollLeft>2,right:el.scrollLeft+el.clientWidth<el.scrollWidth-2});
    el.addEventListener('scroll',measure,{passive:true});const observer=new ResizeObserver(()=>{revealActive(el);measure();});observer.observe(el);measure();
    return()=>{observer.disconnect();el.removeEventListener('scroll',measure);};
  },[itemKey]);
  useEffect(()=>{revealActive(list.current!);},[view,moreOpen,itemKey]);
  const scroll=(direction:number)=>{const el=list.current!;el.scrollBy({left:direction*el.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  const activeMore=moreActive??!items.some(n=>n.id===view);
  return <nav className="mobile-nav mobile-nav-v8 mobile-nav-custom" aria-label="手機主要功能">
    <div className="mobile-nav-scroll">
      <button className="nav-arrow nav-arrow-left" hidden={!edges.left} aria-label="顯示左側功能" onClick={()=>scroll(-1)}>‹</button>
      <div ref={list} className="mobile-nav-track" aria-label="可左右滑動的主要功能">{items.map(n=><button key={n.id} data-nav-id={n.id} className={(view===n.id?'active ':'')+(statuses[n.id]?.attention?'has-unread':'')} aria-current={view===n.id?'page':undefined} onClick={()=>onNavigate(n.id)}><span aria-hidden="true">{n.icon}</span><NavigationBadge reminder={statuses[n.id]} label={n.name}/><strong>{n.name}</strong></button>)}</div>
      <button className="nav-arrow nav-arrow-right" hidden={!edges.right} aria-label="顯示右側功能" onClick={()=>scroll(1)}>›</button>
    </div>
    <button className={'nav-more '+(moreOpen||activeMore?'active ':'')+(moreReminder.attention?'has-unread':'')} aria-current={activeMore?'page':undefined} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onMore}><span aria-hidden="true">☰</span><NavigationBadge reminder={moreReminder} label="更多功能"/><strong>更多{update?' •':''}</strong></button>
  </nav>;
}
