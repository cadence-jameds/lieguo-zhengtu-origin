// @vitest-environment happy-dom
import {act,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {PresentationStore} from './presentationStore';
import {ProjectionRecovery} from './projectionRecovery';
import {fixtureStream} from './formal/projectionFixtureSupport';
import {createFormalFixture} from './formal/fixture';
import {cityScreenSelector} from './presentationSelectors';
import {usePresentationSelector} from './usePresentation';
import type {FormalWorld} from './formal/model';
import type {PresentationWorld} from './presentationModel';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('100 city updates: v1 whole-city-section control renders both consumers; v2 renders only the changed city',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 class SectionControl extends PresentationStore {control:PresentationWorld|null=null;override getWorld=()=>this.control;}
 const stream=fixtureStream(),oldStream=fixtureStream(),store=new PresentationStore(),control=new SectionControl(),writer={branch:1,writerEpoch:1};let w=createFormalFixture();store.receive(stream.publish(w,writer));control.control=store.getWorld();control.receive(oldStream.publish(w,writer));const counts:Record<string,number>={};
 function City({source,id,label}:{source:PresentationStore;id:string;label:string}){const select=useMemo(()=>cityScreenSelector(id),[id]),view=usePresentationSelector(source,select);counts[label]=(counts[label]??0)+1;return <span>{view?.cities.find(c=>c.id===id)?.stock.food}</span>;}
 const node=document.createElement('div'),root=createRoot(node),first=w.cities[0].id,other=w.cities[1].id;await act(async()=>root.render(<><City source={store} id={first} label="newChanged"/><City source={store} id={other} label="newOther"/><City source={control} id={first} label="oldChanged"/><City source={control} id={other} label="oldOther"/></>));
 for(let i=0;i<100;i++){w={...w,revision:w.revision+1,cities:w.cities.map((c,n)=>n?c:{...c,stock:{...c.stock,food:c.stock.food+1}})};await act(async()=>{expect(store.receive(structuredClone(stream.publish(w,writer))).accepted).toBe(true);const current=store.getWorld()!;control.control={...current,cities:structuredClone(current.cities)};expect(control.receive(oldStream.publish(w,writer,true)).accepted).toBe(true);});}
 expect(counts).toEqual({newChanged:101,newOther:1,oldChanged:101,oldOther:101});expect(control.getWorld()!.cities).toEqual(store.getWorld()!.cities);await act(async()=>root.unmount());
});
it('city/entity selectors skip unrelated cities; local recruitment input never constructs or changes the store world',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const stream=fixtureStream(),store=new PresentationStore();let world=createFormalFixture();const writer={branch:1,writerEpoch:1};store.receive(stream.publish(world,writer));
 const first=world.cities[0].id,second=world.cities[1].id,renders:Record<string,number>={};let input:(v:string)=>void=()=>{};
 function City({id}:{id:string}){const selector=useMemo(()=>cityScreenSelector(id),[id]),w=usePresentationSelector(store,selector),[amount,setAmount]=useState('1');if(id===first)input=setAmount;renders[id]=(renders[id]??0)+1;return <div>{w?.cities.find(c=>c.id===id)?.stock.food}:{amount}</div>;}
 const node=document.createElement('div'),root=createRoot(node);await act(async()=>root.render(<><City id={first}/><City id={second}/></>));const initial=store.getWorld();
 await act(async()=>input('27'));expect(store.getWorld()).toBe(initial);expect(renders).toEqual({[first]:2,[second]:1});
 world={...world,revision:world.revision+1,cities:world.cities.map((c,i)=>i?c:{...c,stock:{...c.stock,food:c.stock.food+5}})};
 await act(async()=>{expect(store.receive(structuredClone(stream.publish(world,writer))).accepted).toBe(true);});expect(renders).toEqual({[first]:3,[second]:1});expect(store.getWorld()!.cities[1]).toBe(initial!.cities[1]);
 // Time is a real dependency; both screens must refresh rather than hide resources.
 world={...world,revision:world.revision+1,time:world.time+1000};await act(async()=>{store.receive(stream.publish(world,writer));});expect(renders).toEqual({[first]:4,[second]:2});
 await act(async()=>root.unmount());const final=store.getWorld();expect(final!.revision).toBe(world.revision);
});
it('lost/out-of-order display messages request bounded recovery; manual retry remains available and never resubmits commands',()=>{
 vi.useFakeTimers();const stream=fixtureStream(),store=new PresentationStore(),request=vi.fn(),recovery=new ProjectionRecovery(store,request,100),w=createFormalFixture(),writer={branch:1,writerEpoch:1};
 recovery.receive(stream.publish(w,writer));const prior=store.getWorld();stream.publish({...w,time:1000,revision:1},writer);const late=stream.publish({...w,time:2000,revision:2},writer);
 for(let i=0;i<20;i++)expect(recovery.receive(late).accepted).toBe(false);expect(store.getWorld()).toBe(prior);expect(request).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(300);expect(request).toHaveBeenCalledTimes(3);expect(store.getHealth().state).toBe('blocked');vi.advanceTimersByTime(10000);expect(request).toHaveBeenCalledTimes(3);
 recovery.retry();expect(request).toHaveBeenCalledTimes(4);expect(store.getHealth().state).toBe('recovering');const snapshot=stream.publish({...w,time:2000,revision:2},writer,true);expect(recovery.receive(snapshot).accepted).toBe(true);expect(store.getHealth().state).toBe('ready');vi.advanceTimersByTime(10000);expect(request).toHaveBeenCalledTimes(4);
 recovery.dispose();
});
it('a new committed revision with identical visible fields still advances the clicked version; old sessions/branches cannot replace it',()=>{
 const stream=fixtureStream(),store=new PresentationStore(),w=createFormalFixture(),writer={branch:1,writerEpoch:1};const original=stream.publish(w,writer);store.receive(original);const first=store.getWorld();
 store.receive(stream.publish({...w,revision:w.revision+1},writer));expect(store.getWorld()).not.toBe(first);expect(store.getWorld()!.projection.revision).toBe(w.revision+1);expect(store.getWorld()!.cities).toBe(first!.cities);
 const before=store.getWorld(),old=structuredClone(original);old.sessionId='old-worker';expect(store.receive(old).accepted).toBe(false);expect(store.getWorld()).toBe(before);
 const switched={...w,campaignId:'campaign:replacement' as FormalWorld['campaignId']};store.receive(stream.publish(switched,{branch:2,writerEpoch:2},true));expect(store.getWorld()!.cities[0]).not.toBe(before!.cities[0]);expect(store.receive(original).accepted).toBe(false);
});
it('entity add/update/remove, invalid IDs and malformed sections are atomic; 100 updates preserve every untouched army',()=>{
 const stream=fixtureStream(),store=new PresentationStore(),writer={branch:1,writerEpoch:1};let w=createFormalFixture();store.receive(stream.publish(w,writer));
 // Reordering without world effects is observable and must retain entity identities.
 const original=store.getWorld()!;w={...w,revision:w.revision+1,cities:[...w.cities].reverse()};expect(store.receive(stream.publish(w,writer)).accepted).toBe(true);expect(store.getWorld()!.cities.at(-1)).toBe(original.cities[0]);
 const next={...w,revision:w.revision+1,cities:w.cities.map((c,i)=>i?c:{...c,name:'changed'})},patch=stream.publish(next,writer);if(patch.kind!=='patch')throw Error();const good=structuredClone(patch),bad=structuredClone(patch);bad.entities.cities![0].id='city:wrong';const prior=store.getWorld();expect(store.receive(bad).accepted).toBe(false);expect(store.getWorld()).toBe(prior);expect(store.receive(good).accepted).toBe(true);
 for(let i=0;i<100;i++){w={...next,revision:next.revision+i+1,time:i};expect(store.receive(stream.publish(w,writer)).accepted).toBe(true);expect(store.getWorld()!.armies).toBe(original.armies);}
});
