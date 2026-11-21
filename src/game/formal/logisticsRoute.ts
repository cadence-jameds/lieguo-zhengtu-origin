import type {WorldRead} from '../presentationModel';
import {route} from './routing';

type Point={x:number;y:number};
type Route=ReturnType<typeof route>;
const MAX_ROUTES=128,MAX_POINTS=16384;
let active:{width:number;height:number;terrain:string|undefined;routes:Map<string,Route>;points:number}|undefined;
function copy(r:Route):Route{return{distance:r.distance,path:r.path.map(p=>({...p}))};}

/**
 * Recurring shipments reuse the same directed route on unchanged terrain.
 * Ownership, authorization, vehicle allocation and duration still get checked
 * on each dispatch. Keep one bounded terrain cache and never expose its points
 * to mutable shipments, drafts, renderer or save data.
 */
export function logisticsRoute(w:WorldRead,from:Point,to:Point):Route {
 const {width,height}=w.dimensions,terrain=w.worldLayer?.terrain;
 if(!active||active.width!==width||active.height!==height||active.terrain!==terrain)active={width,height,terrain,routes:new Map(),points:0};
 const cache=active,key=`${from.x},${from.y}>${to.x},${to.y}`,hit=cache.routes.get(key);
 if(hit){cache.routes.delete(key);cache.routes.set(key,hit);return copy(hit);}
 const result=route(w,from,to);
 if(result.path.length<=MAX_POINTS){
  while(cache.routes.size>=MAX_ROUTES||cache.points+result.path.length>MAX_POINTS){
   const oldest=cache.routes.keys().next().value!;
   cache.points-=cache.routes.get(oldest)!.path.length;cache.routes.delete(oldest);
  }
  cache.routes.set(key,copy(result));cache.points+=result.path.length;
 }
 return result;
}
