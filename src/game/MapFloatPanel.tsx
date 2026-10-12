import {useEffect,useId,useLayoutEffect,useRef,useState,type PointerEvent,type ReactNode} from 'react';

type Position={left:number;top:number};
type Drag={id:number;pointerX:number;pointerY:number;left:number;top:number};

/** A map tool window that can be moved without blocking the map beneath it. */
export function MapFloatPanel({title,storageKey,onClose,children}:{title:string;storageKey:'xy'|'favorites'|'selection'|'worldtools'|'empire';onClose:()=>void;children:ReactNode}){
  const key='guozhan-map-panel-'+storageKey;
  const ref=useRef<HTMLElement>(null),drag=useRef<Drag|null>(null),lastPosition=useRef<Position|null>(null),[position,setPosition]=useState<Position|null>(()=>{
    try{const saved=JSON.parse(localStorage.getItem(key)??'null');return saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)?{left:saved.left,top:saved.top}:null;}catch{return null;}
  }),id=useId();
  const clamp=(next:Position):Position=>{
    const panel=ref.current,parent=panel?.parentElement;
    if(!panel||!parent)return next;
    return {left:Math.max(0,Math.min(parent.clientWidth-panel.offsetWidth,next.left)),top:Math.max(0,Math.min(parent.clientHeight-panel.offsetHeight,next.top))};
  };
  const place=(next:Position)=>{const bounded=clamp(next);lastPosition.current=bounded;setPosition(bounded);};
  const save=()=>{if(lastPosition.current)try{localStorage.setItem(key,JSON.stringify(lastPosition.current));}catch{/* The window remains draggable if storage is unavailable. */}};
  useLayoutEffect(()=>{setPosition(previous=>previous?clamp(previous):null);},[]);
  useEffect(()=>{
    const panel=ref.current,parent=panel?.parentElement;
    if(!panel||!parent)return;
    const observer=new ResizeObserver(()=>setPosition(previous=>previous?clamp(previous):null));
    observer.observe(parent);observer.observe(panel);
    return()=>observer.disconnect();
  },[]);
  const begin=(event:PointerEvent<HTMLDivElement>)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    if((event.target as HTMLElement).closest('button'))return;
    const panel=ref.current!,parent=panel.parentElement!,rect=panel.getBoundingClientRect(),boundary=parent.getBoundingClientRect();
    drag.current={id:event.pointerId,pointerX:event.clientX,pointerY:event.clientY,left:rect.left-boundary.left,top:rect.top-boundary.top};
    place({left:drag.current.left,top:drag.current.top});
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    place({left:current.left+event.clientX-current.pointerX,top:current.top+event.clientY-current.pointerY});
  };
  const finish=(event:PointerEvent<HTMLDivElement>)=>{
    if(drag.current?.id===event.pointerId){drag.current=null;save();}
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <section className={'map-float-panel map-float-'+storageKey+'-panel'} ref={ref} role="dialog" aria-modal="false" aria-labelledby={id} style={position?{left:position.left,top:position.top,right:'auto',transform:'none'}:undefined}>
    <div className="map-float-header" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      <h2 id={id} tabIndex={0} aria-label={`${title}，拖曳標題列移動，或用方向鍵移動`} onKeyDown={event=>{const delta=event.key==='ArrowLeft'?{left:-16,top:0}:event.key==='ArrowRight'?{left:16,top:0}:event.key==='ArrowUp'?{left:0,top:-16}:event.key==='ArrowDown'?{left:0,top:16}:null;if(!delta)return;event.preventDefault();const panel=ref.current!,rect=panel.getBoundingClientRect(),boundary=panel.parentElement!.getBoundingClientRect();place({left:rect.left-boundary.left+delta.left,top:rect.top-boundary.top+delta.top});save();}}>{title}</h2>
      <span className="map-float-drag-hint" aria-hidden="true">✥ 拖曳移動</span>
      <button type="button" onClick={onClose} aria-label={`關閉${title}`}>×</button>
    </div>
    <div className="map-float-body">{children}</div>
  </section>;
}
