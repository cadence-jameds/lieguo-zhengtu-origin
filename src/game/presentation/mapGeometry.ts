export type Point={x:number;y:number};
// DEMO 45-degree geometry, dimension-free and independent of legacy world generation.
export const project=(p:Point)=>({x:(p.x-p.y)*20,y:(p.x+p.y)*10});
export const inverse=(x:number,y:number)=>({x:x/40+y/20,y:y/20-x/40});
export function tilePath(ctx:CanvasRenderingContext2D,p:Point,screen:(p:Point)=>Point){ctx.beginPath();[{x:p.x-.5,y:p.y-.5},{x:p.x+.5,y:p.y-.5},{x:p.x+.5,y:p.y+.5},{x:p.x-.5,y:p.y+.5}].forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();}
