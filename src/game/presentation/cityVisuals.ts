/** Presentation calibration only; never persisted in the world or save. */
export const IMPERIAL_WORLD_SCALE=1.10;
// Foot of the imperial center illustrations (477–478 / 512), excluding soft shadow.
const CENTER_FOOT=477.5/512;
export function worldCityVisual(age:number,size:number){
 const scale=age===3?IMPERIAL_WORLD_SCALE:1,base=size*3.8;
 return {scale,width:base*scale,footOffset:base*(scale-1)*(1-CENTER_FOOT)};
}
/** Miniature offsets are percentages of its own art box; old ages/unwalled views stay unchanged. */
export const IMPERIAL_MINIATURE:Readonly<Record<string,readonly [number,number]>>={
 civ_zhongguo:[1.025,1],civ_byzantion:[1.025,1],civ_frankia:[1.03,0],
 civ_britannia:[1.035,12],civ_japan:[1.03,12],civ_mongol:[1.08,11],
};
export const IMPERIAL_TOWN_SCALE:Readonly<Record<string,number>>={
 center:1.10,castle:1.12,academy:1.08,workshop:1.08,barracks:1.08,stable:1.08,
 warehouse:1.06,market:1.06,archery:1.06,townhall:1.04,
};
export function townBuildingScale(kind:string,age:number,civ?:string){
 // Retain tall Frankish towers and the wide Mongol footprint to clear the neighboring range.
 if(age===3&&kind==='castle'&&(civ==='civ_frankia'||civ==='civ_mongol'))return 1;
 return age===3?(IMPERIAL_TOWN_SCALE[kind]??1):1;}
