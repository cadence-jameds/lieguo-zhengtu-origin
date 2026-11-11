import {eraAtlas,constructionArtPath,finishedWallSceneArt,constructionWallSceneArt,openWallSceneArt} from '../assets';
import {CIV_ART,BUILDING_ALIAS,NEW_BUILDINGS,FIELD_ALIAS,unitArt,techArt,cityArtAge,cityPresentation} from './artMap';
import {buildingImagePath,type VisualAge} from './artRegistry';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {TECH_CATALOG} from '../formal/techCatalog';
import type {Building} from '../legacyTypes';
import type {WorldRead} from '../presentationModel';
import type {FormalCity} from '../formal/model';

export const uniqueArt=(paths:readonly string[])=>[...new Set(paths)];
export function buildingArt(kind:string,civ:string,age:VisualAge,constructing=false,targetLevel=1):string[]{
 const registered=buildingImagePath(kind,civ,age,constructing);if(registered)return [registered];
 if(NEW_BUILDINGS.includes(kind as typeof NEW_BUILDINGS[number]))return [`art/formal/building-${kind}.webp`,...(constructing?['art/formal/icon-construction.svg']:[])];
 const alias=BUILDING_ALIAS[kind];if(!alias)return ['art/formal/icon-slot.svg'];
 if(constructing)return [constructionArtPath(alias as Building,age,civ,targetLevel)];
 if(alias==='wall')return [finishedWallSceneArt(age)];
 if(alias==='cellar')return ['art/cellar.webp'];
 if(alias==='castle')return [`art/castle-${civ}.webp`];
 return [eraAtlas(age)];
}
export function resourceArt(building:typeof FIELD_ALIAS[keyof typeof FIELD_ALIAS],level:number,age:VisualAge,constructing=false,targetLevel=level):string[]{
 const stage=constructing?targetLevel:level,advanced=stage>=11?buildingImagePath(building,undefined,3,constructing):undefined;
 if(advanced)return [advanced];
 if(constructing)return [stage>=6&&age>=1&&(building==='farm'||building==='lumber')?`art/construction-${building}-${age>=2?'castle':'feudal'}.webp`:constructionArtPath(building,Math.min(age,2),undefined,targetLevel)];
 return [level>=6?eraAtlas(Math.min(age,2)):`art/field-${building}.webp`];
}
export const miniatureArt=(age:number,wall:number)=>[age===3?'art/unified/cities-imperial.webp':`art/cities-age-${age}.webp`,...(wall>0?[age===3?'art/unified/wall-ring-imperial.webp':`art/wall-ring-${age}.webp`]:[])];
export const COMMON_ART=['art/river-city.webp','art/civilization-emblems-023.webp','art/formal/hud-unit-icons-v03015.png','art/outskirts-landscape-021.webp','art/cities-age-0.webp','art/buildings-dark.webp','art/city-scene-dark-open.webp',...Object.values(FIELD_ALIAS).map(k=>`art/field-${k}.webp`)];
export const MAP_ART=['art/world-riverbanks-0301.webp','art/world-terrain-023.webp','art/world-resources.webp','art/protection-dome.webp','art/world-trees-0299.webp','art/world-mountains-0299.webp','art/world-details-0299.webp'];
export function civilizationAssets(civilizationId:string){
 const civ=CIV_ART[civilizationId]??civilizationId,paths:string[]=[];
 for(const age of [0,1,2,3] as const)for(const kind of [...Object.keys(BUILDING_ALIAS),...NEW_BUILDINGS])for(const constructing of [false,true])paths.push(...buildingArt(kind,civ,age,constructing));
 for(const [id,unit] of Object.entries(UNIT_CATALOG))if(unit.civilizationId===civilizationId)paths.push(unitArt(id).path);
 for(const [id,tech] of Object.entries(TECH_CATALOG))if(tech.civilizationId===civilizationId)paths.push(techArt(id).path);
 return uniqueArt(paths);
}
/** Enumerate production render paths, including atlases and dynamic branches; never glob public/art. */
export const GAME_ART=uniqueArt([...COMMON_ART,...MAP_ART,...Object.keys(CIV_ART).flatMap(civilizationAssets),...Object.keys(UNIT_CATALOG).map(id=>unitArt(id).path),...Object.keys(TECH_CATALOG).map(id=>techArt(id).path),...['construction','slot','research'].map(k=>`art/formal/icon-${k}.svg`),...['scout-report','siege-report','report-defeat','report-food','report-wood','report-stone','report-gold','report-bandit'].map(k=>`art/${k}.webp`),...[0,1,2,3].flatMap(age=>[eraAtlas(age),openWallSceneArt(age),finishedWallSceneArt(age),constructionWallSceneArt(age),...miniatureArt(age,1)]),...Object.values(FIELD_ALIAS).flatMap(kind=>[0,1,2,3].flatMap(age=>[0,6,10,11,15].flatMap(level=>[...resourceArt(kind,level,age as VisualAge),...resourceArt(kind,level,age as VisualAge,true,level)])))]);
/** Frozen when requesting entry. The default district is outskirts, not every future menu/era. */
export function firstScreenArt(world:WorldRead,city?:FormalCity){
 if(!city)return ['art/report-defeat.webp'];
 const p=cityPresentation(world,city);
 return uniqueArt(['art/civilization-emblems-023.webp','art/formal/hud-unit-icons-v03015.png','art/outskirts-landscape-021.webp',...miniatureArt(cityArtAge(world,city),p.wall),...p.fields.flatMap(field=>resourceArt(FIELD_ALIAS[field.resource],field.level,p.visualAge,!!field.job&&field.job.startsAt<=world.time,field.job?.toLevel))]);
}
