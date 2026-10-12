import type {FormalWorld} from '../formal/model';
import type {CityId} from '../formal/ids';
import type {Camera} from './DemoMapCache';
export function selectedReturnCity(w:FormalWorld,id?:CityId){return w.cities.find(c=>c.id===id&&c.ownerFactionId===w.playerFactionId)??w.cities.find(c=>c.ownerFactionId===w.playerFactionId)!;}
/** Resources, timers and garrison counts do not invalidate map imagery. */
export function mapEntityKey(w:FormalWorld){const armies=w.armies.filter(a=>a.mission);return JSON.stringify([w.campaignId,w.politics,w.combat?.battles.map(b=>[b.id,b.cityId,b.phase]),w.cities.map(c=>[c.id,c.x,c.y,c.ownerFactionId,c.wallLevel,c.cityPromotionCompleted]),w.factions.map(f=>[f.id,f.civilizationId,f.age,f.protectionUntil]),w.worldLayer?.wildSites,w.extinction?.sites,w.settlements?.filter(p=>p.phase==='travelling').map(p=>[p.projectId,p.target]),armies.map(a=>[a.id,a.status,a.arrivalAt]),armies.some(a=>a.status==='outbound'||a.status==='returning')?w.time:0]);}
/** Only camera, viewport, static geometry and cache revisions invalidate the background. */
export function mapBackgroundKey(w:FormalWorld,c:Camera,view:{width:number;height:number;dpr:number},grid:boolean,gesture:boolean,terrainRevision:number,sceneryRevision:number){return [view.width,view.height,view.dpr,c.x,c.y,c.z,grid,gesture,terrainRevision,sceneryRevision,w.cities.map(n=>n.x+','+n.y).join('|')].join(':');}
export const mapLabelPreferenceKey='lieguo-formal-map-labels-v0309';
export function mapLabels(storage:Pick<Storage,'getItem'>){try{return storage.getItem(mapLabelPreferenceKey)==='true';}catch{return false;}}
