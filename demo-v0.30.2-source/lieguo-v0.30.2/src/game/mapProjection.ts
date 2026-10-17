import type {Point} from './types';
export const flatProject=(p:Point)=>({x:(p.x-p.y)*20,y:(p.x+p.y)*10});
export const flatInverse=(x:number,y:number)=>({x:x/40+y/20,y:y/20-x/40});
// Ecological elevation affects terrain distribution and shading, never screen coordinates.
export const mapProject=(p:Point,_seed?:number,_version?:number)=>flatProject(p);
export const mapInverse=(x:number,y:number,_seed?:number,_version?:number)=>flatInverse(x,y);
// Grid, ownership fills and selection share the original flat diamond vertices.
export const tileCorners=(p:Point)=>[{x:p.x-.5,y:p.y-.5},{x:p.x+.5,y:p.y-.5},{x:p.x+.5,y:p.y+.5},{x:p.x-.5,y:p.y+.5}];
export function traceTile(ctx:CanvasRenderingContext2D,p:Point,project:(p:Point)=>Point){
 ctx.beginPath();tileCorners(p).forEach((v,i)=>{const q=project(v);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();
}
export const mapGlyphSize=(city:boolean,zoom:number)=>Math.max(13,Math.min(17,zoom*19))*(city?1:.85);
