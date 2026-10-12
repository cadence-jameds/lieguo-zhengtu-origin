// @vitest-environment happy-dom
import {it,expect,vi,afterEach} from 'vitest';
import {createRoot} from 'react-dom/client';
import {act} from 'react';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import FormalCityPanel from '../FormalCityPanel';
import {createFormalWorld} from '../formal/generator';
import {build} from '../formal/developmentTestSupport';
import {displayClock} from './liveClock';
afterEach(()=>{displayClock.stop();vi.unstubAllGlobals();});
it('townhall chooser shows red age, green center Lv5, red residence Lv5 once, then all green and enabled on qualification',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 let w=createFormalWorld({campaign:'build-conditions31',seed:90217});build(w.cities[0],'center',5);build(w.cities[0],'residence',1);const el=document.createElement('div'),root=createRoot(el),issue=vi.fn();el.className='formal-shell';document.body.append(el);const style=document.createElement('style');style.textContent=readFileSync('src/game/presentation/parity.css','utf8');document.head.append(style);
 const card=()=>el.querySelector<HTMLButtonElement>('[aria-label="查看市政廳資訊"]')!.closest('article')!;
 try{await act(async()=>root.render(<FormalCityPanel world={w} cityId={w.cities[0].id} issue={issue} busy={false}/>));await act(async()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='城內')!.click());await act(async()=>el.querySelector<HTMLButtonElement>('.town-lot.vacant')!.click());
  expect([...card().querySelectorAll('.building-prerequisite-summary span')].map(s=>[s.textContent,s.className])).toEqual([['封建時代','unmet'],['城市中心 Lv5','met'],['民居 Lv5','unmet']]);for(const span of card().querySelectorAll('.building-prerequisite-summary span')){const css=getComputedStyle(span);expect(css.color).toMatch(span.className==='unmet'?/^(#ff0000|rgb\(255, 0, 0\))$/i:/^(#88c78d|rgb\(136, 199, 141\))$/i);expect(css.fontWeight).toBe('400');}expect(card().querySelector('.building-requirements')).toBeNull();expect(card().textContent).not.toContain('未達');expect(card().textContent).not.toContain('符合建造條件');expect(card().querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(true);mkdirSync('docs/terrain-v03031',{recursive:true});writeFileSync('docs/terrain-v03031/mixed-build-conditions.html',card().outerHTML);
  w=structuredClone(w);w.factions[0].age=1;build(w.cities[0],'residence',5);await act(async()=>root.render(<FormalCityPanel world={w} cityId={w.cities[0].id} issue={issue} busy={false}/>));expect(card().querySelectorAll('.building-prerequisite-summary .met')).toHaveLength(3);expect(card().querySelector('.building-prerequisite-summary .unmet')).toBeNull();expect(card().querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(false);writeFileSync('docs/terrain-v03031/met-build-conditions.html',card().outerHTML);await act(async()=>card().querySelector<HTMLButtonElement>('button.primary')!.click());expect(issue).toHaveBeenCalledWith(expect.objectContaining({type:'building.upgrade',key:'townhall'}));
 }finally{await act(async()=>root.unmount());el.remove();style.remove();}
});
