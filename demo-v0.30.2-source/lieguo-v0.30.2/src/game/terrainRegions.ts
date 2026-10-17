import atlas from './sceneryAtlas.json';
import mountainMasks from './mountainMasks.json';
// Continuous geography shared by rendering, tile information and travel.
// River membership deliberately matches all previous save versions exactly.
export type Terrain = 'grass' | 'forest' | 'hill' | 'field' | 'water' | 'mountain';
export function hash(x:number,y:number,seed:number){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(a:number,b:number,n:number)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
function noise(x:number,y:number,seed:number){
 const ix=Math.floor(x),iy=Math.floor(y),sx=smooth(0,1,x-ix),sy=smooth(0,1,y-iy);
 const v=(dx:number,dy:number)=>hash(ix+dx,iy+dy,seed)/4294967295;
 return mix(mix(v(0,0),v(1,0),sx),mix(v(0,1),v(1,1),sx),sy);
}
export const riverCenter=(y:number,seed:number)=>126+Math.sin((y+seed%79)/23)*20;
export const isWaterTile=(x:number,y:number,seed:number)=>Math.abs(x-riverCenter(y,seed))<2.7;
// Land cover follows the same hydrology and relief used by the map surface.
export function landWeights(x:number,y:number,seed:number,version=0):[number,number,number,number]{
 const e=terrainEnvironmentAt(x,y,seed,version),forest=e.forest*.95;
 const hill=smooth(11,23,e.uplift)*(1-forest*.72);
 const alluvial=(1-smooth(4,15,e.bank))*(1-smooth(.4,1.3,e.slope));
 const field=Math.max(alluvial*.8,(1-smooth(.32,.53,e.moisture))*.7)*(1-hill)*(1-forest);
 const grass=Math.max(.04,1-forest-hill-field),sum=grass+forest+hill+field;
 return [grass/sum,forest/sum,hill/sum,field/sum];
}
const types:Terrain[]=['grass','forest','hill','field','water','mountain'];
export type MountainAnchor={x:number;y:number;height:number;angle:number};
export type MountainSprite={x:number;y:number;width:number;height:number;variant:number;flip:boolean;level:number};
const clearings=new Map<number,{key:string;points:{x:number;y:number}[]}>();
export const mountainClearingsFor=(seed:number)=>clearings.get(seed)?.points??[];
export const mountainProfileKey=(seed:number)=>clearings.get(seed)?.key??'';
export function setMountainClearings(seed:number,points:{x:number;y:number}[]=[]){
 const key=points.map(p=>p.x+','+p.y).join(';');if(mountainProfileKey(seed)===key)return;
 clearings.set(seed,{key,points});mountainCaches.delete(seed);regionCaches.clear();
}
const mountainCaches=new Map<number,{mask:Uint8Array;anchors:MountainAnchor[];sprites:MountainSprite[]}>();
// The same opaque atlas footprint defines the rendered mountain and blocked tiles.
export function mountainFootprint(d:MountainSprite){
 const px=(d.x-d.y)*20,py=(d.x+d.y)*10,result=new Map<string,{x:number;y:number}>(),rows=mountainMasks[d.variant];
 for(let j=0;j<64;j++)for(let i=0;i<64;i++)if(rows[j][i]==='1'){
  const sx=px+((d.flip?63-i:i)+.5)/64*d.width-d.width/2,sy=py+(j+.5)/64*d.height-d.height*.84;
  const x=Math.round(sx/40+sy/20),y=Math.round(sy/20-sx/40);
  result.set(x+','+y,{x,y});
 }
 return [...result.values()];
}
function mountainGeography(seed:number){
 const old=mountainCaches.get(seed);if(old)return old;
 const mask=new Uint8Array(256*256),anchors:MountainAnchor[]=[];
 // Long, curved ridges are seeded by world, not generated independently in each tile.
 for(let ridge=0;ridge<7;ridge++){
  const startX=24+hash(ridge,81,seed)%202,startY=20+hash(ridge,82,seed)%212;
  const length=16+hash(ridge,83,seed)%22,orientation=hash(ridge,84,seed)%4;
  const dx=[.8,.68,.8,-.55][orientation],dy=[-.6,.72,.6,.84][orientation];
  const bend=(hash(ridge,85,seed)%2?1:-1)*2.4;
  for(let k=0;k<=length;k++){
   const drift=Math.sin(k/length*Math.PI*1.7)*bend;
   const x=startX+dx*k-dy*drift,y=startY+dy*k+dx*drift;
   const height=1+hash(ridge,k+91,seed)%3;
   if(k%4===2&&x>4&&y>4&&x<252&&y<252)anchors.push({x,y,height,angle:Math.atan2((dx+dy)*10,(dx-dy)*20)});

  }
 }
 const sprites:MountainSprite[]=[];
 for(const [index,a] of anchors.entries()){
  if(index%2)continue;
  const n=hash(Math.round(a.x*7),Math.round(a.y*7),seed),variant=n%4,width=205+a.height*39;
  let d:MountainSprite={...a,width,height:width*atlas.mountains[variant].h/atlas.mountains[variant].w,variant,flip:!!(n%2),level:a.height};
  for(let attempt=0;attempt<4;attempt++){
   const footprint=mountainFootprint(d);
   if(footprint.some(p=>p.x<0||p.y<0||p.x>255||p.y>255||watersAt(p.x,p.y,seed))){d={...d,width:d.width*.8,height:d.height*.8};continue;}
   // Preserve old cities and active destinations without moving their contents.
   const protectedPoints=clearings.get(seed)?.points??[];
   if(protectedPoints.some(p=>footprint.some(q=>Math.abs(q.x-p.x)<=1&&Math.abs(q.y-p.y)<=1)))break;
   sprites.push(d);for(const p of footprint)mask[p.y*256+p.x]=Math.max(mask[p.y*256+p.x],a.height);break;
  }
 }
 const result={mask,anchors,sprites};if(mountainCaches.size>=3)mountainCaches.delete(mountainCaches.keys().next().value!);mountainCaches.set(seed,result);return result;
}
export const mountainHeightAt=(x:number,y:number,seed:number,version=0)=>version>=1&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<256&&y<256?mountainGeography(seed).mask[y*256+x]:0;
export const mountainAnchors=(seed:number,version=0):MountainAnchor[]=>version>=1?mountainGeography(seed).anchors:[];
export const mountainSprites=(seed:number,version=0):MountainSprite[]=>version>=1?mountainGeography(seed).sprites:[];
const regionCaches=new Map<string,Uint8Array>();
export function regionalTerrainAt(x:number,y:number,seed:number,version=0):Terrain{
 const index=Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<256&&y>=0&&y<256?y*256+x:-1;
 let cache=regionCaches.get(seed+":"+version);
 if(index>=0&&!cache){if(regionCaches.size>=3)regionCaches.delete(regionCaches.keys().next().value!);cache=new Uint8Array(256*256);regionCaches.set(seed+":"+version,cache);}
 if(index>=0&&cache![index])return types[cache![index]-1];
 let type=4;
 if(!waterAt(x,y,seed,version)){
  if(mountainHeightAt(x,y,seed,version))type=5;
  else{const weights=landWeights(x,y,seed,version);type=weights.indexOf(Math.max(...weights));}
 }
 if(index>=0)cache![index]=type+1;
 return types[type];
}

// Version 1 water geography. Curves and connected irregular lakes are seeded once.
type WaterShape={buckets:Map<string,{x:number;y:number;r:number}[]>;lines:{x:number;y:number;r:number}[];lakes:{x:number;y:number;rx:number;ry:number;phase:number}[]};
const waters=new Map<number,WaterShape>();
export function waterGeography(seed:number):WaterShape{
 const old=waters.get(seed);if(old)return old;
 const rand=(i:number)=>hash(i,7823,seed)/4294967295;
 const turn=hash(11,37,seed)%4,diagonal=rand(2)*.55-.275;
 const transform=(x:number,y:number)=>{x+=(y-128)*diagonal;return turn===0?{x,y}:turn===1?{x:256-y,y:x}:turn===2?{x:256-x,y:256-y}:{x:y,y:256-x};};
 const center=(y:number)=>100+rand(3)*56+Math.sin(y/(28+rand(4)*24)+rand(5)*6.28)*(12+rand(6)*24)+Math.sin(y/17+rand(7)*6.28)*5;
 const shape:WaterShape={buckets:new Map(),lines:[],lakes:[]};
 for(let y=-256;y<=512;y+=1.5)shape.lines.push({...transform(center(y),y),r:2.2+rand(8)*1.3});
 for(let branch=0;branch<2+Math.floor(rand(9)*3);branch++){
  const join=35+rand(20+branch)*180,side=branch%2?-1:1,startX=side<0?-20:276,startY=join-45-rand(30+branch)*80;
  for(let i=0;i<=200;i++){const t=i/200,x=startX+(center(join)-startX)*t,y=startY+(join-startY)*t+Math.sin(t*Math.PI*2+branch)*Math.sin(t*Math.PI)*12;shape.lines.push({...transform(x,y),r:1.1+rand(40+branch)});}
 }
 for(let i=0;i<2+Math.floor(rand(10)*3);i++){const y=28+rand(50+i)*200;shape.lakes.push({...transform(center(y),y),rx:5+rand(60+i)*9,ry:4+rand(70+i)*7,phase:rand(80+i)*6.28});}
 for(const p of shape.lines)for(let x=Math.floor((p.x-p.r)/16);x<=Math.floor((p.x+p.r)/16);x++)for(let y=Math.floor((p.y-p.r)/16);y<=Math.floor((p.y+p.r)/16);y++){const key=x+','+y,list=shape.buckets.get(key)??[];list.push(p);shape.buckets.set(key,list);}
 if(waters.size>=3)waters.delete(waters.keys().next().value!);waters.set(seed,shape);return shape;
}
const waterMasks=new Map<number,Uint8Array>();
function sampleWater(x:number,y:number,shape:WaterShape){
 for(const lake of shape.lakes){const dx=(x-lake.x)/lake.rx,dy=(y-lake.y)/lake.ry,a=Math.atan2(dy,dx);if(dx*dx+dy*dy<(1+.17*Math.sin(a*3+lake.phase)+.1*Math.cos(a*5-lake.phase))**2)return true;}
 return (shape.buckets.get(Math.floor(x/16)+","+Math.floor(y/16))??[]).some(p=>Math.abs(x-p.x)<p.r&&Math.abs(y-p.y)<p.r&&(x-p.x)**2+(y-p.y)**2<p.r*p.r);
}
export function watersAt(x:number,y:number,seed:number){
 const shape=waterGeography(seed);
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=256||y>=256)return sampleWater(x,y,shape);
 let mask=waterMasks.get(seed);
 if(!mask){mask=new Uint8Array(65536);
  // Rasterize only the curve bounds; never scan every curve for every map tile.
  for(const p of shape.lines)for(let yy=Math.max(0,Math.floor(p.y-p.r));yy<=Math.min(255,Math.ceil(p.y+p.r));yy++)for(let xx=Math.max(0,Math.floor(p.x-p.r));xx<=Math.min(255,Math.ceil(p.x+p.r));xx++)if((xx-p.x)**2+(yy-p.y)**2<p.r*p.r)mask[yy*256+xx]=1;
  for(const l of shape.lakes)for(let yy=Math.max(0,Math.floor(l.y-l.ry*1.3));yy<=Math.min(255,Math.ceil(l.y+l.ry*1.3));yy++)for(let xx=Math.max(0,Math.floor(l.x-l.rx*1.3));xx<=Math.min(255,Math.ceil(l.x+l.rx*1.3));xx++){const dx=(xx-l.x)/l.rx,dy=(yy-l.y)/l.ry,a=Math.atan2(dy,dx);if(dx*dx+dy*dy<(1+.17*Math.sin(a*3+l.phase)+.1*Math.cos(a*5-l.phase))**2)mask[yy*256+xx]=1;}
  if(waterMasks.size>=3)waterMasks.delete(waterMasks.keys().next().value!);waterMasks.set(seed,mask);
 }
 return !!mask[y*256+x];
}

export const waterAt=(x:number,y:number,seed:number,version=0)=>version===1?watersAt(x,y,seed):isWaterTile(x,y,seed);
const GEO_MARGIN=32,GEO_SIDE=321;
type ReliefCache={distance:Float32Array;heights:Float32Array};
const reliefCaches=new Map<string,ReliefCache>();
function reliefCache(seed:number,version:number){
 const key=seed+':'+version,old=reliefCaches.get(key);if(old)return old;
 const distance=new Float32Array(GEO_SIDE*GEO_SIDE).fill(32);
 for(let y=0;y<GEO_SIDE;y++)for(let x=0;x<GEO_SIDE;x++)if(waterAt(x-GEO_MARGIN,y-GEO_MARGIN,seed,version))distance[y*GEO_SIDE+x]=0;
 // Two-pass distance field keeps riverbanks continuous and makes drawing cheap.
 for(let y=0;y<GEO_SIDE;y++)for(let x=0;x<GEO_SIDE;x++){const i=y*GEO_SIDE+x;distance[i]=Math.min(distance[i],x?distance[i-1]+1:32,y?distance[i-GEO_SIDE]+1:32,x&&y?distance[i-GEO_SIDE-1]+Math.SQRT2:32,y&&x<GEO_SIDE-1?distance[i-GEO_SIDE+1]+Math.SQRT2:32);}
 for(let y=GEO_SIDE-1;y>=0;y--)for(let x=GEO_SIDE-1;x>=0;x--){const i=y*GEO_SIDE+x;distance[i]=Math.min(distance[i],x<GEO_SIDE-1?distance[i+1]+1:32,y<GEO_SIDE-1?distance[i+GEO_SIDE]+1:32,x<GEO_SIDE-1&&y<GEO_SIDE-1?distance[i+GEO_SIDE+1]+Math.SQRT2:32,x&&y<GEO_SIDE-1?distance[i+GEO_SIDE-1]+Math.SQRT2:32);}
 const heights=new Float32Array(641*641).fill(NaN),cache={distance,heights};
 if(reliefCaches.size>=3)reliefCaches.delete(reliefCaches.keys().next().value!);reliefCaches.set(key,cache);return cache;
}
export function riverBankDistance(x:number,y:number,seed:number,version=0){
 if(x>=-32&&y>=-32&&x<288&&y<288){const d=reliefCache(seed,version).distance,xx=x+32,yy=y+32,ix=Math.floor(xx),iy=Math.floor(yy),i=iy*GEO_SIDE+ix;return mix(mix(d[i],d[i+1],xx-ix),mix(d[i+GEO_SIDE],d[i+GEO_SIDE+1],xx-ix),yy-iy);}
 if(version!==1)return Math.min(32,Math.max(0,Math.abs(x-riverCenter(y,seed))-2.7));
 const shape=waterGeography(seed);let distance=32;
 for(let bx=Math.floor(x/16)-2;bx<=Math.floor(x/16)+2;bx++)for(let by=Math.floor(y/16)-2;by<=Math.floor(y/16)+2;by++)for(const p of shape.buckets.get(bx+','+by)??[])distance=Math.min(distance,Math.max(0,Math.hypot(x-p.x,y-p.y)-p.r));
 for(const l of shape.lakes)distance=Math.min(distance,Math.max(0,(Math.hypot((x-l.x)/l.rx,(y-l.y)/l.ry)-1.2)*Math.min(l.rx,l.ry)));
 return distance;
}
// Downstream coordinate is shared by the main river and its tributaries.
export function downstreamCoordinate(x:number,y:number,seed:number,version=0){const turn=version===1?hash(11,37,seed)%4:0;return turn===0?y:turn===1?256-x:turn===2?256-y:x;}
const lakeBands=new Map<number,[number,number][]>();
export function waterSurfaceHeight(x:number,y:number,seed:number,version=0){
 let t=downstreamCoordinate(x,y,seed,version);
 if(version===1){let bands=lakeBands.get(seed);
  if(!bands){const turn=hash(11,37,seed)%4,raw=waterGeography(seed).lakes.map(l=>{const v=downstreamCoordinate(l.x,l.y,seed,1),r=(turn%2?l.rx:l.ry)*1.3;return [v-r,v+r] as [number,number];}).sort((a,b)=>a[0]-b[0]);bands=[];
   for(const range of raw){const last=bands.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else bands.push([...range]);}
   if(lakeBands.size>=3)lakeBands.delete(lakeBands.keys().next().value!);lakeBands.set(seed,bands);
  }
  // Lakes are level; intervening reaches remain continuous and downhill.
  const mid=(b:[number,number])=>(b[0]+b[1])/2;
  const inside=bands.find(b=>t>=b[0]&&t<=b[1]);
  if(inside)t=mid(inside);else{const prev=bands.filter(b=>b[1]<t).at(-1),next=bands.find(b=>b[0]>t);if(prev&&next)t=mix(mid(prev),mid(next),(t-prev[1])/(next[0]-prev[1]));else if(next)t+=mid(next)-next[0];else if(prev)t-=prev[1]-mid(prev);}
 }
 return 11-8*Math.max(-1,Math.min(2,t/256));
}
export function terrainHeightAt(x:number,y:number,seed:number,version=0):number{
 const xx=(x+32)*2,yy=(y+32)*2,index=Number.isInteger(xx)&&Number.isInteger(yy)&&xx>=0&&yy>=0&&xx<641&&yy<641?yy*641+xx:-1,cache=index>=0?reliefCache(seed,version):undefined;
 if(cache&&!Number.isNaN(cache.heights[index]))return cache.heights[index];
 const bank=riverBankDistance(x,y,seed,version),ridge=noise(x/38,y/29,seed^4319)*.83+noise(x/13,y/11,seed^1921)*.17;
 const height=waterSurfaceHeight(x,y,seed,version)+smooth(0,19,bank)*(3+29*smooth(.29,.82,ridge));
 if(cache){cache.heights[index]=height;return cache.heights[index];}return height;
}
export type TerrainEnvironment={height:number;uplift:number;bank:number;moisture:number;forest:number;slope:number;shade:number;band:'lowland'|'plain'|'hill'|'highland'};
export function terrainEnvironmentAt(x:number,y:number,seed:number,version=0):TerrainEnvironment{
 const bank=riverBankDistance(x,y,seed,version),height=terrainHeightAt(x,y,seed,version),uplift=height-waterSurfaceHeight(x,y,seed,version);
 const dx=(terrainHeightAt(x+1,y,seed,version)-terrainHeightAt(x-1,y,seed,version))/2,dy=(terrainHeightAt(x,y+1,seed,version)-terrainHeightAt(x,y-1,seed,version))/2,slope=Math.hypot(dx,dy);
 const moisture=Math.min(1,noise(x/31,y/27,seed^8123)*.78+(1-smooth(4,28,bank))*.15+noise(x/11,y/13,seed^4412)*.1);
 const forest=smooth(.4,.68,moisture)*(1-smooth(20,31,uplift)*.76)*(1-smooth(1.4,3.5,slope))*(.14+.86*smooth(1,7,bank));
 return {height,uplift,bank,moisture,forest,slope,shade:Math.max(-.15,Math.min(.15,(dx-dy)*.07)),band:uplift<3?'lowland':uplift<12?'plain':uplift<23?'hill':'highland'};
}
