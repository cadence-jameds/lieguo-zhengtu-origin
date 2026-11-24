// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {CityScenes} from './CityScenes';
import {submitFormalOrder} from '../formal/reducer';
import {order} from '../formal/testSupport';
import {build,commit,make,rich} from '../formal/developmentTestSupport';

it.each([false,true])('shows the unbuilt wall action independently of scene labels (mobile=%s)',async mobile=>{
 const world=createFormalWorld({campaign:'wall-marker',seed:90217,speed:25});
 const city=world.cities[0];city.buildings["warehouse.0"]=15;city.economy!.slots["warehouse.0"]=0;city.stock={food:10000,wood:10000,stone:10000,gold:10000};
 const host=document.createElement('div'),root=createRoot(host),onWall=vi.fn(),other=vi.fn();
 document.body.append(host);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const render=(state=world,showWall=true,level=state.cities[0].wallLevel)=>root.render(<div className={mobile?'mobile-layout':'desktop-layout'}><CityScenes world={state} city={{...state.cities[0],wallLevel:level}} mobile={mobile} initialDistrict="town" onBuilding={other} onField={other} onWall={showWall?onWall:undefined}/></div>);
 const gate=()=>host.querySelector<HTMLButtonElement>('.town-gate')!;
 const image=()=>host.querySelector<HTMLImageElement>('.town-background')!.getAttribute('src');
 try{
  await act(async()=>render());
  expect(image()).toContain('dark-open');
  expect(gate().textContent).toContain('建造城牆');
  expect(gate().getAttribute('aria-label')).toBe('建造城牆');
  expect(gate().querySelector('.town-level')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('.label-toggle')!.click());
  if(mobile)await act(async()=>host.querySelector<HTMLButtonElement>('.scene-view-shortcut')!.click());
  expect(gate().textContent).toContain('建造城牆');
  gate().focus();expect(document.activeElement).toBe(gate());
  await act(async()=>gate().click());
  expect(onWall).toHaveBeenCalledOnce();expect(other).not.toHaveBeenCalled();
  await act(async()=>render(world,false));
  expect(gate().disabled).toBe(true);expect(gate().textContent).toContain('建造城牆');
  await act(async()=>gate().click());expect(onWall).toHaveBeenCalledOnce();
  const field=submitFormalOrder(world,order(world,'before-wall',{type:'field.upgrade',cityId:city.id,slot:0}));
  const wall=submitFormalOrder(field.world,order(field.world,'wall-job',{type:'building.upgrade',cityId:city.id,key:'wall'}));
  expect(wall.ack?.status,wall.ack?.reason).toBe('committed');
  await act(async()=>render(wall.world));
  expect(image()).toContain('dark-open');
  expect(gate().textContent).toBe('查看城牆工程');
  expect(gate().getAttribute('aria-label')).toBe('查看城牆工程');
  // The wider queued label participates in the native button's intrinsic width.
  // Leaving it absolutely positioned would paint outside the tap target on phones.
  expect(gate().style.width).toBe('max-content');
  expect(gate().style.minWidth).toBe('max(104px, 12%)');
  expect(gate().querySelector<HTMLElement>('.wall-site-marker')!.style.position).toBe('');
  await act(async()=>gate().click());expect(onWall).toHaveBeenCalledTimes(2);
  await act(async()=>render(world,true,1));
  expect(gate().querySelector('.wall-site-marker')).toBeNull();
  expect(gate().style.width).toBe('');
  expect(gate().querySelector('.town-level b')?.textContent).toBe('1');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});

it.each([false,true])('preserves the true 5/5 training header and wall marker together (mobile=%s)',async mobile=>{
 let world=make();const c=rich(world);
 world.factions[0].age=2;build(c,'castle',1);build(c,'workshop',1);
 for(let i=0;i<4;i++)world=commit(world,{type:'military.recruit',cityId:c.id,unitId:'baggage',count:1});
 world=commit(world,{type:'settlement.prepare',cityId:c.id});
 const host=document.createElement('div'),root=createRoot(host),onWall=vi.fn(),other=vi.fn();
 document.body.append(host);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const render=()=>root.render(<CityScenes world={world} city={world.cities[0]} mobile={mobile} initialDistrict="town" onBuilding={other} onField={other} onWall={onWall}/>);
 const gate=()=>host.querySelector<HTMLButtonElement>('.town-gate')!;
 const count=()=>host.querySelector('.city-queue-summary')?.textContent;
 try{
  await act(async()=>render());
  expect(gate().textContent).toBe('＋ 建造城牆');expect(gate().getAttribute('aria-label')).toBe('建造城牆');expect(count()).toContain('訓練 5/5');
  await act(async()=>gate().click());expect(onWall).toHaveBeenCalledOnce();
  world=commit(world,{type:'building.upgrade',cityId:c.id,key:'wall'});
  await act(async()=>render());
  expect(gate().textContent).toBe('查看城牆工程');expect(count()).toContain('訓練 5/5');
  world=commit(world,{type:'settlement.cancel',cityId:c.id});
  await act(async()=>render());
  expect(gate().textContent).toBe('查看城牆工程');expect(count()).toContain('訓練 4/5');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
