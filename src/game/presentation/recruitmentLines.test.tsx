// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {commit,make,researchCity} from '../formal/developmentTestSupport';
import {UNIT_CATALOG,UNIT_LINES} from '../formal/unitCatalog';
import {displayClock} from './liveClock';
import {recruitmentConditions} from './cityActions';
import {recruitmentLines} from './recruitmentLines';
import {ArmyView} from './DevelopmentViews';

function fixture(){
 const w=make(),city=researchCity(w),f=w.factions[0],elite=UNIT_CATALOG.swordsman;
 city.military!.units={militia:1000,swordsman:300,'modern.militia':100};
 return {w,city,f,elite};
}
it('picks the highest unlocked city tier and never bundles its underlying IDs',()=>{
 const {w,city,f,elite}=fixture();
 const card=()=>recruitmentLines(w,city).find(l=>l.id==='militia')!;
 expect(card()).toMatchObject({definition:{id:'militia'},commandId:'militia',counts:{ordinary:1000,elite:300,modern:100,total:1400}});
 f.techIds.push(elite.eliteTech!);
 expect(card().definition.id).toBe('militia');
 city.economy!.milestones.push(elite.milestone);
 expect(card()).toMatchObject({definition:{id:'swordsman'},commandId:'militia'});
 expect(recruitmentConditions(w,city,card().commandId,2).d.id).toBe('swordsman');
 f.reverseEngineering=['modern.militia'];
 expect(card()).toMatchObject({definition:{id:'modern.militia'},commandId:'modern.militia'});
 expect(recruitmentLines(w,city).find(l=>l.id==='spearman')!.definition.era).not.toBe('modern');
 city.stock.food=0;
 expect(card().commandId).toBe('modern.militia');
 delete city.buildings[UNIT_CATALOG['modern.militia'].producer];
 expect(card().unlocks).not.toHaveLength(0);
 expect(card().definition.era).not.toBe('modern');
});
for(const mobile of [false,true])it(`shows one stable card per line on ${mobile?'mobile':'desktop'} and keeps the chosen old ID read-only`,async()=>{
 const {w,city,f}=fixture(),issue=vi.fn(),box=document.createElement('div'),root=createRoot(box);
 f.reverseEngineering=['modern.militia'];
 document.body.append(box);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 try{
  await act(async()=>root.render(<ArmyView world={w} city={city} issue={issue} busy={false} mobile={mobile}/>));
  expect(Array.from(box.querySelectorAll('[data-recruit-line]'),e=>e.getAttribute('data-recruit-line'))).toEqual([...UNIT_LINES]);
  const card=box.querySelector<HTMLElement>('[data-recruit-line="militia"]')!;
  expect(card.querySelector('[data-garrison-line-counts]')?.textContent).toContain('一般 1,000／精銳 300／現代 100 · 合計 1,400');
  await act(async()=>(mobile?card:card.querySelector('button')!).click());
  const details=box.querySelector<HTMLSelectElement>('select[aria-label="兵種明細"]')!;
  expect([...details.options].map(o=>o.value)).toEqual(['militia','swordsman','modern.militia']);
  await act(async()=>{details.value='swordsman';details.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(box.querySelector('dialog')!.textContent).toContain('（swordsman）');
  await act(async()=>box.querySelector<HTMLButtonElement>('dialog button.primary')!.click());
  expect(issue).toHaveBeenCalledExactlyOnceWith({type:'military.recruit',cityId:city.id,unitId:'modern.militia',count:1});
 }finally{await act(async()=>root.unmount());box.remove();displayClock.stop();vi.unstubAllGlobals();}
});

it('keeps the original queued ID, costs and duration when the card unlocks later',()=>{
 const {w,city,elite}=fixture(),next=commit(w,{type:'military.recruit',cityId:city.id,unitId:'militia',count:8}),c=next.cities[0];
 const original=structuredClone(c.military!.queue[0]);
 next.factions[0].techIds.push(elite.eliteTech!);
 c.economy!.milestones.push(elite.milestone);
 next.factions[0].reverseEngineering=['modern.militia'];
 expect(recruitmentLines(next,c).find(l=>l.id==='militia')!.commandId).toBe('modern.militia');
 expect(c.military!.queue[0]).toEqual(original);
 expect(original.unitId).toBe('militia');
});
