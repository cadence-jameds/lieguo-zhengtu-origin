import {diplomaticRelation,empireOf} from '../formal/politics';
import {terrainAt} from '../formal/terrain';
import type {FormalWorld,FormalCity} from '../formal/model';
import type {Point} from './mapGeometry';
export const RELATION_COLORS={own:'#69cb7e',friendly:'#69cb7e',hostile:'#f0786d',neutral:'#bec1b7'};
export const relationColor=(world:FormalWorld,city:FormalCity)=>({own:RELATION_COLORS.own,friendly:RELATION_COLORS.friendly,war:RELATION_COLORS.hostile,neutral:RELATION_COLORS.neutral})[diplomaticRelation(world,world.playerFactionId,city.ownerFactionId)];
export type PoliticalCell=Point&{color:string;owner:string};
export type PoliticalInfluence={cells:PoliticalCell[];edges:[number,number,number,number,string][];labels:(Point&{name:string;color:string})[]};
const cache=new Map<string,{terrain:string|undefined;value:PoliticalInfluence}>();
/** Presentation only: DEMO radius 8, at most two links per city within 32 cells.
 * No ownership, routes, terrain, saves or simulation data is mutated. */
export function politicalInfluence(world:FormalWorld):PoliticalInfluence{
 const cities=world.cities.map(c=>({city:c,empire:empireOf(world,c.ownerFactionId)})),key=world.campaignId+'|'+world.seed+'|'+world.metadata.terrainVersion+'|'+cities.map(({city:c,empire:e})=>[c.id,c.x,c.y,e?.id,e?.name,e?.color].join(',')).join(';'),terrain=world.worldLayer?.terrain,old=cache.get(key);if(old&&old.terrain===terrain)return old.value;
 const cells=new Map<string,PoliticalCell&{distance:number}>(),labels=new Map<string,{x:number;y:number;count:number;name:string;color:string}>();
 const water=(x:number,y:number)=>['water','river'].includes(terrainAt(world,x,y)!);
 for(const {city:c,empire:e} of cities){if(e){const label=labels.get(e.id)??{x:0,y:0,count:0,name:e.name,color:e.color};label.x+=c.x;label.y+=c.y;label.count++;labels.set(e.id,label);}for(let dx=-8;dx<=8;dx++)for(let dy=-8;dy<=8;dy++){const x=c.x+dx,y=c.y+dy,distance=dx*dx+dy*dy;if(distance>64||x<0||y<0||x>=world.dimensions.width||y>=world.dimensions.height||water(x,y))continue;const k=x+','+y;if((cells.get(k)?.distance??Infinity)>distance)cells.set(k,{x,y,owner:e?.id??'',color:e?.color??'',distance});}}
 for(const [k,c] of cells)if(!c.owner)cells.delete(k);
 for(let i=0;i<cities.length;i++){const {city:a,empire:e}=cities[i];if(!e)continue;const near=cities.slice(i+1).filter(b=>b.empire?.id===e.id&&Math.hypot(a.x-b.city.x,a.y-b.city.y)<=32).sort((b,c)=>Math.hypot(a.x-b.city.x,a.y-b.city.y)-Math.hypot(a.x-c.city.x,a.y-c.city.y)).slice(0,2);
 for(const {city:b} of near){const obstacles=cities.filter(n=>n.empire?.id!==e.id&&n.city.x>=Math.min(a.x,b.x)-11&&n.city.x<=Math.max(a.x,b.x)+11&&n.city.y>=Math.min(a.y,b.y)-11&&n.city.y<=Math.max(a.y,b.y)+11),blocked=(x:number,y:number)=>x<0||y<0||x>=world.dimensions.width||y>=world.dimensions.height||water(x,y)||terrainAt(world,x,y)==='mountain'||obstacles.some(n=>Math.hypot(x-n.city.x,y-n.city.y)<=8),steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)*2),path:Point[]=[];
 for(let k=0;k<=steps;k++){const t=steps?k/steps:0,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);if(blocked(x,y)){path.length=0;break;}path.push({x,y});}
 for(const p of path)for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){if(dx*dx+dy*dy>5)continue;const x=p.x+dx,y=p.y+dy,k=x+','+y;if(!blocked(x,y)&&!cells.has(k))cells.set(k,{x,y,owner:e.id,color:e.color,distance:64});}
 }}
 const edges:PoliticalInfluence['edges']=[];for(const c of cells.values())for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(cells.get((c.x+dx)+','+(c.y+dy))?.owner===c.owner)continue;const x=c.x+dx*.5,y=c.y+dy*.5;edges.push([x-dy*.5,y+dx*.5,x+dy*.5,y-dx*.5,c.color]);}
 const value={cells:[...cells.values()],edges,labels:[...labels.values()].map(l=>({x:l.x/l.count,y:l.y/l.count,name:l.name,color:l.color}))};cache.set(key,{terrain,value});if(cache.size>4)cache.delete(cache.keys().next().value!);return value;
}
export const politicalCells=(world:FormalWorld)=>politicalInfluence(world).cells;
export function drawPoliticalOverlay(ctx:CanvasRenderingContext2D,influence:PoliticalInfluence,screen:(p:Point)=>Point,viewport?:{width:number;height:number;zoom:number}){
 ctx.save();ctx.globalAlpha=.36;for(const c of influence.cells){const center=screen(c);if(viewport&&(center.x < -50||center.x > viewport.width+50||center.y < -30||center.y > viewport.height+30))continue;const ps=[{x:c.x-.5,y:c.y-.5},{x:c.x+.5,y:c.y-.5},{x:c.x+.5,y:c.y+.5},{x:c.x-.5,y:c.y+.5}].map(screen);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=c.color;ctx.fill();}
 ctx.globalAlpha=1;ctx.lineWidth=1.5;ctx.strokeStyle='#273a32';ctx.beginPath();for(const [x1,y1,x2,y2] of influence.edges){const a=screen({x:x1,y:y1}),b=screen({x:x2,y:y2});if(viewport&&(a.x < -40||a.x > viewport.width+40||a.y < -40||a.y > viewport.height+40))continue;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();ctx.globalAlpha=1;ctx.font='bold 15px serif';ctx.textAlign='center';for(const l of influence.labels){if(viewport&&viewport.zoom>=.7)continue;const p=screen(l);ctx.strokeStyle='#151c19';ctx.lineWidth=3;ctx.strokeText(l.name,p.x,p.y);ctx.fillStyle=l.color;ctx.fillText(l.name,p.x,p.y);}ctx.restore();
}
