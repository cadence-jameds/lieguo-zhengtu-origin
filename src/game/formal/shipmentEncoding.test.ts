import {expect,it} from 'vitest';
import {canonicalJSON} from './canonical';
import {shipmentPaymentFingerprint} from './commandEvidence';
import type {Resources} from './model';
const encode=(campaign:string,issuer:string,type:'wonder.ship'|'breakthrough.ship',city:string,project:string,resources:Resources)=>canonicalJSON({campaignId:campaign,issuerId:issuer,payload:{type,cityId:city,projectId:project,resources}});
it('reuses encodings only for exactly equal actual payment inputs, including after eviction',()=>{
 for(let round=0;round<2;round++)for(let i=0;i<300;i++){
  const args=['campaign:'+i%3,'faction:'+i%5,i%2?'wonder.ship':'breakthrough.ship','city:'+i%7,'project:'+i%11,{food:i%13,wood:i%17,stone:i%19,gold:i%23}] as const;
  expect(shipmentPaymentFingerprint(...args)).toBe(encode(...args));
  expect(shipmentPaymentFingerprint(...args)).toBe(encode(...args));
 }
});
it('does not reuse an encoding after caller mutation or normalize malformed cargo',()=>{
 const cargo={food:1,wood:2,stone:3,gold:4};
 const check=(resources:Resources)=>expect(shipmentPaymentFingerprint('campaign:a','faction:a','wonder.ship','city:a','project:a',resources)).toBe(encode('campaign:a','faction:a','wonder.ship','city:a','project:a',resources));
 check(cargo);cargo.food++;check(cargo);cargo.gold=-0;check(cargo);
 for(const value of [{...cargo,extra:1},{...cargo,food:undefined},{...cargo,wood:NaN},{food:1,wood:2,stone:3},Object.assign(Object.create(null),cargo)])check(value as Resources);
});
