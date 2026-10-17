import atlas from './sceneryAtlas.json';
import {hash,regionalTerrainAt,terrainEnvironmentAt,mountainSprites,mountainProfileKey,waterAt} from './terrainRegions';
import {landCoverWeights} from './landCover';
import {flatProject,flatInverse} from './mapProjection';
import type {Point,Node} from './types';

export type Decoration={x:number;y:number;width:number;height:number;variant:number;kind:'tree'|'mountain'|'detail';flip:boolean};
export type SceneryNode=Pick<Node,'id'|'x'|'y'|'kind'|'respawnAt'>;
export const sceneryNodeKey=(nodes:SceneryNode[])=>nodes.filter(n=>n.kind==='capital'||n.kind==='village').map(n=>`${n.id}:${n.x},${n.y}:${n.kind}`).join('|');
export const sceneryNodeVisible=(n:SceneryNode,zoom:number)=>!n.respawnAt&&n.kind!=='ruins'&&(['capital','village'].includes(n.kind)||zoom>.22);

// Check the full projected rectangle (including the raised summit), not just
// the anchor. Conservative padding also protects the interpolated shoreline.
export function decorationDry(d:Decoration,seed:number,version:number){
 const p=flatProject(d),left=p.x-d.width/2,right=p.x+d.width/2,top=p.y-d.height*.84,bottom=p.y+d.height*.16;
 const nx=Math.max(2,Math.ceil(d.width/8)),ny=Math.max(2,Math.ceil(d.height/8));
 for(let iy=0;iy<=ny;iy++)for(let ix=0;ix<=nx;ix++){
  const q=flatInverse(left+(right-left)*ix/nx,top+(bottom-top)*iy/ny);
  if(waterAt(Math.floor(q.x),Math.floor(q.y),seed,version)||waterAt(Math.ceil(q.x),Math.ceil(q.y),seed,version))return false;
 }
 return true;
}
let cacheKey='';const cells=new Map<string,Decoration[]>();let ridges:Decoration[]=[];
function fit(d:Decoration,seed:number,version:number){
 for(let attempt=0;attempt<4;attempt++){if(decorationDry(d,seed,version))return d;d={...d,width:d.width*.78,height:d.height*.78};}
 return null;
}
export function decorationsAt(x:number,y:number,seed:number,version:number):Decoration[]{
 prepare(seed,version);const key=x+','+y,old=cells.get(key);if(old)return old;
 const n=hash(x,y,seed),kind=regionalTerrainAt(x,y,seed,version),result:Decoration[]=[];
 if(kind!=='water'){
  const e=terrainEnvironmentAt(x,y,seed,version),cover=landCoverWeights(x,y,seed,version),biome=cover.indexOf(Math.max(...cover));
  const px=x+((n>>>8)%101/100-.5)*1.7,py=y+((n>>>16)%101/100-.5)*1.7;
  const treeChance=kind==='mountain'?7:e.bank<2.5?24:biome===1?3:kind==='forest'?65:biome===0?2:4+e.forest*9;
  if(n%100<treeChance){
   const group=(n>>>7)%10,variant=group<(kind==='forest'?4:7)?(n>>>3)%4:group<8?4+(n>>>3)%4:8+(n>>>3)%8;
   const width=variant<4?14+(n>>>20)%13:variant<8?28+(n>>>20)%17:43+(n>>>20)%19;
   const d=fit({x:px,y:py,width,height:width*atlas.trees[variant].h/atlas.trees[variant].w,kind:'tree',variant,flip:!!(n%2)},seed,version);if(d)result.push(d);
  }
  if(kind!=='mountain'&&(n>>>5)%100<(kind==='forest'?10:biome===0?9:24)){
   const variant=(e.bank<3?12:biome*4)+(n>>>13)%4,width=48+(n>>>21)%44;
   const d=fit({x:x-((n>>>10)%100/100-.5),y:y+((n>>>17)%100/100-.5),width,height:width*atlas.ground[variant].h/atlas.ground[variant].w*.62,kind:'detail',variant,flip:!!(n%2)},seed,version);if(d)result.push(d);
  }
 }
 cells.set(key,result);return result;
}
function prepare(seed:number,version:number){
 const key=seed+':'+version+':'+mountainProfileKey(seed);if(cacheKey===key)return;cacheKey=key;cells.clear();
 ridges=mountainSprites(seed,version).map(d=>({...d,kind:'mountain'}));
}
export function ridgeDecorations(seed:number,version:number){prepare(seed,version);return ridges;}
export function decorationRect(d:Decoration){const p=flatProject(d);return {left:p.x-d.width/2,top:p.y-d.height*.84,right:p.x+d.width/2,bottom:p.y+d.height*.16};}
export const pointInRect=(p:Point,r:ReturnType<typeof decorationRect>)=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;
