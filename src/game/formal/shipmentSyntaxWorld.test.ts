import {expect,it,vi} from 'vitest';
import {wonderWorld} from './wonderTestSupport';
import {order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import * as validation from './schema';
import type {FormalWorld} from './model';
import {canonicalJSON} from './canonical';
function send(){const w=wonderWorld();w.cities[1].stock={food:1,wood:0,stone:0,gold:0};return{w,command:order(w,{type:'wonder.ship',cityId:w.cities[1].id,projectId:w.largeProjects[0].projectId,resources:{food:1,wood:0,stone:0,gold:0}})};}
it('retains exact command/arrival/return worlds, reports and Acks versus the complete uncached validator',()=>{
 const {w,command}=send(),before=canonicalJSON(w),actual=submitFormalOrder(w,command),target=actual.world.logistics![0].returnAt,clock=advanceFormal(actual.world,target);
 const spy=vi.spyOn(validation,'validateFormalDraft').mockImplementation(validation.validateFormalWorld);
 try{const expected=submitFormalOrder(w,command);expect(actual).toEqual(expected);expect(clock).toEqual(advanceFormal(expected.world,target));expect(canonicalJSON(w)).toBe(before);}finally{spy.mockRestore();}
});
it('still revalidates pool totals, duplicate identities, payment evidence, world time and ownership after syntax hits',()=>{
 const {w,command}=send(),sent=submitFormalOrder(w,command),funded=advanceFormal(sent.world,sent.world.logistics![0].returnAt).world;
 const normalized=(state:FormalWorld,draft:boolean)=>{try{return{world:(draft?validation.validateFormalDraft:validation.validateFormalWorld)(structuredClone(state))};}catch(e){return{issues:(e as {issues?:unknown}).issues??String(e)};}};
 const cases=[funded];
 const pool=structuredClone(funded);pool.largeProjects[0].poolResources.food++;cases.push(pool);
 const duplicate=structuredClone(funded);duplicate.largeProjects[0].shipments.push(structuredClone(duplicate.largeProjects[0].shipments[0]));cases.push(duplicate);
 const payment=structuredClone(funded);payment.commandReceipts.find(r=>r.commandId===command.commandId)!.fingerprint='{}';cases.push(payment);
 const cargo=structuredClone(funded);cargo.largeProjects[0].shipments[0].resources.food=2;cargo.largeProjects[0].poolResources.food=2;cases.push(cargo);
 const time=structuredClone(funded);time.time=0;cases.push(time);
 const owner=structuredClone(funded);owner.cities[1].ownerFactionId=owner.factions[1].id;cases.push(owner);
 for(const state of cases)expect(normalized(state,true)).toEqual(normalized(state,false));
 for(const state of [pool,duplicate,payment,cargo])expect('issues' in normalized(state,true)).toBe(true);
});
