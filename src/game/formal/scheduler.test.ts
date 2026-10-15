import {expect,it} from 'vitest';
import {eventId} from './ids';
import {fixtureIds,createFormalFixture} from './fixture';
import {EventScheduler,compareEvents} from './scheduler';
import type {FormalEvent} from './model';
import {decodeSave,encodeSave} from './saveCodec';
import {advanceFormal} from './reducer';
import {contribute} from './testSupport';
import {submitFormalOrder} from './reducer';
import {eventSchema} from './schema';
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

it('linear heap replacement and cancellation retain identical event ordering and atomic validation',()=>{
 const input=Array.from({length:2400},(_,i):FormalEvent=>({id:eventId('bulk'+i),at:(i*491)%781,type:'fixture.marker',marker:'bulk'}));
 const fromPush=new EventScheduler();for(const event of [...input].reverse())fromPush.push(event);
 const bulk=new EventScheduler([...input].reverse());
 expect(bulk.snapshot()).toEqual(fromPush.snapshot());
 const replacement=[...input.filter((_,i)=>i%4!==0),{id:eventId('late'),at:0,type:'fixture.marker' as const,marker:'late'}];
 bulk.replace(replacement);
 expect(bulk.snapshot()).toEqual([...replacement].sort(compareEvents));
 const removed=new Set(replacement.filter((_,i)=>i%7===0).map(e=>e.id));
 bulk.discard(removed);
 const expected=replacement.filter(e=>!removed.has(e.id)).sort(compareEvents);
 expect(bulk.snapshot()).toEqual(expected);
 const before=bulk.snapshot();
 expect(()=>bulk.replace([replacement[0],replacement[0]])).toThrow('Duplicate EventId');
 expect(()=>bulk.replace([{...replacement[0],at:NaN}])).toThrow('Invalid event');
 expect(bulk.snapshot()).toEqual(before);
 const drained:FormalEvent[]=[];while(bulk.size)drained.push(bulk.pop()!);
 expect(drained).toEqual(expected);
});

it('internal replay cloning preserves every legal flat event variant and deterministic heap order',()=>{
 const shapes=[
  {type:'governance.decide',cityId:'city:x'},{type:'ai.decide',factionId:'faction:x'},
  {type:'politics.end-friendly',a:'faction:x',b:'faction:y'},{type:'craftsman.arrive',craftsmanId:'craftsman:x'},
  {type:'age.complete',factionId:'faction:x'},{type:'military.train',cityId:'city:x'},
  {type:'settlement.ready',projectId:'project:x'},{type:'settlement.arrive',projectId:'project:x'},
  {type:'army.depart',armyId:'army:x'},{type:'army.arrive',armyId:'army:x'},{type:'army.return',armyId:'army:x'},
  {type:'combat.round',battleId:'battle:x'},{type:'wild.respawn',siteId:'wild:x',generation:0},
  {type:'economy.settle',cityId:'city:x'},{type:'construction.complete',cityId:'city:x'},
  {type:'city.promote.complete',cityId:'city:x'},{type:'logistics.arrive',shipmentId:'shipment:x'},
  {type:'logistics.return',shipmentId:'shipment:x'},{type:'research.complete',projectId:'research:x'},
  {type:'fixture.marker',marker:'flat'},
 ];
 const input=shapes.map((shape,i)=>eventSchema.parse({...shape,id:eventId('flat-'+i),at:i%3}));
 const native=new EventScheduler([...input].reverse()),replay=EventScheduler.forReplay(input);
 expect(replay.snapshot()).toEqual(native.snapshot());
 while(native.size)expect(replay.pop()).toEqual(native.pop());expect(replay.size).toBe(0);
});

for(const mode of ['native','replay'] as const)it(`${mode} constructor, replace, push and snapshots isolate caller-owned events`,()=>{
 const make=mode==='native'?(input:FormalEvent[])=>new EventScheduler(input):EventScheduler.forReplay;
 const first:FormalEvent={id:eventId('first'),at:1,type:'fixture.marker',marker:'first'},q=make([first]);
 first.at=9;first.marker='changed';expect(q.snapshot()[0]).toMatchObject({at:1,marker:'first'});
 const replaced:FormalEvent={id:eventId('replaced'),at:2,type:'fixture.marker',marker:'replaced'};q.replace([replaced]);replaced.at=9;
 const pushed:FormalEvent={id:eventId('pushed'),at:3,type:'fixture.marker',marker:'pushed'};q.push(pushed);pushed.at=0;
 const before=q.snapshot(),snapshot=q.snapshot();snapshot[0].at=99;snapshot.push(first);
 expect(q.snapshot()).toEqual(before);expect(before.map(e=>e.at)).toEqual([2,3]);
 expect(()=>q.replace([replaced,replaced])).toThrow('Duplicate EventId');expect(q.snapshot()).toEqual(before);
});

it('internal replay fallback deeply isolates unexpected nested and cyclic data',()=>{
 const nested:{items:number[];self?:unknown}={items:[1]};nested.self=nested;
 const event={id:eventId('nested'),at:1,type:'fixture.marker' as const,marker:'nested',extra:nested};
 const expected=structuredClone(event);
 const q=EventScheduler.forReplay([event]);nested.items.push(2);
 const snapshot=q.snapshot() as (FormalEvent&{extra:typeof nested})[];expect(snapshot[0].extra.items).toEqual([1]);
 expect(snapshot[0].extra.self).toBe(snapshot[0].extra);snapshot[0].extra.items.push(3);
 expect(q.snapshot()).toEqual([expected]);
 const replacement={...event,id:eventId('nested-replace'),extra:{items:[4]}},pushed={...event,id:eventId('nested-push'),extra:{items:[5]}};
 q.replace([replacement]);q.push(pushed);replacement.extra.items.push(6);pushed.extra.items.push(7);
 expect((q.snapshot() as (FormalEvent&{extra:{items:number[]}})[]).map(e=>e.extra.items)).toEqual([[5],[4]]);
});

it('internal replay fallback matches native getter, symbol, nonenumerable and prototype cloning',()=>{
 const base=()=>({id:eventId('edge'),at:1,type:'fixture.marker' as const,marker:'edge'});
 const withGetter=()=>Object.defineProperty(base(),'extra',{enumerable:true,get:()=>({items:[1]})});
 const withSymbol=()=>Object.assign(base(),{[Symbol('ignored')]:{nested:true}});
 const withHidden=()=>Object.defineProperty(base(),'hidden',{enumerable:false,value:{items:[2]}});
 const withPrototype=()=>Object.setPrototypeOf(base(),{inherited:'ignored'});
 const withNullPrototype=()=>Object.setPrototypeOf(base(),null);
 const withProtoKey=()=>Object.defineProperty(base(),'__proto__',{enumerable:true,writable:true,configurable:true,value:'literal'});
 for(const make of [withGetter,withSymbol,withHidden,withPrototype,withNullPrototype,withProtoKey,()=>Object.freeze(base())]){
  const input=make(),expected=structuredClone(input),actual=EventScheduler.forReplay([input]).snapshot()[0];
  expect(actual).toEqual(expected);expect(Object.getPrototypeOf(actual)).toBe(Object.getPrototypeOf(expected));expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(expected));
 }
 let reads=0;const getter=Object.defineProperty(base(),'extra',{enumerable:true,get:()=>{reads++;return {value:1};}});
 EventScheduler.forReplay([getter]);expect(reads).toBe(1);
 for(const extra of [Symbol('value'),()=>undefined]){
  const invalidEvent={...base(),extra};
  expect(()=>EventScheduler.forReplay([invalidEvent])).toThrow();
 }
});

it('public scheduler keeps native Proxy rejection and replacement failure isolation',()=>{
 const input:FormalEvent={id:eventId('proxy'),at:1,type:'fixture.marker',marker:'proxy'},proxy=new Proxy(input,{});
 expect(()=>new EventScheduler([proxy])).toThrow();
 const q=new EventScheduler([events[0]]),before=q.snapshot();expect(()=>q.replace([proxy])).toThrow();expect(q.snapshot()).toEqual(before);
 expect(()=>q.push(proxy)).toThrow();expect(q.snapshot()).toEqual(before);
 q.push(input);expect(q.snapshot()).toEqual([...before,input].sort(compareEvents));
});
