import {drawWorldScenery,pumpScenery} from './worldScenery';
import {TerrainCache,terrainChunks} from './terrainCache';
import {waterAt,mountainProfileKey,hash} from './terrainRegions';
import {flatProject,flatInverse} from './mapProjection';
import {coverNoise} from './landCover';
import type {Game,Point} from './types';
const assets=new Map<string,HTMLImageElement>();
export function mapImage(src:string){let image=assets.get(src);if(!image){image=new Image();image.src=src;assets.set(src,image);}return image;}
let sessionKey='',terrain=new TerrainCache(),overview:HTMLCanvasElement|null=null;
export function sessionTerrain(g:Pick<Game,'seed'|'terrainVersion'>){const key=g.seed+':'+g.terrainVersion+':'+mountainProfileKey(g.seed);if(key!==sessionKey){sessionKey=key;terrain.dispose();terrain=new TerrainCache();overview=null;}return terrain;}
// A coherent low-resolution world underneath detailed chunks; never show empty
// 4×4 blue/green placeholder diamonds when entering or zooming out.
export function terrainOverview(g:Pick<Game,'seed'|'terrainVersion'>){
 sessionTerrain(g);if(overview)return overview;
 const c=document.createElement('canvas');c.width=356;c.height=178;const ctx=c.getContext('2d')!,image=ctx.createImageData(c.width,c.height),covers=new Map<string,number[]>();
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const q=flatInverse(x*40-7120,y*40-1010);if(q.x< -50.5||q.y< -50.5||q.x>305.5||q.y>305.5)continue;
  const ix=Math.round(q.x),iy=Math.round(q.y),wet=waterAt(ix,iy,g.seed,g.terrainVersion),noise=hash(ix,iy,g.seed)%9-4;
  const cx=Math.floor(ix/4)*4,cy=Math.floor(iy/4)*4,key=cx+','+cy;let weights=covers.get(key);if(!weights){const dry=Math.max(0,(coverNoise(cx/39,cy/34,g.seed^82347)-.50)*2.5),rock=Math.max(0,(coverNoise(cx/26,cy/31,g.seed^9173)-.57)*1.8);weights=wet?[0,0,0]:[1-dry-rock,dry,rock];if(!wet)covers.set(key,weights);}const palette=[[181,190,132],[179,166,117],[160,161,139]],i=(y*c.width+x)*4;
  for(let k=0;k<3;k++)image.data[i+k]=wet?[43,111,143][k]:weights.reduce((v,a,j)=>v+a*palette[j][k],0)+noise;
  image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);overview=c;return c;
}
export function prewarmMap(g:Game,center:Point,base:string){
 const cache=sessionTerrain(g),q=flatProject(center),ground=mapImage(base+'art/world-terrain-023.webp');
 for(const path of ['world-trees-0299.webp','world-mountains-0299.webp','world-details-0299.webp','world-water-029.webp','world-riverbanks-0301.webp'])mapImage(base+'art/'+path);
 let stopped=false,timer:ReturnType<typeof setTimeout>,passes=0;
 const buffer=document.createElement('canvas');buffer.width=Math.min(1440,window.innerWidth);buffer.height=Math.min(900,window.innerHeight);
 const work=()=>{
  if(stopped||passes++>180)return;if(!ground.complete||!ground.naturalWidth){timer=setTimeout(work,100);return;}
  const water=mapImage(base+'art/world-water-029.webp');if(water.complete&&water.naturalWidth)cache.setWaterTexture(water);cache.setGroundTexture(ground);const bank=mapImage(base+'art/world-riverbanks-0301.webp');if(bank.complete&&bank.naturalWidth)cache.setBankTexture(bank);terrainOverview(g);
  for(const p of terrainChunks(q.x,q.y,.75,Math.min(1440,window.innerWidth),Math.min(900,window.innerHeight)))cache.request(p.x,p.y,g.seed,.75,Math.min(2,window.devicePixelRatio||1),false,g.terrainVersion);
  cache.pump(2,4);
  const forest=mapImage(base+'art/world-trees-0299.webp'),mountain=mapImage(base+'art/world-mountains-0299.webp'),details=mapImage(base+'art/world-details-0299.webp');
  let sceneryWork=0;if(!cache.pendingCount&&[forest,mountain,details].every(a=>a.complete&&a.naturalWidth)){
   const ctx=buffer.getContext('2d')!;ctx.clearRect(0,0,buffer.width,buffer.height);
   drawWorldScenery(ctx,{seed:g.seed,version:g.terrainVersion??0,nodes:g.nodes,camera:{...q,z:.75},width:buffer.width,height:buffer.height,forest,mountain,details,progressive:true,dpr:Math.min(2,window.devicePixelRatio||1)});sceneryWork=pumpScenery(4);
  }
  if(cache.pendingCount||sceneryWork||![forest,mountain,details].every(a=>a.complete&&a.naturalWidth))timer=setTimeout(work,16);
 };
 timer=setTimeout(work,60);return()=>{stopped=true;clearTimeout(timer);};
}
