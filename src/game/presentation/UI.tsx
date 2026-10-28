import {effectiveSpeed} from '../formal/playtest';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import type {FormalCity,FormalWorld,Resources} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {productionPerHour,offeringPerHour} from '../formal/economy';
import {armyUpkeep} from '../formal/military';
import {assetURL,civilizationIndex,CIV_NAMES,LABELS} from './artMap';

export const fmt=(n:number)=>Math.floor(n).toLocaleString('zh-TW');
export const clock=(ms:number)=>`${Math.floor(ms/3600000)}時 ${String(Math.floor(ms%3600000/60000)).padStart(2,'0')}分`;
export function realTime(ms:number,w:FormalWorld){const seconds=Math.max(0,Math.ceil(ms/effectiveSpeed(w)/1000));return seconds>=3600?Math.floor(seconds/3600)+'時 '+Math.floor(seconds%3600/60)+'分':seconds>=60?Math.floor(seconds/60)+'分 '+seconds%60+'秒':seconds+'秒';}
export const remaining=(at:number,w:FormalWorld)=>realTime(Math.max(0,at-w.time),w);
export function FormalEmblem({civ}:{civ:string}){const i=civilizationIndex(civ);return <span role="img" aria-label={CIV_NAMES[civ]+'文明徽記'} className="civilization-emblem" style={{backgroundImage:`url(${assetURL('art/civilization-emblems-023.webp')})`,backgroundPosition:`${i%3*50}% ${Math.floor(i/3)*100}%`}}/>;}
/** DEMO dialog behavior copied without its legacy content imports. */
export function Dialog({title,onClose,children,className,headerAction}:{title:string;onClose:()=>void;children:ReactNode;className?:string;headerAction?:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),id=useId(),backdrop=useRef(false);
 useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
 const outside=(e:{clientX:number;clientY:number})=>{const r=ref.current!.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 return <dialog ref={ref} className={className} aria-labelledby={id} onPointerDown={e=>{backdrop.current=e.target===e.currentTarget&&outside(e);}} onPointerCancel={()=>{backdrop.current=false;}} onClick={e=>{if(backdrop.current&&e.target===e.currentTarget&&outside(e))onClose();backdrop.current=false;}} onCancel={e=>{e.preventDefault();onClose();}}><div className="dialog-title"><h2 id={id}>{title}</h2>{headerAction&&<div className="dialog-header-action">{headerAction}</div>}<button onClick={onClose} aria-label="關閉對話框">×</button></div><div className="dialog-body">{children}</div></dialog>;
}
export function Cost({cost,stock}:{cost:Resources;stock?:Resources}){return <div className="cost">{resourceKeys.map(r=><span key={r} className={stock&&cost[r]>stock[r]?'resource-shortage':''}><i className={'res-'+r}>{LABELS[r]}</i> {fmt(cost[r])}{stock&&cost[r]>stock[r]&&<small>缺 {fmt(cost[r]-stock[r])}</small>}</span>)}</div>;}
export function netProduction(w:FormalWorld,c:FormalCity){const p=productionPerHour(w,c);for(const r of resourceKeys)p[r]*=(c.integrationWorkHours??0)>0?.4:1;p.gold+=offeringPerHour(c);p.food-=armyUpkeep(w,c);return p;}
export function Heading({title,subtitle,children}:{title:string;subtitle?:string;children?:ReactNode}){return <div className="view-heading"><div><p className="eyebrow">{subtitle??'河谷戰役 · 你的旗幟與城邦'}</p><h1>{title}</h1></div>{children}</div>;}
