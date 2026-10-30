// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {CityScenes} from './CityScenes';
import {Shell} from './Shell';
import {build,make,rich,order} from '../formal/developmentTestSupport';
import {submitFormalOrder} from '../formal/reducer';

it('keeps completed levels while an upgrade or a new building is in progress, with clickable plots and hidden names',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 let w=make();const c=rich(w);w.factions[0].age=3;build(c,'residence',9);build(c,'warehouse.0',10);build(c,'bunker.0',15);c.population=Math.min(1000,c.housing);c.stock={food:5000,wood:5000,stone:5000,gold:5000};
 for(const key of ['center','market']){const result=submitFormalOrder(w,order(w,{type:'building.upgrade',cityId:c.id,key}));expect(result.ack?.status,result.ack?.reason).toBe('committed');w=result.world;}
 const city=w.cities.find(city=>city.id===c.id)!;expect(city.buildings.market??0).toBe(0);
 const host=document.createElement('div'),root=createRoot(host),onBuilding=vi.fn(),onGovernor=vi.fn();
 try{
  await act(async()=>root.render(<CityScenes world={w} city={city} mobile initialDistrict="town" onBuilding={onBuilding} onField={()=>{}} onGovernor={onGovernor}/>));
  expect(host.querySelector('.quiet-town-labels')).not.toBeNull();
  const badges=[...host.querySelectorAll('.town-level b')].map(e=>e.textContent);
  expect(badges).toEqual(expect.arrayContaining(['1','9','10','15']));expect(badges).not.toContain('0');
  expect(host.querySelector('.town-level-anchor.building-hall b')!.textContent).toBe('1');
  expect(host.querySelector('.town-level-anchor.building-market')).toBeNull();
  expect(host.querySelectorAll('.constructing')).toHaveLength(2);expect(host.querySelectorAll('.formal-badge')).toHaveLength(0);
  await act(async()=>host.querySelector<HTMLButtonElement>('.building-hall')!.click());expect(onBuilding).toHaveBeenCalledWith('center',-1);
  await act(async()=>host.querySelector<HTMLButtonElement>('.governor-shortcut')!.click());expect(onGovernor).toHaveBeenCalledOnce();
  await act(async()=>host.querySelector<HTMLButtonElement>('.scene-view-shortcut')!.click());expect(host.querySelector('.town-close')).toBeNull();expect(host.querySelectorAll('.town-level').length).toBe(badges.length);
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});

it('updates all four mobile age labels on the same mounted HUD and preserves the era action',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div'),root=createRoot(host),w=make(),city=w.cities[0],onEra=vi.fn();
 try{for(const [age,label] of ['黑暗','封建','城堡','帝王'].entries()){
  const world={...w,factions:w.factions.map(f=>f.id===w.playerFactionId?{...f,age:age as 0|1|2|3}:f)};
  await act(async()=>root.render(<Shell world={world} city={city} cities={[city]} mobile view="city" onEra={onEra} onView={()=>{}} onCity={()=>{}} onHome={()=>{}} onResource={()=>{}} onMore={()=>{}} moreOpen={false} busy={false}>{null}</Shell>));
  const era=host.querySelector<HTMLButtonElement>('.mobile-era')!;expect([...era.children].map(e=>e.textContent)).toEqual([label,'時代']);expect(era.getAttribute('aria-label')).toBe(label+'時代');await act(async()=>era.click());
 }expect(onEra).toHaveBeenCalledTimes(4);}finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});

it('uses actual wall levels in both label modes and omits a level-zero gate badge',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div'),root=createRoot(host),w=make(),onWall=vi.fn();
 try{for(const level of [0,1,9,10,15]){
  const city={...w.cities[0],wallLevel:level};
  await act(async()=>root.render(<CityScenes world={w} city={city} mobile initialDistrict="town" onBuilding={()=>{}} onField={()=>{}} onWall={onWall}/>));
  expect(host.querySelector('.town-gate .town-level b')?.textContent??null).toBe(level?String(level):null);
  await act(async()=>host.querySelector<HTMLButtonElement>('.label-toggle')!.click());
  expect(host.querySelector('.town-gate .town-level b')?.textContent??null).toBe(level?String(level):null);
  expect(host.querySelectorAll('.town-lot.built .town-label')).toHaveLength(0);
  await act(async()=>host.querySelector<HTMLButtonElement>('.town-gate')!.click());
 }expect(onWall).toHaveBeenCalledTimes(5);}finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
