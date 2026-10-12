/** Adapted from v0.30.2 TerrainCache + worldScenery + mapSession.
 * Request/pump/LRU, world-space scenery tiles, gesture tiers and static background
 * semantics are retained. Only terrain/decorations/node dependencies are Formal.
 */
import type {FormalWorld} from '../formal/model';
import {project,inverse,tilePath,type Point} from './mapGeometry';
import {paintSurface,paintTerrainOverview,shoreSegments,wetSurface,noise,decorations,type Texture,type Decoration} from './mapPaint';
import {terrainAt} from '../formal/terrain';
import {sceneryRasterScale} from '../mapDisplay';
import atlas from '../sceneryAtlas.json';
import {assetURL} from './artMap';
import {overviewGeometry,MAP_TERRAIN_MARGIN} from './mapViewRules';
export type Camera={x:number;y:number;z:number};
const CHUNK=16,WIDTH=704,HEIGHT=384,ORIGIN=352;
export const terrainRasterScale=(zoom:number,dpr=1)=>Math.min(2,Math.max(.125,2**Math.floor(Math.log2(zoom*dpr))));
export function terrainChunks(c:Camera,w:number,h:number,world:FormalWorld){
 const corners=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>inverse(c.x+(x-w/2)/c.z,c.y+(y-h/2)/c.z)),out:Point[]=[];
 for(let y=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.y))-16)/CHUNK)*CHUNK);y<=Math.min(world.dimensions.height-1,Math.max(...corners.map(p=>p.y))+16);y+=CHUNK)
 for(let x=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.x))-16)/CHUNK)*CHUNK);x<=Math.min(world.dimensions.width-1,Math.max(...corners.map(p=>p.x))+16);x+=CHUNK){const q=project({x,y}),sx=(q.x-c.x)*c.z+w/2,sy=(q.y-c.y)*c.z+h/2;if(sx+352*c.z>=0&&sx-352*c.z<=w&&sy+320*c.z>=0&&sy-64*c.z<=h)out.push({x,y});}
 return out.sort((a,b)=>{const p=project(a),q=project(b);return (p.x-c.x)**2+(p.y-c.y)**2-(q.x-c.x)**2-(q.y-c.y)**2;});
}
const imageCache=new Map<string,HTMLImageElement>();
export function mapImage(path:string){let im=imageCache.get(path);if(!im){im=new Image();im.src=assetURL(path);imageCache.set(path,im);}return im;}
type Chunk={image:HTMLCanvasElement;scale:number};
type Job={x:number;y:number;scale:number;key:string};
export class TerrainCache {
 cache=new Map<string,Chunk>();pending=new Map<string,Job>();revision=0;bytes=0;hits=0;misses=0;worker?:Worker;active?:Job;generation=1;texture?:Texture;bank?:HTMLImageElement;overview?:HTMLCanvasElement;overviewReady=false;onChange=()=>{};
 constructor(readonly world:FormalWorld){
  try{this.worker=new Worker(new URL('./mapRaster.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{const job=this.active;this.active=undefined;if(data.error){this.worker?.terminate();this.worker=undefined;if(job)this.pending.set(job.key,job);}else if(data.generation===this.generation&&job){if(job.key==='overview'){const c=this.pixels(data.pixels);this.setOverview(c);}else this.store(job.key,this.make(job,data.pixels));this.revision++;}this.onChange();};this.worker.onerror=()=>{if(this.active)this.pending.set(this.active.key,this.active);this.active=undefined;this.worker?.terminate();this.worker=undefined;this.onChange();};this.init();}catch{this.worker=undefined;}
 }
 init(){this.worker?.postMessage({type:'init',world:{seed:this.world.seed,dimensions:this.world.dimensions,worldLayer:this.world.worldLayer},texture:this.texture,generation:this.generation});}
 setTextures(ground:HTMLImageElement,bank:HTMLImageElement){if(!ground.naturalWidth||!bank.naturalWidth||this.bank===bank&&this.texture)return;const c=document.createElement('canvas');c.width=ground.naturalWidth;c.height=ground.naturalHeight;const q=c.getContext('2d')!;q.drawImage(ground,0,0);this.texture=q.getImageData(0,0,c.width,c.height);this.bank=bank;this.generation++;this.cache.clear();this.bytes=0;this.overviewReady=false;this.init();this.revision++;}
 beginFrame(){this.pending.clear();}
 request(x:number,y:number,z:number,dpr:number,gesture:boolean){const scale=terrainRasterScale(gesture?Math.min(.5,z):z,dpr),key=x+','+y+':'+scale,hit=this.cache.get(key);if(hit){this.hits++;this.cache.delete(key);this.cache.set(key,hit);return hit;}
  if(this.active?.key!==key)this.pending.set(key,{x,y,scale,key});
  for(const tier of [2,1,.5,.25,.125]){const cached=this.cache.get(x+','+y+':'+tier);if(cached){this.hits++;return cached;}}return null;
 }
 requestOverview(){if(!this.overviewReady&&this.active?.key!=='overview')this.pending.set('overview',{x:0,y:0,scale:.075,key:'overview'});if(!this.overview){this.overview=this.pixels(paintTerrainOverview(this.world));this.trim(0);}return this.overview;}
 get pendingCount(){return this.pending.size+(this.active?1:0);}
 pump(){if(this.active||!this.pending.size)return;const [key,job]=this.pending.entries().next().value!;this.pending.delete(key);this.misses++;
  if(this.worker){this.active=job;this.worker.postMessage({type:job.key==='overview'?'overview':'paint',key,cx:job.x,cy:job.y,quality:job.scale});}
  else {if(key==='overview'){this.setOverview(this.overview??this.pixels(paintTerrainOverview(this.world)));}else this.store(key,this.make(job));this.revision++;this.onChange();}
 }
 pixels(p:ReturnType<typeof paintSurface>){const c=document.createElement('canvas');c.width=p.width;c.height=p.height;const q=c.getContext('2d')!,a=q.createImageData(p.width,p.height);a.data.set(p.data);q.putImageData(a,0,0);return c;}
 make(job:Job,prepared?:ReturnType<typeof paintSurface>):Chunk{
  const origin=project(job),start={x:origin.x-ORIGIN,y:origin.y-64},image=this.pixels(prepared??paintSurface(this.world,start,WIDTH,HEIGHT,job.scale,this.texture)),q=image.getContext('2d')!;q.scale(job.scale,job.scale);const local=(p:Point)=>{const a=project(p);return{x:a.x-start.x,y:a.y-start.y};};
  // DEMO bank-crop pipeline, contours sampled exclusively from Formal wet cells.
  if(this.bank?.naturalWidth&&job.scale>=.25)for(let y=job.y-2;y<=job.y+17;y++)for(let x=job.x-2;x<=job.x+17;x++)for(const [a,b] of shoreSegments(this.world,x,y)){let p=local(a),r=local(b),dx=r.x-p.x,dy=r.y-p.y;const len=Math.hypot(dx,dy);if(len<.01)continue;const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},into={x:mid.x-dy/len/40+dx/len/20,y:mid.y+dx/len/20+dy/len/40};if(wetSurface(this.world,into.x,into.y)<wetSurface(this.world,mid.x,mid.y)){[p,r]=[r,p];dx=-dx;dy=-dy;}const u=((Math.min((a.x-a.y)*20,(b.x-b.y)*20)*2.5+this.world.seed)%180+180)%180,hh=6+noise(mid.x*.7,mid.y*.7,this.world.seed^711)*2;q.save();q.translate(p.x,p.y);q.rotate(Math.atan2(dy,dx));q.drawImage(this.bank,u,0,Math.min(29,len*2.5+.5),12,-.25,-hh*.75+.4,len+.5,hh);q.restore();}
  return{image,scale:job.scale};
 }
 setOverview(image:HTMLCanvasElement){this.overview=image;this.overviewReady=true;this.trim(0);}
 get totalBytes(){return this.bytes+(this.overview?this.overview.width*this.overview.height*4:0);}
 trim(incoming:number){while(this.totalBytes+incoming>96*1024*1024&&this.cache.size){const first=this.cache.keys().next().value!,old=this.cache.get(first)!;this.bytes-=old.image.width*old.image.height*4;this.cache.delete(first);}}
 store(key:string,value:Chunk){const bytes=value.image.width*value.image.height*4;const old=this.cache.get(key);if(old){this.bytes-=old.image.width*old.image.height*4;this.cache.delete(key);}this.trim(bytes);this.cache.set(key,value);this.bytes+=bytes;}
 dispose(){this.worker?.terminate();this.pending.clear();this.onChange=()=>{};}
}
type Tile={image:HTMLCanvasElement;wx:number;wy:number;width:number;height:number;scale:number};
const tileSize=(scale:number)=>({width:512/Math.max(1,scale),height:256/Math.max(1,scale)});
export class SceneryCache {
 cache=new Map<string,Tile>();pending=new Map<string,()=>void>();bytes=0;revision=0;hits=0;misses=0;spriteDraws=0;assetSignature='';
 assetsReady(images:HTMLImageElement[]){const signature=images.map(im=>im.naturalWidth+','+im.naturalHeight).join('|');if(signature===this.assetSignature)return;this.assetSignature=signature;this.cache.clear();this.bytes=0;this.pending.clear();this.revision++;}
 beginFrame(){this.pending.clear();}
 draw(ctx:CanvasRenderingContext2D,w:FormalWorld,c:Camera,width:number,height:number,dpr:number,gesture:boolean){
  const scale=sceneryRasterScale(c.z,dpr,gesture),size=tileSize(scale),nodes=w.cities,prefix=nodes.map(n=>n.x+','+n.y).join('|'),left=c.x-width/2/c.z,right=c.x+width/2/c.z,top=c.y-height/2/c.z,bottom=c.y+height/2/c.z;
  for(let y=Math.floor(top/size.height);y<=Math.floor(bottom/size.height);y++)for(let x=Math.floor(left/size.width);x<=Math.floor(right/size.width);x++){
   const wx=x*size.width,wy=y*size.height;if(wx>20*w.dimensions.width+512||wx+size.width< -20*w.dimensions.height-512||wy>10*(w.dimensions.width+w.dimensions.height)+512||wy+size.height< -512)continue;
   const key=prefix+':'+x+','+y+':'+scale,render=()=>{const canvas=document.createElement('canvas');canvas.width=size.width*scale+4;canvas.height=size.height*scale+4;this.render(canvas.getContext('2d')!,w,{x:wx+size.width/2,y:wy+size.height/2,z:scale},canvas.width,canvas.height,nodes);const cost=canvas.width*canvas.height*4;while(this.bytes+cost>48*1024*1024&&this.cache.size){const first=this.cache.keys().next().value!,old=this.cache.get(first)!;this.bytes-=old.image.width*old.image.height*4;this.cache.delete(first);}this.cache.set(key,{image:canvas,wx,wy,width:size.width,height:size.height,scale});this.bytes+=cost;this.revision++;this.misses++;};
   let tile=this.cache.get(key);if(!tile){this.pending.set(key,render);for(const tier of [4,2,1,.5,.25]){const ts=tileSize(tier);if(tier===scale||ts.width<size.width)continue;tile=this.cache.get(prefix+':'+Math.floor(wx/ts.width)+','+Math.floor(wy/ts.height)+':'+tier);if(tile)break;}}
   else{this.hits++;this.cache.delete(key);this.cache.set(key,tile);}
   if(tile){ctx.save();ctx.beginPath();ctx.rect((wx-c.x)*c.z+width/2-.15,(wy-c.y)*c.z+height/2-.15,size.width*c.z+.3,size.height*c.z+.3);ctx.clip();const pad=2/tile.scale;ctx.drawImage(tile.image,(tile.wx-pad-c.x)*c.z+width/2,(tile.wy-pad-c.y)*c.z+height/2,(tile.width+pad*2)*c.z,(tile.height+pad*2)*c.z);ctx.restore();}
  }
 }
 render(ctx:CanvasRenderingContext2D,w:FormalWorld,c:Camera,width:number,height:number,nodes:Point[]){
  const screen=(p:Point)=>{const q=project(p);return{x:(q.x-c.x)*c.z+width/2,y:(q.y-c.y)*c.z+height/2};},corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>inverse(c.x+(x-width/2)/c.z,c.y+(y-height/2)/c.z)),minX=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.x))-18)/2)*2),maxX=Math.min(w.dimensions.width-1,Math.max(...corners.map(p=>p.x))+18),minY=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.y))-18)/2)*2),maxY=Math.min(w.dimensions.height-1,Math.max(...corners.map(p=>p.y))+18),items:Decoration[]=[];
  for(let x=minX;x<=maxX;x+=2)for(let y=minY;y<=maxY;y+=2)items.push(...decorations(w,x,y).filter(d=>d.kind!=='mountain'));
  // Mountain stride is independent of the tree/detail 2-cell sampling grid.
  for(let y=Math.ceil(minY/6)*6;y<=maxY;y+=6)for(let x=minX;x<=maxX;x++)if(terrainAt(w,x,y)==='mountain')items.push(...decorations(w,x,y).filter(d=>d.kind==='mountain'));
  items.sort((a,b)=>+(a.kind!=='detail')-+(b.kind!=='detail')||(a.x+a.y)-(b.x+b.y));
  for(const item of items){if(c.z<=.25&&item.kind==='detail')continue;const p=screen(item),sw=item.width*c.z,sh=item.height*c.z;if(p.x+sw/2<0||p.x-sw/2>width||p.y+sh*.16<0||p.y-sh*.84>height)continue;const im=mapImage(item.kind==='tree'?'art/world-trees-0299.webp':item.kind==='mountain'?'art/world-mountains-0299.webp':'art/world-details-0299.webp'),r=(item.kind==='tree'?atlas.trees:item.kind==='mountain'?atlas.mountains:atlas.ground)[item.variant];if(!im.naturalWidth)continue;ctx.save();ctx.translate(p.x,p.y);ctx.scale(item.flip?-1:1,1);if(item.kind==='detail')ctx.globalAlpha=.38;ctx.drawImage(im,r.x,r.y,r.w,r.h,-sw/2,-sh*.84,sw,sh);ctx.restore();this.spriteDraws++;}
  // DEMO clears scenery only around cities. Wild sites never erase background
  // or invalidate scenery tiles when their slots respawn elsewhere.
  ctx.globalCompositeOperation='destination-out';for(const n of nodes){const p=screen(n),size=17*c.z;if(p.x<-80||p.x>width+80||p.y<-80||p.y>height+80)continue;ctx.save();ctx.translate(p.x,p.y-size*.7);ctx.scale(size*2.6,size*2.4);const mask=ctx.createRadialGradient(0,0,.72,0,0,1);mask.addColorStop(0,'#000');mask.addColorStop(1,'#0000');ctx.fillStyle=mask;ctx.fillRect(-1,-1,2,2);ctx.restore();}ctx.globalCompositeOperation='source-over';
 }
 pump(maxMs=4){const start=performance.now();let count=0;for(const [key,render] of this.pending){if(count>=2||(count&&performance.now()-start>=maxMs))break;this.pending.delete(key);render();count++;}return count;}
}
const sessions=new Map<string,{terrain:TerrainCache;scenery:SceneryCache}>();
export function mapSession(w:FormalWorld){
 let session=sessions.get(w.campaignId);
 if(session&&(session.terrain.world.seed!==w.seed||session.terrain.world.worldLayer?.terrain!==w.worldLayer?.terrain)){
  session.terrain.dispose();sessions.delete(w.campaignId);session=undefined;
 }
 if(!session){
  session={terrain:new TerrainCache(w),scenery:new SceneryCache()};sessions.set(w.campaignId,session);
  // The modal lab and normal map can remain mounted together. Keep one cache per context.
  const lab=w.campaignId.startsWith('campaign:b5lab-');
  for(const key of sessions.keys())if(key!==w.campaignId&&key.startsWith('campaign:b5lab-')===lab){
   sessions.get(key)!.terrain.dispose();sessions.delete(key);
  }
 }
 return session;
}
export function drawTerrain(ctx:CanvasRenderingContext2D,w:FormalWorld,c:Camera,width:number,height:number,dpr:number,gesture:boolean,grid:boolean,cache:TerrainCache){
 cache.beginFrame();const screen=(p:Point)=>{const q=project(p);return{x:(q.x-c.x)*c.z+width/2,y:(q.y-c.y)*c.z+height/2};};ctx.fillStyle='#29392d';ctx.fillRect(0,0,width,height);ctx.imageSmoothingEnabled=true;ctx.save();ctx.beginPath();const margin=MAP_TERRAIN_MARGIN;[{x:-.5-margin,y:-.5-margin},{x:w.dimensions.width-.5+margin,y:-.5-margin},{x:w.dimensions.width-.5+margin,y:w.dimensions.height-.5+margin},{x:-.5-margin,y:w.dimensions.height-.5+margin}].forEach((p,i)=>{const a=screen(p);if(i)ctx.lineTo(a.x,a.y);else ctx.moveTo(a.x,a.y);});ctx.closePath();ctx.clip();
 const overview=cache.requestOverview(),a=overviewGeometry(w),p=screen({x:0,y:0});ctx.drawImage(overview,p.x+a.origin.x*c.z,p.y+a.origin.y*c.z,a.width*c.z,a.height*c.z);
 const chunks=terrainChunks(c,width,height,w);if(c.z>=.18)for(const p of chunks){const tile=cache.request(p.x,p.y,c.z,dpr,gesture);if(!tile)continue;const center=screen(p);ctx.save();ctx.beginPath();const pad=1.25/(20*tile.scale);[{x:p.x-.5-pad,y:p.y-.5-pad},{x:p.x+15.5+pad,y:p.y-.5-pad},{x:p.x+15.5+pad,y:p.y+15.5+pad},{x:p.x-.5-pad,y:p.y+15.5+pad}].forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.clip();ctx.drawImage(tile.image,center.x-ORIGIN*c.z,center.y-64*c.z,WIDTH*c.z,HEIGHT*c.z);ctx.restore();}ctx.restore();
 ctx.beginPath();[{x:-.5,y:-.5},{x:w.dimensions.width-.5,y:-.5},{x:w.dimensions.width-.5,y:w.dimensions.height-.5},{x:-.5,y:w.dimensions.height-.5}].forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.strokeStyle='#dfc18065';ctx.lineWidth=1;ctx.stroke();
 if(grid&&c.z>.2){ctx.strokeStyle='#46523848';ctx.lineWidth=.65;for(const p of chunks)for(let y=p.y;y<p.y+16;y++)for(let x=p.x;x<p.x+16;x++){const t=terrainAt(w,x,y);if(!t||t==='river'||t==='water')continue;tilePath(ctx,{x,y},screen);ctx.stroke();}}
}
