import {z} from 'zod';
import type {CityId} from './ids';
import type {Governor} from './governance';
import type {FormalWorld} from './model';
import {buildingLevel} from './catalogB3';
const int=z.number().int().safe().nonnegative(),id=(p:string)=>z.string().regex(new RegExp('^'+p+':[A-Za-z0-9_.-]{1,100}$'));
export const governorSchema:z.ZodType<Governor>=z.object({cityId:id('city'),ownerFactionId:id('faction'),enabled:z.boolean(),policy:z.enum(['balanced','economy','population','military','reserve']),budget:int,reserve:int,spent:z.object({food:int,wood:int,stone:int,gold:int}).strict(),period:int,eventId:id('event').nullable(),nextAt:int,decisions:int,blocked:z.string().max(200)}).strict() as unknown as z.ZodType<Governor>;
export const governanceOrderShape=z.object({type:z.literal('governance.set'),cityId:id('city') as unknown as z.ZodType<CityId>,enabled:z.boolean(),policy:z.enum(['balanced','economy','population','military','reserve']),budget:int,reserve:int}).strict();
export function validateGovernance(w:FormalWorld,fail:(s:string)=>void){const records=w.governors??[];if(new Set(records.map(g=>g.cityId)).size!==records.length)fail('Duplicate governance city');for(const g of records){const c=w.cities.find(c=>c.id===g.cityId);if(!c||!w.factions.some(f=>f.id===g.ownerFactionId)||g.period>Math.floor(w.time/3600000)||g.enabled&&(c.ownerFactionId!==g.ownerFactionId||buildingLevel(c,'townhall')<1||!g.eventId||!w.events.some(e=>e.type==='governance.decide'&&e.id===g.eventId&&e.cityId===g.cityId&&e.at===g.nextAt))||!g.enabled&&g.eventId!==null)fail('Governance scope/schedule invalid');}for(const e of w.events)if(e.type==='governance.decide'&&!records.some(g=>g.enabled&&g.eventId===e.id&&g.cityId===e.cityId))fail('Dangling governance event');}
