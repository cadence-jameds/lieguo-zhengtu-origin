import {afterEach,expect,it,vi} from 'vitest';
import {createFormalFixture} from './fixture';
import {createFormalWorld} from './generator';
import {enableAutonomy} from './autonomy';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {order} from './developmentTestSupport';
import * as drafts from './worldDraft';
import {canonicalJSON,digest} from './canonical';
import {validateFormalWorld} from './schema';
afterEach(()=>vi.restoreAllMocks());
function history(){const w=createFormalFixture();return submitFormalOrder(w,order(w,{type:'city.rename',cityId:w.cities[0].id,name:'Receipt source'})).world;}
it('copies every receipt field and nested world independently of the caller',()=>{
 const input=history(),expected=structuredClone(input),copy=drafts.cloneWorldDraft(input);
 expect(copy).toEqual(expected);expect(copy.commandReceipts[0]).not.toBe(input.commandReceipts[0]);
 input.commandReceipts[0].fingerprint='caller mutation';input.commandReceipts[0].committedRevision++;
 input.commandReceipts[0].disposition='rolled-back';input.commandReceipts[0].issuerId='faction:changed' as never;input.commandReceipts[0].commandId='command:changed' as never;
 input.commandReceipts.length=0;input.cities[0].stock.food=0;expect(copy).toEqual(expected);
 copy.cities[0].name='draft only';expect(input.cities[0].name).toBe(expected.cities[0].name);
});
it('keeps malformed nested receipt fields on the full clone path and strict rejection',()=>{
 const input=history(),r=input.commandReceipts[0] as unknown as Record<string,unknown>;r.extra={nested:{value:1}};
 const copy=drafts.cloneWorldDraft(input);expect(copy).toEqual(structuredClone(input));(r.extra as {nested:{value:number}}).nested.value=2;
 expect((copy.commandReceipts[0] as any).extra.nested.value).toBe(1);expect(()=>validateFormalWorld(copy)).toThrow();
});
it('cannot turn an invalid receipt primitive or non-cloneable value into a valid draft',()=>{
 const input=history();(input.commandReceipts[0] as any).fingerprint={nested:true};const copy=drafts.cloneWorldDraft(input);
 expect(copy).toEqual(structuredClone(input));expect(()=>validateFormalWorld(copy)).toThrow();
 (input.commandReceipts[0] as any).fingerprint=()=>0;expect(()=>drafts.cloneWorldDraft(input)).toThrow();
});
it('does not normalize a non-record receipt into a valid plain record',()=>{
 const input=history();input.commandReceipts[0]=Object.assign(new Date(0),input.commandReceipts[0]);
 const copy=drafts.cloneWorldDraft(input);expect(copy.commandReceipts[0]).toBeInstanceOf(Date);expect(()=>validateFormalWorld(copy)).toThrow();
});
it('frozen histories remain untouched through command and clock admission and have identical checksums',async()=>{
 const input=history(),before=canonicalJSON(input);for(const r of input.commandReceipts)Object.freeze(r);Object.freeze(input.commandReceipts);
 const o=order(input,{type:'city.rename',cityId:input.cities[0].id,name:'Isolated'}),actual=submitFormalOrder(input,o),clock=advanceFormal(input,input.time+1);
 vi.spyOn(drafts,'cloneWorldDraft').mockImplementation(structuredClone);const reference=submitFormalOrder(input,o),referenceClock=advanceFormal(input,input.time+1);
 expect(actual).toEqual(reference);expect(clock).toEqual(referenceClock);expect(await digest(actual.world)).toBe(await digest(reference.world));expect(canonicalJSON(input)).toBe(before);
});
it('99 original AI agents have identical events, receipts, reports and state in synchronous and cooperative replay',async()=>{
 const input=createFormalWorld({campaign:'c4-clone-equivalence',seed:12012});enableAutonomy(input);expect(input.autonomy!.agents).toHaveLength(99);
 const before=canonicalJSON(input),target=input.time+3600000,actual=advanceFormal(input,target),cooperative=await advanceFormalCooperative(input,target,undefined,{yieldIntervalMs:8});
 vi.spyOn(drafts,'cloneWorldDraft').mockImplementation(structuredClone);const reference=advanceFormal(input,target);
 expect(actual).toEqual(reference);expect(cooperative).toEqual(reference);expect(canonicalJSON(input)).toBe(before);expect(actual.world.commandReceipts.length).toBeGreaterThan(input.commandReceipts.length);expect(()=>validateFormalWorld(actual.world)).not.toThrow();
});
