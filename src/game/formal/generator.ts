import {installMountains} from './mountains';
import {campaignId,cityId,factionId,wildSiteId} from './ids';
import type {FormalCity,FormalWorld,ResourceField} from './model';
import {resourceKeys} from './model';
import {nativeMetadata,NATIVE_GENERATOR_VERSION,NATIVE_TERRAIN_VERSION} from './versions';
import {buildable,generateTerrain,seedHash,terrainAt} from './terrain';
import {validateFormalWorld} from './schema';
import {spatial} from './spatial';
import {initializeEconomy} from './economy';
import {initialMilitary} from './military';
import {uniqueCultureName} from './cultureNames';
import {populateWild} from './wildLifecycle';
import {initialCombat} from './combatModel';
export const CIVILIZATIONS=['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'] as const;
export function fieldsFor(counts:readonly number[]):ResourceField[]{let slot=0;return counts.flatMap((n,i)=>Array.from({length:n},()=>({slot:slot++,resource:resourceKeys[i],level:0})));}
export function initialCity(owner:FormalCity['ownerFactionId'],id:FormalCity['id'],x:number,y:number,name:string,starting=true,counts:readonly number[]=[6,5,4,3]):FormalCity {
 return{id,ownerFactionId:owner,name,x,y,population:starting?200:400,housing:400,stock:{food:600,wood:600,stone:600,gold:600},buildings:{center:1},fields:fieldsFor(counts),wallLevel:0,cityPromotionCompleted:false,integrationWorkHours:starting?0:12,integrationTotalWorkHours:starting?0:12,startingCity:starting};
}
/** Native world generation: campaign identity is never mixed into geometry or RNG. */
export function createFormalWorld(o:{campaign:string;seed:number;speed?:number;name?:string;civilizationId?:string;offlineHours?:0|1|6|24;worldGeneratorVersion?:string;terrainVersion?:number}):FormalWorld {
 if(!Number.isInteger(o.seed)||o.seed<0||o.seed>4294967295)throw new Error('Invalid world seed');
 if(o.worldGeneratorVersion&&o.worldGeneratorVersion!==NATIVE_GENERATOR_VERSION||o.terrainVersion!==undefined&&o.terrainVersion!==NATIVE_TERRAIN_VERSION)throw new Error('Unsupported generation inputs');
 if(o.civilizationId&&!CIVILIZATIONS.includes(o.civilizationId as typeof CIVILIZATIONS[number]))throw new Error('Unknown civilization');
 const w:FormalWorld={kind:'formal',fixture:false,metadata:nativeMetadata(),campaignId:campaignId(o.campaign),seed:o.seed,speed:o.speed??1,offlineHours:o.offlineHours??24,time:0,dimensions:{width:384,height:384},playerFactionId:factionId('000'),revision:0,sequences:{event:1,report:1,project:1},factions:[],cities:[],armies:[],events:[],commandReceipts:[],completionReceipts:[],researchProjects:[],largeProjects:[],worldLayer:{regionSize:32,terrain:generateTerrain(o.seed),wildSites:[]}};
 installMountains(w);
 const index=spatial(w);
 const legal=Array.from({length:144},(_,region)=>{const points:{x:number;y:number;rank:number}[]=[];for(let dy=0;dy<32;dy++)for(let dx=0;dx<32;dx++){const x=(region%12)*32+dx,y=Math.floor(region/12)*32+dy;if(buildable(terrainAt(w,x,y)))points.push({x,y,rank:seedHash(o.seed,x,y,7)});}return points.sort((a,b)=>a.rank-b.rank||a.y-b.y||a.x-b.x);});
 for(let n=0;n<100;n++){
  const id=factionId(String(n).padStart(3,'0')),region=(n*37+o.seed%144)%144,point=legal[region].find(p=>!index.at(p.x,p.y).city)!;
  w.factions.push({id,name:n===0?(o.name??'玩家'):uniqueCultureName(CIVILIZATIONS[seedHash(o.seed,n,0,3)%6],seedHash(o.seed,n,0,94),'lord',w.factions.map(f=>f.name)),civilizationId:n===0?(o.civilizationId??CIVILIZATIONS[0]):CIVILIZATIONS[seedHash(o.seed,n,0,3)%6],empireId:null,modernQualification:'none',researchCooperation:false,techIds:[],researchQueue:null,role:n===0?'player':'ai',age:0,ageQueue:null});
  const c=initialCity(id,cityId(String(n).padStart(3,'0')),point.x,point.y,uniqueCultureName(w.factions[n].civilizationId,seedHash(o.seed,n,0,95),'city',w.cities.map(c=>c.name)));w.cities.push(c);index.addCity(c);
 }
 for(let region=0;region<144;region++)for(let q=0;q<3;q++){
  // Capacity shortage spills to nearest legal regions without reducing the slot count.
  const candidates=Array.from({length:144},(_,i)=>i).sort((a,b)=>Math.hypot(a%12-region%12,Math.floor(a/12)-Math.floor(region/12))-Math.hypot(b%12-region%12,Math.floor(b/12)-Math.floor(region/12))||a-b);
  let point:{x:number;y:number}|undefined;
  for(const r of candidates){point=legal[r].find(p=>!index.at(p.x,p.y).city&&!index.at(p.x,p.y).site);if(point)break;}
  if(!point)throw new Error('No legal wild site coordinate');
  const slot=region*3+q,h=seedHash(o.seed,slot,0,90)%100,roll=seedHash(o.seed,slot,0,91)%100;
  const s={id:wildSiteId(String(slot).padStart(3,'0')),spawnSlot:slot,generation:0,region:index.regionAt(point.x,point.y),...point,resource:h<30?'food' as const:h<55?'wood' as const:h<75?'stone' as const:h<85?'gold' as const:'bandit' as const,level:roll<40?1:roll<70?2:roll<88?3:roll<96?4:5};
  // Persist only formal coordinates; placement sort ranks are transient.
  const site={id:s.id,spawnSlot:s.spawnSlot,generation:s.generation,region:s.region,x:s.x,y:s.y,resource:s.resource,level:s.level};w.worldLayer!.wildSites.push(site);index.addSite(site);
 }
 initializeEconomy(w);w.settlements=[];w.colonizationUnits=[];w.combat=initialCombat();for(const site of w.worldLayer!.wildSites)populateWild(w,site);for(const c of w.cities){c.military=initialMilitary();c.autoLogistics=[];}return validateFormalWorld(w);
}
