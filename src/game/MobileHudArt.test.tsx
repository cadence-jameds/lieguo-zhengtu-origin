// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {MobileMoreMenu} from './MobileNavigationSettings';
import {NAV,Shell} from './presentation/Shell';
import {MOBILE_GARRISON_KEY} from './presentation/MobileGarrison';
import {createFormalFixture} from './formal/fixture';

let root:Root|undefined,box:HTMLDivElement;
const noop=()=>{};
beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true));
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;box?.remove();vi.unstubAllGlobals();localStorage.clear();});
async function mount(node:React.ReactNode){box=document.createElement('div');document.body.append(box);root=createRoot(box);await act(async()=>root!.render(node));}
async function click(label:string){const b=[...box.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent===label||b.querySelector('strong')?.textContent===label)!;expect(b,label).toBeTruthy();await act(async()=>b.click());}
it('shows the approved mobile icons while preserving resource labels and clicks',async()=>{
 const w=createFormalFixture(),c=w.cities[0],resource=vi.fn(),navigate=vi.fn();
 await mount(<Shell world={w} city={c} cities={[c]} mobile view="city" onView={navigate} onCity={noop} onHome={noop} onResource={resource} onMore={noop} moreOpen={false} busy={false}><p>遊戲內容</p></Shell>);
 const buttons=[...box.querySelectorAll<HTMLButtonElement>('.mobile-resources button')];
 expect(buttons).toHaveLength(4);
 for(const b of buttons){expect(b.querySelector('.sr-only')?.textContent).toBeTruthy();const img=b.querySelector('img')!;expect(img.getAttribute('src')).toBeTruthy();expect(img.getAttribute('alt')).toBe('');}
 await act(async()=>buttons[0].click());expect(resource).toHaveBeenCalledWith('food');
 expect(box.querySelector('[data-nav-id=reports] img')?.getAttribute('src')).toBeTruthy();
 expect(box.querySelector('.nav-more img')?.getAttribute('src')).toBeTruthy();
 await click('戰報');expect(navigate).toHaveBeenCalledWith('reports');
});
it('provides the full contents in the mobile single-column More menu',()=>{
 const el=document.createElement('div');
 el.innerHTML=renderToStaticMarkup(<MobileMoreMenu shortcuts={[]} view="city" onNavigate={noop} onHome={noop} onCustomize={noop} reminders={{reports:{count:2}}}>clock</MobileMoreMenu>);
 expect(el.querySelectorAll('.mobile-more-single > button')).toHaveLength(NAV.length+2);
 expect(el.querySelector('[data-nav-id=reports] img')?.getAttribute('src')).toBeTruthy();
 expect(el.querySelector('[data-nav-id=reports] .nav-unread-count')?.textContent).toBe('2');
});
it('folds the actual mobile garrison while keeping resources and game content, and remembers the setting',async()=>{
 const w=createFormalFixture(),c=w.cities[0];
 const shell=(mobile=true)=><Shell world={w} city={c} cities={[c]} mobile={mobile} view="city" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false}><p>遊戲內容</p></Shell>;
 await mount(shell());
 expect(box.querySelectorAll('.mobile-garrison .garrison-cell')).toHaveLength(11);
 await click('收合兵種');
 const toggle=box.querySelector<HTMLButtonElement>('.mobile-garrison-toggle')!;
 expect(toggle.getAttribute('aria-expanded')).toBe('false');
 expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
 expect(box.querySelector('.garrison-lines')).toBeNull();
 expect(box.querySelectorAll('.mobile-resources button')).toHaveLength(4);
 expect(box.querySelector('main')?.textContent).toContain('遊戲內容');
 expect(localStorage.getItem(MOBILE_GARRISON_KEY)).toBe('1');
 await act(async()=>root!.render(shell(false)));
 expect(box.querySelector('.mobile-garrison-toggle')).toBeNull();
 expect(box.querySelectorAll('.garrison-cell')).toHaveLength(11);
 await act(async()=>root!.render(shell()));
 expect(box.querySelector('.garrison-lines')).toBeNull();
 await click('展開兵種');expect(box.querySelectorAll('.garrison-cell')).toHaveLength(11);
 expect(localStorage.getItem(MOBILE_GARRISON_KEY)).toBe('0');
});

it('uses the common art at desktop while keeping the full rail and garrison',()=>{
 const w=createFormalFixture(),c=w.cities[0],el=document.createElement('div');
 el.innerHTML=renderToStaticMarkup(<Shell world={w} city={c} cities={[c]} mobile={false} view="reports" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} unread={8} alerts={1} mobileShortcuts={[]}>{null}</Shell>);
 expect(el.querySelectorAll('.desktop-layout .resource img.hud-pictogram')).toHaveLength(4);
 expect(el.querySelectorAll('.left-rail nav img.hud-pictogram')).toHaveLength(NAV.length);
 expect(el.querySelector('.left-rail .active.has-unread')?.textContent).toContain('8');
 expect(el.querySelector('.desktop-layout .resource')?.getAttribute('title')).toContain('庫存');
 expect(el.querySelectorAll('.desktop-layout .garrison-cell')).toHaveLength(11);
 expect(el.querySelector('.mobile-garrison-toggle')).toBeNull();
});

it('uses the crown for the existing legion route in an empire without changing the separate governance route',async()=>{
 const onNavigate=vi.fn();
 const more=(politicalName:'軍團'|'帝國')=><MobileMoreMenu shortcuts={[]} view="map" onNavigate={onNavigate} onHome={noop} onCustomize={noop} reminders={{}} politicalName={politicalName}>clock</MobileMoreMenu>;
 await mount(more('帝國'));
 const legion=box.querySelector<HTMLButtonElement>('[data-nav-id=legion]')!,governance=box.querySelector<HTMLButtonElement>('[data-nav-id=empire]')!;
 expect(legion.textContent).toContain('帝國');
 expect(governance.textContent).toContain('治理方針');
 expect(legion.querySelector('img')?.src).not.toBe(governance.querySelector('img')?.src);
 const crown=legion.querySelector('img')?.src;
 await act(async()=>{legion.click();governance.click();});
 expect(onNavigate.mock.calls).toEqual([['legion'],['empire']]);
 await act(async()=>root!.render(more('軍團')));
 expect(legion.textContent).toContain('軍團');
 expect(legion.querySelector('img')?.src).not.toBe(crown);
});
