// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createFormalWorld} from '../formal/generator';
import {CityScenes} from './CityScenes';
import {CIV_ORDER,TOWN_ANCHORS} from './artMap';
import {worldCityVisual} from './cityVisuals';

it('imperial world enlargement keeps the visible base anchored at every map zoom',()=>{
 for(const size of [5,8,12,20,36]){
  for(const age of [0,1,2])expect(worldCityVisual(age,size)).toEqual({scale:1,width:size*3.8,footOffset:0});
  const baseline=worldCityVisual(2,size),imperial=worldCityVisual(3,size);
  expect(imperial.width/baseline.width).toBeCloseTo(1.10);
  for(const foot of [477,478]){
   const before=-(1-foot/512)*baseline.width,after=imperial.footOffset-(1-foot/512)*imperial.width;
   expect(Math.abs(after-before)).toBeLessThan(.02);
  }
 }
});
it('six civilizations retain all town button anchors and world data under presentation calibration',()=>{
 const base=createFormalWorld({campaign:'city-visuals',seed:90217});
 for(const civ of CIV_ORDER)for(const age of [0,1,2,3] as const){
  const w=structuredClone(base),c=w.cities[0];w.factions[0].civilizationId=civ;w.factions[0].age=age;
  c.buildings={...c.buildings,castle:1,academy:1,market:1};c.castleCivilizationId=civ;c.economy!.slots={castle:0,academy:1,market:2};
  const before=JSON.stringify(w),html=renderToStaticMarkup(<CityScenes world={w} city={c} onBuilding={()=>{}} onField={()=>{}} initialDistrict="town"/>);
  const el=document.createElement('div');el.innerHTML=html;
  const lots=[...el.querySelectorAll<HTMLElement>('.town-lot')];expect(lots).toHaveLength(16);
  lots.forEach((lot,i)=>{expect(lot.style.left).toBe(TOWN_ANCHORS[i][0]+'%');expect(lot.style.top).toBe(TOWN_ANCHORS[i][1]+'%');expect(lot.style.transform).toBe('');});
  expect(el.querySelector('.building-hall .town-building-art')?.getAttribute('data-scale')).toBe(age===3?'1.1':'1');
  const castleScale=Number(el.querySelector('.building-castle .town-building-art')?.getAttribute('data-scale'));expect(castleScale).toBeGreaterThanOrEqual(1);expect(castleScale).toBeLessThanOrEqual(1.12);if(age<3)expect(castleScale).toBe(1);
  expect(JSON.stringify(w)).toBe(before);
 }
});
