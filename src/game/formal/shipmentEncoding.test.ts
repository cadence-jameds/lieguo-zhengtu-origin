import {expect,it} from 'vitest';
import {canonicalJSON} from './canonical';
import {shipmentPaymentFingerprint,shipmentPaymentFieldsFingerprint} from './commandEvidence';
import type {Resources} from './model';
const encode=(campaign:string,issuer:string,type:'wonder.ship'|'breakthrough.ship',city:string,project:string,resources:Resources)=>canonicalJSON({campaignId:campaign,issuerId:issuer,payload:{type,cityId:city,projectId:project,resources}});
it('reuses encodings only for exactly equal actual payment inputs, including after eviction',()=>{
 for(let round=0;round<2;round++)for(let i=0;i<300;i++){
  const args=['campaign:'+i%3,'faction:'+i%5,i%2?'wonder.ship':'breakthrough.ship','city:'+i%7,'project:'+i%11,{food:i%13,wood:i%17,stone:i%19,gold:i%23}] as const;
  expect(shipmentPaymentFingerprint(...args)).toBe(encode(...args));
  expect(shipmentPaymentFieldsFingerprint(args[0],args[1],args[2],args[3],args[4],args[5].food,args[5].wood,args[5].stone,args[5].gold)).toBe(encode(...args));
  expect(shipmentPaymentFingerprint(...args)).toBe(encode(...args));
 }
});
it('does not reuse an encoding after caller mutation or normalize malformed cargo',()=>{
 const cargo={food:1,wood:2,stone:3,gold:4};
 const check=(resources:Resources)=>expect(shipmentPaymentFingerprint('campaign:a','faction:a','wonder.ship','city:a','project:a',resources)).toBe(encode('campaign:a','faction:a','wonder.ship','city:a','project:a',resources));
 check(cargo);cargo.food++;check(cargo);cargo.gold=-0;check(cargo);
 for(const value of [{...cargo,extra:1},{...cargo,food:undefined},{...cargo,wood:NaN},{food:1,wood:2,stone:3},Object.assign(Object.create(null),cargo)])check(value as Resources);
 check(Object.assign([],cargo) as unknown as Resources);
 const hidden={...cargo,extra:1};Object.defineProperty(hidden,'food',{enumerable:false});check(hidden);
});
it('scalar reuse cannot hide unknown cargo fields or changed payment amounts from formal Schema validation',async()=>{
 const {wonderWorld,wonderAct}=await import('./wonderTestSupport'),{validateFormalWorld}=await import('./schema');let w=wonderWorld();const cargo={food:10,wood:20,stone:30,gold:40};w.cities[1].stock={food:100,wood:100,stone:100,gold:100};w=wonderAct(w,{type:'wonder.ship',cityId:w.cities[1].id,projectId:w.largeProjects[0].projectId,resources:cargo});const valid=validateFormalWorld(w);
 for(const change of ['extra','missing','nonfinite','amount']){
  const bad=structuredClone(valid),resources=bad.largeProjects[0].shipments[0].resources as unknown as Record<string,unknown>;
  if(change==='extra')resources.extra=1;else if(change==='missing')delete resources.food;else if(change==='nonfinite')resources.food=Infinity;else{resources.food=11;bad.logistics![0].resources.food=11;}
  const before=structuredClone(bad);expect(()=>validateFormalWorld(bad)).toThrow();expect(bad).toEqual(before);
 }
});
