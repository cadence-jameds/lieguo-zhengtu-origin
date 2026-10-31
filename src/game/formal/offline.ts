import {worldPaused} from './extinction';
import {setClockMode} from './campaignTime';
import type {FormalWorld,FormalTransition} from './model';
import {advanceFormal,advanceFormalCooperative} from './reducer';
import {citySnapshot,HOUR} from './economy';
export const OFFLINE_MODES=[0,1,4,8,12] as const;
export type OfflineSummary={elapsedRealMs:number;advancedRealMs:number;advancedWorldMs:number;capHours:number;buildingsCompleted:number;unitsTrained:number;technologiesCompleted:number;citiesFounded:number;populationChange:number;recovered:boolean};
/** Wall clock supplies duration only. All resulting gameplay runs through the Formal scheduler. */
type OfflinePlan={elapsed:number;capHours:number;real:number;target:number};
function offlinePlan(world:FormalWorld,savedAt:number,now:number):OfflinePlan {
 const elapsed=Number.isFinite(savedAt)&&Number.isFinite(now)?Math.max(0,Math.floor(now-savedAt)):0,capHours=world.offlineHours??12,real=worldPaused(world)?0:Math.min(elapsed,Math.min(12,capHours)*HOUR),target=world.time+Math.floor(real*world.speed);
 return {elapsed,capHours,real,target};
}
function finishOffline(world:FormalWorld,result:FormalTransition,{elapsed,capHours,real}:OfflinePlan):FormalTransition&{summary:OfflineSummary}{
 if(!worldPaused(result.world))setClockMode(result.world,'foreground');
 const own=(w:FormalWorld)=>w.cities.filter(c=>c.ownerFactionId===w.playerFactionId),before=own(world),after=own(result.world);
 const unitsTrained=before.reduce((n,c)=>n+(c.military?.queue.reduce((sum,j)=>sum+j.remaining-(after.find(a=>a.id===c.id)?.military?.queue.find(k=>k.commandId===j.commandId)?.remaining??0),0)??0),0);
 const buildingsCompleted=before.reduce((n,c)=>n+(c.economy?.construction.filter(j=>!after.find(a=>a.id===c.id)?.economy?.construction.some(k=>k.commandId===j.commandId)).length??0),0);
 return{...result,summary:{elapsedRealMs:elapsed,advancedRealMs:Math.min(real,Math.ceil((result.world.time-world.time)/world.speed)),advancedWorldMs:result.world.time-world.time,capHours,buildingsCompleted,unitsTrained,technologiesCompleted:result.world.researchProjects.filter(p=>p.ownerFactionId===world.playerFactionId&&p.phase==='completed').length-world.researchProjects.filter(p=>p.ownerFactionId===world.playerFactionId&&p.phase==='completed').length,citiesFounded:after.length-before.length,populationChange:after.reduce((n,c)=>n+(citySnapshot(result.world,c.id)?.population??0),0)-before.reduce((n,c)=>n+(citySnapshot(world,c.id)?.population??0),0),recovered:false}};
}
/** Ordinary synchronous simulation uses the unchanged complete-world contract. */
export function advanceOffline(world:FormalWorld,savedAt:number,now:number):FormalTransition&{summary:OfflineSummary}{
 const plan=offlinePlan(world,savedAt,now);
 world=structuredClone(world);if(plan.real>0)setClockMode(world,'offline');
 return finishOffline(world,advanceFormal(world,plan.target),plan);
}
/** Worker-side replay yields between whole events, without committing partial world state. */
export async function advanceOfflineCooperative(world:FormalWorld,savedAt:number,now:number,onProgress?:(fraction:number,events:number)=>void):Promise<FormalTransition&{summary:OfflineSummary}>{
 const plan=offlinePlan(world,savedAt,now),start=world.time;
 world=structuredClone(world);if(plan.real>0)setClockMode(world,'offline');
 const result=await advanceFormalCooperative(world,plan.target,(at,target,events)=>onProgress?.(target===start?1:Math.max(0,Math.min(1,(at-start)/(target-start))),events));
 return finishOffline(world,result,plan);
}
