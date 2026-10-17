import {ResourceSprite} from './ResourceSprite';
import {ConstructionSprite} from './assets';
import {useEffect,useRef,useState} from 'react';
import {MiniatureCity} from './MiniatureCity';
import {ConstructionProgress,constructionProgress} from './TownScene';
import {fieldNames,type FieldBuilding} from './resourceFields';
import {eras} from './content';
import type {Node} from './types';
// Unequal offsets and terrain silhouettes keep the parcels organic, while anchors stay legible.
export const outskirtsLots:readonly (readonly [number,number])[]=[
 [14,27],[34,16],[54,15],[73,20],[88,33],[74,43],[89,57],[74,66],[68,85],[48,86],[30,85],[14,78],
 [23,43],[10,55],[24,65],[40,74],[57,74],[87,78]
];
type Props={n:Node;civ:string;era:number;time:number;speed:number;mobile:boolean;labels:boolean;closeView?:boolean;onToggleView?:()=>void;onEnter:()=>void;onSelect:(id:number)=>void};
export function OutskirtsScene({n,civ,era,time,speed,mobile,labels,closeView,onToggleView,onEnter,onSelect}:Props){
 const [localClose,setLocalClose]=useState(mobile),close=closeView??localClose,viewport=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=viewport.current;if(el)el.scrollLeft=(el.scrollWidth-el.clientWidth)/2;},[close,n.id,mobile]);
 return <section className="outskirts-scene">{mobile&&!onToggleView&&<div className="scene-controls"><button aria-pressed={close} onClick={()=>setLocalClose(v=>!v)}>{close?'查看全景':'放大操作'}</button></div>}<div className="town-viewport" ref={viewport} tabIndex={0} aria-label="城郊資源地，放大後可左右滑動"><div className={'outskirts-composition '+(mobile&&close?'outskirts-close ':'')+(labels?'show-field-names':'')}><img className="outskirts-background" src={import.meta.env.BASE_URL+'art/outskirts-landscape-021.webp'} alt="道路穿過城外草地，資源田地環繞中央聚落" draggable={false}/>{n.plots.filter(p=>p.kind==='resource').map(p=>{const [x,y]=outskirtsLots[p.id-17],b=p.building as FieldBuilding,job=n.build.find(j=>j.plot===p.id),waiting=job?constructionProgress(n,job,time).waiting:false,constructing=!!job&&job.action!=='demolish';return <button key={p.id} className={'resource-parcel parcel-'+b+(constructing?' constructing':'')} style={{left:x+'%',top:y+'%',zIndex:Math.round(y)}} aria-label={'資源地 '+(p.id-16)+'：'+fieldNames[b]+' '+p.level+' 級'+(job?waiting?'，排隊中':job.action==='demolish'?'，拆除中':'，施工中':'')} onClick={()=>onSelect(p.id)}>{constructing?<ConstructionSprite building={b} era={era} targetLevel={(p.level??0)+1}/>:<ResourceSprite building={b} level={p.level??0} era={era}/>}<span className="parcel-label"><span className="parcel-name">{fieldNames[b]}</span><b>{p.level??0}</b></span>{job&&<ConstructionProgress n={n} job={job} time={time} speed={speed}/>}</button>;})}<button className="outskirts-center" onClick={onEnter} aria-label={eras[era]+'的'+n.name+'，進入城內建設'}><MiniatureCity civ={civ} era={era} wall={n.buildings.wall}/></button></div></div></section>;
}
