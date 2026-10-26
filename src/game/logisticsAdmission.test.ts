import {expect,it} from 'vitest';
import {wonderWorld} from './formal/wonderTestSupport';
import {order,build} from './formal/developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './formal/reducer';
import {playerOrderBase,playerOrderWithBase} from './orderAdmission';
import {zeroResources,type FormalCommand} from './formal/model';
it('allocation intent survives unrelated AI wonder pool/shipments while real capacity and authority changes remain fenced',()=>{
 let w=wonderWorld();const c=w.cities[1],p:FormalCommand={type:'logistics.configure',cityId:c.id,rules:[],settings:{reserve:zeroResources(),manualCaravans:13,wonder:{projectId:w.largeProjects[0].projectId,maxCaravans:2,enabled:true}}};
 const o=order(w,p),base=playerOrderBase(w,p)!;w.cities[2].stock={food:2000,wood:0,stone:0,gold:0};const ai=submitFormalOrder(w,order(w,{type:'wonder.ship',cityId:w.cities[2].id,projectId:w.largeProjects[0].projectId,resources:w.cities[2].stock},undefined,w.factions[1].id));expect(ai.ack?.status).toBe('committed');const later=advanceFormal(ai.world,ai.world.logistics![0].arrivalAt).world;expect(later.largeProjects[0].poolResources.food).toBe(2000);
 const rebased=playerOrderWithBase(later,o,base,0,w.revision);expect(rebased.expectedRevision).toBe(later.revision);expect(submitFormalOrder(later,rebased).ack?.status).toBe('committed');
 for(const mutate of [(n:typeof w)=>{build(n.cities[1],'market',14);},(n:typeof w)=>{n.cities[1].ownerFactionId=n.factions[1].id;},(n:typeof w)=>{n.largeProjects[0].wonder!.phase='building';},(n:typeof w)=>{n.cities[1].logisticsSettings={reserve:zeroResources(),manualCaravans:10};}]){const changed=structuredClone(later);mutate(changed);expect(playerOrderWithBase(changed,o,base,0,w.revision)).toBe(o);}
 expect(playerOrderWithBase(later,o,base,0,later.revision)).toBe(o);
});
