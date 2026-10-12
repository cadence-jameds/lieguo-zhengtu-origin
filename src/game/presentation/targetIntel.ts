import {createContext,useContext,useEffect,useState} from 'react';
import type {FormalWorld} from '../formal/model';
import type {CityIntel} from '../formal/combatModel';
/** The existing single-authority Worker owns all IndexedDB reads. */
export const TargetIntelContext=createContext<(world:FormalWorld,cityId:string,generation?:number)=>Promise<CityIntel>>(async()=>({}));
export function useTargetIntel(world:FormalWorld,cityId?:string,generation?:number){
 const read=useContext(TargetIntelContext),[result,setResult]=useState<{key:string;intel:CityIntel;failed:boolean}>();
 const key=`${world.campaignId}:${world.playerFactionId}:${world.sequences.report}:${cityId??''}:${generation??''}`;
 useEffect(()=>{let cancelled=false;if(cityId)void read(world,cityId,generation).then(intel=>{if(!cancelled)setResult({key,intel,failed:false});}).catch(()=>{if(!cancelled)setResult({key,intel:{},failed:true});});return()=>{cancelled=true;};},[key,read]);
 return {intel:result?.key===key?result.intel:{},failed:result?.key===key&&result.failed};
}
