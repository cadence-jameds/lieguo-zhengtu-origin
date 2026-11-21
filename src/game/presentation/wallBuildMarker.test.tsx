// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {CityScenes} from './CityScenes';
import {submitFormalOrder} from '../formal/reducer';
import {order} from '../formal/testSupport';

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
