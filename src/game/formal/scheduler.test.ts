import {expect,it} from 'vitest';
import {eventId} from './ids';
import {fixtureIds,createFormalFixture} from './fixture';
import {EventScheduler,compareEvents} from './scheduler';
import type {FormalEvent} from './model';
import {decodeSave,encodeSave} from './saveCodec';
import {advanceFormal} from './reducer';
import {contribute} from './testSupport';
import {submitFormalOrder} from './reducer';
const events:FormalEvent[]=[{id:eventId('c'),at:10,type:'fixture.marker',marker:'c'},{id:eventId('b'),at:10,type:'fixture.marker',marker:'b'},{id:eventId('z'),at:10,type:'research.complete',projectId:fixtureIds.research},{id:eventId('a'),at:5,type:'fixture.marker',marker:'a'}];
it('priority heap uses time, explicit priority, then EventId independently of insertion',()=>{
 for(const input of [events,[...events].reverse(),[events[1],events[3],events[2],events[0]]]){
  const q=new EventScheduler(input),out=[];while(q.size)out.push(q.pop()!.id);expect(out).toEqual(['event:a','event:z','event:b','event:c']);
 }
});
it('heap can interleave new events with pops, rejects duplicate ID and invalid time',()=>{
 const q=new EventScheduler();q.push(events[0]);q.push(events[1]);expect(q.pop()!.id).toBe('event:b');q.push(events[3]);expect(q.pop()!.id).toBe('event:a');expect(()=>q.push(events[0])).toThrow('Duplicate');expect(()=>q.push({...events[2],at:NaN})).toThrow();
});
it('save/load preserves event ordering and every stable EventId',async()=>{
 const w=submitFormalOrder(createFormalFixture({research:true}),contribute(createFormalFixture({research:true}),'fund')).world;
 const q=new EventScheduler(w.events);q.push({...events[0],at:47400});q.push({...events[1],at:47400});w.events=q.snapshot();
 const loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded.events).toEqual(w.events);expect(new EventScheduler(loaded.events).snapshot()).toEqual(w.events);
 expect([...loaded.events].sort(compareEvents)).toEqual(w.events);
});
it('one-pass and sliced advances produce the same event/project/report effects apart from commit revisions',()=>{
 const w=submitFormalOrder(createFormalFixture({research:true}),contribute(createFormalFixture({research:true}),'fund')).world;
 const one=advanceFormal(w,60000),first=advanceFormal(w,10000),sliced=advanceFormal(first.world,60000);
 expect({...sliced.world,revision:one.world.revision}).toEqual(one.world);expect([...first.reports,...sliced.reports]).toEqual(one.reports);
});
it('large shuffled input drains in deterministic sorted order',()=>{
 const input=Array.from({length:3000},(_,i):FormalEvent=>({id:eventId(String(i).padStart(5,'0')),at:(i*137)%101,type:'fixture.marker',marker:'x'}));
 const q=new EventScheduler([...input].reverse()),out=[];while(q.size)out.push(q.pop()!);expect(out).toEqual([...input].sort(compareEvents));
});
