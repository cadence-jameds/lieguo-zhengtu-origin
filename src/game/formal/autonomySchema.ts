import {z} from 'zod';
import type {Autonomy,Traits} from './autonomyModel';
import {TRAITS,traitsFor} from './autonomyModel';
import type {FormalWorld} from './model';
const id=(prefix:string)=>z.string().regex(new RegExp('^'+prefix+':[A-Za-z0-9_.-]{1,100}$'));
const int=z.number().int().safe().nonnegative(),fraction=z.number().finite().min(0).max(1);
const memory=z.object({factionId:id('faction'),trust:z.number().min(-1).max(1),hatred:fraction,threat:fraction,at:int}).strict();
const intel=z.object({cityId:id('city'),ownerFactionId:id('faction'),at:int,source:z.enum(['scout','battle','shared']),units:z.record(int),coarse:z.enum(['personnel','armor','siege'])}).strict();
const agent=z.object({factionId:id('faction'),traits:z.object(Object.fromEntries(TRAITS.map(k=>[k,fraction])) as Record<keyof Traits,typeof fraction>).strict(),decisions:int,nextAt:int,eventId:id('event').nullable(),active:z.boolean(),budgetPercent:int.max(100),lastWarAt:int,memory:z.array(memory).max(32),intel:z.array(intel).max(32)}).strict();
export const autonomySchema:z.ZodType<Autonomy>=z.object({version:z.literal(1),agents:z.array(agent),accepted:int,rejected:int}).strict() as unknown as z.ZodType<Autonomy>;
export function validateAutonomy(w:FormalWorld,fail:(s:string)=>void){
 const auto=w.autonomy;if(!auto){if(w.events.some(e=>e.type==='ai.decide'))fail('AI event without autonomy');return;}
 const agents=new Map(auto.agents.map(a=>[a.factionId,a]));const ai=w.factions.filter(f=>f.role==='ai');
 if(w.fixture||agents.size!==auto.agents.length||ai.length!==agents.size||ai.some(f=>!agents.has(f.id)))fail('AI ownership registry mismatch');
 for(const a of auto.agents){const traits=traitsFor(w.seed,a.factionId);if(TRAITS.some(k=>traits[k]!==a.traits[k]))fail('Seeded AI traits changed');const alive=w.cities.some(c=>c.ownerFactionId===a.factionId);
  if(alive? !a.eventId||!w.events.some(e=>e.type==='ai.decide'&&e.factionId===a.factionId&&e.id===a.eventId&&e.at===a.nextAt):a.eventId!==null)fail('AI schedule/reference mismatch');
  if(new Set(a.memory.map(m=>m.factionId)).size!==a.memory.length||a.memory.some(m=>m.at>w.time||!w.factions.some(f=>f.id===m.factionId))||new Set(a.intel.map(i=>i.cityId)).size!==a.intel.length||a.intel.some(i=>i.at>w.time||!w.cities.some(c=>c.id===i.cityId)||!w.factions.some(f=>f.id===i.ownerFactionId)))fail('AI memory references invalid');
 }
 for(const e of w.events)if(e.type==='ai.decide'&&agents.get(e.factionId)?.eventId!==e.id)fail('Dangling/duplicate AI event');
}
