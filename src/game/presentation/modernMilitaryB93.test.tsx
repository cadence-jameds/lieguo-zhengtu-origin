// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {make,researchCity} from '../formal/developmentTestSupport';
import {ArmyView} from './DevelopmentViews';
import {ModernizationPanel} from './ModernizationPanel';
import {ArmyDispatchDialog} from './CombatPanel';
import {displayClock} from './liveClock';
import {unitArt} from './artMap';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();displayClock.stop();vi.unstubAllGlobals();});
for(const mobile of [false,true])it(`B9-3 ${mobile?'mobile':'desktop'} modern production keeps the existing layout and enforces full qualification`,async()=>{
 const w=make(),c=researchCity(w),issue=vi.fn();await act(async()=>root.render(<ArmyView world={w} city={c} issue={issue} busy={false} mobile={mobile}/>));
 const select=host.querySelector<HTMLSelectElement>('select[aria-label="兵種世代"]')!;await act(async()=>{select.value='modern';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.textContent).toContain('機械化突擊步兵');expect(host.textContent).toContain('軍用補給卡車');expect(host.textContent).toContain('近衛自動步槍隊');expect(host.textContent).toContain('需要完整現代軍事資格');expect(issue).not.toHaveBeenCalled();
 if(!mobile){const article=[...host.querySelectorAll('article.card')].find(a=>a.querySelector('h2')?.textContent==='機械化突擊步兵')!;expect(article.querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(true);}
});
it('B9-3 modern training emits the existing recruit command and names the correct modern identity',async()=>{
 const w=make(),c=researchCity(w),issue=vi.fn();w.factions[0].modernQualification='full';await act(async()=>root.render(<ArmyView world={w} city={c} issue={issue} busy={false}/>));
 const select=host.querySelector<HTMLSelectElement>('select[aria-label="兵種世代"]')!;await act(async()=>{select.value='modern';select.dispatchEvent(new Event('change',{bubbles:true}));});
 const article=[...host.querySelectorAll('article.card')].find(a=>a.querySelector('h2')?.textContent==='機械化突擊步兵')!,button=article.querySelector<HTMLButtonElement>('button.primary')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'military.recruit',cityId:c.id,unitId:'modern.militia',count:1});
 expect(unitArt('modern.militia').badge).toContain('現代');expect(unitArt('modern.guard.civ_japan').badge).toContain('現代');
});
it('B9-3 paid retrofit exposes only actual held old troops and sends a single explicit conversion command',async()=>{
 const w=make(),c=researchCity(w),issue=vi.fn();w.factions[0].modernQualification='full';c.military!.units={swordsman:2,'modern.archer':1};const before=structuredClone(w);
 await act(async()=>root.render(<ModernizationPanel world={w} city={c} issue={issue} busy={false}/>));expect(host.textContent).toContain('劍士（存活 2）');expect(host.textContent).not.toContain('自動步槍兵（存活');const button=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.startsWith('改裝 機械化突擊步兵'))!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledExactlyOnceWith({type:'military.modernize',cityId:c.id,unitId:'swordsman',count:1});expect(w).toEqual(before);
});
it('B9-3 retrofit shows qualification restrictions and blocks dispatching unavailable modern resources',async()=>{
 const w=make(),c=researchCity(w),issue=vi.fn();c.military!.units={militia:1};await act(async()=>root.render(<ModernizationPanel world={w} city={c} issue={issue} busy={false}/>));expect(host.textContent).toContain('需要完整現代軍事資格');expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
 const updated=structuredClone(w);updated.factions[0].modernQualification='full';updated.cities[0].stock.gold=25;await act(async()=>root.render(<ModernizationPanel world={updated} city={updated.cities[0]} issue={issue} busy={false}/>));expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);expect(issue).not.toHaveBeenCalled();
});
it('B9-3 scouting UI selects actual traditional and modern scouts without offering combat units',async()=>{
 const w=make(),c=researchCity(w),issue=vi.fn();c.military!.units={scout:2,'modern.scout':3,'modern.militia':4};
 await act(async()=>root.render(<ArmyDispatchDialog world={w} city={c} issue={issue} busy={false} target={{kind:'city',cityId:w.cities[1].id}} mission="scout" onClose={()=>{}} onBack={()=>{}}/>));
 expect(host.querySelector('input[aria-label="派遣斥候"]')).not.toBeNull();expect(host.querySelector('input[aria-label="派遣機動偵察隊"]')).not.toBeNull();expect(host.querySelector('input[aria-label="派遣機械化突擊步兵"]')).toBeNull();
});
