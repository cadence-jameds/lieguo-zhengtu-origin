// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {MobileMoreMenu,MobileNavigationSettings} from '../MobileNavigationSettings';
import {MOBILE_SHORTCUTS_KEY,readMobileShortcuts} from '../mobileNavigationPreferences';
import {createFormalFixture} from '../formal/fixture';
import {wonderWorld,wonderAct} from '../formal/wonderTestSupport';
import {initializeCityEconomy} from '../formal/economy';
import {EventScheduler} from '../formal/scheduler';
import {cityId,factionId} from '../formal/ids';
import type {FormalWorld} from '../formal/model';
import {Shell} from './Shell';
import {PoliticalCommunityView} from './PoliticalCommunityView';
import {politicalCommunityLabel} from './politicalCommunity';

const noop=()=>{};
const leader=()=>wonderWorld(false);
function independent(){const w=leader();return wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'empire-dissolve'});}
function transfer(w:FormalWorld){return wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'empire-transfer',target:w.factions[1].id});}
function ownMember(){return transfer(leader());}
function ordinaryMember(){
 let w=ownMember();
 const third=factionId('community-ui-member'),thirdCity=cityId('community-ui-member'),c={...structuredClone(w.cities[1]),id:thirdCity,ownerFactionId:third,name:'新城',x:7,y:7};
 w.factions.push({...structuredClone(w.factions[0]),id:third,name:'新領主',empireId:null,age:2});
 w.cities.push(c);const scheduler=new EventScheduler(w.events);initializeCityEconomy(w,c,scheduler);w.events=scheduler.snapshot();
 w=wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'legion-invite',target:third});
 w=wonderAct(w,{type:'politics',cityId:thirdCity,action:'request-accept',requestId:w.politics!.requests.at(-1)!.id},third);
 return wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'legion-transfer',target:third});
}
function shell(w:FormalWorld,mobile:boolean){const c=w.cities[0];return renderToStaticMarkup(<Shell world={w} city={c} cities={[c]} mobile={mobile} view="legion" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} mobileShortcuts={['map','legion','empire']}><p>遊戲</p></Shell>);}
const rootView=(w:FormalWorld,issue=vi.fn())=><PoliticalCommunityView world={w} city={w.cities[0]} issue={issue} busy={false} onWorld={noop}/>;
let mounted:Root|undefined;
afterEach(async()=>{if(mounted)await act(async()=>mounted!.unmount());document.body.innerHTML='';localStorage.clear();vi.unstubAllGlobals();});
const parsed=(s:string)=>{const el=document.createElement('div');el.innerHTML=s;return el;};

it('renders matching current role labels in desktop rail, mobile bar, more and shortcut editor without changing stable IDs',()=>{
 for(const [make,label] of [[createFormalFixture,'軍團'],[independent,'軍團'],[ordinaryMember,'帝國'],[leader,'帝國']] as const){
  const w=make(),name=politicalCommunityLabel(w);expect(name).toBe(label);
  const desktop=parsed(shell(w,false));expect(desktop.querySelector('.left-rail [title="'+label+'"]')?.getAttribute('aria-current')).toBe('page');
  expect(desktop.querySelector('.left-rail [title="治理方針"]')).not.toBeNull();
  const mobile=parsed(shell(w,true));expect(mobile.querySelector('[data-nav-id=legion]')?.textContent).toContain(label);
  expect(mobile.querySelector('[data-nav-id=empire]')?.textContent).toContain('治理');
  expect(mobile.querySelector('.nav-more')?.parentElement?.tagName).toBe('NAV');
  const more=parsed(renderToStaticMarkup(<MobileMoreMenu politicalName={name} shortcuts={[]} view="legion" onNavigate={noop} onHome={noop} onCustomize={noop} reminders={{}}>測試</MobileMoreMenu>));
  expect(more.querySelector('[data-nav-id=legion]')?.textContent).toContain(label);
  expect(more.querySelector('[data-nav-id=empire]')?.textContent).toContain('治理方針');
  const settings=parsed(renderToStaticMarkup(<MobileNavigationSettings politicalName={name} shortcuts={['legion','empire']} onSave={noop} onClose={noop}/>));
  expect(settings.querySelector('button[aria-label="移除'+label+'"]')).not.toBeNull();
  localStorage.setItem(MOBILE_SHORTCUTS_KEY,JSON.stringify(['legion','empire']));
  expect(readMobileShortcuts()).toEqual(['legion','empire']);
 }
});

it('shows only a real empire with projects separated from own legion actions, and reacts to leave and leader transfer',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const box=document.createElement('div');document.body.append(box);mounted=createRoot(box);
 const issue=vi.fn(),render=async(w:FormalWorld)=>{await act(async()=>mounted!.render(rootView(w,issue)));};
 const tab=(name:string)=>[...box.querySelectorAll<HTMLButtonElement>('button[role=tab]')].find(b=>b.textContent===name);
 const click=async(name:string)=>{const b=tab(name);expect(b,name).toBeTruthy();await act(async()=>b!.click());};
 await render(createFormalFixture());expect(box.textContent).toContain('尚未加入軍團');expect(tab('世界奇觀')).toBeUndefined();
 await render(independent());expect(tab('管理')).toBeTruthy();expect(tab('世界奇觀')).toBeUndefined();
 const first=leader();await render(first);expect(tab('帝國管理')).toBeTruthy();
 await click('世界奇觀');expect(box.querySelector('[aria-label="帝國世界奇觀"]')).not.toBeNull();expect(box.textContent).not.toContain('啟動文明突破');
 await click('文明突破');expect(box.textContent).toContain('帝國完成世界奇觀後');
 await click('自己的軍團');for(const item of ['總覽','成員','聯防','聯軍','管理'])expect(tab(item),item).toBeTruthy();
 expect(box.querySelector('[aria-label="帝國世界奇觀"]')).toBeNull();
 await click('帝國管理');expect(box.textContent).toContain('解散帝國');expect(box.textContent).toContain('帝國所屬軍團');
 await render(transfer(first));expect(box.querySelector('[aria-selected=true]')?.textContent).toBe('帝國總覽');
 await click('帝國管理');expect(box.textContent).toContain('軍團退出帝國');expect(box.textContent).not.toContain('解散帝國');
 await render(ordinaryMember());expect(tab('帝國管理')).toBeUndefined();expect(box.textContent).toContain('帝國成員');
 const member=ownMember();await render(wonderAct(member,{type:'politics',cityId:member.cities[0].id,action:'empire-leave'}));expect(tab('帝國總覽')).toBeUndefined();expect(tab('所屬軍團')).toBeUndefined();expect(issue).not.toHaveBeenCalled();
});
