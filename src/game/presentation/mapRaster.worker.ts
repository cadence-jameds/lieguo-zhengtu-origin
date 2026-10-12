/// <reference lib="webworker" />
import type {FormalWorld} from '../formal/model';
import {paintSurface,type Texture} from './mapPaint';
import {project} from './mapGeometry';
import {overviewGeometry} from './mapViewRules';
/** Pixels only. This worker never runs commands, generates worlds or writes saves. */
let world:FormalWorld,texture:Texture|undefined,generation=0;
self.onmessage=({data})=>{
 if(data.type==='init'){world=data.world;texture=data.texture;generation=data.generation;return;}
 if(data.type==='overview'){try{const a=overviewGeometry(world),pixels=paintSurface(world,a.origin,a.width,a.height,a.scale,texture);self.postMessage({key:'overview',generation,pixels},[pixels.data.buffer]);}catch(e){self.postMessage({error:String(e),generation});}return;}
 if(data.type==='paint'){try{const p=project({x:data.cx,y:data.cy}),pixels=paintSurface(world,{x:p.x-352,y:p.y-64},704,384,data.quality,texture);self.postMessage({key:data.key,cx:data.cx,cy:data.cy,quality:data.quality,generation,pixels},[pixels.data.buffer]);}catch(e){self.postMessage({error:String(e),generation});}}
};
