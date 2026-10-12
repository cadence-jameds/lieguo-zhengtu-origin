import type {FormalCity,FormalWorld,Resources} from '../formal/model';
import {settleCity} from '../formal/economy';
import {economyDisplayTime,useDisplayTime} from './liveClock';
import {clock,fmt,realTime} from './UI';

export function Countdown({at,world}:{at:number;world:FormalWorld}){
 const time=useDisplayTime(world);
 return <span>{time>=at&&world.time<at?'完成確認中':realTime(at-time,world)}</span>;
}
export function WorldClock({world}:{world:FormalWorld}){return <>{clock(useDisplayTime(world))}</>;}
export function LiveProgress({world,start,duration,label,className='meter'}:{world:FormalWorld;start:number;duration:number;label:string;className?:string}){
 const time=useDisplayTime(world),p=Math.max(0,Math.min(100,100*(time-start)/duration));
 return <span className={className} style={{display:'block'}} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} title={label+' '+p.toFixed(0)+'%'}><span style={{width:p+'%'}}/></span>;
}
export function CityValue({world,city,resource,population=false}:{world:FormalWorld;city:FormalCity;resource?:keyof Resources;population?:boolean}){
 const time=economyDisplayTime(world,useDisplayTime(world)),copy=structuredClone(city);
 settleCity(world,copy,time);
 return <>{population?fmt(copy.population)+' / '+fmt(copy.housing):copy.developerResources?'∞':fmt(copy.stock[resource!])}</>;
}
