// @vitest-environment happy-dom
import {afterEach,expect,it} from 'vitest';
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {endgameWorld} from '../formal/endgameTestSupport';
import {applyWonderDamage} from '../formal/wonderCondition';
import {EventScheduler} from '../formal/scheduler';
import {eventId,resolutionId} from '../formal/ids';
import {order} from '../formal/developmentTestSupport';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import type {FormalWorld} from '../formal/model';
import {WonderPanel} from './WonderPanel';
import {ArmyDispatchDialog} from './CombatPanel';
import {FormalTargetPanel} from './FormalTargetPanel';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined;afterEach(async()=>{await act(async()=>root?.unmount());document.body.innerHTML='';});
async function mount(node:React.ReactNode){const div=document.createElement('div');document.body.append(div);root=createRoot(div);await act(async()=>root!.render(node));return div;}
async function input(el:HTMLInputElement,value:number){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));});}
it('B9-5 WonderPanel starts paid repair, sends actual city cargo and displays independent arrival/remaining work',async()=>{
 let w=endgameWorld(true);w.playerFactionId=w.factions[1].id;const s=new EventScheduler(w.events);applyWonderDamage(w,w.largeProjects[0].projectId,{type:'fixture.marker',marker:'damage',id:eventId('ui-damage'),at:w.time},resolutionId('ui-damage'),60000,s);w.events=s.snapshot();let update!:(w:FormalWorld)=>void;
 function Screen(){const [world,setWorld]=useState(w);w=world;update=setWorld;return <WonderPanel world={world} busy={false} issue={p=>{const t=submitFormalOrder(world,order(world,p));expect(t.ack?.status,t.ack?.reason).toBe('committed');setWorld(t.world);}}/>;}
 const div=await mount(<Screen/>),button=(text:string)=>Array.from(div.querySelectorAll('button')).find(b=>b.textContent===text)!;
 expect(div.textContent).toContain('受損');await act(async()=>button('啟動奇觀修復').click());expect(w.largeProjects.at(-1)!.kind).toBe('wonder-repair');
 await input(div.querySelector<HTMLInputElement>('[aria-label^="修復運送"]')!,100);await act(async()=>button('派出修復商隊').click());expect(w.largeProjects.at(-1)!.poolResources.food).toBe(0);expect(div.textContent).toContain('載貨在途');
 await act(async()=>update(advanceFormal(w,w.logistics![0].arrivalAt).world));expect(w.largeProjects.at(-1)!.poolResources.food).toBe(100);expect(div.textContent).toContain('空車返程');
});
it('B9-5 dispatch UI permits a lawful catapult-only destruction mission through the actual military command',async()=>{
 let w=endgameWorld();w.cities[0].military!.units={catapult:2};const div=await mount(<ArmyDispatchDialog world={w} city={w.cities[0]} busy={false} mission="wonder-destruction" target={{kind:'city',cityId:w.cities[2].id}} onClose={()=>{}} issue={p=>{const t=submitFormalOrder(w,order(w,p));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;}}/>);
 await input(div.querySelector<HTMLInputElement>('[aria-label="派遣投石機"]')!,1);const button=Array.from(div.querySelectorAll('button')).find(b=>b.textContent==='下達奇觀破壞命令')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(w.armies.at(-1)!.mission).toBe('wonder-destruction');expect(w.cities[0].military!.units.catapult).toBe(1);
});
it('B9-5 map target exposes the public landmark/stage and destruction action without publishing enemy numeric durability',async()=>{
 const w=endgameWorld(),missions:string[]=[];const div=await mount(<FormalTargetPanel world={w} home={w.cities[0]} city={w.cities[2]} onCity={()=>{}} onMission={m=>missions.push(m)}/>);expect(div.textContent).toContain('世界奇觀');expect(div.textContent).not.toContain('120,000');const button=Array.from(div.querySelectorAll('button')).find(b=>b.textContent==='奇觀破壞')!;await act(async()=>button.click());expect(missions).toEqual(['wonder-destruction']);
});
it.each([0,60000,120000])('B9 Final Gate map damage %s agrees with core eligibility and preserves other missions',async damage=>{
 const w=endgameWorld(),missions:string[]=[];if(damage){const s=new EventScheduler(w.events);applyWonderDamage(w,w.largeProjects[0].projectId,{type:'fixture.marker',marker:'ui-ruins',id:eventId('ui-ruins'),at:w.time},resolutionId('ui-ruins'),damage,s);w.events=s.snapshot();}
 const div=await mount(<FormalTargetPanel world={w} home={w.cities[0]} city={w.cities[2]} onCity={()=>{}} onMission={m=>missions.push(m)}/>),buttons=Array.from(div.querySelectorAll('button')),destroy=buttons.find(b=>b.textContent==='奇觀破壞');expect(!!destroy).toBe(damage<120000);expect(buttons.some(b=>b.textContent==='佔領據點')).toBe(true);expect(buttons.some(b=>b.textContent==='派遣斥候')).toBe(true);if(destroy){await act(async()=>destroy.click());expect(missions).toEqual(['wonder-destruction']);}else{expect(div.textContent).toContain('廢墟');expect(missions).toEqual([]);}
});
