// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {make,researchCity} from '../formal/developmentTestSupport';
import {catchupWorld,act as issue} from '../formal/catchupTestSupport';
import {AwarenessPanel} from './AwarenessPanel';
import {CatchupPanel} from './CatchupPanel';
import {ArmyView,ResearchView} from './DevelopmentViews';
import {displayClock} from './liveClock';
import {IncomingArmyAlert} from './IncomingArmyAlert';
import {battlefield,dispatch,arrive} from '../formal/combatTestSupport';
import {BattleReportBody} from './BattleReportBody';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();displayClock.stop();vi.unstubAllGlobals();});
const button=(text:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
async function input(el:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});}
for(const mobile of [false,true])it(`B9-4 ${mobile?'mobile':'desktop'} keeps military layout and allows only the reverse-engineered line`,async()=>{
 const w=make(),c=researchCity(w),issue=vi.fn();w.factions[0].reverseEngineering=['modern.militia'];await act(async()=>root.render(<ArmyView world={w} city={c} issue={issue} busy={false} mobile={mobile}/>));const select=host.querySelector<HTMLSelectElement>('select[aria-label="兵種世代"]')!;await act(async()=>{select.value='modern';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(host.textContent).toContain('現代軍事認知');expect(host.textContent).toContain('現代化追趕工程');if(!mobile){const article=[...host.querySelectorAll('article.card')].find(a=>a.querySelector('h2')?.textContent==='機械化突擊步兵')!;expect(article.querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(false);await act(async()=>article.querySelector<HTMLButtonElement>('button.primary')!.click());expect(issue).toHaveBeenCalledWith({type:'military.recruit',cityId:c.id,unitId:'modern.militia',count:1});const tank=[...host.querySelectorAll('article.card')].find(a=>a.querySelector('h2')?.textContent==='主力戰車')!;expect(tank.querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(true);}
});
it('B9-4 awareness exposes effective value, encountered lines and a single explicit reverse choice',async()=>{
 const w=make(),issue=vi.fn();w.modernAwareness={pools:{[w.playerFactionId]:{value:60,significantEncounter:true,encountered:['modern.knight']}},battles:[]};await act(async()=>root.render(<AwarenessPanel world={w} city={w.cities[0]} issue={issue} busy={false}/>));expect(host.textContent).toContain('60／100');expect(host.textContent).toContain('主力戰車');expect(button('選擇逆向工程').disabled).toBe(false);await act(async()=>button('選擇逆向工程').click());expect(issue).toHaveBeenCalledExactlyOnceWith({type:'modern.reverse',cityId:w.cities[0].id,unitId:'modern.knight'});
});
it('B9-4 emergency start, four-resource shipment, pool and funding status use formal commands',async()=>{
 let w=catchupWorld();const send=vi.fn();await act(async()=>root.render(<CatchupPanel world={w} city={w.cities[0]} issue={send} busy={false}/>));await act(async()=>button('以本城啟動緊急現代化').click());expect(send).toHaveBeenCalledWith({type:'modern.emergency.start',cityId:w.cities[0].id});w=issue(w,{type:'modern.emergency.start',cityId:w.cities[0].id});await act(async()=>root.render(<CatchupPanel world={w} city={w.cities[0]} issue={send} busy={false}/>));expect(host.textContent).toContain('籌資');const fields=[...host.querySelectorAll<HTMLInputElement>('input[type="number"]')];expect(fields).toHaveLength(4);await input(fields[0],'100');await act(async()=>button('商隊運送至工程池').click());expect(send).toHaveBeenCalledWith({type:'modern.project.ship',cityId:w.cities[0].id,projectId:w.largeProjects.at(-1)!.projectId,resources:{food:100,wood:0,stone:0,gold:0}});
});
it('B9-4 ResearchView shows cooperation/modern effects and accepts explicitly selected real city contributions',async()=>{
 let w=make();researchCity(w,true);const send=vi.fn();w=issue(w,{type:'research.start',cityId:w.cities[0].id,techId:'modern.infantry-weapons'});await act(async()=>root.render(<ResearchView world={w} city={w.cities[0]} issue={send} busy={false}/>));await act(async()=>button('現代科研').click());expect(host.textContent).toContain('現代步兵武裝');expect(host.textContent).toContain('火力協同網');expect(host.textContent).not.toContain('主動防護系統');expect(host.textContent).toContain('多城科研籌資中');const field=host.querySelector<HTMLInputElement>('input[aria-label="科研投入food"]')!;await input(field,'123');await act(async()=>button('投入所選科研資源').click());expect(send).toHaveBeenCalledWith({type:'research.contribute',cityId:w.cities[0].id,projectId:w.researchProjects[0].projectId,resources:{food:123,wood:0,stone:0,gold:0}});const card=host.querySelector('[data-tech-id="modern.infantry-weapons"]')!;await act(async()=>card.querySelector<HTMLButtonElement>('button')!.click());expect(host.textContent).toContain('現代徒步戰鬥兵與徒步衛隊攻擊 +8%');
});
it('B9-4 data link adds major and secondary composition to existing owned incoming alert only',async()=>{
 let w=battlefield();w.factions[0].techIds=['modern.data-link'];w.cities[1].military!.units={'modern.knight':10,militia:20};w=dispatch(w,'raid',{'modern.knight':10,militia:20},1,0).world;await act(async()=>root.render(<IncomingArmyAlert world={w} onCity={vi.fn()}/>));await act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());expect(host.textContent).toContain('主要／次要：主力戰車／民兵');
});
it('B9-4 cognition20 unlocks explicit enemy modern type identification in the existing battle report',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:1000};w.cities[1].military!.units={'modern.knight':5};const t=arrive(dispatch(w,'raid',{militia:1000}).world);w=t.world;const battle=t.reports[0].battle!;await act(async()=>root.render(<BattleReportBody battle={battle} world={w}/>));expect(host.textContent).toContain('未辨識現代部隊');expect(host.textContent).not.toContain('主力戰車');w.modernAwareness!.pools[w.playerFactionId].value=20;await act(async()=>root.render(<BattleReportBody battle={battle} world={w}/>));expect(host.textContent).toContain('主力戰車');
});
