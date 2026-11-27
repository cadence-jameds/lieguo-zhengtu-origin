/** Both widths are constant screen pixels, independent of the map zoom. */
export const MAP_ROUTE_WIDTH=1.5, MAP_ROUTE_EDGE_WIDTH=2.7;
export function paintRouteStroke(ctx:CanvasRenderingContext2D,path:Path2D|undefined,zoom:number,color:string,hostileCargo=false){
 ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';ctx.setLineDash(hostileCargo?[8/zoom,5/zoom]:[5/zoom,5/zoom]);
 ctx.lineWidth=MAP_ROUTE_EDGE_WIDTH/zoom;ctx.strokeStyle='#1a231ee0';if(path)ctx.stroke(path);else ctx.stroke();
 ctx.lineWidth=MAP_ROUTE_WIDTH/zoom;ctx.strokeStyle=color;if(path)ctx.stroke(path);else ctx.stroke();
 ctx.restore();
}
