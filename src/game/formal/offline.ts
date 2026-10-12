import {effectiveSpeed} from './playtest';
import type {FormalWorld,FormalTransition} from './model';
import {advanceFormal} from './reducer';
import {citySnapshot,HOUR} from './economy';
export const OFFLINE_MODES=[0,1,6,24] as const;
export type OfflineSummary={elapsedRealMs:number;advancedRealMs:number;advancedWorldMs:number;capHours:number;buildingsCompleted:number;unitsTrained:number;technologiesCompleted:number;citiesFounded:number;populationChange:number;recovered:boolean};
/** Wall clock supplies duration only. All resulting gameplay runs through the Formal scheduler. */
export function advanceOffline(world:FormalWorld,savedAt:number,now:number):FormalTransition&{summary:OfflineSummary}{
 const elapsed=Number.isFinite(savedAt)&&Number.isFinite(now)?Math.max(0,Math.floor(now-savedAt)):0,capHours=world.offlineHours??24,real=Math.min(elapsed,Math.min(24,capHours)*HOUR),target=world.time+Math.floor(real*effectiveSpeed(world));
 const result=advanceFormal(world,target),own=(w:FormalWorld)=>w.cities.filter(c=>c.ownerFactionId===w.playerFactionId),before=own(world),after=own(result.world);
 const unitsTrained=before.reduce((n,c)=>n+(c.military?.queue.reduce((sum,j)=>sum+j.remaining-(after.find(a=>a.id===c.id)?.military?.queue.find(k=>k.commandId===j.commandId)?.remaining??0),0)??0),0);
 const buildingsCompleted=before.reduce((n,c)=>n+(c.economy?.construction.filter(j=>!after.find(a=>a.id===c.id)?.economy?.construction.some(k=>k.commandId===j.commandId)).length??0),0);
 return{...result,summary:{elapsedRealMs:elapsed,advancedRealMs:real,advancedWorldMs:target-world.time,capHours,buildingsCompleted,unitsTrained,technologiesCompleted:result.world.researchProjects.filter(p=>p.ownerFactionId===world.playerFactionId&&p.phase==='completed').length-world.researchProjects.filter(p=>p.ownerFactionId===world.playerFactionId&&p.phase==='completed').length,citiesFounded:after.length-before.length,populationChange:after.reduce((n,c)=>n+(citySnapshot(result.world,c.id)?.population??0),0)-before.reduce((n,c)=>n+(citySnapshot(world,c.id)?.population??0),0),recovered:false}};
}
