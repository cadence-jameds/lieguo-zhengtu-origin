import type {FormalWorld} from '../formal/model';
import {inverse,type Point} from './mapGeometry';

// v0.30.2 detail rules, with a separate LOD for a fitted 384×384 overview.
export const MAP_DETAIL_MIN_ZOOM=.12,WILD_MAP_MIN_ZOOM=.22;
export const detailedMap=(zoom:number)=>zoom>=MAP_DETAIL_MIN_ZOOM;
export const visibleWildSite=(zoom:number,political:boolean)=>!political&&zoom>WILD_MAP_MIN_ZOOM;
export const mapNodeSize=(city:boolean,zoom:number)=>Math.max(7,Math.min(17,zoom*19))*(city?1:.70+.02*Math.max(0,Math.min(1,(zoom-.25)/.95)));
export function mapMarkerSize(zoom:number){
 if(detailedMap(zoom))return {width:28*zoom+8,height:14*zoom+4};
 const width=Math.max(1.5,Math.min(3,28*zoom));
 return {width,height:width/2};
}
export function mapHitExtent(city:boolean,zoom:number){
 if(city&&!detailedMap(zoom)){const m=mapMarkerSize(zoom);return {x:m.width+2,above:m.height+2,below:m.height+2};}
 const size=mapNodeSize(city,zoom);return {x:size*1.8,above:size*2.8,below:size*.8};
}
export function mapHit(city:boolean,zoom:number,anchor:Point,pointer:Point){
 const e=mapHitExtent(city,zoom);
 return Math.abs(anchor.x-pointer.x)<e.x&&pointer.y>anchor.y-e.above&&pointer.y<anchor.y+e.below;
}
export function mapQueryBounds(camera:Point&{z:number},width:number,height:number,rect:{left:number;top:number;right:number;bottom:number}){
 const ps=[[rect.left,rect.top],[rect.right,rect.top],[rect.left,rect.bottom],[rect.right,rect.bottom]].map(([x,y])=>inverse(camera.x+(x-width/2)/camera.z,camera.y+(y-height/2)/camera.z));
 return {minX:Math.floor(Math.min(...ps.map(p=>p.x))),minY:Math.floor(Math.min(...ps.map(p=>p.y))),maxX:Math.ceil(Math.max(...ps.map(p=>p.x))),maxY:Math.ceil(Math.max(...ps.map(p=>p.y)))};
}
export function mapPickBounds(camera:Point&{z:number},width:number,height:number,pointer:Point){
 const e=mapHitExtent(true,camera.z);
 // Bounds describe possible anchors, hence above/below are reversed.
 return mapQueryBounds(camera,width,height,{left:pointer.x-e.x,top:pointer.y-e.below,right:pointer.x+e.x,bottom:pointer.y+e.above});
}
export const MAP_TERRAIN_MARGIN=50;
export function overviewGeometry(w:Pick<FormalWorld,'dimensions'>){
 const width=20*(w.dimensions.width+w.dimensions.height+4*MAP_TERRAIN_MARGIN);
 return {origin:{x:-20*(w.dimensions.height+2*MAP_TERRAIN_MARGIN),y:-10-20*MAP_TERRAIN_MARGIN},width,height:width/2,scale:.075};
}
