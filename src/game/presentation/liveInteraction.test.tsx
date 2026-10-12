// @vitest-environment happy-dom
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {advanceFormal,submitFormalOrder} from '../formal/reducer';
import {order} from '../formal/testSupport';
import {researchCity} from '../formal/developmentTestSupport';
import {Countdown,LiveProgress,CityValue} from './LiveValues';
import {displayClock} from './liveClock';
import {ArmyView} from './DevelopmentViews';
import FormalCityPanel from '../FormalCityPanel';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {unitRecruitCost} from '../formal/military';
import {constructionAction} from './cityActions';
import {citySnapshot} from '../formal/economy';
import type {FormalWorld} from '../formal/model';

let container:HTMLDivElement,root:Root,now=0;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();displayClock.stop();vi.restoreAllMocks();vi.unstubAllGlobals();});

for(const speed of [1,3,6,10,50])it(`${speed}X countdown/HUD ticks leave the parent, typed input, focus and scroll intact`,async()=>{
 const base=createFormalWorld({campaign:'live-ui-'+speed,seed:90217,speed}),world=submitFormalOrder(base,order(base,'live-job',{type:'field.upgrade',cityId:base.cities[0].id,slot:0})).world,job=world.cities[0].economy!.construction[0],before=JSON.stringify(world);let renders=0;
 function Surface(){renders++;const [value,setValue]=useState('');return <section><input aria-label="輸入" value={value} onChange={e=>setValue(e.target.value)}/><Countdown at={job.startsAt+job.durationMs} world={world}/><LiveProgress world={world} start={job.startsAt} duration={job.durationMs} label="施工"/><CityValue world={world} city={world.cities[0]} resource="wood"/></section>;}
 displayClock.adopt({campaignId:world.campaignId,time:world.time,speed,running:true});await act(async()=>root.render(<Surface/>));const input=container.querySelector('input')!;input.focus();container.scrollTop=77;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'輸入中的數量');input.dispatchEvent(new Event('input',{bubbles:true}));});const initialRenders=renders,text=container.textContent;
 now=1000;await act(async()=>displayClock.sample());expect(container.textContent).not.toBe(text);expect(renders).toBe(initialRenders);expect(container.querySelector('input')).toBe(input);expect(input.value).toBe('輸入中的數量');expect(document.activeElement).toBe(input);expect(container.scrollTop).toBe(77);expect(JSON.stringify(world)).toBe(before);
 now=Math.ceil((job.startsAt+job.durationMs)/speed);await act(async()=>displayClock.sample());expect(container.textContent).toContain('完成確認中');expect(world.cities[0].fields![0].level).toBe(0);expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('100');
});
it('an open recruitment dialog preserves quantity, focus and dialog/outer scroll across an actual training completion',async()=>{
 let world=createFormalWorld({campaign:'recruit-dialog',seed:90217,speed:50});researchCity(world);const id=world.cities[0].id;world=submitFormalOrder(world,order(world,'train',{type:'military.recruit',cityId:id,unitId:'militia',count:1})).world;
 const render=(w:FormalWorld)=>root.render(<ArmyView world={w} city={w.cities[0]} issue={()=>{}} busy={false} mobile/>);
 await act(async()=>render(world));const card=[...container.querySelectorAll<HTMLButtonElement>('.catalog-card')].find(e=>e.textContent?.includes('民兵'))!;await act(async()=>card.click());const dialog=container.querySelector('dialog')!,input=container.querySelector<HTMLInputElement>('[aria-label="招募數量"]')!,body=dialog.querySelector<HTMLDivElement>('.dialog-body')!;
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;await act(async()=>{setter.call(input,'37');input.dispatchEvent(new Event('input',{bubbles:true}));});input.focus();body.scrollTop=125;container.scrollTop=48;expect(input.value).toBe('37');
 const job=world.cities[0].military!.queue[0];world=advanceFormal(world,job.nextAt).world;await act(async()=>render(world));expect(container.querySelector('dialog')).toBe(dialog);expect(dialog.open).toBe(true);expect(container.querySelector('[aria-label="招募數量"]')).toBe(input);expect(input.value).toBe('37');expect(document.activeElement).toBe(input);expect(body.scrollTop).toBe(125);expect(container.scrollTop).toBe(48);expect(world.cities[0].military!.units.militia).toBe(1);
});

for(const speed of [1,3,6,10,50]){
 it(`${speed}X open recruitment affordability updates without waiting for a checkpoint`,async()=>{
  const world=createFormalWorld({campaign:'live-afford-'+speed,seed:90217,speed}),city=researchCity(world),cost=unitRecruitCost(world,city,UNIT_CATALOG.militia);city.stock.food=cost.food-1;const before=JSON.stringify(world),issue=vi.fn();
  displayClock.adopt({campaignId:world.campaignId,time:world.time,speed,running:true});await act(async()=>root.render(<ArmyView world={world} city={city} issue={issue} busy={false} mobile/>));await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('.catalog-card')].find(e=>e.textContent?.includes('民兵'))!.click());
  const dialog=container.querySelector('dialog')!,button=[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(e=>e.textContent==='招募 1 名')!;expect(button.disabled).toBe(true);
  now=Math.ceil((3600000/54)/speed/1000)*1000;await act(async()=>displayClock.sample());expect(button.disabled).toBe(false);expect(container.querySelector('dialog')).toBe(dialog);expect(JSON.stringify(world)).toBe(before);await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'military.recruit',cityId:city.id,unitId:'militia',count:1});
 });
 it(`${speed}X an open construction dialog updates eligibility while the scene stays mounted`,async()=>{
  const world=createFormalWorld({campaign:'live-build-afford-'+speed,seed:90217,speed}),city=world.cities[0],slot=city.fields!.find(f=>f.resource==='wood')!.slot,cost=constructionAction(world,citySnapshot(world,city.id)!,{field:slot}).cost!;city.stock.wood=cost.wood-1;const before=JSON.stringify(world);
  displayClock.adopt({campaignId:world.campaignId,time:world.time,speed,running:true});await act(async()=>root.render(<FormalCityPanel world={world} cityId={city.id} issue={()=>{}} busy={false} mobile/>));const field=container.querySelector<HTMLButtonElement>('[data-testid="field-anchor-'+slot+'"]')!;await act(async()=>field.click());const dialog=container.querySelector('dialog')!,button=[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(e=>e.textContent==='升級至 Lv1')!;expect(button.disabled).toBe(true);
  now=Math.ceil((3600000/45)/speed/1000)*1000;await act(async()=>displayClock.sample());expect(button.disabled).toBe(false);expect(container.querySelector('dialog')).toBe(dialog);expect(container.querySelector('[data-testid="field-anchor-'+slot+'"]')).toBe(field);expect(JSON.stringify(world)).toBe(before);
 });
}
