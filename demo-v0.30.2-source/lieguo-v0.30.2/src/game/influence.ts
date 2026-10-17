import {faction,overlord} from './engine';
import {empireFor,organizationName} from './organizations';
import type {Game} from './types';
import {terrainAt} from './world';
import {empireNameColor,empireTerritoryColor} from './empirePalette';
export function influenceKey(g:Game){return g.nodes.filter(n=>n.owner&&['capital','village'].includes(n.kind)).map(n=>[n.id,n.owner,n.x,n.y].join(',')).join(';')+'|'+g.factions.map(f=>[f.id,f.vassal,f.league,f.empireId,f.empire,f.empireName].join(',')).join(';');}
export function empireOwner(g:Game,id:string){const top=overlord(g,id);return empireFor(g,top)??(faction(g,top)?.empire?top:null);}
export function buildInfluence(g:Game){
 const cells=new Map<string,{x:number;y:number;owner:string;color:string;distance:number}>(),labels=new Map<string,{x:number;y:number;count:number;name:string;color:string;textColor:string}>();
 const cities=g.nodes.filter(n=>n.owner&&['capital','village'].includes(n.kind));
 for(const n of g.nodes){if(!n.owner||!['capital','village'].includes(n.kind))continue;const owner=empireOwner(g,n.owner),color=owner?empireTerritoryColor(g,owner):'';
 if(owner){const label=labels.get(owner)??{x:n.x,y:n.y,count:0,name:organizationName(g,owner,'empire'),color,textColor:empireNameColor(g,owner)};label.count++;labels.set(owner,label);}
 for(let x=Math.max(0,n.x-8);x<=Math.min(255,n.x+8);x++)for(let y=Math.max(0,n.y-8);y<=Math.min(255,n.y+8);y++){const d=Math.hypot(x-n.x,y-n.y);if(d>8)continue;const key=x+','+y;if((cells.get(key)?.distance??Infinity)>d)cells.set(key,{x,y,owner:owner??'',color,distance:d});}}
 for(const [key,c] of cells)if(!c.owner)cells.delete(key);
 // Short land corridors join nearby cities of the same empire. All cities,
 // including independent lords, reserve their immediate surroundings.
 const blocked=(x:number,y:number,obstacles:typeof cities)=>x<0||y<0||x>255||y>255||['water','mountain'].includes(terrainAt(x,y,g.seed,g.terrainVersion))||obstacles.some(n=>Math.abs(x-n.x)<=8&&Math.abs(y-n.y)<=8&&Math.hypot(x-n.x,y-n.y)<=8);
 for(let i=0;i<cities.length;i++){
   const a=cities[i],owner=empireOwner(g,a.owner!);if(!owner)continue;
   const near=cities.slice(i+1).filter(b=>empireOwner(g,b.owner!)===owner&&Math.hypot(a.x-b.x,a.y-b.y)<=32).sort((b,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(a.x-c.x,a.y-c.y)).slice(0,2);
   for(const b of near){
     const obstacles=cities.filter(n=>empireOwner(g,n.owner!)!==owner&&n.x>=Math.min(a.x,b.x)-11&&n.x<=Math.max(a.x,b.x)+11&&n.y>=Math.min(a.y,b.y)-11&&n.y<=Math.max(a.y,b.y)+11);
     const steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)*2),path:{x:number;y:number}[]=[];
     for(let k=0;k<=steps;k++){const t=k/steps,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);if(blocked(x,y,obstacles)){path.length=0;break;}path.push({x,y});}
     if(!path.length)continue;
     const color=cells.get(a.x+','+a.y)?.color??labels.get(owner)!.color;
     for(const p of path)for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
       if(dx*dx+dy*dy>5)continue;const x=p.x+dx,y=p.y+dy,key=x+','+y;
       if(blocked(x,y,obstacles)||cells.has(key))continue;
       cells.set(key,{x,y,owner,color,distance:8});
     }
   }
 }
 const edges:[number,number,number,number,string][]=[];
 for(const c of cells.values()){for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(cells.get((c.x+dx)+','+(c.y+dy))?.owner===c.owner)continue;const x=c.x+dx*.5,y=c.y+dy*.5;edges.push([x-dy*.5,y+dx*.5,x+dy*.5,y-dx*.5,c.color]);}}
 return {cells:[...cells.values()],labels:[...labels.values()],edges};
}
