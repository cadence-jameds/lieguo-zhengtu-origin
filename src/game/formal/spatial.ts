import type {ArmyId,CityId,FactionId,WildSiteId,ProjectId} from './ids';
import type {FormalArmy,FormalCity,FormalWorld,WildSite} from './model';
import {armyPosition} from './armyPosition';
export type Bounds={minX:number;minY:number;maxX:number;maxY:number};
/** Derived, ephemeral maps. No cache, renderer, or index data enters a formal save. */
export class SpatialIndex {
 readonly reservations=new Map<number,ProjectId>();
 readonly cities=new Map<CityId,FormalCity>();readonly sites=new Map<WildSiteId,WildSite>();
 readonly armies=new Map<ArmyId,FormalArmy>();readonly armyCells=new Map<number,Set<ArmyId>>();readonly armyRegions=new Map<number,Set<ArmyId>>();
 readonly cityCells=new Map<number,CityId>();readonly siteCells=new Map<number,WildSiteId>();
 readonly ownership=new Map<FactionId,Set<CityId>>();readonly regions=new Map<number,{cities:Set<CityId>;sites:Set<WildSiteId>}>();
 constructor(readonly width:number,readonly height:number,readonly regionSize=32){
  for(let n=0;n<Math.ceil(width/regionSize)*Math.ceil(height/regionSize);n++)this.regions.set(n,{cities:new Set(),sites:new Set()});
 }
 regionAt(x:number,y:number){return Math.floor(y/this.regionSize)*Math.ceil(this.width/this.regionSize)+Math.floor(x/this.regionSize);}
 addCity(c:FormalCity){const key=c.y*this.width+c.x;if(this.cityCells.has(key)||this.siteCells.has(key))throw new Error('Spatial overlap');this.cities.set(c.id,c);this.cityCells.set(key,c.id);this.regions.get(this.regionAt(c.x,c.y))!.cities.add(c.id);const ids=this.ownership.get(c.ownerFactionId)??new Set<CityId>();ids.add(c.id);this.ownership.set(c.ownerFactionId,ids);}
 addSite(s:WildSite){const key=s.y*this.width+s.x;if(this.cityCells.has(key)||this.siteCells.has(key))throw new Error('Spatial overlap');this.sites.set(s.id,s);this.siteCells.set(key,s.id);this.regions.get(this.regionAt(s.x,s.y))!.sites.add(s.id);}
 addArmy(a:FormalArmy,time:number){const p=armyPosition(a,time);if(!p)return;this.armies.set(a.id,a);const x=Math.floor(p.x),y=Math.floor(p.y),cell=y*this.width+x,region=this.regionAt(x,y);const ids=this.armyCells.get(cell)??new Set<ArmyId>();ids.add(a.id);this.armyCells.set(cell,ids);const r=this.armyRegions.get(region)??new Set<ArmyId>();r.add(a.id);this.armyRegions.set(region,r);}
 queryArmies(b:Bounds,time:number){const result:FormalArmy[]=[];for(const r of this.visibleRegions(b))for(const id of this.armyRegions.get(r)??[]){const a=this.armies.get(id)!,p=armyPosition(a,time)!;if(p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY)result.push(a);}return result;}
 transfer(c:FormalCity,owner:FactionId){this.ownership.get(c.ownerFactionId)?.delete(c.id);c.ownerFactionId=owner;const ids=this.ownership.get(owner)??new Set<CityId>();ids.add(c.id);this.ownership.set(owner,ids);}
 at(x:number,y:number){const key=y*this.width+x;return {city:this.cities.get(this.cityCells.get(key)!),site:this.sites.get(this.siteCells.get(key)!),reservation:this.reservations.get(key)};}
 reserve(x:number,y:number,id:ProjectId){const key=y*this.width+x;if(this.reservations.has(key)||this.cityCells.has(key)||this.siteCells.has(key))throw new Error('Coordinate already occupied');this.reservations.set(key,id);}
 release(x:number,y:number,id:ProjectId){const key=y*this.width+x;if(this.reservations.get(key)!==id)throw new Error('Reservation mismatch');this.reservations.delete(key);}
 owned(owner:FactionId){return [...this.ownership.get(owner)??[]].map(id=>this.cities.get(id)!);}
 visibleRegions(b:Bounds):number[]{const out:number[]=[];for(let y=Math.max(0,Math.floor(b.minY/this.regionSize));y<=Math.min(Math.ceil(this.height/this.regionSize)-1,Math.floor(b.maxY/this.regionSize));y++)for(let x=Math.max(0,Math.floor(b.minX/this.regionSize));x<=Math.min(Math.ceil(this.width/this.regionSize)-1,Math.floor(b.maxX/this.regionSize));x++)out.push(y*Math.ceil(this.width/this.regionSize)+x);return out;}
 query(b:Bounds){const cities:FormalCity[]=[],sites:WildSite[]=[];const inside=(p:{x:number;y:number})=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;
  for(const n of this.visibleRegions(b)){const r=this.regions.get(n)!;for(const id of r.cities){const c=this.cities.get(id)!;if(inside(c))cities.push(c);}for(const id of r.sites){const s=this.sites.get(id)!;if(inside(s))sites.push(s);}}
  return{cities,sites};
 }
 nearby(x:number,y:number,radius:number){const q=this.query({minX:x-radius,minY:y-radius,maxX:x+radius,maxY:y+radius});return{cities:q.cities.filter(c=>Math.hypot(c.x-x,c.y-y)<=radius),sites:q.sites.filter(s=>Math.hypot(s.x-x,s.y-y)<=radius)};}
}
const indexes=new WeakMap<FormalWorld,{time:number;index:SpatialIndex}>();
export function invalidateSpatial(w:FormalWorld){indexes.delete(w);}
export function spatial(w:FormalWorld):SpatialIndex {let cached=indexes.get(w);if(!cached){const i=new SpatialIndex(w.dimensions.width,w.dimensions.height,w.worldLayer?.regionSize??32);for(const c of w.cities)i.addCity(c);for(const s of w.worldLayer?.wildSites??[])if(s.phase!=='cooldown')i.addSite(s);for(const s of w.extinction?.sites??[])if(s.phase==='active')i.addSite(s);for(const p of w.settlements??[])if(p.phase==='travelling'&&p.target)i.reserve(p.target.x,p.target.y,p.projectId);for(const a of w.armies)i.addArmy(a,w.time);cached={time:w.time,index:i};indexes.set(w,cached);}else if(cached.time!==w.time){cached.index.armies.clear();cached.index.armyCells.clear();cached.index.armyRegions.clear();for(const a of w.armies)cached.index.addArmy(a,w.time);cached.time=w.time;}return cached.index;}
