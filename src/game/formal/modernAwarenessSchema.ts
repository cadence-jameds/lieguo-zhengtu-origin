import {z} from 'zod';
import type {ModernAwareness} from './modernAwareness';
import {modernCombatUnit} from './modernAwareness';
import type {FormalWorld} from './model';
import type {BattleId} from './ids';
const int=z.number().int().nonnegative().safe();
export const awarenessSchema:z.ZodType<ModernAwareness>=z.object({pools:z.record(z.object({value:int.max(100),significantEncounter:z.boolean(),encountered:z.array(z.string())}).strict()),battles:z.array(z.object({battleId:z.string().regex(/^battle:/) as unknown as z.ZodType<BattleId>,pool:z.string(),events:z.array(z.string()),killedPopulation:int,battleAward:int.max(10),conquestAward:z.boolean()}).strict())}).strict();
export function validateAwareness(w:FormalWorld,fail:(s:string)=>void){
 const a=w.modernAwareness;
 const unique=(xs:readonly string[])=>new Set(xs).size===xs.length;
 for(const f of w.factions)if(f.reverseEngineering&&(!unique(f.reverseEngineering)||f.reverseEngineering.some(id=>!modernCombatUnit(id))))fail('Invalid reverse engineering lines');
 if(!a)return;
 if(!unique(a.battles.map(b=>b.pool+'/'+b.battleId)))fail('Duplicate awareness battle');
 for(const [key,p] of Object.entries(a.pools))if(!/^(empire|faction):/.test(key)||key.startsWith('faction:')&&!w.factions.some(f=>f.id===key)||!unique(p.encountered)||p.encountered.some(id=>!modernCombatUnit(id)))fail('Invalid awareness pool');
 for(const b of a.battles)if(!a.pools[b.pool]||!unique(b.events)||!w.combat?.receipts.some(r=>r.battleId===b.battleId)||b.events.some(event=>!w.combat?.receipts.some(r=>r.battleId===b.battleId&&event.startsWith(r.eventId+'/')))||b.conquestAward&&!w.combat?.receipts.some(r=>r.battleId===b.battleId&&r.kind==='final'&&r.ownerBefore!==r.ownerAfter&&r.qualificationBefore==='full'&&r.outcome==='conquered'))fail('Awareness battle receipt missing');
}
