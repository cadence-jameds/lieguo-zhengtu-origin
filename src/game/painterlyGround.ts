import {landCoverWeights,coverNoise} from './landCover';
import {hash,terrainEnvironmentAt,mountainHeightAt,waterAt,mountainProfileKey} from './terrainRegions';
import type {GroundTexture} from './terrainRaster';

let sampleKey='';
const SIDE=448,OFFSET=80;
const samples=new Float32Array(SIDE*SIDE*4).fill(NaN);
// Sample a continuous, world-anchored surface. Chunk and grid boundaries do
// not alter the colors, texture origin, or river shoreline.
export function painterlyGround(cx:number,cy:number,seed:number,version:number,scale:number,texture?:GroundTexture){
 const width=Math.round(704*scale),height=Math.round(384*scale),data=new Uint8ClampedArray(width*height*4);
 const profile=seed+':'+version+':'+mountainProfileKey(seed);if(sampleKey!==profile){samples.fill(NaN);sampleKey=profile;}
 const span=44,startX=cx-14,startY=cy-14,grid=new Float32Array(span*span*4);
 for(let y=0;y<span;y++)for(let x=0;x<span;x++){
  const wx=startX+x,wy=startY+y,i=(y*span+x)*4,at=((wy+OFFSET)*SIDE+wx+OFFSET)*4;
  const cached=wx>=-OFFSET&&wy>=-OFFSET&&wx<SIDE-OFFSET&&wy<SIDE-OFFSET;
  if(cached&&!Number.isNaN(samples[at])){grid.set(samples.subarray(at,at+4),i);continue;}
  const w=landCoverWeights(wx,wy,seed,version),e=terrainEnvironmentAt(wx,wy,seed,version),mountain=mountainHeightAt(wx,wy,seed,version);
  for(let k=0;k<3;k++){const base=w[0]*[181,190,132][k]+w[1]*[179,166,117][k]+w[2]*[160,161,139][k];const shade=e.forest*.16;grid[i+k]=base*(1-shade)+[106,136,91][k]*shade;if(mountain)grid[i+k]=grid[i+k]*.78+[142,146,118][k]*.22;}
  grid[i+3]=waterAt(wx,wy,seed,version)?1:0;
  if(cached)samples.set(grid.subarray(i,i+4),at);
 }
 const mirror=(v:number,s:number)=>{const n=((Math.floor(v)%(s*2))+s*2)%(s*2);return n<s?n:s*2-n-1;};
 for(let py=0;py<height;py++)for(let px=0;px<width;px++){
  const sx=(px+.5)/scale-352,sy=(py+.5)/scale-64,x=cx+sx/40+sy/20,y=cy+sy/20-sx/40;
  const gx=x-startX,gy=y-startY,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
  if(ix<0||iy<0||ix>=span-1||iy>=span-1)continue;
  const base=(iy*span+ix)*4,out=(py*width+px)*4;
  const value=(k:number)=>(grid[base+k]*(1-fx)+grid[base+4+k]*fx)*(1-fy)+(grid[base+span*4+k]*(1-fx)+grid[base+span*4+4+k]*fx)*fy;
  const rawWet=value(3),wet=rawWet>0&&rawWet<1?rawWet+(coverNoise(x*2,y*2,seed^9918)-.5)*.22:rawWet,water=Math.max(0,Math.min(1,(wet-.48)*20));
  const rough=coverNoise(x*2,y*2,seed^7721),bank=Math.max(0,1-Math.abs(wet-.37)/( .28+rough*.18));
  const edge=Math.max(0,1-Math.abs(wet-.51)*35),foam=Math.max(0,1-Math.abs(wet-.59)*24)*Math.max(0,(rough-.45)*1.2);
  const grain=(hash(Math.floor(x*19),Math.floor(y*19),seed)%101-50)*.035;
  let mottling=0,waterTexture=0;
  if(texture){const size=texture.width/3,at=(mirror(y*17,size)*texture.width+mirror(x*17,size))*4;mottling=(texture.data[at]*.3+texture.data[at+1]*.6+texture.data[at+2]*.1-108)*.14;const wave=((size+mirror((x+y)*26,size))*texture.width+size+mirror((x-y)*26,size))*4;waterTexture=(texture.data[wave]*.3+texture.data[wave+1]*.6+texture.data[wave+2]*.1-105)*.62;}
  const ripple=Math.sin((x-y)*14+(x+y)*19)*1.7+grain+waterTexture;
  for(let k=0;k<3;k++){
   const land=value(k)+mottling+grain;
   const shore=land*(1-bank*.25)+([147,139,101][k]+rough*32)*bank*.25;
   const river=([43,109,137][k]+ripple)*(1-foam*.34)+[155,181,168][k]*foam*.34;
   const color=shore*(1-water)+river*water;
   data[out+k]=color*(1-edge*.12)+[65,84,69][k]*edge*.12;
  }
  data[out+3]=255;
 }
 return {width,height,data};
}
