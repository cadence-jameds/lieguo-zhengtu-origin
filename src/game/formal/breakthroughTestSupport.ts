import {expect} from 'vitest';
import type {FormalWorld} from './model';
import {resourceKeys,zeroResources} from './model';
import {wonderWorld,wonderAct,fundWonder} from './wonderTestSupport';
import {advanceFormal} from './reducer';
import {wonderRemaining} from './wonder';
import {BREAKTHROUGH_COST} from './breakthrough';
let completed:FormalWorld|undefined;
export function completedWonder(){if(!completed){const funded=fundWonder(wonderWorld());completed=advanceFormal(funded,funded.largeProjects[0].wonder!.startedAt!+funded.largeProjects[0].durationMs).world;}return structuredClone(completed);}
export function breakthroughWorld(){const w=completedWonder();return wonderAct(w,{type:'breakthrough.start',cityId:w.cities[0].id});}
export function fundedBreakthrough(){
 let w=breakthroughWorld();const deducted=zeroResources();
 while(w.largeProjects[1].breakthrough!.phase==='funding'){
  const p=w.largeProjects[1],needed=wonderRemaining(p),cargo=zeroResources();let capacity=30000;
  for(const r of resourceKeys){cargo[r]=Math.min(capacity,needed[r]);capacity-=cargo[r];}
  expect(capacity).toBeLessThan(30000);w.cities[1].stock={...cargo};const before={...w.cities[1].stock};
  w=wonderAct(w,{type:'breakthrough.ship',cityId:w.cities[1].id,projectId:p.projectId,resources:cargo});
  for(const r of resourceKeys){expect(before[r]-w.cities[1].stock[r]).toBe(cargo[r]);deducted[r]+=cargo[r];}
  w=advanceFormal(w,w.logistics!.at(-1)!.returnAt).world;
 }
 expect(deducted).toEqual(BREAKTHROUGH_COST);expect(w.largeProjects[1].shipments).toHaveLength(2000);return w;
}
