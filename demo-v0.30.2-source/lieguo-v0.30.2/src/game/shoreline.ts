import {waterAt} from './terrainRegions';
import {coverNoise} from './landCover';
import type {Point} from './types';

// Sub-cell contours retain seeded river membership but break the straight
// stair-step outlines with the same small shoreline variation as the shader.
export function shoreSegments(x:number,y:number,seed:number,version:number){
 const a=+waterAt(x,y,seed,version),b=+waterAt(x+1,y,seed,version),d=+waterAt(x,y+1,seed,version),e=+waterAt(x+1,y+1,seed,version);
 if(a===b&&a===d&&a===e)return [];
 const field=(fx:number,fy:number)=>((a*(1-fx)+b*fx)*(1-fy)+(d*(1-fx)+e*fx)*fy)+(coverNoise((x+fx)*2,(y+fy)*2,seed^9918)-.5)*.22;
 const segments:[Point,Point][]=[];
 for(let j=0;j<4;j++)for(let i=0;i<4;i++){
  const p=[{x:i/4,y:j/4},{x:(i+1)/4,y:j/4},{x:(i+1)/4,y:(j+1)/4},{x:i/4,y:(j+1)/4}],v=p.map(q=>field(q.x,q.y)),crossings:Point[]=[];
  for(let k=0;k<4;k++){const n=(k+1)%4;if((v[k]>.5)===(v[n]>.5))continue;const t=(.5-v[k])/(v[n]-v[k]);crossings.push({x:x+p[k].x+(p[n].x-p[k].x)*t,y:y+p[k].y+(p[n].y-p[k].y)*t});}
  for(let k=0;k+1<crossings.length;k+=2)segments.push([crossings[k],crossings[k+1]]);
 }
 return segments;
}
function shorelineWet(p:Point,seed:number,version:number){
 const x=Math.floor(p.x),y=Math.floor(p.y),fx=p.x-x,fy=p.y-y;
 return (+waterAt(x,y,seed,version)*(1-fx)+ +waterAt(x+1,y,seed,version)*fx)*(1-fy)+(+waterAt(x,y+1,seed,version)*(1-fx)+ +waterAt(x+1,y+1,seed,version)*fx)*fy;
}
export function drawShoreline(c:CanvasRenderingContext2D,cx:number,cy:number,seed:number,version:number,project:(p:Point)=>Point,bankArt?:CanvasImageSource){
 if(!bankArt)return;
 c.save();c.imageSmoothingEnabled=true;
 for(let y=cy-2;y<=cy+17;y++)for(let x=cx-2;x<=cx+17;x++){
  for(const [a,b] of shoreSegments(x,y,seed,version)){
   let p=project(a),q=project(b),dx=q.x-p.x,dy=q.y-p.y;const length=Math.hypot(dx,dy);if(length<.01)continue;
   const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2},nx=-dy/length,ny=dx/length;
   const into={x:midpoint.x+nx/40+ny/20,y:midpoint.y+ny/20-nx/40};
   if(shorelineWet(into,seed,version)<shorelineWet(midpoint,seed,version)){[p,q]=[q,p];dx=-dx;dy=-dy;}
   // Literal grass, earth and rock pixels from the approved reference. Seeded
   // world-space coordinates make adjacent chunks use identical samples.
   const horizontal=Math.abs(dx)>Math.abs(dy),axis=(v:Point)=>horizontal?(v.x-v.y)*20:(v.x+v.y)*10;
   const phase=Math.min(axis(a),axis(b))*2.5+seed;
   const u=((phase%180)+180)%180,sw=Math.min(29,Math.abs(axis(b)-axis(a))*2.5+.5);
   const height=6+coverNoise(midpoint.x*.7,midpoint.y*.7,seed^711)*2;
   c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(dy,dx));
   if((horizontal?dx:dy)<0){c.translate(length,0);c.scale(-1,1);}
   c.drawImage(bankArt,u,0,sw,12,-.25,-height*.75+.4,length+.5,height);
   c.restore();
  }
 }
 c.restore();
}
