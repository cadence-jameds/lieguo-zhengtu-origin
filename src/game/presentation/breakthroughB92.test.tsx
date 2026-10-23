// @vitest-environment happy-dom
import {afterEach,expect,it} from 'vitest';
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {WonderPanel} from './WonderPanel';
import {completedWonder} from '../formal/breakthroughTestSupport';
import {order} from '../formal/developmentTestSupport';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import {changeCityOwner} from '../formal/economy';
import {wonderAct} from '../formal/wonderTestSupport';
import type {FormalWorld} from '../formal/model';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined;afterEach(async()=>{await act(async()=>root?.unmount());document.body.innerHTML='';});
it('B9-2 WonderPanel starts the project, sends real cargo, displays transit, pauses on loss and resumes after recapture',async()=>{
 let w=completedWonder(),update!:(w:FormalWorld)=>void;w.cities[1].stock={food:1000,wood:1000,stone:1000,gold:1000};
 function Screen(){const [world,setWorld]=useState(w);w=world;update=setWorld;return <WonderPanel world={world} busy={false} issue={payload=>{const result=submitFormalOrder(world,order(world,payload));expect(result.ack?.status,result.ack?.reason).toBe('committed');setWorld(result.world);}}/>;}
 const div=document.createElement('div');document.body.append(div);root=createRoot(div);await act(async()=>root!.render(<Screen/>));const button=(text:string)=>Array.from(div.querySelectorAll('button')).find(b=>b.textContent===text)!;
 expect(button('啟動文明突破').disabled).toBe(false);await act(async()=>button('啟動文明突破').click());expect(w.largeProjects[1].kind).toBe('civilization-breakthrough');expect(div.textContent).toContain('獨立文明突破工程池');
 const source=div.querySelector<HTMLSelectElement>('[aria-label="突破資源來源城市"]')!;await act(async()=>{source.value=w.cities[1].id;source.dispatchEvent(new Event('change',{bubbles:true}));});
 const inputs=Array.from(div.querySelectorAll<HTMLInputElement>('[aria-label^="突破運送"]'));for(let i=0;i<inputs.length;i++)await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(inputs[i],String((i+1)*100));inputs[i].dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>button('派出商隊投入文明突破').click());expect(w.cities[1].stock.gold).toBe(600);expect(w.largeProjects[1].poolResources.gold).toBe(0);expect(div.textContent).toContain('載貨在途');
 await act(async()=>update(advanceFormal(w,w.logistics![0].arrivalAt).world));expect(w.largeProjects[1].poolResources.gold).toBe(400);expect(div.textContent).toContain('空車返程');
 let lost=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},w.factions[1].id);changeCityOwner(lost,lost.cities[0],lost.factions[1].id,'conquest');await act(async()=>update(lost));expect(div.textContent).toContain('已暫停');expect(div.textContent).toContain('暫停計時與資源投入');expect(button('派出商隊投入文明突破')).toBeUndefined();
 lost=structuredClone(w);changeCityOwner(lost,lost.cities[0],lost.playerFactionId,'conquest');await act(async()=>update(lost));expect(div.textContent).toContain('籌資／運輸中');expect(button('派出商隊投入文明突破')).toBeDefined();
},60000);
