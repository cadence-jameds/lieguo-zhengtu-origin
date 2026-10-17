import { useEffect, useRef, useState } from 'react';

export function MobileNavigation<T extends string>({view,items,onNavigate,moreOpen,onMore,unread,alerts=unread,update}:{view:T;items:{id:T;icon:string;name:string}[];onNavigate:(id:T)=>void;moreOpen:boolean;onMore:()=>void;unread:number;alerts?:number;update:boolean}){
  const list=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({left:false,right:false});
  useEffect(()=>{
    const el=list.current!;const measure=()=>setEdges({left:el.scrollLeft>2,right:el.scrollLeft+el.clientWidth<el.scrollWidth-2});
    el.addEventListener('scroll',measure,{passive:true});const observer=new ResizeObserver(measure);observer.observe(el);measure();
    return()=>{observer.disconnect();el.removeEventListener('scroll',measure);};
  },[]);
  useEffect(()=>{
    const el=list.current!,active=el.querySelector<HTMLElement>('[aria-current="page"]');if(!active)return;
    const left=active.offsetLeft,right=left+active.offsetWidth;
    if(left<el.scrollLeft)el.scrollLeft=left;else if(right>el.scrollLeft+el.clientWidth)el.scrollLeft=right-el.clientWidth;
  },[view,moreOpen]);
  const scroll=(direction:number)=>{const el=list.current!;el.scrollBy({left:direction*el.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <nav className="mobile-nav mobile-nav-v8" aria-label="手機主要功能">
    <button className="nav-arrow nav-arrow-left" hidden={!edges.left} aria-label="顯示左側功能" onClick={()=>scroll(-1)}>‹</button>
    <div ref={list} className="mobile-nav-track" aria-label="可左右滑動的主要功能">{items.map(n=><button key={n.id} className={(view===n.id?'active ':'')+(n.id==='reports'&&alerts?'has-unread':'')} aria-current={view===n.id?'page':undefined} onClick={()=>onNavigate(n.id)}><span aria-hidden="true">{n.icon}</span>{n.id==='reports'&&unread>0&&<small className="nav-unread-count">{unread}</small>}<strong>{n.name}</strong></button>)}
    <button className={'nav-more '+(moreOpen||['settings','tasks'].includes(view)?'active':'')} aria-current={['settings','tasks'].includes(view)?'page':undefined} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onMore}><span aria-hidden="true">☰</span><strong>更多{update?' •':''}</strong></button></div>
    <button className="nav-arrow nav-arrow-right" hidden={!edges.right} aria-label="顯示右側功能" onClick={()=>scroll(1)}>›</button>
  </nav>;
}
