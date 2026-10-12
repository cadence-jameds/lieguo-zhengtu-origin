import type {FormalWorld} from './model';
import {buildingIds,emptyTroops,type Game,type Node} from '../legacyTypes';
/** Ephemeral renderer adapter only. Never persisted, loaded, repaired, or used by authority. */
export function mapPresentation(w:FormalWorld):Game {
 const nodes:Node[]=w.cities.map(n=>({id:n.id,name:n.name,x:n.x,y:n.y,kind:'village',owner:n.ownerFactionId,stock:{...n.stock},population:n.population,integration:100,stability:100,buildings:Object.fromEntries(buildingIds.map(b=>[b,b==='hall'?n.buildings.center??0:0])) as Node['buildings'],troops:emptyTroops(),build:[],train:[],policy:'balanced',plots:[],governor:{enabled:false,budget:0,reserve:0,spent:{food:0,wood:0,stone:0,gold:0},period:0,blocked:'',autoNew:false}}));
 return {schema:6,content:'B1-map-presentation-only',campaign:w.campaignId,acceptedCommands:[],seed:w.seed,player:w.playerFactionId,speed:w.speed,time:w.time,savedAt:0,revision:w.revision,next:1,rng:1,nodes,factions:w.factions.map(f=>({id:f.id,name:f.name,civilization:f.civilizationId,capital:w.cities.find(n=>n.ownerFactionId===f.id)?.id??w.cities[0].id,era:0,tech:[],research:null,intel:{},vassal:null,regent:false,intent:'',exile:null})),events:[],marches:[],battles:[],reports:[],protectionUntil:0,treaties:[],log:[],hegemony:null,result:null,sandbox:false,terrainVersion:w.metadata.terrainVersion,mountainRevision:1};
}
