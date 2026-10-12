import type {FormalWorld,TerrainClass} from '../formal/model';
import {terrainAt,seedHash} from '../formal/terrain';
import {project,inverse,type Point} from './mapGeometry';
import atlas from '../sceneryAtlas.json';
import {mountainAt,mountainFootprint} from '../formal/mountains';
import {overviewGeometry} from './mapViewRules';
export type Texture={width:number;height:number;data:Uint8ClampedArray};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function noise(x:number,y:number,seed:number){const a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),n=(x:number,y:number)=>(seedHash(seed,x,y,129)%65536)/65535;return (n(a,b)*(1-u)+n(a+1,b)*u)*(1-v)+(n(a,b+1)*(1-u)+n(a+1,b+1)*u)*v;}
export const terrainSample=(w:FormalWorld,x:number,y:number):TerrainClass=>terrainAt(w,clamp(Math.round(x),0,w.dimensions.width-1),clamp(Math.round(y),0,w.dimensions.height-1))!;
const wet=(t:TerrainClass)=>t==='water'||t==='river';
export function wetSurface(w:FormalWorld,x:number,y:number){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;return (+wet(terrainSample(w,ix,iy))*(1-fx)+ +wet(terrainSample(w,ix+1,iy))*fx)*(1-fy)+(+wet(terrainSample(w,ix,iy+1))*(1-fx)+ +wet(terrainSample(w,ix+1,iy+1))*fx)*fy;}
const color=(w:FormalWorld,x:number,y:number)=>{const t=terrainSample(w,x,y),biome=noise(x*.065,y*.065,w.seed^763),base=biome<.42?[181,190,132]:biome>.65?[160,161,139]:[179,166,117];return base.map((v,k)=>t==='forest'?v*.88+[106,136,91][k]*.12:t==='mountain'?v*.78+[142,146,118][k]*.22:v);};
/** DEMO-style inexpensive overview is available on the first frame. The worker
 * refines it later; this raster reads only Formal terrain, never legacy ecology. */
export function paintTerrainOverview(w:FormalWorld){
 const geometry=overviewGeometry(w),scale=.025,width=Math.round(geometry.width*scale),height=Math.round(geometry.height*scale),data=new Uint8ClampedArray(width*height*4),covers=new Map<string,number[]>();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=inverse(geometry.origin.x+(x+.5)/scale,geometry.origin.y+(y+.5)/scale),ix=Math.round(p.x),iy=Math.round(p.y),t=terrainSample(w,ix,iy),key=Math.floor(ix/4)+','+Math.floor(iy/4);
  let cover=covers.get(key);if(!cover){cover=color(w,Math.floor(ix/4)*4,Math.floor(iy/4)*4);covers.set(key,cover);}
  const tint=seedHash(w.seed,ix,iy)%9-4,at=(y*width+x)*4;
  for(let k=0;k<3;k++)data[at+k]=wet(t)?[43,111,143][k]:t==='mountain'?[142,146,118][k]+tint:cover[k]+tint;
  data[at+3]=255;
 }
 return {width,height,data};
}
/** Adaptation of DEMO painterlyGround: same continuous palette, texture grain,
 * wet interpolation and shoreline shader. Membership comes only from Formal terrain. */
export function paintSurface(w:FormalWorld,origin:Point,width:number,height:number,scale:number,texture?:Texture){
 const rw=Math.max(1,Math.round(width*scale)),rh=Math.max(1,Math.round(height*scale)),data=new Uint8ClampedArray(rw*rh*4),cache=new Map<string,number[]>();
 const sample=(x:number,y:number)=>{const key=x+','+y;let c=cache.get(key);if(!c){c=color(w,x,y);cache.set(key,c);}return c;};
 const mirror=(v:number,s:number)=>{const n=((Math.floor(v)%(s*2))+s*2)%(s*2);return n<s?n:s*2-n-1;};
 for(let py=0;py<rh;py++)for(let px=0;px<rw;px++){
  const p=inverse(origin.x+(px+.5)/scale,origin.y+(py+.5)/scale),x=Math.floor(p.x),y=Math.floor(p.y),fx=p.x-x,fy=p.y-y,a=sample(x,y),b=sample(x+1,y),c=sample(x,y+1),d=sample(x+1,y+1),raw=wetSurface(w,p.x,p.y),rough=noise(p.x*2,p.y*2,w.seed^7721),v=raw>0&&raw<1?raw+(noise(p.x*2,p.y*2,w.seed^9918)-.5)*.22:raw,water=clamp((v-.48)*20),bank=Math.max(0,1-Math.abs(v-.37)/(.28+rough*.18)),edge=Math.max(0,1-Math.abs(v-.51)*35),foam=Math.max(0,1-Math.abs(v-.59)*24)*Math.max(0,(rough-.45)*1.2),grain=(seedHash(w.seed,Math.floor(p.x*19),Math.floor(p.y*19),138)%101-50)*.035;
  let mottling=0,wave=0;if(texture){const size=texture.width/3,at=(mirror(p.y*17,size)*texture.width+mirror(p.x*17,size))*4,wa=((size+mirror((p.x+p.y)*26,size))*texture.width+size+mirror((p.x-p.y)*26,size))*4;mottling=(texture.data[at]*.3+texture.data[at+1]*.6+texture.data[at+2]*.1-108)*.14;wave=(texture.data[wa]*.3+texture.data[wa+1]*.6+texture.data[wa+2]*.1-105)*.62;}
  const ripple=Math.sin((p.x-p.y)*14+(p.x+p.y)*19)*1.7+grain+wave,at=(py*rw+px)*4;
  for(let k=0;k<3;k++){const land=(a[k]*(1-fx)+b[k]*fx)*(1-fy)+(c[k]*(1-fx)+d[k]*fx)*fy+mottling+grain,shore=land*(1-bank*.25)+([147,139,101][k]+rough*32)*bank*.25,river=([43,109,137][k]+ripple)*(1-foam*.34)+[155,181,168][k]*foam*.34,co=shore*(1-water)+river*water;data[at+k]=co*(1-edge*.12)+[65,84,69][k]*edge*.12;}data[at+3]=255;
 }
 return {width:rw,height:rh,data};
}
export function shoreSegments(w:FormalWorld,x:number,y:number){
 const a=+wet(terrainSample(w,x,y)),b=+wet(terrainSample(w,x+1,y)),c=+wet(terrainSample(w,x,y+1)),d=+wet(terrainSample(w,x+1,y+1));if(a===b&&a===c&&a===d)return [];
 const field=(fx:number,fy:number)=>((a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy)+(noise((x+fx)*2,(y+fy)*2,w.seed^9918)-.5)*.22,result:[Point,Point][]=[];
 for(let j=0;j<4;j++)for(let i=0;i<4;i++){const ps=[{x:i/4,y:j/4},{x:(i+1)/4,y:j/4},{x:(i+1)/4,y:(j+1)/4},{x:i/4,y:(j+1)/4}],vs=ps.map(p=>field(p.x,p.y)),cross:Point[]=[];for(let k=0;k<4;k++){const n=(k+1)%4;if((vs[k]>.5)===(vs[n]>.5))continue;const t=(.5-vs[k])/(vs[n]-vs[k]);cross.push({x:x+ps[k].x+(ps[n].x-ps[k].x)*t,y:y+ps[k].y+(ps[n].y-ps[k].y)*t});}for(let k=0;k+1<cross.length;k+=2)result.push([cross[k],cross[k+1]]);}return result;
}
export type Decoration=Point&{kind:'tree'|'mountain'|'detail';variant:number;width:number;height:number;flip:boolean};
/** Same atlas sizes/variety as DEMO. A sampled forest cell holds at most one tree;
 * Formal mountain anchors drive sparse, large overlapping ridge sprites.
 * The complete footprint is Formal blocked terrain, not a visual-only overlay. */
export function decorations(w:FormalWorld,x:number,y:number):Decoration[]{
 const t=terrainAt(w,x,y);if(!t||wet(t))return [];const n=seedHash(w.seed,x,y,107),out:Decoration[]=[];
 const add=(kind:Exclude<Decoration['kind'],'mountain'>,variant:number,width:number,px=x,py=y)=>{const b=(kind==='tree'?atlas.trees:atlas.ground)[variant];let item={x:px,y:py,kind,variant,width,height:width*b.h/b.w*(kind==='detail'?.62:1),flip:!!(n%2)};
  for(let k=0;k<4;k++){const p=project(item),samples=[inverse(p.x-width/2,p.y),inverse(p.x+width/2,p.y),{x:item.x,y:item.y}];if(samples.every(p=>!wet(terrainSample(w,p.x,p.y)))){out.push(item);return;}width*=.78;item={...item,width,height:item.height*.78};}
 };
 // DEMO samples ecology every two cells, with one 14–61px tree at most.
 const cluster=noise(x*.06,y*.06,w.seed^7351),treeChance=t==='forest'?(cluster>.47?65:12):cluster>.62?9:3;
 if((t==='forest'||t==='land')&&n%100<treeChance){const group=(n>>>7)%10,v=group<(t==='forest'?4:7)?(n>>>3)%4:group<8?4+(n>>>3)%4:8+(n>>>3)%8,width=v<4?14+(n>>>20)%13:v<8?28+(n>>>20)%17:43+(n>>>20)%19;add('tree',v,width,x+((n>>>8)%101/100-.5)*1.7,y+((n>>>16)%101/100-.5)*1.7);}
 const mountain=mountainAt(w,x,y);if(mountain)out.push({...mountain,kind:'mountain'});
 if(t!=='mountain'&&(n>>>5)%100<(t==='forest'?10:19))add('detail',(n>>>13)%16,48+(n>>>21)%44,x-.4,y+.3);
 return out;
}
export const INITIAL_ZOOM=.75,MAX_ZOOM=2,MIN_ZOOM=.12;
export const overviewZoom=(w:FormalWorld,width:number,height:number)=>Math.max(.005,Math.min((width-40)/(20*(w.dimensions.width+w.dimensions.height)),(height-40)/(10*(w.dimensions.width+w.dimensions.height))));
/** The same durable footprint is used by terrain, routing, settlement and art. */
export function mountainVisualCells(_w:FormalWorld,d:Decoration){return mountainFootprint(d);}
