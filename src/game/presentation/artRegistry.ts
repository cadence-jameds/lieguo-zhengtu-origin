import registry from './artAssets.json';

/** Presentation-only assets. These keys never enter the Formal world or save. */
export type VisualAge=0|1|2|3;
export const unitPortraits:Readonly<Record<string,string>>=registry.units;
export const technologyCards:Readonly<Record<string,string>>=registry.technologies;
export const buildingSprites:Readonly<Record<string,string>>=registry.buildings;
export const buildingConstruction:Readonly<Record<string,string>>=registry.construction;

export function buildingImagePath(kind:string,civ:string|undefined,age:number,constructing=false){
 const entries=constructing?buildingConstruction:buildingSprites;
 if(age>=3){const key=kind+'.imperial';const path=entries[key+'.'+civ]??entries[key];if(path)return path;}
 return constructing?entries[kind+'.all']:undefined;
}
