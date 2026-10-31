import {retireAutonomy} from './autonomy';
import {EventScheduler} from './scheduler';
import {expect} from 'vitest';
import {createFormalWorld} from './generator';
import {commandId} from './ids';
import type {FormalCity,FormalCommand,FormalWorld} from './model';
import {HOUSING} from './catalogB3';
import {submitFormalOrder} from './reducer';
import {changeCityOwner} from './economy';
let serial=0;
// P0-C-10 successor: these established domain labs predate new-campaign shields.
// Keep them combat-ready; raw generator protection is tested in protectionExtinctionP0C10.test.ts.
export const make=()=>{const w=createFormalWorld({campaign:'b4-'+crypto.randomUUID(),seed:90217});for(const f of w.factions)f.protectionUntil=0;return w;};
export function order(w:FormalWorld,payload:FormalCommand,id='b4-'+(++serial),issuer=w.playerFactionId){return{commandId:commandId(id),campaignId:w.campaignId,issuerId:issuer,issuedWorldTime:w.time,expectedRevision:w.revision,payload};}
export function build(c:FormalCity,key:string,level:number){c.buildings[key]=level;if(key!=='center'&&c.economy!.slots[key]===undefined)c.economy!.slots[key]=Object.keys(c.economy!.slots).length;if(key==='residence')c.housing=400+HOUSING[level];}
export function rich(w:FormalWorld,c=w.cities[0],amount=100000){for(let i=0;i<Math.ceil(amount/100000);i++)build(c,`warehouse.${i}`,15);build(c,'residence',15);c.population=15000;c.stock={food:amount,wood:amount,stone:amount,gold:amount};return c;}
export function commit(w:FormalWorld,payload:FormalCommand){const t=submitFormalOrder(w,order(w,payload));expect(t.ack?.status,t.ack?.reason).toBe('committed');return t.world;}
export function reject(w:FormalWorld,payload:FormalCommand){const before=JSON.stringify(w),t=submitFormalOrder(w,order(w,payload));expect(t.ack?.status,t.ack?.reason).toBe('rejected');expect(JSON.stringify(w)).toBe(before);return t;}
export function ownSecond(w:FormalWorld){const c=w.cities[1];changeCityOwner(w,c,w.playerFactionId,'receive');if(w.autonomy){const scheduler=new EventScheduler(w.events);retireAutonomy(w,scheduler);w.events=scheduler.snapshot();}c.integrationWorkHours=0;return rich(w,c);}
export function researchCity(w:FormalWorld,modern=false){const c=rich(w);for(const k of ['academy','barracks','blacksmith','stable','archery','market','workshop','castle','townhall','embassy'])build(c,k,15);w.factions[0].age=3;if(modern){w.factions[0].modernQualification='full';w.factions[0].researchCooperation=true;w.factions[0].techIds.push('research.cooperation');}return c;}
