// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {ELITE_VARIANTS,UNIT_CATALOG,unitLine} from '../formal/unitCatalog';
import {spatial} from '../formal/spatial';
import {RecruitmentForm} from './RecruitmentForm';
import {Garrison} from './Garrison';
import {CIV_ORDER,cityArtAge} from './artMap';
import {worldCityVisual} from './cityVisuals';
import {mapEntityViewport,mapHit,mapHitExtent,mapNodeSize,mapPickBounds,mapQueryBounds} from './mapViewRules';
import {project} from './mapGeometry';
import {fmt} from './UI';

it('matches imperial sprite picking and lower viewport culling across zoom, city ages and map viewports',()=>{
 const w=createFormalWorld({campaign:'issue38-map',seed:90217}),city=w.cities[0];
 for(const civ of CIV_ORDER)for(const age of [0,1,2,3] as const){
  w.factions[0].civilizationId=civ;w.factions[0].age=age;
  const visualAge=cityArtAge(w,city);expect(visualAge).toBe(age);
  for(const z of [.04,.75,1,2])for(const width of [320,390,1440]){
   const h=400, anchor={x:width/2,y:h/2}, cam={...project(city),z};
   const e=mapHitExtent(true,z,visualAge);
   if(z<.12){expect(e).toEqual(mapHitExtent(true,z,0));continue;}
   const size=mapNodeSize(true,z),visual=worldCityVisual(visualAge,size);
   expect(visual.width/size).toBeCloseTo(age===3?3.8*1.30:3.8);
   if(age!==3){expect(e).toEqual({x:size*1.8,above:size*2.8,below:size*.8});continue;}
   const tip={x:anchor.x+e.x-0.1,y:anchor.y-e.above+0.1};
   expect(mapHit(true,z,anchor,tip,visualAge)).toBe(true);
   expect(mapHit(true,z,anchor,tip,2)).toBe(false);
   expect(spatial(w).query(mapPickBounds(cam,width,h,tip)).cities).toContain(city);
   expect(e.x).toBeCloseTo(visual.width/2);
   expect(e.above+e.below).toBeCloseTo(visual.width);
   const lowerAnchor=h+e.above-.1,lowerCam={...cam,y:cam.y-(lowerAnchor-h/2)/z};
   if(z>=1)expect(lowerAnchor).toBeGreaterThan(h+60);
   expect(spatial(w).query(mapQueryBounds(lowerCam,width,h,mapEntityViewport(z,width,h))).cities).toContain(city);
  }
 }
});

it('shows actual per-unit base carry, including zero, and follows unlocked elite and civilization variants',()=>{
 const w=createFormalWorld({campaign:'issue38-unit',seed:90217}), city=w.cities[0];
 const check=(unitId:string,actualId=unitId)=>{
  const before=structuredClone(city.military),issue=vi.fn();
  const html=renderToStaticMarkup(<RecruitmentForm world={w} city={city} unitId={unitId} busy={false} issue={issue} onRecruited={()=>{}}/>);
  const box=document.createElement('div');box.innerHTML=html;expect(box.textContent).toContain('每名基礎負重 '+fmt(UNIT_CATALOG[actualId].carry));
  expect(city.military).toEqual(before);expect(issue).not.toHaveBeenCalled();
 };
 const units=Object.values(UNIT_CATALOG);
 check(units.find(unit=>unit.carry===0)!.id);
 check(units.find(unit=>unit.era==='modern')!.id);
 check('militia');
 const eliteId=ELITE_VARIANTS.militia,elite=UNIT_CATALOG[eliteId];w.factions[0].techIds.push(elite.eliteTech!);city.economy!.milestones.push(elite.milestone);
 check('militia',eliteId);
 for(const civ of CIV_ORDER){w.factions[0].civilizationId=civ;for(const id of unitLine('guard',civ).ordinary)check(id);}
});

it('garrison details show each line variant separately even at zero troops',async()=>{
 const w=createFormalWorld({campaign:'issue38-garrison',seed:90217}),city=w.cities[0],line=unitLine('militia',w.factions[0].civilizationId);
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const box=document.createElement('div'),root=createRoot(box);document.body.append(box);
 try {
  await act(async()=>root.render(<Garrison world={w} city={city}/>));
  const button=[...box.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')?.startsWith(line.name+'駐軍'))!;
  await act(async()=>button.click());
  const rows=[...box.querySelectorAll('.garrison-carry li')].map(e=>e.textContent);
  expect(rows).toEqual([...line.ordinary,...line.elite,...line.modern].map(id=>UNIT_CATALOG[id].name+' · 每名基礎負重 '+fmt(UNIT_CATALOG[id].carry)));
 } finally {await act(async()=>root.unmount());box.remove();vi.unstubAllGlobals();}
});
