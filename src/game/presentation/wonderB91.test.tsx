// @vitest-environment happy-dom
import {afterEach,expect,it} from 'vitest';
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LegionView} from './LegionView';
import {wonderWorld} from '../formal/wonderTestSupport';
import {order} from '../formal/developmentTestSupport';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import type {FormalWorld} from '../formal/model';
import type {CityId} from '../formal/ids';
import {playerOrderBase,playerOrderWithBase} from '../orderAdmission';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined;afterEach(async()=>{await act(async()=>root?.unmount());document.body.innerHTML='';});
it('B9-1 Legion UI selects a legal member host, dispatches own real cargo, shows transit and arrival without resetting the layout',async()=>{
 let w=wonderWorld(false);w.factions[0].age=2;w.cities[1].stock={food:1000,wood:1000,stone:1000,gold:1000};let update!:(w:FormalWorld)=>void;
 function Screen(){const [world,setWorld]=useState(w);update=setWorld;w=world;return <LegionView world={world} city={world.cities[0]} issue={payload=>{const t=submitFormalOrder(world,order(world,payload));expect(t.ack?.status,t.ack?.reason).toBe('committed');setWorld(t.world);}} busy={false} onWorld={()=>{}}/>;}
 const div=document.createElement('div');document.body.append(div);root=createRoot(div);await act(async()=>root!.render(<Screen/>));
 const button=(name:string)=>Array.from(div.querySelectorAll('button')).find(b=>b.textContent===name)!;
 expect(button('指定城市並啟動奇觀').disabled).toBe(true);expect(div.textContent).toContain('啟動世界奇觀需要完成帝王時代');
 await act(async()=>button('指定城市並啟動奇觀').click());expect(w.largeProjects).toHaveLength(0);
 await act(async()=>update({...w,factions:w.factions.map(f=>f.id===w.playerFactionId?{...f,age:3 as const}:f)}));
 expect(button('指定城市並啟動奇觀').disabled).toBe(false);
 const host=div.querySelector<HTMLSelectElement>('[aria-label="奇觀承載城市"]')!;expect(host.options).toHaveLength(3);
 await act(async()=>{host.value=w.cities[2].id;host.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>button('指定城市並啟動奇觀').click());
 expect(w.largeProjects[0].initiatingCityId).toBe(w.cities[2].id);expect(div.textContent).toContain('籌資／運輸中');
 const source=div.querySelector<HTMLSelectElement>('[aria-label="奇觀資源來源城市"]')!;expect(source.options).toHaveLength(2);
 await act(async()=>{source.value=w.cities[1].id;source.dispatchEvent(new Event('change',{bubbles:true}));});
 const inputs=Array.from(div.querySelectorAll<HTMLInputElement>('.wonder-panel input[aria-label^="奇觀運送"]'));
 for(let i=0;i<inputs.length;i++)await act(async()=>{const input=inputs[i];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String((i+1)*100));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(button('派出商隊投入奇觀').disabled).toBe(false);await act(async()=>button('派出商隊投入奇觀').click());
 expect(w.cities[1].stock).toEqual({food:900,wood:800,stone:700,gold:600});expect(w.largeProjects[0].poolResources.food).toBe(0);expect(div.textContent).toContain('載貨在途');
 await act(async()=>update(advanceFormal(w,w.logistics![0].arrivalAt).world));expect(w.largeProjects[0].poolResources).toEqual({food:100,wood:200,stone:300,gold:400});expect(div.textContent).toContain('空車返程');expect(div.textContent).toContain('已抵達 1 批');
});
it('B9-1 wonder intent can cross unrelated foreground time but fences changed host ownership and project allocation',()=>{
 const w=wonderWorld();w.largeProjects=[];const p={type:'wonder.start' as const,cityId:w.cities[0].id,hostCityId:w.cities[2].id},command=order(w,p),base=playerOrderBase(w,p)!,later={...w,revision:w.revision+1,time:w.time+1};
 expect(playerOrderWithBase(later,command,base,0,w.revision).expectedRevision).toBe(later.revision);
 const changed=structuredClone(later);changed.cities[2].id='city:changed' as CityId;expect(playerOrderWithBase(changed,command,base,0,w.revision)).toBe(command);
});
