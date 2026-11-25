import {afterEach,expect,it,vi} from 'vitest';
import * as autonomy from './autonomy';
import * as economy from './economy';
import * as governance from './governance';
import * as growth from './growthTasks';
import {setClockMode} from './campaignTime';
import {canonicalJSON} from './canonical';
import {commandHistory,worldLedger} from './commandLedger';
import {build,order} from './developmentTestSupport';
import {createFormalWorld} from './generator';
import {eventId} from './ids';
import {encodeScenario as encodeSave} from './ledgerTestSupport';
import type {FormalCommand,FormalOrder,FormalTransition,FormalWorld} from './model';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {decodeSave} from './saveCodec';
afterEach(()=>vi.restoreAllMocks());
const HOUR=3600000;
function governed(){
 const w=createFormalWorld({campaign:'p0-replay-governor',seed:12012});build(w.cities[0],'townhall',1);
 return submitFormalOrder(w,order(w,{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'economy',budget:2400,reserve:0},'governor')).world;
}
/** Reference control retains the pre-optimization full clone and global validation on every admission. */
function referenceAdvance(w:FormalWorld,target:number):FormalTransition {
 const ai=autonomy.handleAutonomy,governor=governance.handleGovernance;
 const aiSpy=vi.spyOn(autonomy,'handleAutonomy').mockImplementation((draft,event,scheduler)=>ai(draft,event,scheduler,submitFormalOrder));
 const governorSpy=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler)=>governor(draft,event,scheduler,submitFormalOrder));
 try{return advanceFormal(w,target);}finally{aiSpy.mockRestore();governorSpy.mockRestore();}
}
function governedCommand(w:FormalWorld,payload:FormalCommand,reference:boolean,target=0,status='committed'){
 const governor=governance.handleGovernance;let admissions=0;
 const spy=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current,value)=>{
  const before=canonicalJSON(current),events=scheduler.snapshot();
  const t=(reference?submitFormalOrder:submit)(current,{...(value as FormalOrder),payload});
  expect(t.ack?.status,t.ack?.reason).toBe(status);expect(canonicalJSON(current)).toBe(before);expect(scheduler.snapshot()).toEqual(events);
  if(status==='rejected')expect(t.world).toBe(current);admissions++;return t;
 }));
 try{const t=advanceFormal(w,target);expect(admissions).toBe(1);return t;}finally{spy.mockRestore();}
}

const scopedCommand=(w:FormalWorld):FormalCommand=>({type:'field.upgrade',cityId:w.cities[0].id,slot:0});

function factsClones(calls:unknown[][]):number {
 return calls.filter(([input])=>{
  if(!input||typeof input!=='object')return false;
  const value=input as {commandFacts?:unknown;evidence?:unknown;minimumGovernance?:unknown};
  return !!(value.commandFacts||value.evidence&&value.minimumGovernance);
 }).length;
}

it('offline facts ownership eliminates per-command copies and keeps the foreground path unchanged',async()=>{
 const foreground=governed();autonomy.enableAutonomy(foreground);
 const input=structuredClone(foreground);setClockMode(input,'offline');
 const before=canonicalJSON(input),target=HOUR;
 const reference=referenceAdvance(input,target);
 const clone=vi.spyOn(globalThis,'structuredClone');
 const actual=await advanceFormalCooperative(input,target,undefined,{yieldIntervalMs:8});
 expect(factsClones(clone.mock.calls)).toBe(1);
 expect(actual).toEqual(reference);expect(canonicalJSON(input)).toBe(before);
 expect(actual.world.commandFacts!.effects).toBeGreaterThan(input.commandFacts!.effects);
 for(const fact of Object.values(actual.world.commandFacts!.evidence))expect(fact.committedRevision).toBeLessThanOrEqual(actual.world.revision);
 clone.mockClear();
 const live=await advanceFormalCooperative(foreground,target,undefined,{yieldIntervalMs:8});
 expect(live.world.commandFacts!.effects).toBeGreaterThan(foreground.commandFacts!.effects);
 expect(factsClones(clone.mock.calls)).toBeGreaterThan(1);
},20000);

it('bounded offline replay agrees with full validation, including evidence and ledger delta',async()=>{
 const w=governed();autonomy.enableAutonomy(w);
 const restored=(await decodeSave(await encodeSave(w))).world;
 setClockMode(restored,'offline');
 const before=canonicalJSON({world:restored,history:Array.from(commandHistory(restored)),archive:worldLedger(restored).archive()});
 const reference=referenceAdvance(restored,HOUR/4);
 const actual=advanceFormal(restored,HOUR/4);
 expect(actual.world.commandFacts!.effects).toBeGreaterThan(restored.commandFacts!.effects);
 expect(actual.world.commandFacts).toEqual(reference.world.commandFacts);
 expect(actual.world.ledger).toEqual(reference.world.ledger);
 expect(worldLedger(actual.world).archive()).toEqual(worldLedger(reference.world).archive());
 expect(actual.reports).toEqual(reference.reports);
 expect(actual).toEqual(reference);
 expect(canonicalJSON({world:restored,history:Array.from(commandHistory(restored)),archive:worldLedger(restored).archive()})).toBe(before);
},20000);

it('offline evidence with a cross-domain alias keeps the original clone path',()=>{
 const w=governed();setClockMode(w,'offline');
 const fact=w.commandFacts!.evidence['command:governor'];
 fact.payload.resources=w.cities[0].stock;
 const payload=scopedCommand(w),before=canonicalJSON(w),reference=governedCommand(w,payload,true);
 const clone=vi.spyOn(globalThis,'structuredClone'),actual=governedCommand(w,payload,false);
 expect(factsClones(clone.mock.calls)).toBeGreaterThan(1);
 expect(actual).toEqual(reference);
 expect(actual.world.commandFacts!.evidence['command:governor'].payload.resources).toBe(actual.world.cities[0].stock);
 expect(canonicalJSON(w)).toBe(before);
});

it('an offline rejection after a draft write leaves borrowed evidence unchanged',()=>{
 const w=governed();setClockMode(w,'offline');const before=canonicalJSON(w);
 const handler=economy.applyEconomyCommand;
 vi.spyOn(economy,'applyEconomyCommand').mockImplementation((...args)=>{handler(...args);throw new economy.RuleViolation('offline rejection after spend');});
 const result=governedCommand(w,scopedCommand(w),false,0,'rejected');
 expect(result.world.commandFacts).toEqual(w.commandFacts);
 expect(result.world.commandReceipts).toEqual(w.commandReceipts);
 expect(canonicalJSON(w)).toBe(before);
});

it('a failure after drafting the receipt but before acceptance never changes the owned replay evidence',()=>{
 const w=governed();setClockMode(w,'offline');const before=canonicalJSON(w);
 const governor=governance.handleGovernance;let checked=false;
 const growthFault=vi.spyOn(growth,'recordGrowthCommand').mockImplementation(()=>{throw new Error('offline growth fault');});
 vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current,value)=>{
  const facts=canonicalJSON(current.commandFacts),history=canonicalJSON(current.commandReceipts);
  expect(()=>submit(current,value)).toThrow('offline growth fault');
  expect(canonicalJSON(current.commandFacts)).toBe(facts);
  expect(canonicalJSON(current.commandReceipts)).toBe(history);
  checked=true;throw Error('offline growth fault');
 }));
 expect(()=>advanceFormal(w,0)).toThrow('offline growth fault');expect(checked).toBe(true);
 expect(growthFault).toHaveBeenCalledTimes(1);expect(canonicalJSON(w)).toBe(before);
});

it('cancelling after a successful offline command keeps the source private and replays identically',async()=>{
 const w=governed();setClockMode(w,'offline');
 w.events.push({id:eventId(String(w.sequences.event++).padStart(16,'0')),at:1,type:'fixture.marker',marker:'offline-cancel'});
 const before=canonicalJSON(w),progress:number[]=[];
 await expect(advanceFormalCooperative(w,1,(_at,_target,processed)=>{progress.push(processed);},{
  yieldIntervalMs:0,yieldControl:async()=>{throw Error('cancelled offline replay');}
 })).rejects.toThrow('cancelled offline replay');
 expect(progress).toEqual([1]);expect(canonicalJSON(w)).toBe(before);
 const reference=referenceAdvance(w,1);expect(reference.world.commandFacts!.effects).toBeGreaterThan(w.commandFacts!.effects);
 expect(await advanceFormalCooperative(w,1,undefined,{yieldIntervalMs:0})).toEqual(reference);
 expect(canonicalJSON(w)).toBe(before);
});
