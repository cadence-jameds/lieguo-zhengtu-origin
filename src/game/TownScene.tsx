import {useEffect,useRef,useState} from 'react';
import {BuildingSprite,ConstructionSprite,constructionWallSceneArt,finishedWallSceneArt} from './assets';
import {plotLevel} from './city';
import {buildings} from './content';
import {duration} from './ui';
import {buildDuration} from './legacyEngine';
import {MINUTE,type Job,type Building,type Node} from './legacyTypes';
// Percent coordinates on a single 1536 × 1024 composition; anchors are building feet.
export const townLots:readonly (readonly [number,number])[]=[
 [50.5,50],[17,29],[33,29],[67,27],[84,29],
 [15,44],[35,43],[64,43],[78,43],[88,45],
 [14,65],[35,62],[72,61],[89,64],[25,73],[68,76],
];
export const townSceneArt=(wall:number,era:number,constructing=false)=>constructing?constructionWallSceneArt(era):wall>0?finishedWallSceneArt(era):era===0?'art/city-scene-dark-open.webp':era===1?'art/city-scene-feudal-open.webp':'art/city-scene-open.webp';
type Props={n:Node;civ:string;era:number;speed:number;time:number;mobile:boolean;labels:boolean;closeView?:boolean;onToggleView?:()=>void;onSelect:(id:number)=>void};
export function TownScene({n,civ,era,speed,time,mobile,labels,closeView,onToggleView,onSelect}:Props){
 const [localClose,setLocalClose]=useState(true),close=closeView??localClose,viewport=useRef<HTMLDivElement>(null);
 const wallJob=n.build.find(j=>j.item==='wall'&&j.action!=='demolish');
 useEffect(()=>{const el=viewport.current;if(el)el.scrollLeft=(el.scrollWidth-el.clientWidth)/2;},[mobile,close,n.id]);
 return <section className="town-scene">{mobile&&!onToggleView&&<div className="scene-controls"><button aria-pressed={close} onClick={()=>setLocalClose(v=>!v)}>{close?'查看全景':'放大操作'}</button></div>}<div className="town-viewport" ref={viewport} tabIndex={0} aria-label="城鎮場景，可橫向捲動"><div className={'town-composition '+(mobile&&close?'town-close ':'')+(!labels?'quiet-town-labels':'')}>
 <img className="town-background" src={import.meta.env.BASE_URL+townSceneArt(n.buildings.wall,era,!!wallJob)} alt={wallJob?['木牆','石牆','垛牆'][era]+'沿整條城市邊界施工中':n.buildings.wall?'城牆與城門沿遠方城市邊界延伸，主路通往中央廣場':'城外田野與入城道路連接中央廣場，尚未修築城防'} draggable={false}/>
 <button className="town-gate" aria-label={'城門與城防，'+(n.buildings.wall?'城牆 '+n.buildings.wall+' 級':'尚未修築')} onClick={()=>onSelect(16)}><span><span className="town-name">{n.buildings.wall?'城門 · ':'修築城防'}</span>{n.buildings.wall>0&&n.buildings.wall}</span>{n.build.find(j=>j.item==='wall')&&<ConstructionProgress n={n} job={n.build.find(j=>j.item==='wall')!} time={time} speed={speed}/>}</button>
 {n.plots.filter(p=>p.kind!=='wall'&&p.kind!=='resource').map(p=>{const [x,y]=townLots[p.id],job=n.build.find(j=>j.plot===p.id),building=p.building??(job?.action!=='demolish'?job?.item as Building:undefined),level=building?plotLevel(n,building,p.id):0,waiting=job?constructionProgress(n,job,time).waiting:false,constructing=!!job&&job.action!=='demolish';return <button key={p.id} className={'town-lot '+(p.building||constructing?'built':'vacant')+(p.id===0?' town-center':'')+(building?' building-'+building:'')+(constructing?' constructing':'')} style={{left:x+'%',top:y+'%',zIndex:Math.round(y)}} aria-label={'地塊 '+(p.id+1)+'：'+(building?(level?buildings[building].name+' '+level+' 級':'空地，預定建造'+buildings[building].name):'空地')+(job?waiting?'，排隊中':job.action==='demolish'?'，拆除中':'，施工中':'')} onClick={()=>onSelect(p.id)}>{constructing?<ConstructionSprite building={building!} civ={civ} era={era} targetLevel={level+1}/>:p.building?<BuildingSprite building={p.building} civ={civ} era={era}/>:<span className="town-empty">＋</span>}<span className="town-label"><span className="town-name">{building?buildings[building].name:'空地 '+(p.id+1)}</span>{level>0&&<b>{level}</b>}</span>{job&&<ConstructionProgress n={n} job={job} time={time} speed={speed}/>}</button>;})}
 </div></div></section>;
}

export function constructionProgress(n:Node,job:Job,time:number){
 const start=job.started??job.at-(job.action==='demolish'?plotLevel(n,job.item as Building,job.plot)*15*MINUTE:buildDuration(n,job.item as Building,job.plot));
 const waiting=n.build[0]?.id!==job.id||time<start;
 return {waiting,percent:waiting?0:Math.max(0,Math.min(100,(time-start)/Math.max(1,job.at-start)*100))};
}
export function ConstructionProgress({n,job,time,speed}:{n:Node;job:Job;time:number;speed:number}){const {waiting,percent}=constructionProgress(n,job,time);return <span className={'construction-progress'+(waiting?' waiting':'')} title={(waiting?'等待':'剩餘')+' '+duration((job.at-time)/speed)}>{waiting?<small aria-label="等待施工" role="img">⏳</small>:<span className="construction-track" role="progressbar" aria-label={buildings[job.item as Building].name+'施工進度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{width:percent+'%'}}/></span>}</span>;}
