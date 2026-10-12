import {diplomaticRelation,empireOf} from '../formal/politics';
import type {FormalWorld,FormalCity} from '../formal/model';
import type {Point} from './mapGeometry';
export const RELATION_COLORS={own:'#69cb7e',friendly:'#69cb7e',hostile:'#f0786d',neutral:'#bec1b7'};
export const relationColor=(world:FormalWorld,city:FormalCity)=>({own:RELATION_COLORS.own,friendly:RELATION_COLORS.friendly,war:RELATION_COLORS.hostile,neutral:RELATION_COLORS.neutral})[diplomaticRelation(world,world.playerFactionId,city.ownerFactionId)];
export type PoliticalCell=Point&{color:string};
const politicalCache=new WeakMap<FormalWorld,PoliticalCell[]>();
/** Bounded influence around formally owned empire cities. */
export function politicalCells(world:FormalWorld):PoliticalCell[]{const cached=politicalCache.get(world);if(cached)return cached;const cells=new Map<string,PoliticalCell&{distance:number}>();for(const city of world.cities){const e=empireOf(world,city.ownerFactionId);if(!e)continue;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const distance=dx*dx+dy*dy,x=city.x+dx,y=city.y+dy;if(distance>25||x<0||y<0||x>=384||y>=384)continue;const key=x+','+y,old=cells.get(key);if(!old||distance<old.distance)cells.set(key,{x,y,color:e.color,distance});}}const result=[...cells.values()];politicalCache.set(world,result);return result;}
export function drawPoliticalOverlay(ctx:CanvasRenderingContext2D,cells:PoliticalCell[],screen:(p:Point)=>Point){
 ctx.save();ctx.globalAlpha=.36;for(const c of cells){const ps=[{x:c.x-.5,y:c.y-.5},{x:c.x+.5,y:c.y-.5},{x:c.x+.5,y:c.y+.5},{x:c.x-.5,y:c.y+.5}].map(screen);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=c.color;ctx.fill();}ctx.restore();
}
