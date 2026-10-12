// Close views use device pixels; overview remains cheap. Values are cache tiers.
export function sceneryRasterScale(zoom:number,dpr=1,gesturing=false){
 const density=zoom*Math.min(2,dpr)*(gesturing?.5:1);
 return Math.min(4,Math.max(.25,2**(zoom<=.5?Math.floor:Math.ceil)(Math.log2(density))));
}
// City names never appear on the world map. Resource levels follow the
// same text toggle as civilization/type glyphs and retain distance rules.
export function showMapCaption(city:boolean,labels:boolean,zoom:number,selected:boolean,dragging:boolean){
 return !city&&labels&&zoom>.22&&(selected||(!dragging&&zoom>.5));
}
