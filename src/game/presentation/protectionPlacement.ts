/** Viewport geometry only; never reads or changes the world clock or game rules. */
export type ShieldBox={left:number;top:number;right:number;bottom:number};
export type ShieldPoint={left:number;top:number};
export const overlaps=(a:ShieldBox,b:ShieldBox,gap=4)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function shieldPlacement(bounds:ShieldBox,width:number,height:number,preferred:ShieldPoint[],obstacles:ShieldBox[]):ShieldPoint{
 const clamp=(p:ShieldPoint)=>({left:Math.max(bounds.left,Math.min(p.left,bounds.right-width)),top:Math.max(bounds.top,Math.min(p.top,bounds.bottom-height))});
 const candidates=[...preferred];
 for(let y=bounds.bottom-height;y>=bounds.top;y-=height+6)candidates.push({left:bounds.right-width,top:y},{left:bounds.left,top:y});
 for(let x=bounds.right-width;x>=bounds.left;x-=width+6)candidates.push({left:x,top:bounds.top},{left:x,top:bounds.bottom-height});
 const points=candidates.map(clamp),score=(p:ShieldPoint)=>obstacles.reduce((n,b)=>n+(overlaps({...p,right:p.left+width,bottom:p.top+height},b)?1:0),0);
 const clear=points.find(p=>score(p)===0);if(clear)return clear;
 // Zoomed resource sprites can fill the visible scene with transparent hit
 // boxes. If none is fully clear, protect primary click centers first.
 const impact=(p:ShieldPoint)=>obstacles.reduce((n,b)=>{
  const area=Math.max(0,Math.min(p.left+width,b.right)-Math.max(p.left,b.left))*Math.max(0,Math.min(p.top+height,b.bottom)-Math.max(p.top,b.top));
  const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2,center=p.left<=cx&&p.left+width>=cx&&p.top<=cy&&p.top+height>=cy;
  return n+area+(center?width*height*(obstacles.length+1):0);
 },0);
 let best=points[0]??clamp({left:bounds.left,top:bounds.top}),least=impact(best);
 for(const p of points){const value=impact(p);if(value<least){best=p;least=value;}}
 // A narrow free gap can fall between the perimeter samples. Try the actual
 // control edges before choosing any position that overlaps an operation.
 const xs=[bounds.left,bounds.right-width,...obstacles.flatMap(b=>[b.left-width-4,b.right+4])],ys=[bounds.top,bounds.bottom-height,...obstacles.flatMap(b=>[b.top-height-4,b.bottom+4])];
 for(const y of ys)for(const x of xs){const p=clamp({left:x,top:y});if(score(p)===0)return p;const value=impact(p);if(value<least){best=p;least=value;}}
 return best;
}
