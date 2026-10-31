// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ArmyView} from './DevelopmentViews';
import {RecruitmentForm,parseRecruitCount} from './RecruitmentForm';
import * as actions from './cityActions';
import * as reducer from '../formal/reducer';
import {createFormalFixture} from '../formal/fixture';
import {initializeEconomy} from '../formal/economy';
import {initialMilitary} from '../formal/military';
import {researchCity} from '../formal/developmentTestSupport';
import {displayClock} from './liveClock';
let box:HTMLDivElement,root:Root;beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);box=document.createElement('div');document.body.append(box);root=createRoot(box);});afterEach(async()=>{await act(async()=>root.unmount());box.remove();displayClock.stop();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(){const w=createFormalFixture({speed:25});w.armies=[];initializeEconomy(w);for(const c of w.cities)c.military=initialMilitary();researchCity(w,true);return w;}
async function edit(input:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
for(const mobile of [false,true])it(`${mobile?'phone':'desktop'} keeps edits local, preserves leading zeros/empty drafts, and submits the original Worker command`,async()=>{
 const w=fixture(),issue=vi.fn();await act(async()=>root.render(<ArmyView world={w} city={w.cities[0]} issue={issue} busy={false} mobile={mobile}/>));
 if(!mobile){const batch=box.querySelector<HTMLInputElement>('[aria-label=每批招募人數]')!,preview=vi.spyOn(actions,'recruitmentConditions');await edit(batch,'0500');expect(batch.value).toBe('0500');expect(preview).not.toHaveBeenCalled();preview.mockRestore();}
 const card=[...box.querySelectorAll<HTMLElement>(mobile?'.catalog-grid>.catalog-card':'.desktop-recruits>.card')].find(e=>e.textContent!.includes('斥候'))!;await act(async()=>{(mobile?card:card.querySelector<HTMLButtonElement>('button')!).click();});const input=box.querySelector<HTMLInputElement>('[aria-label=招募數量]')!;input.focus();const conditions=vi.spyOn(actions,'recruitmentConditions'),submit=vi.spyOn(reducer,'submitFormalOrder'),clone=vi.spyOn(globalThis,'structuredClone');
 for(const raw of ['1','5','50','500','1000','0500','','0','100001','100000','0500']){await edit(input,raw);expect(input.value).toBe(raw);expect(box.querySelector('[aria-label=招募數量]')).toBe(input);expect(document.activeElement).toBe(input);}
 expect(conditions.mock.calls.every(c=>c[2]==='scout')).toBe(true);expect(submit).not.toHaveBeenCalled();expect(clone).not.toHaveBeenCalled();expect(issue).not.toHaveBeenCalled();clone.mockRestore();submit.mockRestore();
 // Both platforms submit a base unit ID and a validated integer; the Worker owns final admission.
 await edit(input,'5');const button=box.querySelector<HTMLButtonElement>('dialog .primary')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'military.recruit',cityId:w.cities[0].id,unitId:'scout',count:5});
});
it('validates only on submission, without coercing empty, zero or over-limit input',async()=>{
 const w=fixture(),issue=vi.fn();await act(async()=>root.render(<RecruitmentForm world={w} city={w.cities[0]} unitId="scout" busy={false} issue={issue} onRecruited={()=>{}}/>));const input=box.querySelector<HTMLInputElement>('input')!;
 for(const raw of ['','0','100001','1.5','1e2','-1']){await edit(input,raw);expect(box.querySelector('[role=alert]')).toBeNull();await act(async()=>box.querySelector<HTMLButtonElement>('.primary')!.click());expect(box.querySelector('[role=alert]')?.textContent).toContain('1～100000');expect(input.value).toBe(raw);expect(issue).not.toHaveBeenCalled();}
 expect(parseRecruitCount('100000')).toBe(100000);expect(parseRecruitCount('0500')).toBe(500);expect(parseRecruitCount('')).toBeUndefined();
});
it('25x clock, world, city and qualification updates keep the same input, focus and draft',async()=>{
 let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);let w=fixture();displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:25,running:true});await act(async()=>root.render(<ArmyView world={w} city={w.cities[0]} issue={()=>{}} busy={false} mobile/>));await act(async()=>[...box.querySelectorAll<HTMLButtonElement>('.catalog-card')].find(e=>e.textContent!.includes('斥候'))!.click());const input=box.querySelector<HTMLInputElement>('[aria-label=招募數量]')!,dialog=box.querySelector('dialog');input.focus();await edit(input,'0500');
 for(let i=1;i<=3;i++){now=i*1000;await act(async()=>displayClock.sample());expect(input.value).toBe('0500');expect(box.querySelector('dialog')).toBe(dialog);expect(document.activeElement).toBe(input);}
 w={...w,time:w.time+1000,factions:w.factions.map(f=>({...f,age:2}))};await act(async()=>root.render(<ArmyView world={w} city={w.cities[1]} issue={()=>{}} busy={false} mobile/>));expect(box.querySelector('[aria-label=招募數量]')).toBe(input);expect(input.value).toBe('0500');expect(document.activeElement).toBe(input);
});
