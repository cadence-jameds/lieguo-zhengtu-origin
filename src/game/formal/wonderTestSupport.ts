import {expect} from 'vitest';
import {createFormalFixture} from './fixture';
import {build,order} from './developmentTestSupport';
import {initializeEconomy} from './economy';
import {submitFormalOrder,advanceFormal} from './reducer';
import {resourceKeys,zeroResources,type FormalWorld,type FormalCommand} from './model';
import {wonderRemaining,WONDER_COST} from './wonder';
export function wonderAct(w:FormalWorld,payload:FormalCommand,issuer=w.playerFactionId){const result=submitFormalOrder(w,order(w,payload,undefined,issuer));expect(result.ack?.status,result.ack?.reason).toBe('committed');return result.world;}
export function wonderWorld(start=true){
 let w=createFormalFixture({campaign:'wonder-'+crypto.randomUUID(),speed:3});initializeEconomy(w);
 for(const f of w.factions)f.age=2;
 for(const c of w.cities){build(c,'embassy',15);build(c,'market',15);build(c,'warehouse.0',15);}
 w=wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'甲'});
 w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'legion-create',name:'乙'},w.factions[1].id);
 w=wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'empire-propose',target:w.factions[1].id,name:'奇觀帝國'});
 w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'request-accept',requestId:w.politics!.requests[0].id},w.factions[1].id);
 w.factions[0].age=3;
 return start?wonderAct(w,{type:'wonder.start',cityId:w.cities[0].id,hostCityId:w.cities[0].id}):w;
}
/** Synthetic resupply between trips; each of the 24M resources still goes through real
 * stock deduction, capacity-limited market dispatch and scheduled arrival. No pool injection. */
export function fundWonder(input:FormalWorld){
 let w=input;const deducted=zeroResources();
 while(w.largeProjects[0].wonder!.phase==='funding'){
  const needed=wonderRemaining(w.largeProjects[0]),resources=zeroResources();let capacity=30000;
  for(const r of resourceKeys){resources[r]=Math.min(needed[r],capacity);capacity-=resources[r];}
  expect(capacity).toBeLessThan(30000);
  w.cities[1].stock={...resources};
  const before={...w.cities[1].stock};
  w=wonderAct(w,{type:'wonder.ship',cityId:w.cities[1].id,projectId:w.largeProjects[0].projectId,resources});
  for(const r of resourceKeys){expect(before[r]-w.cities[1].stock[r]).toBe(resources[r]);deducted[r]+=resources[r];}
  if(resourceKeys.every(r=>wonderRemaining(w.largeProjects[0])[r]===0)){
   w.cities[0].stock.food=1;
   const excess=submitFormalOrder(w,order(w,{type:'wonder.ship',cityId:w.cities[0].id,projectId:w.largeProjects[0].projectId,resources:{food:1,wood:0,stone:0,gold:0}}));
   expect(excess.ack?.status).toBe('rejected');expect(excess.ack?.reason).toContain('包含在途資源');
  }
  w=advanceFormal(w,w.logistics!.at(-1)!.returnAt).world;
 }
 expect(deducted).toEqual(WONDER_COST);return w;
}
