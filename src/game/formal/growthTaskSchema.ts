import {z} from 'zod';
import type {CityId,CommandId} from './ids';
import type {FormalWorld} from './model';
import type {GrowthTaskState} from './growthTasks';
import {GROWTH_TASK_BY_ID,GROWTH_FACT_LIMITS} from './growthTaskCatalog';
import {resourceKeys} from './model';
const int=z.number().int().nonnegative().safe(),taskId=z.string().refine(id=>GROWTH_TASK_BY_ID.has(id)),city=z.string().regex(/^city:[A-Za-z0-9_.-]{1,100}$/) as unknown as z.ZodType<CityId>,command=z.string().regex(/^command:[A-Za-z0-9_.-]{1,100}$/) as unknown as z.ZodType<CommandId>;
const resources=z.object({food:int,wood:int,stone:int,gold:int}).strict();
export const growthTaskIdSchema=taskId;
export const growthTaskSchema:z.ZodType<GrowthTaskState>=z.object({version:z.literal(1),startedAt:int,recordedThrough:int,facts:z.record(z.string().refine(k=>GROWTH_FACT_LIMITS.has(k)),int),completed:z.record(taskId,int),claimed:z.record(taskId,z.object({commandId:command,cityId:city,at:int,accepted:resources,lost:resources,capacity:int,stockBefore:resources,reserved:resources}).strict()),settledCities:z.array(city),autoShipments:z.array(z.string().regex(/^shipment:[A-Za-z0-9_.-]{1,100}$/))}).strict();
export function validateGrowthTasks(w:FormalWorld,fail:(message:string)=>void){
 const s=w.growthTasks;if(!s)return;if(s.startedAt>s.recordedThrough)fail('Growth task start invalid');
 for(const [key,n]of Object.entries(s.facts))if(n>(GROWTH_FACT_LIMITS.get(key)??0))fail('Growth fact exceeds bounded target');
 for(const [id,at]of Object.entries(s.completed)){const t=GROWTH_TASK_BY_ID.get(id);if(!t||at<s.startedAt||at>s.recordedThrough||(s.facts[t.fact]??0)<t.target)fail('Growth completion proof invalid');}
 for(const [id,c]of Object.entries(s.claimed)){
  const t=GROWTH_TASK_BY_ID.get(id),receipt=w.commandReceipts.find(r=>r.commandId===c.commandId&&r.issuerId===w.playerFactionId);
  if(!t||s.completed[id]===undefined||c.at<s.completed[id]||c.at>s.recordedThrough||!receipt){fail('Growth claim receipt invalid');continue;}
  try{const o=JSON.parse(receipt.fingerprint);if(o.issuerId!==w.playerFactionId||o.payload.type!=='tasks.claim'||o.payload.taskId!==id||o.payload.cityId!==c.cityId||!resourceKeys.every(r=>o.payload.expectedResources[r]===c.accepted[r]))fail('Growth claim command mismatch');}catch{fail('Growth claim command malformed');}
  for(const r of resourceKeys){const accepted=Math.min(t.reward[r],Math.max(0,c.capacity-c.reserved[r]-c.stockBefore[r]));if(c.accepted[r]!==accepted||c.lost[r]!==t.reward[r]-accepted)fail('Growth reward ledger invalid');}
 }
 if(new Set(s.settledCities).size!==s.settledCities.length||new Set(s.autoShipments).size!==s.autoShipments.length||new Set(Object.values(s.claimed).map(c=>c.commandId)).size!==Object.keys(s.claimed).length)fail('Growth proof identity duplicate');
}
