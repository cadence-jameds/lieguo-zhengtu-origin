import {isWaterTile,landWeights,riverCenter} from './terrainRegions';
export type GroundTexture={data:Uint8ClampedArray;width:number;height:number};
const colors=[[112,132,73],[48,82,48],[138,136,113],[164,157,91],[69,123,139]];
const mirror=(n:number,size:number)=>{const p=((Math.floor(n)%(size*2))+size*2)%(size*2);return p<size?p:size*2-p-1;};
// Pure raster: world coordinates, not tile/chunk-local crops. Adjacent chunks
// sample the same continuous surface, including at each quality level.
export function terrainPixel(x:number,y:number,seed:number,texture?:GroundTexture,land?:number[]):[number,number,number]{
 const water=isWaterTile(Math.round(x),Math.round(y),seed);
 const weights=water?[0,0,0,0,1]:land??[...landWeights(x,y,seed),0];
 const rgb=[0,0,0],cell=texture?texture.width/3:0;
 const tx=texture?mirror(x*7,cell):0,ty=texture?mirror(y*7,cell):0;
 for(let t=0;t<5;t++){
  const weight=weights[t];if(weight<.001)continue;
  const offset=texture?((Math.floor(t/3)*cell+ty)*texture.width+(t%3)*cell+tx)*4:0;
  for(let k=0;k<3;k++)rgb[k]+=weight*(texture?colors[t][k]*.58+texture.data[offset+k]*.42:colors[t][k]);
 }
 // A narrow shore tint stays inside the exact established water tiles.
 if(water){const edge=Math.min(1,Math.max(0,(Math.abs(x-riverCenter(y,seed))-1.7)/1.2));for(let k=0;k<3;k++)rgb[k]=rgb[k]*(1-edge*.22)+[171,177,135][k]*edge*.22;}
 return rgb as [number,number,number];
}
export function rasterGround(chunkX:number,chunkY:number,seed:number,step:number,texture?:GroundTexture){
 const width=704/step,height=384/step,data=new Uint8ClampedArray(width*height*4);
 // Compute region weights once per world tile; pixels interpolate the same
 // global lattice across chunk boundaries. Avoid rerunning noise per pixel.
 const span=42,grid=new Float32Array(span*span*4),weights=[0,0,0,0,0];
 for(let j=0;j<span;j++)for(let i=0;i<span;i++)grid.set(landWeights(chunkX+i-13,chunkY+j-13,seed),(j*span+i)*4);
 for(let py=0;py<height;py++)for(let px=0;px<width;px++){
  const sx=(px+.5)*step-352,sy=(py+.5)*step-64,x=chunkX+sx/40+sy/20,y=chunkY+sy/20-sx/40;
  if(x<chunkX-1||x>chunkX+16||y<chunkY-1||y>chunkY+16)continue;
  const gx=x-chunkX+13,gy=y-chunkY+13,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,base=(iy*span+ix)*4;
  for(let k=0;k<4;k++)weights[k]=(grid[base+k]*(1-fx)+grid[base+4+k]*fx)*(1-fy)+(grid[base+span*4+k]*(1-fx)+grid[base+span*4+4+k]*fx)*fy;
  const rgb=terrainPixel(x,y,seed,texture,weights),i=(py*width+px)*4;
  data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255;
 }
 return {width,height,data};
}
