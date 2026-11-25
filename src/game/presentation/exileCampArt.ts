import type {Point} from './mapGeometry';

export const EXILE_CAMP_ART='art/world-exile-camp.webp';
export const isExileCamp=(id:string)=>id.startsWith('wild:exile-');

// Alpha footprint is centered on x=192 and has its lowest solid pixel at y=416
// in the 384x512 image. Anchor that point at the south tip of the selected tile.
export function exileCampFrame(site:Point,screen:(point:Point)=>Point,size:number){
 const tileFoot=screen({x:site.x+.5,y:site.y+.5}),height=size*4.53;
 return {bottom:{x:tileFoot.x,y:tileFoot.y+height*(1-416/512)},width:size*3.4,height};
}
