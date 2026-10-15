import type {FormalWorld} from './model';
import {passable,terrainAt,terrainTravelMultiplier} from './terrain';
type Point={x:number;y:number};
/** Shared by path selection, military segment snapshots and strict save validation. */
export const segmentTravelDistance=(w:FormalWorld,from:Point,to:Point)=>Math.hypot(to.x-from.x,to.y-from.y)*terrainTravelMultiplier(terrainAt(w,to.x,to.y));
/** Indexed grid A*: explicit passability, no hard path/entity limit or illegal straight-line fallback. */
export function route(w:FormalWorld,from:Point,to:Point):{path:Point[];distance:number} {
 const width=w.dimensions.width,start=from.y*width+from.x,goal=to.y*width+to.x;
 if(!passable(terrainAt(w,from.x,from.y))||!passable(terrainAt(w,to.x,to.y)))throw new Error('No traversable route');
 const heap:{key:number;g:number;score:number}[]=[],cost=new Map<number,number>([[start,0]]),parent=new Map<number,number>();
 const less=(a:typeof heap[number],b:typeof heap[number])=>a.score-b.score||a.key-b.key;
 const push=(n:typeof heap[number])=>{let i=heap.length;heap.push(n);while(i>0){const p=(i-1)>>1;if(less(heap[p],n)<=0)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&less(heap[c+1],heap[c])<0)c++;if(less(last,heap[c])<=0)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
 push({key:start,g:0,score:Math.hypot(from.x-to.x,from.y-to.y)});
 while(heap.length){const n=pop();if(n.g!==cost.get(n.key))continue;if(n.key===goal){const path:Point[]=[];let k=goal;while(true){path.push({x:k%width,y:Math.floor(k/width)});if(k===start)break;k=parent.get(k)!;}return{path:path.reverse(),distance:n.g};}
  const x=n.key%width,y=Math.floor(n.key/width);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(dx===0&&dy===0)continue;const nx=x+dx,ny=y+dy,t=terrainAt(w,nx,ny);if(!passable(t))continue;if(dx&&dy&&(!passable(terrainAt(w,nx,y))||!passable(terrainAt(w,x,ny))))continue;
   const key=ny*width+nx,g=n.g+Math.hypot(dx,dy)*terrainTravelMultiplier(t);if(g>=(cost.get(key)??Infinity))continue;cost.set(key,g);parent.set(key,n.key);push({key,g,score:g+Math.hypot(nx-to.x,ny-to.y)});
  }
 }
 throw new Error('No traversable route');
}
