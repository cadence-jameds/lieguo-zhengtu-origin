import {z} from 'zod';
import type {EventId,FactionId} from './ids';
import type {FormalWorld} from './model';
import type {VictoryState} from './victory';
import {victoryConditions,VICTORY_DURATION} from './victory';
const int=z.number().int().nonnegative().safe(),scope=z.string().regex(/^(empire|faction):[A-Za-z0-9_.-]{1,100}$/),event=z.string().regex(/^event:[A-Za-z0-9_.-]{1,100}$/) as unknown as z.ZodType<EventId>,faction=z.string().regex(/^faction:[A-Za-z0-9_.-]{1,100}$/) as unknown as z.ZodType<FactionId>;
export const victoryKindSchema=z.enum(['conquest','hegemony']);
export const victorySchema:z.ZodType<VictoryState>=z.object({candidates:z.array(z.object({scope,kind:victoryKindSchema,startedAt:int,eventId:event}).strict()),result:z.object({scope,kind:victoryKindSchema,at:int,eventId:event,members:z.array(faction).min(1)}).strict().nullable()}).strict();
export function validateVictory(w:FormalWorld,fail:(message:string)=>void){
 const state=w.victory,conditions=state?victoryConditions(w):[],keys=new Set<string>(),events=new Set<string>();
 for(const c of state?.candidates??[]){const key=c.scope+':'+c.kind;if(keys.has(key)||events.has(c.eventId)||c.startedAt>w.time||!conditions.some(x=>x.scope===c.scope&&x[c.kind])||!w.events.some(e=>e.type==='victory.complete'&&e.id===c.eventId&&e.scope===c.scope&&e.kind===c.kind&&e.at===c.startedAt+VICTORY_DURATION[c.kind]))fail('Victory candidate/clock invalid');keys.add(key);events.add(c.eventId);}
 if(state?.result&&(state.candidates.length||state.result.at>w.time||state.result.members.some(id=>!w.factions.some(f=>f.id===id))||new Set(state.result.members).size!==state.result.members.length||w.events.some(e=>e.type==='victory.complete')))fail('Victory result receipt invalid');
 for(const e of w.events)if(e.type==='victory.complete'&&!state?.candidates.some(c=>c.eventId===e.id))fail('Dangling victory event');
}
