import type {FormalWorld} from '../formal/model';
import {buildable,fieldDistribution,terrainAt} from '../formal/terrain';
import {spatial} from '../formal/spatial';
import type {Point} from './mapGeometry';
export type SpecialKind='seven'|'nine'|'fifteen';
export type SpecialPreferences={enabled:boolean;seven:boolean;nine:boolean;fifteen:boolean};
export const SPECIAL_FIELDS_KEY='lieguo-special-fields-v1';
export const DEFAULT_SPECIAL_FIELDS:SpecialPreferences={enabled:false,seven:true,nine:true,fifteen:true};
export const SPECIAL_COLORS={seven:'#62b5ff',nine:'#c394ff',fifteen:'#ffda57'};
export function readSpecialPreferences(storage:Pick<Storage,'getItem'>):SpecialPreferences{try{const v=JSON.parse(storage.getItem(SPECIAL_FIELDS_KEY)??'{}');return {enabled:v.enabled===true,seven:v.seven!==false,nine:v.nine!==false,fifteen:v.fifteen!==false};}catch{return {...DEFAULT_SPECIAL_FIELDS};}}
export function specialClassification(counts:readonly number[]):{kind:SpecialKind;label:string}|undefined{
 const index=counts.findIndex(n=>n===15||n===9);if(index>=0)return {kind:counts[index]===15?'fifteen':'nine',label:counts[index]+['糧','木','石','金'][index]};
 if(counts[0]===7)return {kind:'seven',label:'7糧'};
}
/** Geometry-only LRU. Dynamic occupancy is checked each draw, never cached here. */
export class SpecialFieldCache{
 private seed=-1;private values=new Map<number,ReturnType<typeof specialClassification>>();misses=0;
 get(seed:number,x:number,y:number){if(seed!==this.seed){this.seed=seed;this.values.clear();}const key=y*384+x;if(this.values.has(key)){const v=this.values.get(key);this.values.delete(key);this.values.set(key,v);return v;}this.misses++;const v=specialClassification(fieldDistribution(seed,x,y));this.values.set(key,v);if(this.values.size>8192)this.values.delete(this.values.keys().next().value!);return v;}
 get size(){return this.values.size;}
}
export function specialSettlementTile(world:FormalWorld,x:number,y:number){if(!buildable(terrainAt(world,x,y)))return false;const at=spatial(world).at(x,y);return !at.city&&!at.site&&!at.reservation;}
export function visibleSpecialFields(world:FormalWorld,bounds:{minX:number;maxX:number;minY:number;maxY:number},screen:(p:Point)=>Point,width:number,height:number,preferences:SpecialPreferences,cache:SpecialFieldCache){
 const points:(Point&{kind:SpecialKind;label:string})[]=[],minX=Math.max(0,Math.floor(bounds.minX)),maxX=Math.min(world.dimensions.width-1,Math.ceil(bounds.maxX)),minY=Math.max(0,Math.floor(bounds.minY)),maxY=Math.min(world.dimensions.height-1,Math.ceil(bounds.maxY));
 // Explicit LOD budget: overview does no classification and never scans 147456 tiles.
 const area=Math.max(0,maxX-minX+1)*Math.max(0,maxY-minY+1);if(!preferences.enabled||area>4096)return {points,visited:0,misses:0,lodHidden:preferences.enabled&&area>4096};
 const before=cache.misses;let visited=0;
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const p=screen({x,y});if(p.x<0||p.y<0||p.x>width||p.y>height)continue;visited++;if(!specialSettlementTile(world,x,y))continue;const s=cache.get(world.seed,x,y);if(s&&preferences[s.kind])points.push({x,y,...s});}
 return {points,visited,misses:cache.misses-before,lodHidden:false};
}
