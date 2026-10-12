import {sceneryRasterScale} from './mapDisplay';
import {mountainProfileKey} from './terrainRegions';
import bounds from './sceneryAtlas.json';
import {flatInverse,flatProject} from './mapProjection';
import {decorationsAt,ridgeDecorations,sceneryNodeVisible,sceneryNodeKey,type SceneryNode,type Decoration} from './sceneryPlacement';

type Camera={x:number;y:number;z:number};
type Atlas=CanvasImageSource&{width:number;height:number};
type Scene={seed:number;version:number;nodes:SceneryNode[];camera:Camera;width:number;height:number;forest:Atlas;mountain:Atlas;details:Atlas;progressive?:boolean;dpr?:number;gesturing?:boolean};
function renderScenery(ctx:CanvasRenderingContext2D,s:Scene){
 const {seed,version,camera:c,width:w,height:h}=s;
 const project=(p:{x:number;y:number})=>{const q=flatProject(p);return {x:(q.x-c.x)*c.z+w/2,y:(q.y-c.y)*c.z+h/2};};
 const corners=[flatInverse(c.x-w/2/c.z,c.y-h/2/c.z),flatInverse(c.x+w/2/c.z,c.y-h/2/c.z),flatInverse(c.x-w/2/c.z,c.y+h/2/c.z),flatInverse(c.x+w/2/c.z,c.y+h/2/c.z)];
 const minX=Math.max(-50,Math.floor((Math.min(...corners.map(p=>p.x))-12)/2)*2),maxX=Math.min(305,Math.max(...corners.map(p=>p.x))+12);
 const minY=Math.max(-50,Math.floor((Math.min(...corners.map(p=>p.y))-12)/2)*2),maxY=Math.min(305,Math.max(...corners.map(p=>p.y))+12);
 const items:Decoration[]=[];
 for(let x=minX;x<=maxX;x+=2)for(let y=minY;y<=maxY;y+=2)items.push(...decorationsAt(x,y,seed,version));
 items.push(...ridgeDecorations(seed,version));
 const layer=ctx;layer.clearRect(0,0,w,h);layer.imageSmoothingEnabled=true;
 layer.save();layer.beginPath();
 [{x:-50.5,y:-50.5},{x:305.5,y:-50.5},{x:305.5,y:305.5},{x:-50.5,y:305.5}].forEach((p,i)=>{const q=project(p);if(i)layer.lineTo(q.x,q.y);else layer.moveTo(q.x,q.y);});layer.closePath();layer.clip();
 items.sort((a,b)=>+(a.kind!=='detail')-+(b.kind!=='detail')||(a.x+a.y)-(b.x+b.y));
 for(const item of items){
  if(c.z<=.25&&item.kind==='detail')continue;
  const p=project(item),width=item.width*c.z,height=item.height*c.z;
  if(p.x+width/2<0||p.x-width/2>w||p.y+height*.16<0||p.y-height*.84>h)continue;
  const atlas=item.kind==='mountain'?s.mountain:item.kind==='tree'?s.forest:s.details,rect=(item.kind==='mountain'?bounds.mountains:item.kind==='tree'?bounds.trees:bounds.ground)[item.variant];
  layer.save();layer.translate(p.x,p.y);layer.scale(item.flip?-1:1,1);if(item.kind==='detail')layer.globalAlpha=.38;
  layer.drawImage(atlas,rect.x,rect.y,rect.w,rect.h,-width/2,-height*.84,width,height);layer.restore();
 }
 // Only city clearings remain. Wild resource lifecycle never changes scenery.
 layer.globalCompositeOperation='destination-out';
 for(const n of s.nodes){if(!['capital','village'].includes(n.kind)||!sceneryNodeVisible(n,c.z))continue;const p=project(n),city=true,size=17*c.z;
  if(p.x<-80||p.x>w+80||p.y<-80||p.y>h+80)continue;
  layer.save();layer.translate(p.x,p.y-size*.7);layer.scale(size*(city?2.6:2.15),size*(city?2.4:2.6));
  const mask=layer.createRadialGradient(0,0,.72,0,0,1);mask.addColorStop(0,'#000');mask.addColorStop(1,'#0000');layer.fillStyle=mask;layer.fillRect(-1,-1,2,2);layer.restore();
 }
 layer.globalCompositeOperation='source-over';layer.restore();
}

// World-space tiles survive pan/zoom and page remounts; depth sorting and atlas
// draws are paid once per tile and LOD. Memory remains bounded at 48 MiB.
const budget=48*1024*1024;
type Tile={image:HTMLCanvasElement;wx:number;wy:number;width:number;height:number;scale:number};
const cache=new Map<string,Tile>(),pending=new Map<string,()=>void>();let bytes=0;
const tileSize=(scale:number)=>({width:512/Math.max(1,scale),height:256/Math.max(1,scale)});
export let sceneryRevision=0;
export function resetSceneryRequests(){pending.clear();}
export function pumpScenery(maxMs=4){const start=performance.now();let count=0;for(const [key,render] of pending){if(count>=3||(count&&performance.now()-start>=maxMs))break;pending.delete(key);render();count++;}return count;}
export function drawWorldScenery(ctx:CanvasRenderingContext2D,s:Scene){
 const c=s.camera,scale=sceneryRasterScale(c.z,s.dpr??1,s.gesturing),size=tileSize(scale),tileWidth=size.width,tileHeight=size.height;
 const prefix=[s.seed,s.version,mountainProfileKey(s.seed),sceneryNodeKey(s.nodes)].join(':');
 const left=c.x-s.width/2/c.z,right=c.x+s.width/2/c.z,top=c.y-s.height/2/c.z,bottom=c.y+s.height/2/c.z;
 for(let y=Math.floor(top/tileHeight);y<=Math.floor(bottom/tileHeight);y++)for(let x=Math.floor(left/tileWidth);x<=Math.floor(right/tileWidth);x++){
  const wx=x*tileWidth,wy=y*tileHeight;
  if(wx>7120||wx+tileWidth< -7120||wy>6110||wy+tileHeight< -1010)continue;
  const key=prefix+':'+x+','+y+':'+scale;
  const render=()=>{
   const canvas=document.createElement('canvas');canvas.width=tileWidth*scale+4;canvas.height=tileHeight*scale+4;
   renderScenery(canvas.getContext('2d')!,{...s,camera:{x:wx+tileWidth/2,y:wy+tileHeight/2,z:scale},width:canvas.width,height:canvas.height});
   const cost=canvas.width*canvas.height*4;
   while(bytes+cost>budget&&cache.size){const first=cache.keys().next().value!,old=cache.get(first)!;bytes-=old.image.width*old.image.height*4;cache.delete(first);}
   cache.set(key,{image:canvas,wx,wy,width:tileWidth,height:tileHeight,scale});bytes+=cost;sceneryRevision++;
  };
  let tile=cache.get(key);
  if(!tile){if(s.progressive){pending.set(key,render);for(const tier of [4,2,1,.5,.25]){const ts=tileSize(tier);if(tier===scale||ts.width<tileWidth)continue;tile=cache.get(prefix+':'+Math.floor(wx/ts.width)+','+Math.floor(wy/ts.height)+':'+tier);if(tile)break;}}else{render();tile=cache.get(key);}}
  else{cache.delete(key);cache.set(key,tile);}
  if(tile){ctx.save();ctx.beginPath();ctx.rect((wx-c.x)*c.z+s.width/2-.15,(wy-c.y)*c.z+s.height/2-.15,tileWidth*c.z+.3,tileHeight*c.z+.3);ctx.clip();const pad=2/tile.scale;ctx.drawImage(tile.image,(tile.wx-pad-c.x)*c.z+s.width/2,(tile.wy-pad-c.y)*c.z+s.height/2,(tile.width+pad*2)*c.z,(tile.height+pad*2)*c.z);ctx.restore();}
 }
}
export const sceneryCacheStats=()=>({tiles:cache.size,bytes,pending:pending.size});
