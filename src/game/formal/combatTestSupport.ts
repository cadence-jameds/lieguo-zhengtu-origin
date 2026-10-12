import {expect} from 'vitest';
import {make,rich,order} from './developmentTestSupport';
import {spatial,invalidateSpatial} from './spatial';
import {buildable,terrainAt} from './terrain';
import type {FormalCommand,FormalWorld} from './model';
import {advanceFormal,submitFormalOrder} from './reducer';
import {isMissionArmy} from './combatModel';
export function battlefield(){const w=make();for(const c of w.cities.slice(0,3))rich(w,c);const home=w.cities[0],used=spatial(w);let moved=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){if(moved===2)break;const x=home.x+dx,y=home.y+dy;if(buildable(terrainAt(w,x,y))&&!used.at(x,y).city&&!used.at(x,y).site){w.cities[++moved].x=x;w.cities[moved].y=y;}}invalidateSpatial(w);return w;}
export function issue(w:FormalWorld,p:FormalCommand,issuer=w.playerFactionId,id?:string){const t=submitFormalOrder(w,order(w,p,id,issuer));expect(t.ack?.status,t.ack?.reason).toBe('committed');return t;}
export function dispatch(w:FormalWorld,mission:'raid'|'conquest'|'scout'|'reinforce',units:Record<string,number>,source=0,destination=1,mode:'resources-army'|'defenses-army'='resources-army'){return issue(w,{type:'army.dispatch',cityId:w.cities[source].id,mission,target:{kind:'city',cityId:w.cities[destination].id},units,...(mission==='scout'?{scoutMode:mode}:{})},w.cities[source].ownerFactionId);}
export const arrive=(w:FormalWorld)=>advanceFormal(w,w.armies.filter(isMissionArmy).find(a=>a.status==='outbound')!.arrivalAt);
