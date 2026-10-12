import {drawShoreline} from './shoreline';
import {regionalTerrainAt,hash,waterAt,mountainClearingsFor} from './terrainRegions';
import {painterlyGround} from './painterlyGround';
import type {GroundTexture} from './terrainRaster';
import {flatProject,mapProject,traceTile} from './mapProjection';
export const terrainPalette={grass:['#aeb986','#b8c18e','#a9b681'],field:['#c7c390','#c9c697','#beba86'],forest:['#7c976b','#829d70','#789469'],hill:['#a6a581','#ada98a','#9d9b7b'],water:['#397b9a','#4386a3','#367998'],mountain:['#a8a083','#b0a48c','#a39b80']};
export const CHUNK_SIZE=16,CHUNK_ORIGIN_X=352,CHUNK_WIDTH=704,CHUNK_HEIGHT=384;
export const TERRAIN_MARGIN=50;
export const terrainDetail=(zoom:number)=>zoom<.2?4:zoom<.4?2:1;
export function terrainChunks(cx:number,cy:number,z:number,w:number,h:number){
 const inverse=(x:number,y:number)=>({x:x/40+y/20,y:y/20-x/40});
 const corners=[inverse(cx-w/2/z,cy-h/2/z),inverse(cx+w/2/z,cy-h/2/z),inverse(cx-w/2/z,cy+h/2/z),inverse(cx+w/2/z,cy+h/2/z)];
 const result:{x:number;y:number}[]=[];
 const first=Math.floor(-TERRAIN_MARGIN/CHUNK_SIZE)*CHUNK_SIZE,last=Math.floor((255+TERRAIN_MARGIN)/CHUNK_SIZE)*CHUNK_SIZE;
 for(let x=Math.max(first,Math.floor(Math.min(...corners.map(p=>p.x))/16)*16-16);x<=Math.min(last,Math.max(...corners.map(p=>p.x))+16);x+=16)
  for(let y=Math.max(first,Math.floor(Math.min(...corners.map(p=>p.y))/16)*16-16);y<=Math.min(last,Math.max(...corners.map(p=>p.y))+16);y+=16){
   const sx=((x-y)*20-cx)*z+w/2,sy=((x+y)*10-cy)*z+h/2;
   if(sx+340*z>=0&&sx-340*z<=w&&sy+340*z>=0&&sy-64*z<=h)result.push({x,y});
  }
 return result.sort((a,b)=>{const priority=(p:{x:number;y:number})=>((p.x<0||p.y<0||p.x>=256||p.y>=256)?1e9:0)+((p.x-p.y)*20-cx)**2+((p.x+p.y)*10-cy)**2;return priority(a)-priority(b);});
}
// Only terrain pixels are cached. Orders, fog/intelligence and simulation are never cached here.
type RasterJob={key:string;x:number;y:number;seed:number;zoom:number;dpr:number;version:number};
type GroundPixels=ReturnType<typeof painterlyGround>;
export class TerrainCache {
 private worker?:Worker;
 private workerFailed=false;
 private workerTexture?:GroundTexture;
 private active?:RasterJob;
 private generation=0;
 dispose(){this.worker?.terminate();this.worker=undefined;this.active=undefined;this.pending.clear();}
 private invalidate(){this.generation++;this.cache.clear();this.pending.clear();this.bytes=0;this.revision++;}
 private startRaster(job:RasterJob){
  if(typeof Worker==='undefined'||this.workerFailed){this.get(job.x,job.y,job.seed,job.zoom,false,job.dpr,job.version);return;}
  if(!this.worker){
   try{
    this.worker=new Worker(new URL('./terrainRaster.worker.ts',import.meta.url),{type:'module'});
    this.worker.onmessage=({data}:{data:{generation:number;pixels:GroundPixels;error?:string}})=>{
     const job=this.active;this.active=undefined;
     if(data.error){this.worker?.terminate();this.worker=undefined;this.workerFailed=true;if(job)this.pending.set(job.key,job);}
     else if(job&&data.generation===this.generation)this.get(job.x,job.y,job.seed,job.zoom,false,job.dpr,job.version,data.pixels);
     this.revision++;
    };
    this.worker.onerror=()=>{const job=this.active;this.active=undefined;this.worker?.terminate();this.worker=undefined;this.workerFailed=true;if(job)this.pending.set(job.key,job);this.revision++;};
   }catch{this.workerFailed=true;this.get(job.x,job.y,job.seed,job.zoom,false,job.dpr,job.version);return;}
  }
  this.active=job;
  const texture=this.workerTexture===this.groundTexture?undefined:this.groundTexture;this.workerTexture=this.groundTexture;
  this.worker.postMessage({...job,scale:terrainRasterScale(job.zoom,job.dpr),generation:this.generation,texture,clearings:mountainClearingsFor(job.seed)});
 }

 revision=0;
 waterTexture:HTMLCanvasElement|null=null;
 private groundTexture?:GroundTexture;
 private bankTexture?:HTMLImageElement;
 setBankTexture(atlas:HTMLImageElement){if(this.bankTexture===atlas)return;this.bankTexture=atlas;this.invalidate();}
 private groundSource?:HTMLImageElement;
 private waterSource?:HTMLImageElement;
 setGroundTexture(atlas:HTMLImageElement){
  if(this.groundSource===atlas)return;this.groundSource=atlas;
  const c=document.createElement('canvas');c.width=atlas.naturalWidth;c.height=atlas.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(atlas,0,0);this.groundTexture=ctx.getImageData(0,0,c.width,c.height);this.invalidate();
 }
 private cache=new Map<string,{image:HTMLCanvasElement;foliage:HTMLCanvasElement|null}>();
 hits=0;misses=0;
 private bytes=0;
 private pending=new Map<string,RasterJob>();
 setWaterTexture(atlas:HTMLImageElement){
  if(this.waterSource===atlas)return;this.waterSource=atlas;
  const water=document.createElement('canvas');water.width=water.height=512;
  water.getContext('2d')!.drawImage(atlas,0,0,512,512);
  this.waterTexture=water;this.invalidate();
 }
 beginFrame(){this.pending.clear();}
 get pendingCount(){return this.pending.size+(this.active?1:0);}
 // A gesture requests cheap terrain first. Refine only after input settles.
 request(x:number,y:number,seed:number,zoom:number,dpr=1,gesturing=false,version=0){
  const quality=gesturing?Math.min(.5,zoom):zoom,scale=terrainRasterScale(quality,dpr),detail=quality>.55;
  const key=[x,y,seed,version,detail,scale,false].join(':');
  const hit=this.cache.get(key);
  if(hit){this.hits++;this.cache.delete(key);this.cache.set(key,hit);return {...hit,scale};}
  if(this.active?.key!==key)this.pending.set(key,{key,x,y,seed,zoom:quality,dpr,version});
  for(const fallbackScale of [2,1,.5,.25,.125])for(const fallbackDetail of [false,true]){
   const cached=this.cache.get([x,y,seed,version,fallbackDetail,fallbackScale,false].join(':'));
   if(cached)return {...cached,scale:fallbackScale};
  }
  return null;
 }
 // Bound synchronous raster work, rather than rasterizing every cache miss in a wheel event.
 pump(maxChunks=3,maxMs=4){
  const start=performance.now();let generated=0;
  for(const [key,job] of this.pending){if(this.active||generated>=maxChunks||(generated>0&&performance.now()-start>=maxMs))break;this.pending.delete(key);this.startRaster(job);generated++;}
  return generated;
 }
 get size(){return this.cache.size;}
 get(x:number,y:number,seed:number,zoom:number,grid:boolean,dpr=1,version=0,prepared?:GroundPixels){
  const detail=zoom>.55,scale=terrainRasterScale(zoom,dpr),key=[x,y,seed,version,detail,scale,grid&&zoom>.45].join(':');
  const old=this.cache.get(key);if(old){this.hits++;this.cache.delete(key);this.cache.set(key,old);return {...old,scale};}
  this.misses++;const image=document.createElement('canvas');image.width=CHUNK_WIDTH*scale;image.height=CHUNK_HEIGHT*scale;const c=image.getContext('2d')!;c.scale(scale,scale);
  const origin=flatProject({x,y}),project=(p:{x:number;y:number})=>{const q=mapProject(p,seed,version);return {x:CHUNK_ORIGIN_X+q.x-origin.x,y:64+q.y-origin.y};};
  c.save();c.beginPath();
  // Overlap by a raster pixel so antialiased chunk edges never expose the background.
  const pad=1.25/(20*scale);
  const left=Math.max(x-.5-pad,-TERRAIN_MARGIN-.5),top=Math.max(y-.5-pad,-TERRAIN_MARGIN-.5),right=Math.min(x+15.5+pad,255.5+TERRAIN_MARGIN),bottom=Math.min(y+15.5+pad,255.5+TERRAIN_MARGIN);
  [{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}].forEach((p,i)=>{const q=project(p);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.closePath();c.clip();
  const pixels=prepared??painterlyGround(x,y,seed,version,scale,this.groundTexture),surface=document.createElement('canvas');surface.width=pixels.width;surface.height=pixels.height;
  const surfaceContext=surface.getContext('2d')!,bitmap=surfaceContext.createImageData(pixels.width,pixels.height);bitmap.data.set(pixels.data);surfaceContext.putImageData(bitmap,0,0);
  c.drawImage(surface,0,0,CHUNK_WIDTH,CHUNK_HEIGHT);
  drawShoreline(c,x,y,seed,version,project,this.bankTexture);
  // Only the 256 × 256 playable area receives grid lines.
  if(scale>=.125)for(let i=0;i<16;i++)for(let j=0;j<16;j++){
   const tx=x+i,ty=y+j;if(tx<0||ty<0||tx>=256||ty>=256)continue;
   if(waterAt(tx,ty,seed,version))continue;traceTile(c,{x:tx,y:ty},project);c.strokeStyle='#46523848';c.lineWidth=Math.max(.65,.28/scale);c.stroke();
  }
  c.restore();
  const foliage=null;
  // Bounded bitmap memory at 96 MiB, regardless of zoom or viewport.
  const bytes=image.width*image.height*4*(foliage?2:1);while(this.bytes+bytes>96*1024*1024&&this.cache.size){const first=this.cache.keys().next().value!,old=this.cache.get(first)!;this.bytes-=old.image.width*old.image.height*4*(old.foliage?2:1);this.cache.delete(first);}this.bytes+=bytes;this.cache.set(key,{image,foliage});return {image,foliage,scale};
 }
}

export const terrainRasterScale=(zoom:number,dpr=1)=>Math.min(2,Math.max(.125,2**Math.floor(Math.log2(zoom*dpr))));

// Discrete palette restores crisp geometric tiles; seeded ecology defines the regions.
export function terrainFill(x:number,y:number,seed:number,version=0){
 const type=regionalTerrainAt(x,y,seed,version);
 return terrainPalette[type][hash(x,y,seed)%3];
}
