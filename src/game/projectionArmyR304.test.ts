import {expect,it} from 'vitest';
import {ownSecond} from './formal/developmentTestSupport';
import {battlefield,dispatch,issue} from './formal/combatTestSupport';
import {advanceFormal} from './formal/reducer';
import {isMissionArmy} from './formal/combatModel';
import {sealProjectionScenario} from './formal/projectionBenchmarkSupport';
import {WorldStream} from './worldStream';
import {PresentationStore} from './presentationStore';
it('formal dispatch, travel, recall and return produce exact Add/Update/Remove deltas and preserve unrelated entities',async()=>{
 const raw=battlefield();ownSecond(raw);raw.cities[0].military!.units={militia:10};let w=await sealProjectionScenario(raw);const stream=new WorldStream(),store=new PresentationStore(),writer={branch:0,writerEpoch:0};expect(store.receive(stream.publish(w,writer)).accepted).toBe(true);const unrelated=store.getWorld()!.cities[5];
 w=await sealProjectionScenario(dispatch(w,'reinforce',{militia:10}).world);const added=stream.publish(w,writer);if(added.kind!=='patch')throw Error();expect(added.entities.armies![0].op).toBe('add');expect(store.receive(structuredClone(added)).accepted).toBe(true);expect(store.getWorld()!.armies).toEqual(w.armies);
 const army=w.armies.find(isMissionArmy)!;w=await sealProjectionScenario(advanceFormal(w,Math.floor((army.departedAt+army.arrivalAt)/2)).world);expect(store.receive(stream.publish(w,writer)).accepted).toBe(true);expect(store.getWorld()!.time).toBe(w.time);
 w=await sealProjectionScenario(advanceFormal(w,army.arrivalAt).world);expect(store.receive(stream.publish(w,writer)).accepted).toBe(true);expect(w.armies.find(isMissionArmy)!.status).toBe('stationed');
 w=await sealProjectionScenario(issue(w,{type:'army.recall',cityId:w.cities[1].id,armyId:army.id}).world);const updated=stream.publish(w,writer);if(updated.kind!=='patch')throw Error();expect(updated.entities.armies![0].op).toBe('update');expect(store.receive(structuredClone(updated)).accepted).toBe(true);expect(store.getWorld()!.armies).toEqual(w.armies);
 const returning=w.armies.find(isMissionArmy)!;expect(returning.status).toBe('returning');w=await sealProjectionScenario(advanceFormal(w,returning.arrivalAt).world);const removed=stream.publish(w,writer);if(removed.kind!=='patch')throw Error();expect(removed.entities.armies![0].op).toBe('remove');expect(store.receive(structuredClone(removed)).accepted).toBe(true);expect(store.getWorld()!.armies).toEqual(w.armies);expect(w.armies).toHaveLength(0);expect(store.getWorld()!.cities[5]).toBe(unrelated);
 const before=store.getWorld(),forged=structuredClone(removed);forged.projectionSequence++;forged.baseSequence!++;forged.baseRevision=forged.nextRevision;expect(store.receive(forged).accepted).toBe(false);expect(store.getWorld()).toBe(before);
});
