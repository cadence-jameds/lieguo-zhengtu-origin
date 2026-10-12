import {useEffect,useState} from 'react';
import {clock} from './UI';
export function intelAge(observedRealAt:number|undefined,now:number){return observedRealAt===undefined?'現實觀測時間未記錄':`駐軍情報距今 ${clock(Math.max(0,now-observedRealAt))}`;}
export function useRealNow(){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);return now;}
