/** DEMO atlas footprint adapted to Formal durable terrain. Never calls legacy geography. */
import atlas from '../sceneryAtlas.json';
import silhouettes from './mountainSilhouettes.json';
import type {FormalWorld} from './model';
import {seedHash,terrainAt} from './terrain';
export type MountainSprite={x:number;y:number;variant:number;width:number;height:number;flip:boolean};
export type MountainProfile={revision:1;sprites:MountainSprite[]};
const footprints=new Map<string,{x:number;y:number}[]>();
export function mountainFootprint(d:MountainSprite):{x:number;y:number}[]{
 const key=[d.x,d.y,d.variant,d.width,d.height,d.flip].join(':');const old=footprints.get(key);if(old)return old;
 const cells=new Map<string,{x:number;y:number}>(),dx=d.width/64/40,dy=d.height/64/20;
 for(const [j,row] of silhouettes[d.variant].entries())for(let i=0;i<64;i++)if(row[i]==='1'){
  const left=d.flip?63-i:i,sx=(left/64-.5)*d.width,sy=(j/64-.84)*d.height,x=d.x+sx/40+sy/20,y=d.y+sy/20-sx/40;
  for(let yy=Math.round(y-dx);yy<=Math.round(y+dy);yy++)for(let xx=Math.round(x);xx<=Math.round(x+dx+dy);xx++)cells.set(xx+','+yy,{x:xx,y:yy});
 }
 const result=[...cells.values()];if(footprints.size>=1024)footprints.delete(footprints.keys().next().value!);footprints.set(key,result);return result;
}
/** Existing entities and in-flight routes are protected once during migration,
 * not consulted every frame; geography stays fixed as the campaign advances. */
function protectedCells(w:FormalWorld){const cells=new Set<number>(),protect=(p:{x:number;y:number})=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)cells.add((p.y+dy)*384+p.x+dx);};
 for(const p of [...w.cities,...(w.worldLayer?.wildSites??[])])protect(p);
 for(const s of w.settlements??[]){if(s.target)protect(s.target);for(const p of s.path??[])protect(p);}
 for(const a of w.armies){if(a.position)protect({x:Math.round(a.position.x),y:Math.round(a.position.y)});for(const p of a.path??[])protect(p);}
 for(const t of w.logistics??[])for(const p of t.path)protect(p);
 return cells;
}
export function installMountains(w:FormalWorld){
 const layer=w.worldLayer;if(!layer||layer.mountains)return;
 const protectedSet=protectedCells(w),sprites:MountainSprite[]=[],terrain=layer.terrain.split('');
 // Read the original Formal ridge, so the overlay never recursively spawns mountains.
 for(let y=0;y<384;y+=6)for(let x=0;x<384;x++)if(terrainAt(w,x,y)==='mountain'){
  let left=x,right=x;while(terrainAt(w,left-1,y)==='mountain')left--;while(terrainAt(w,right+1,y)==='mountain')right++;
  if(x!==Math.floor((left+right)/2))continue;
  const n=seedHash(w.seed,x,y,107),variant=n%4,width=210+n%75,b=atlas.mountains[variant];let d:MountainSprite={x,y,variant,width,height:width*b.h/b.w,flip:!!(n%2)};
  for(let attempt=0;attempt<8;attempt++){
   const footprint=mountainFootprint(d);
   if(footprint.some(p=>{const t=terrainAt(w,p.x,p.y);return !t||t==='water'||t==='river';})){d={...d,width:d.width*.8,height:d.height*.8};continue;}
   if(footprint.some(p=>protectedSet.has(p.y*384+p.x)))break;
   sprites.push(d);for(const p of footprint)terrain[p.y*384+p.x]='M';break;
  }
 }
 layer.terrain=terrain.join('');layer.mountains={revision:1,sprites};
}
/** Called only after the original envelope/schema/checksum/report checks. */
export function migrateMountains(w:FormalWorld):FormalWorld{
 if(w.fixture||w.metadata.schemaVersion!==3||w.metadata.terrainVersion!==2)return w;
 const next=structuredClone(w);installMountains(next);next.metadata={...w.metadata,terrainVersion:3};return next;
}
const indexes=new WeakMap<MountainSprite[],Map<string,MountainSprite>>();
export function mountainAt(w:FormalWorld,x:number,y:number){const sprites=w.worldLayer?.mountains?.sprites;if(!sprites)return undefined;let index=indexes.get(sprites);if(!index){index=new Map(sprites.map(d=>[d.x+','+d.y,d]));indexes.set(sprites,index);}return index.get(x+','+y);}
