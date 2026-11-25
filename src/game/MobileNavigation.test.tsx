// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {MobileNavigation} from './MobileNavigation';
import {MobileMoreMenu,MobileNavigationSettings} from './MobileNavigationSettings';
import {aggregateReminders,type NavigationReminders} from './NavigationReminder';
import {DEFAULT_MOBILE_SHORTCUTS,MOBILE_SHORTCUTS_KEY,normalizeMobileShortcuts,readMobileShortcuts,useMobileShortcuts} from './mobileNavigationPreferences';
import {NAV,Shell,type View} from './presentation/Shell';
import {createFormalFixture} from './formal/fixture';
import {MOBILE_GARRISON_KEY} from './presentation/MobileGarrison';
let root:Root|undefined,box:HTMLDivElement;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;box?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
async function mount(node:React.ReactNode){box=document.createElement('div');document.body.append(box);root=createRoot(box);await act(async()=>root!.render(node));}
async function click(label:string){const b=[...box.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent===label||b.querySelector('strong')?.textContent===label)!;expect(b,label).toBeTruthy();await act(async()=>b.click());}
const noop=()=>{};
it('defaults to six ordered shortcuts and preserves intentionally empty or shorter choices',()=>{
 expect(readMobileShortcuts()).toEqual(DEFAULT_MOBILE_SHORTCUTS);expect(readMobileShortcuts()).toHaveLength(6);
 for(const ids of [[],['tasks'],['city','reports','map']]){localStorage.setItem(MOBILE_SHORTCUTS_KEY,JSON.stringify(ids));expect(readMobileShortcuts()).toEqual(ids);}
});
it('validates unknown, duplicate, corrupt and excessive preferences',()=>{
 expect(normalizeMobileShortcuts(['tasks','tasks','unknown',null,'map'])).toEqual(['tasks','map']);
 expect(normalizeMobileShortcuts(NAV.map(n=>n.id))).toHaveLength(6);
 for(const value of ['bad','null','{}']){localStorage.setItem(MOBILE_SHORTCUTS_KEY,value);expect(readMobileShortcuts()).toEqual(DEFAULT_MOBILE_SHORTCUTS);}
 vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');}});expect(readMobileShortcuts()).toEqual(DEFAULT_MOBILE_SHORTCUTS);
});
it('persists only device preferences and reports failed storage without losing session choices',async()=>{
 localStorage.setItem('campaign-sentinel','unchanged');
 function Harness(){const {shortcuts,save,storageError}=useMobileShortcuts();return <><button onClick={()=>save(['tasks','map'])}>save</button><output>{JSON.stringify({shortcuts,storageError})}</output></>;}
 await mount(<Harness/>);await click('save');expect(readMobileShortcuts()).toEqual(['tasks','map']);expect(localStorage.getItem('campaign-sentinel')).toBe('unchanged');
 vi.stubGlobal('localStorage',{setItem:()=>{throw Error('quota');},clear:()=>{}});await click('save');expect(box.textContent).toContain('"storageError":true');expect(box.textContent).toContain('["tasks","map"]');
});
it('keeps More outside the scrolling track, highlights hidden current pages and routes all visible buttons',async()=>{
 const navigate=vi.fn(),more=vi.fn();await mount(<MobileNavigation view="empire" items={NAV.slice(0,6)} onNavigate={navigate} moreOpen={false} onMore={more} unread={0} update={false}/>);
 expect(box.querySelector('.mobile-nav-track .nav-more')).toBeNull();expect(box.querySelector('.nav-more')?.parentElement?.tagName).toBe('NAV');expect(box.querySelector('.nav-more')?.getAttribute('aria-current')).toBe('page');
 await click('世界地圖');await click('更多');expect(navigate).toHaveBeenCalledWith('map');expect(more).toHaveBeenCalledOnce();
});
it('shows independent per-feature reminders, aggregates only hidden features and never assigns reports to tasks',()=>{
 const reminders:NavigationReminders<View>={reports:{count:9,attention:true},tasks:{count:2},legion:{attention:true},diplomacy:{count:3}};
 expect(aggregateReminders([reminders.tasks!,reminders.legion!,reminders.diplomacy!])).toEqual({count:5,attention:true});
 const html=renderToStaticMarkup(<MobileNavigation view="reports" items={NAV.filter(n=>n.id==='reports')} onNavigate={noop} moreOpen={false} onMore={noop} unread={99} update={false} reminders={reminders} hiddenIds={['tasks','legion','diplomacy']}/>);
 const el=document.createElement('div');el.innerHTML=html;expect(el.querySelector('[data-nav-id=reports]')?.textContent).toContain('9');expect(el.querySelector('.nav-more')?.textContent).toContain('5');expect(el.querySelector('.nav-more')?.className).toContain('has-unread');
 const fresh=renderToStaticMarkup(<MobileMoreMenu shortcuts={['reports']} view="tasks" onNavigate={noop} onHome={noop} onCustomize={noop} reminders={{reports:{count:9,attention:true}}}>clock</MobileMoreMenu>);el.innerHTML=fresh;expect(el.querySelector('[data-nav-id=tasks] .nav-unread-count')).toBeNull();
});
it('retains unread number without attention and attention without unread number',()=>{
 for(const [unread,alerts] of [[7,0],[0,1]]){const html=renderToStaticMarkup(<MobileNavigation view="city" items={NAV.filter(n=>n.id==='reports')} onNavigate={noop} moreOpen={false} onMore={noop} unread={unread} alerts={alerts} update={false}/>);const el=document.createElement('div');el.innerHTML=html;expect(el.querySelector('[data-nav-id=reports]')?.classList.contains('has-unread')).toBe(alerts>0);expect(el.querySelector('.nav-unread-count')?.textContent).toBe(unread?'7':'•');}
});
it('preserves overview home, settings, campaign information and all unselected formal functions',async()=>{
 const navigate=vi.fn(),home=vi.fn(),customize=vi.fn();await mount(<MobileMoreMenu shortcuts={['map','tasks','settings']} view="empire" onNavigate={navigate} onHome={home} onCustomize={customize} reminders={{reports:{count:4,attention:true}}}><p>123時 · 3X · 玩家勢力</p></MobileMoreMenu>);
 expect(box.textContent).toContain('123時 · 3X · 玩家勢力');expect(box.querySelector('[data-nav-id=tasks]')).toBeNull();expect(box.querySelector('[data-nav-id=empire]')?.getAttribute('aria-current')).toBe('page');
 expect([...box.querySelectorAll('[data-nav-id]')].map(e=>e.getAttribute('data-nav-id'))).toEqual(NAV.filter(n=>!['map','tasks'].includes(n.id)).map(n=>n.id));
 await act(async()=>box.querySelector<HTMLButtonElement>('.mobile-more>button')!.click());await click('自訂底部快捷列');expect(home).toHaveBeenCalledOnce();expect(customize).toHaveBeenCalledOnce();await act(async()=>box.querySelector<HTMLButtonElement>('[data-nav-id=reports]')!.click());expect(navigate).toHaveBeenCalledWith('reports');
});
it('edits staged choices, enforces six, reorders, removes, re-adds and saves fewer than six in order',async()=>{
 const save=vi.fn();await mount(<MobileNavigationSettings shortcuts={[...DEFAULT_MOBILE_SHORTCUTS]} onSave={save} onClose={noop}/>);
 expect([...box.querySelectorAll<HTMLButtonElement>('.mobile-shortcut-options button')].every(b=>b.disabled)).toBe(true);
 await click('移除世界地圖');await click('加入征途目標');await click('將征途目標向前移');expect(save).not.toHaveBeenCalled();
 await click('移除軍隊編組');await click('儲存快捷列');expect(save).toHaveBeenCalledWith(['city','reports','research','tasks','legion']);
});
it('cancel discards edits and an empty configuration remains usable through More',async()=>{
 const save=vi.fn(),close=vi.fn();await mount(<MobileNavigationSettings shortcuts={['map']} onSave={save} onClose={close}/>);await click('移除世界地圖');await click('取消');expect(close).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled();await click('儲存快捷列');expect(save).toHaveBeenCalledWith([]);
 const html=renderToStaticMarkup(<MobileNavigation view="map" items={[]} onNavigate={noop} moreOpen={false} onMore={noop} unread={0} update={false}/>);expect(html).toContain('nav-more active');
});
it('remeasures on preference changes and honors reduced-motion for arrow scrolling',async()=>{
 const scroll=vi.fn();vi.spyOn(HTMLElement.prototype,'scrollBy').mockImplementation(scroll);
 vi.spyOn(window,'matchMedia').mockReturnValue({matches:true} as MediaQueryList);
 await mount(<MobileNavigation view="city" items={NAV.slice(0,2)} onNavigate={noop} moreOpen={false} onMore={noop} unread={0} update={false}/>);
 const track=box.querySelector<HTMLElement>('.mobile-nav-track')!;Object.defineProperties(track,{clientWidth:{value:200,configurable:true},scrollWidth:{value:500,configurable:true}});
 await act(async()=>track.dispatchEvent(new Event('scroll')));expect(box.querySelector<HTMLButtonElement>('.nav-arrow-right')!.hidden).toBe(false);await click('顯示右側功能');expect(scroll).toHaveBeenCalledWith({left:160,behavior:'instant'});
 await act(async()=>root!.render(<MobileNavigation view="city" items={[]} onNavigate={noop} moreOpen={false} onMore={noop} unread={0} update={false}/>));expect(box.querySelectorAll('.mobile-nav-track button')).toHaveLength(0);
});
it('desktop keeps every existing feature and report indicator irrespective of mobile preferences',()=>{
 const w=createFormalFixture(),c=w.cities[0],html=renderToStaticMarkup(<Shell world={w} city={c} cities={[c]} mobile={false} view="reports" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} unread={8} alerts={1} mobileShortcuts={[]}><p>內容</p></Shell>),el=document.createElement('div');el.innerHTML=html;expect(el.querySelectorAll('.left-rail nav button')).toHaveLength(NAV.length);expect(el.querySelector('.mobile-nav')).toBeNull();expect(el.querySelector('.left-rail .active.has-unread')?.textContent).toContain('8');
 expect(el.querySelectorAll('.desktop-layout .resource img.hud-pictogram')).toHaveLength(4);
 expect(el.querySelectorAll('.left-rail nav img.hud-pictogram')).toHaveLength(NAV.length);
 expect(el.querySelector('.desktop-layout .resource')?.getAttribute('title')).toContain('庫存');
 expect(el.querySelectorAll('.desktop-layout .garrison-cell')).toHaveLength(11);
 expect(el.querySelector('.mobile-garrison-toggle')).toBeNull();
});

it('keeps the active shortcut clear of arrow gutters after orientation changes',async()=>{
 let resized=()=>{};
 vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resized=callback;}observe(){}disconnect(){}});
 await mount(<MobileNavigation view="reports" items={NAV.filter(n=>n.id==='reports')} onNavigate={noop} moreOpen={false} onMore={noop} unread={1} update={false}/>);
 const track=box.querySelector<HTMLElement>('.mobile-nav-track')!,active=track.querySelector<HTMLElement>('button')!;
 track.style.scrollPaddingLeft='18px';track.style.scrollPaddingRight='18px';
 Object.defineProperties(track,{clientWidth:{value:272},scrollWidth:{value:500}});
 Object.defineProperties(active,{offsetLeft:{value:400},offsetWidth:{value:66}});
 await act(async()=>resized());expect(track.scrollLeft).toBe(212);
});

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
