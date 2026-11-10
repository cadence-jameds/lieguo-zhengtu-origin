import {expect,it,vi} from 'vitest';
import {z} from 'zod';
import type {FormalWorld,Shipment} from './model';
import {shipmentSyntax,withDraftShipmentSyntax,withShipmentValidation} from './shipmentSyntax';
const amount=z.number().int().nonnegative().safe(),id=z.string().regex(/^[a-z]+:[a-z0-9]+$/);
const resources=z.object({food:amount,wood:amount,stone:amount,gold:amount}).strict();
function syntax(){const base=z.object({commandId:id.optional(),shipmentId:id,projectId:id,sourceFactionId:id,sourceCityId:id,destinationCityId:id,resources,dispatchedAt:amount,authorizationSnapshot:z.object({sourceCityOwnerFactionId:id,contributorEmpireId:id.nullable(),checkedAt:amount}).strict()}).strict();return z.discriminatedUnion('phase',[base.extend({phase:z.literal('in-transit'),arrivedAt:z.never().optional(),arrivalEventId:z.never().optional()}),base.extend({phase:z.literal('arrived'),arrivedAt:amount,arrivalEventId:id}),base.extend({phase:z.literal('returned'),arrivedAt:amount,arrivalEventId:id})]) as unknown as z.ZodType<Shipment>;}
const row=():Shipment=>({commandId:'command:1' as never,shipmentId:'shipment:1' as never,projectId:'project:1' as never,sourceFactionId:'faction:1' as never,sourceCityId:'city:1' as never,destinationCityId:'city:2' as never,resources:{food:30000,wood:0,stone:0,gold:0},dispatchedAt:0,authorizationSnapshot:{sourceCityOwnerFactionId:'faction:1' as never,contributorEmpireId:'empire:1' as never,checkedAt:0},phase:'arrived',arrivedAt:1,arrivalEventId:'event:1' as never});
const world=(rows:Shipment[])=>({largeProjects:[{shipments:rows}]} as FormalWorld);
const normalize=(r:z.SafeParseReturnType<unknown,Shipment>)=>r.success?{data:r.data}:{issues:r.error.issues};
const check=(s:z.ZodType<Shipment>,r:Shipment)=>withDraftShipmentSyntax(world([r]),()=>normalize(s.safeParse(r)));
it('reuses only exact structural content and returns independent mutable parsed copies',()=>{
 const s=syntax(),fast=shipmentSyntax(s),spy=vi.spyOn(s,'_parse'),input=row();
 try{const first=withDraftShipmentSyntax(world([input]),()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(1);
  const second=withDraftShipmentSyntax(world([input]),()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(1);expect(second).toEqual(first);expect(Object.keys(second)).toEqual(Object.keys(first));
  second.resources.food=1;second.authorizationSnapshot.checkedAt=8;expect(first.resources.food).toBe(30000);expect(input.resources.food).toBe(30000);
  expect(withDraftShipmentSyntax(world([input]),()=>fast.parse(input))).toEqual(first);
 }finally{spy.mockRestore();}
});
it('invalidates every changed field, nested value, unknown undefined key and signed zero',()=>{
 const s=syntax(),fast=shipmentSyntax(s);check(fast,row());const cases:Shipment[]=[];
 for(const k of Object.keys(row()))for(const v of [undefined,null,{},[],NaN,Infinity,-1,'bad'])cases.push({...row(),[k]:v} as Shipment);
 for(const k of ['food','wood','stone','gold','extra'])for(const v of [undefined,-1,-0,1.5,30001])cases.push({...row(),resources:{...row().resources,[k]:v}} as Shipment);
 for(const k of ['sourceCityOwnerFactionId','contributorEmpireId','checkedAt','extra'])cases.push({...row(),authorizationSnapshot:{...row().authorizationSnapshot,[k]:undefined}} as Shipment);
 cases.push({...row(),extra:undefined} as unknown as Shipment,{...row(),dispatchedAt:-0});
 for(const input of cases)expect(check(fast,input)).toEqual(normalize(s.safeParse(input)));
 const minus={...row(),dispatchedAt:-0};expect(Object.is((check(fast,minus) as {data:Shipment}).data.dispatchedAt,-0)).toBe(true);
});
it('keeps public validation uncached, including proxies and getters, and closes scope after exceptions',()=>{
 const s=syntax(),fast=shipmentSyntax(s),input=row(),spy=vi.spyOn(s,'_parse');
 try{check(fast,input);spy.mockClear();expect(normalize(fast.safeParse(input))).toEqual(normalize(s.safeParse(input)));expect(spy).toHaveBeenCalledTimes(2);
  const proxy=new Proxy(row(),{});expect(normalize(fast.safeParse(proxy))).toEqual(normalize(s.safeParse(proxy)));
  const getter=row();Object.defineProperty(getter,'dispatchedAt',{enumerable:true,get:()=>0});expect(normalize(fast.safeParse(getter))).toEqual(normalize(s.safeParse(getter)));
  expect(()=>withDraftShipmentSyntax(world([input]),()=>{throw Error('scope');})).toThrow('scope');spy.mockClear();fast.parse(input);expect(spy).toHaveBeenCalledTimes(1);
 }finally{spy.mockRestore();}
});
it('binds reuse to the current syntax rules and disables effectful schemas',()=>{
 const s=syntax(),fast=shipmentSyntax(s),input=row();check(fast,input);
 const option=(s as any)._def.optionsMap.get('arrived'),shape=option._getCached().shape;shape.arrivedAt=amount.min(10);
 expect(check(fast,input)).toEqual(normalize(s.safeParse(input)));expect('issues' in check(fast,input)).toBe(true);
 let allowed=true;const effect=syntax().refine(()=>allowed),guarded=shipmentSyntax(effect);expect('data' in check(guarded,input)).toBe(true);allowed=false;expect(check(guarded,input)).toEqual(normalize(effect.safeParse(input)));
});
it('keeps a bounded stable prefix and parses overflow without eviction thrashing',()=>{
 const s=syntax(),fast=shipmentSyntax(s),rows=Array.from({length:4097},(_,i)=>({...row(),shipmentId:('shipment:'+i) as never})),spy=vi.spyOn(s,'_parse');
 try{withDraftShipmentSyntax(world(rows),()=>rows.forEach(r=>fast.parse(r)));expect(spy).toHaveBeenCalledTimes(4097);spy.mockClear();
  withDraftShipmentSyntax(world(rows),()=>rows.forEach(r=>fast.parse(r)));expect(spy).toHaveBeenCalledTimes(1);
 }finally{spy.mockRestore();}
});
it('invalidates campaign and branch contexts even when a row has identical content',()=>{
 const s=syntax(),fast=shipmentSyntax(s),input=row(),w=world([input]),spy=vi.spyOn(s,'_parse');
 try{withDraftShipmentSyntax(w,()=>fast.parse(input));withDraftShipmentSyntax(w,()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(1);
  w.campaignId='campaign:next' as never;withDraftShipmentSyntax(w,()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(2);
  w.ledger={anchor:{branch:2,writerEpoch:3}} as never;withDraftShipmentSyntax(w,()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(3);
 }finally{spy.mockRestore();}
});
it('consumes the private root permit once; re-entrant public validation uses the original parser',()=>{
 const s=syntax(),fast=shipmentSyntax(s),input=row(),w=world([input]),spy=vi.spyOn(s,'_parse');
 try{check(fast,input);spy.mockClear();
  withDraftShipmentSyntax(w,()=>{withShipmentValidation(w,()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(0);withShipmentValidation(w,()=>fast.parse(input));expect(spy).toHaveBeenCalledTimes(1);});
 }finally{spy.mockRestore();}
});
