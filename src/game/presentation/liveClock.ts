import {effectiveSpeed} from '../formal/playtest';
import {useMemo,useSyncExternalStore} from 'react';
import type {FormalCity,FormalWorld} from '../formal/model';
import {settleCity} from '../formal/economy';

export type ClockAnchor={campaignId?:string;time:number;speed:number;running:boolean};
/** Display only. Never submitted to reducers or persisted as authority. */
export class DisplayClock {
 private anchor:ClockAnchor={time:0,speed:1,running:false};
 private realAt=0;
 private sampled=0;
 private listeners=new Set<()=>void>();
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private now=()=>performance.now()){}
 adopt(anchor:ClockAnchor){this.anchor=anchor;this.realAt=this.now();this.sampled=anchor.time;this.emit();}
 time(campaignId:string,fallback:number){return this.anchor.campaignId===campaignId?Math.max(fallback,this.sampled):fallback;}
 projectTime(campaignId:string,fallback:number){return this.anchor.campaignId===campaignId?Math.max(fallback,this.anchor.time+(this.anchor.running?Math.floor(Math.max(0,this.now()-this.realAt)*this.anchor.speed):0)):fallback;}
 sample=()=>{this.sampled=this.anchor.time+(this.anchor.running?Math.floor(Math.max(0,this.now()-this.realAt)*this.anchor.speed):0);this.emit();};
 private emit(){for(const f of this.listeners)f();}
 subscribe=(f:()=>void)=>{this.listeners.add(f);if(!this.timer)this.timer=setInterval(this.sample,250);return()=>{this.listeners.delete(f);if(!this.listeners.size){clearInterval(this.timer);this.timer=undefined;}};};
 stop(){this.sample();this.anchor={...this.anchor,time:this.sampled,running:false};this.realAt=this.now();}
}
export const displayClock=new DisplayClock();
const inactiveSubscribe=()=>()=>{};
export function useDisplayTime(world:FormalWorld,precision=1,enabled=true){return useSyncExternalStore(enabled?displayClock.subscribe:inactiveSubscribe,()=>enabled?Math.max(world.time,Math.floor(displayClock.time(world.campaignId,world.time)/(precision*effectiveSpeed(world)))*precision*effectiveSpeed(world)):world.time,()=>world.time);}
/** Open forms update affordability once a second without changing authority. */
export function useLiveCity(world:FormalWorld,city:FormalCity|undefined,enabled=true){
 const time=economyDisplayTime(world,useDisplayTime(world,1000,enabled));
 return useMemo(()=>{if(!city||!enabled)return city;const copy=structuredClone(city);settleCity(world,copy,Math.max(city.economy?.lastSettledAt??world.time,time));return copy;},[world,city,time,enabled]);
}
/** Prevent projecting old rates past an uncommitted event boundary. */
export function economyDisplayTime(world:FormalWorld,time:number){return Math.max(world.time,Math.min(time,...world.events.map(e=>e.at)));}
