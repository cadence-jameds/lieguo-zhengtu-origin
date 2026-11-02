import type {PresentationWorld} from './presentationModel';
import {buildingLevel} from './formal/catalogB3';
/** A city screen reads one city, its owner and global rule inputs. Other cities'
 * stocks/population are not inputs (names/ownership/embassies are). Keep the prior read context until an
 * actual dependency changes; the central store still holds the exact full view. */
export function cityScreenSelector(cityId:string|undefined){
 let prior:PresentationWorld|null=null,last:PresentationWorld|null=null,dependencies:unknown[]=[];
 return (world:PresentationWorld|null)=>{
  if(world===last)return prior;last=world;if(!world||!cityId){prior=world;dependencies=[];return prior;}
  const city=world.cities.find(c=>c.id===cityId),owner=world.factions.find(f=>f.id===city?.ownerFactionId),governor=world.governors?.find(g=>g.cityId===cityId),townhalls=world.cities.filter(c=>c.ownerFactionId===city?.ownerFactionId&&buildingLevel(c,'townhall')>=1).length;
  const network=world.cities.flatMap(c=>[c.id,c.ownerFactionId,c.name,c.x,c.y,buildingLevel(c,'townhall'),buildingLevel(c,'embassy')]);
  const next=[...network,world.factions,world.playerFactionId,world.dimensions,world.worldLayer,world.victory,world.modernAwareness,world.campaignId,world.projection.branch,world.projection.writerEpoch,world.time,world.nextEventAt,city,owner,governor,townhalls,world.armies,world.logistics,world.settlements,world.colonizationUnits,world.researchProjects,world.largeProjects,world.extinction,world.politics,world.growthTasks,world.developer,world.metadata,world.sequences,world.seed,world.speed,world.clockMode,world.derived.castleSources[cityId],world.derived.governance[cityId]];
  if(!prior||next.length!==dependencies.length||next.some((value,i)=>value!==dependencies[i])){prior=world;dependencies=next;}return prior;
 };
}
