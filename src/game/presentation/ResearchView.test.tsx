// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {make,researchCity,commit,ownSecond,build} from '../formal/developmentTestSupport';
import {advanceFormal,submitFormalOrder} from '../formal/reducer';
import {order} from '../formal/testSupport';
import type {FormalWorld} from '../formal/model';
import {TECH_CATALOG} from '../formal/techCatalog';
import {decodeSave,encodeSave} from '../formal/saveCodec';
import * as qualifications from '../formal/buildingDetailData';
import {ResearchView,ResearchCountdown,researchRealTime} from './ResearchView';
import {displayClock,DisplayClock} from './liveClock';

let host:HTMLDivElement,root:Root,now=0;
beforeEach(()=>{localStorage.clear();now=0;vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(performance,'now').mockImplementation(()=>now);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();displayClock.stop();vi.restoreAllMocks();vi.unstubAllGlobals();});
const button=(name:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
const node=(id:string)=>host.querySelector<HTMLElement>(`[data-tech-id="${id}"]`)!;
const show=async(w:FormalWorld,mobile=false)=>{await act(async()=>root.render(<ResearchView world={w} city={w.cities[0]} issue={()=>{}} busy={false} mobile={mobile}/>));};
const start=(speed=1)=>{const w=make();w.speed=speed===50?1:speed;if(speed===50)w.developer={enabled:true,speed:50};researchCity(w);return commit(w,{type:'research.start',cityId:w.cities[0].id,techId:'military.breeding'});};

for(const [speed,expected] of [[1,'1 時 0 分 0 秒'],[3,'0 時 20 分 0 秒'],[6,'0 時 10 分 0 秒'],[10,'0 時 6 分 0 秒'],[50,'0 時 1 分 12 秒']] as const){
 it(speed+'X converts one world hour and ticks only display leaves',async()=>{
  const w=start(speed),p=w.researchProjects.at(-1)!;p.durationSnapshot.durationMs=3600000;
  displayClock.adopt({campaignId:w.campaignId,time:w.time,speed,running:true});
  let parentRenders=0;function Surface(){parentRenders++;return <ResearchCountdown world={w} project={p}/>;}
  await act(async()=>root.render(<Surface/>));expect(host.textContent).toBe(expected+'（現實時間）');expect(researchRealTime(3600000,w)).toBe(expected);
  now=1000;await act(async()=>displayClock.sample());expect(host.textContent).toBe(researchRealTime(3600000-speed*1000,w)+'（現實時間）');expect(parentRenders).toBe(1);
  now=Math.ceil(3600000/speed);await act(async()=>displayClock.sample());expect(host.textContent).toBe('完成確認中');expect(w.factions[0].techIds).not.toContain(p.techId);
 });
}
it('speed switch, pause, resume and recovered world anchor use the common display clock',async()=>{
 let w=start(),p=w.researchProjects.at(-1)!;p.durationSnapshot.durationMs=3600000;
 const render=async()=>act(async()=>root.render(<ResearchCountdown world={w} project={p}/>));
 displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:1,running:true});await render();
 now=1000;await act(async()=>displayClock.sample());expect(host.textContent).toContain('59 分 59 秒');
 w={...w,time:1000,developer:{enabled:true,speed:50}};displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:50,running:true});await render();expect(host.textContent).toContain('1 分 12 秒');
 now=2000;await act(async()=>displayClock.sample());await act(async()=>displayClock.stop());const paused=host.textContent;
 now=9000;await act(async()=>displayClock.sample());expect(host.textContent).toBe(paused);
 displayClock.adopt({campaignId:w.campaignId,time:51000,speed:50,running:true});now=10000;await act(async()=>displayClock.sample());expect(host.textContent).toContain('1 分 10 秒');
 w={...w,time:1800000};displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:50,running:false});await render();expect(host.textContent).toContain('0 時 0 分 36 秒');
 const isolated=new DisplayClock(()=>now);isolated.adopt({campaignId:'other',time:999999,speed:50,running:true});expect(isolated.time(w.campaignId,w.time)).toBe(w.time);
});
it('keeps active art dark and gold until the formal completion event, with fixed duration across cities',async()=>{
 let w=start(50);ownSecond(w);const before=JSON.stringify(w),p=w.researchProjects.at(-1)!,end=p.startedAt!+p.durationSnapshot.durationMs;
 displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:50,running:true});await show(w);expect(node(p.techId).dataset.state).toBe('active');expect(host.querySelector('[role=progressbar]')).toBeNull();
 await act(async()=>node(p.techId).querySelector('button')!.click());const time=host.querySelector('.research-detail')!.textContent!.match(/研究時間.*（現實時間）/)?.[0];
 build(w.cities[1],'academy',1);const afterCityChange=JSON.stringify(w);await act(async()=>root.render(<ResearchView world={w} city={w.cities[1]} issue={()=>{}} busy={false}/>));expect(host.querySelector('.research-detail')!.textContent).toContain(time!);
 now=Math.ceil(end/50)+1000;await act(async()=>displayClock.sample());expect(node(p.techId).dataset.state).toBe('active');expect(host.textContent).toContain('完成確認中');expect(JSON.stringify(w)).toBe(afterCityChange);
 const actual=advanceFormal(w,end).world;await show(actual);expect(node(p.techId).dataset.state).toBe('done');expect(host.textContent).toContain('目前沒有進行中的研究');expect(before).not.toBe(JSON.stringify(actual));
 const loaded=(await decodeSave(await encodeSave(actual))).world;await show(loaded);expect(node(p.techId).dataset.state).toBe('done');expect(loaded.factions[0].researchQueue).toBeNull();expect(loaded.factions[0].techIds).toEqual(actual.factions[0].techIds);
});
it('checks resources, shows all requirement reasons and prevents duplicate starts before and after ACK',async()=>{
 let w=make(),c=researchCity(w);const send=vi.fn(),id='blacksmith.melee.1';
 await act(async()=>root.render(<ResearchView world={w} city={c} issue={send} busy={false}/>));expect(node(id).dataset.state).toBe('available');
 await act(async()=>node(id).querySelector('button')!.click());const startButton=button('啟動研究');await act(async()=>{startButton.click();startButton.click();});expect(send).toHaveBeenCalledTimes(1);
 w=commit(w,{type:'research.start',cityId:c.id,techId:id});await act(async()=>root.render(<ResearchView world={w} city={w.cities[0]} issue={send} busy={false}/>));
 const other='blacksmith.ranged.1';expect(node(other).dataset.state).toBe('locked');await act(async()=>node(other).querySelector('button')!.click());expect(button('啟動研究').disabled).toBe(true);expect(host.textContent).toContain('勢力共用研究佇列已占用');
 expect(submitFormalOrder(w,order(w,'duplicate-other',{type:'research.start',cityId:c.id,techId:other})).ack?.status).toBe('rejected');
 const poor=make();await show(poor);await act(async()=>node('blacksmith.melee.1').querySelector('button')!.click());expect(button('啟動研究').disabled).toBe(true);expect(host.textContent).toContain('鐵匠鋪 Lv1');expect(host.textContent).toContain('封建時代');
});
it('mobile supports independent collapses, bottom details and persisted browsing without save mutations',async()=>{
 const w=make();researchCity(w);const before=JSON.stringify(w);await show(w,true);await act(async()=>button('封建').click());
 const groups=host.querySelectorAll<HTMLDetailsElement>('.research-mobile-groups>details');expect(groups.length).toBeGreaterThan(3);
 await act(async()=>{groups[0].open=false;groups[0].dispatchEvent(new Event('toggle'));});expect(groups[1].open).toBe(true);
 await act(async()=>node('economy.food.1').querySelector('button')!.click());expect(host.querySelector('dialog.research-sheet')?.hasAttribute('open')).toBe(true);expect(host.textContent).toContain(TECH_CATALOG['economy.food.1'].effect);
 await act(async()=>button('×').click());await act(async()=>button('城堡').click());await act(async()=>button('封建').click());expect(host.querySelector<HTMLDetailsElement>('.research-mobile-groups>details')!.open).toBe(false);
 await act(async()=>root.render(<div/>));await show(w,true);expect(button('封建').getAttribute('aria-pressed')).toBe('true');expect(host.querySelector<HTMLDetailsElement>('.research-mobile-groups>details')!.open).toBe(false);expect(JSON.stringify(w)).toBe(before);
});
it('funding has no countdown, permits zero-stock project creation and retains real four-resource contributions',async()=>{
 let w=make(),c=researchCity(w,true);c.stock={food:0,wood:0,stone:0,gold:0};await show(w);await act(async()=>button('現代科研').click());await act(async()=>node('modern.infantry-weapons').querySelector('button')!.click());expect(node('modern.infantry-weapons').dataset.state).toBe('available');expect(node('modern.infantry-weapons').textContent).toContain('可建立籌資');expect(button('建立科研籌資').disabled).toBe(false);
 w=commit(w,{type:'research.start',cityId:c.id,techId:'modern.infantry-weapons'});await show(w);expect(host.querySelector('.research-current')!.textContent).toContain('籌資中');expect(host.querySelector('.research-countdown')).toBeNull();expect(host.textContent).toContain('剩餘需求');expect(host.querySelectorAll('input[aria-label^="科研投入"]')).toHaveLength(4);
});
it('countdown ticks retain SVG nodes, selection, scroll and do not recalculate qualifications',async()=>{
 const w=start(10),spy=vi.spyOn(qualifications,'researchRequirements');displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:10,running:true});await show(w);
 const path=host.querySelector('svg path'),calls=spy.mock.calls.length;await act(async()=>node('military.breeding').querySelector('button')!.click());const outer=host.querySelector('.research-view')!;outer.scrollTop=321;
 now=1000;await act(async()=>displayClock.sample());expect(host.querySelector('svg path')).toBe(path);expect(outer.scrollTop).toBe(321);expect(spy.mock.calls.length).toBe(calls);expect(node('military.breeding').getAttribute('class')).toContain('is-selected');
});
