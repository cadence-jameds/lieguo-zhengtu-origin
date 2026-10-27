import type {FormalCity,FormalWorld,Resources} from './model';
import {resourceKeys} from './model';
import {buildingLevel} from './catalogB3';
export type LogisticsPurpose='manual'|'general-auto'|'wonder-auto';
export type LogisticsSettings={reserve:Resources;manualCaravans:number;wonder?:{projectId:import('./ids').ProjectId;maxCaravans:number;enabled:boolean}};
/** Legacy per-route reserves become one conservative city floor without rewriting saves. */
export function logisticsReserve(c:FormalCity):Resources{return c.logisticsSettings?.reserve??Object.fromEntries(resourceKeys.map(r=>[r,Math.max(0,...(c.autoLogistics??[]).map(a=>a.reserve[r]))])) as Resources;}
export function logisticsAllocation(c:FormalCity){const total=Math.min(15,buildingLevel(c,'market')),general=(c.autoLogistics??[]).reduce((n,a)=>n+a.maxCaravans,0),wonder=c.logisticsSettings?.wonder?.maxCaravans??0,manual=c.logisticsSettings?.manualCaravans??Math.max(0,total-general-wonder);return{total,general,wonder,manual,allocated:general+wonder+manual};}
export function logisticsAvailable(w:FormalWorld,c:FormalCity,purpose:LogisticsPurpose='manual',destination?:string){
 const a=logisticsAllocation(c),trips=(w.logistics??[]).filter(t=>t.sourceCityId===c.id),busy=trips.reduce((n,t)=>n+t.caravans,0);
 const purposeUsed=trips.filter(t=>(t.purpose??'manual')===purpose).reduce((n,t)=>n+t.caravans,0);
 const used=trips.filter(t=>(t.purpose??'manual')===purpose&&(purpose!=='general-auto'||t.destinationCityId===destination)).reduce((n,t)=>n+t.caravans,0);
 const quota=purpose==='general-auto'?(c.autoLogistics??[]).find(r=>r.destinationCityId===destination)?.maxCaravans??0:purpose==='wonder-auto'?a.wonder:a.manual;
 return a.allocated>a.total?0:Math.max(0,Math.min(quota-used,a.total-busy,purpose==='general-auto'?a.general-purposeUsed:Infinity));
}
export const defaultLogisticsSettings=(c:FormalCity):LogisticsSettings=>({reserve:{...logisticsReserve(c)},manualCaravans:logisticsAllocation(c).manual,...(c.logisticsSettings?.wonder?{wonder:structuredClone(c.logisticsSettings.wonder)}:{})});
