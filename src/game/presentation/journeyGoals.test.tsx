// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {JourneyGoals} from './JourneyGoals';
import {VictoryPanel} from './VictoryPanel';
import {LegionView} from './LegionView';
import {NAV,Shell} from './Shell';
import {MobileMoreMenu} from '../MobileNavigationSettings';
import {MOBILE_SHORTCUTS_KEY,readMobileShortcuts} from '../mobileNavigationPreferences';
import {claimableGrowthCount} from '../formal/growthTasks';
import {GROWTH_TASK_BY_ID} from '../formal/growthTaskCatalog';
import {createFormalFixture} from '../formal/fixture';
import {initializeEconomy} from '../formal/economy';
import {initialMilitary} from '../formal/military';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import {order,make} from '../formal/developmentTestSupport';
import {victoryConditions,reconcileVictory} from '../formal/victory';
import {EventScheduler} from '../formal/scheduler';
import {empireId} from '../formal/ids';
import {invalidateSpatial} from '../formal/spatial';
import {invalidateMilitaryPower} from '../formal/militaryPower';
import {HOUR} from '../formal/time';
import type {FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {displayClock} from './liveClock';
let root:Root|undefined,box:HTMLDivElement;
beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true));
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;box?.remove();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();displayClock.stop();});
async function mount(node:React.ReactNode){box=document.createElement('div');document.body.append(box);root=createRoot(box);await act(async()=>root!.render(node));}
async function click(name:string){const el=[...box.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name)!;expect(el,name).toBeTruthy();await act(async()=>el.click());}
function ready(){let w=createFormalFixture();w.armies=[];for(const c of w.cities){c.fields=Array.from({length:18},(_,slot)=>({slot,resource:resourceKeys[slot<6?0:slot<11?1:slot<15?2:3],level:0}));c.wallLevel=0;c.cityPromotionCompleted=false;c.integrationWorkHours=0;c.military=initialMilitary();}initializeEconomy(w);w=submitFormalOrder(w,order(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0})).world;const job=w.cities[0].economy!.construction[0];return advanceFormal(w,job.startsAt+job.durationMs).world;}
const noop=()=>{};
it('keeps ten routes, renames tasks consistently and preserves PR34 local shortcut preferences and independent badges',()=>{
 expect(NAV).toHaveLength(10);expect(NAV.find(n=>n.id==='tasks')!.name).toBe('征途目標');localStorage.setItem(MOBILE_SHORTCUTS_KEY,JSON.stringify(['tasks','map','reports']));expect(readMobileShortcuts()).toEqual(['tasks','map','reports']);const w=createFormalFixture(),html=renderToStaticMarkup(<Shell world={w} city={w.cities[0]} cities={w.cities.slice(0,2)} mobile view="tasks" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} mobileShortcuts={['tasks']} navigationReminders={{tasks:{count:3,attention:true},reports:{count:5,attention:true}}}><p>內容</p></Shell>);const el=document.createElement('div');el.innerHTML=html;expect(el.querySelector('[data-nav-id=tasks] strong')!.textContent).toBe('目標');expect(el.querySelector('[data-nav-id=tasks] .nav-unread-count')!.textContent).toBe('3');expect(el.querySelector('.nav-more .nav-unread-count')!.textContent).toBe('5');
 const more=renderToStaticMarkup(<MobileMoreMenu shortcuts={[]} view="tasks" onNavigate={noop} onHome={noop} onCustomize={noop} reminders={{tasks:{count:3,attention:true},reports:{count:5,attention:true}}}>clock</MobileMoreMenu>);el.innerHTML=more;expect(el.querySelector('[data-nav-id=tasks]')!.textContent).toContain('征途目標');expect(el.querySelector('[data-nav-id=tasks] .nav-unread-count')!.textContent).toBe('3');expect(el.querySelector('[data-nav-id=reports] .nav-unread-count')!.textContent).toBe('5');
});
it('desktop keeps the original report badge and gives goals its own independent reminder',()=>{
 const w=createFormalFixture(),html=renderToStaticMarkup(<Shell world={w} city={w.cities[0]} cities={w.cities.slice(0,2)} mobile={false} view="tasks" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} unread={5} alerts={1} navigationReminders={{tasks:{count:3,attention:true}}}><p>內容</p></Shell>),el=document.createElement('div');el.innerHTML=html;const buttons=[...el.querySelectorAll('.left-rail nav button')];expect(buttons).toHaveLength(10);expect(buttons.find(b=>b.getAttribute('title')==='征途目標')?.textContent).toContain('3');expect(buttons.find(b=>b.getAttribute('title')==='戰報紀事')?.textContent).toContain('5');expect(el.querySelectorAll('.left-rail .has-unread')).toHaveLength(2);
});
it('renders only the expanded era tasks initially and exposes both official tabs',async()=>{
 const w=ready();await mount(<JourneyGoals world={w} city={w.cities[0]} busy={false} issue={noop}/>);expect(box.querySelector('h1')!.textContent).toBe('征途目標');expect(box.querySelectorAll('[role=tab]')).toHaveLength(2);expect(box.querySelectorAll('[data-task-id]')).toHaveLength(14);expect(box.querySelector('[data-task-id=F01]')).toBeNull();const era=box.querySelectorAll<HTMLDetailsElement>('.journey-era')[1];await act(async()=>{era.open=true;era.dispatchEvent(new Event('toggle'));});expect(box.querySelectorAll('[data-task-id]')).toHaveLength(43);await click('勝利之路');expect(box.querySelectorAll('[data-task-id]')).toHaveLength(0);expect(box.textContent).toContain('征服勝利');expect(box.textContent).toContain('帝國霸權勝利');
});
it('claims the full reward once and moves it into collapsed compact history without reports or popups',async()=>{
 const initial=ready(),issued:FormalCommand[]=[];initial.cities[1].stock={food:0,wood:0,stone:0,gold:0};
 function Harness(){const [w,setW]=useState(initial);return <JourneyGoals world={w} city={w.cities[0]} busy={false} issue={p=>{issued.push(p);const t=submitFormalOrder(w,order(w,p));expect(t.ack?.status,t.ack?.reason).toBe('committed');expect(t.reports).toEqual([]);setW(t.world);}}/>;}
 await mount(<Harness/>);expect(box.querySelector('.journey-ready [data-task-id=N01]')).not.toBeNull();expect(box.querySelector('.journey-claimed')?.getAttribute('open')).toBeNull();const select=box.querySelector<HTMLSelectElement>('[aria-label=領獎城市]')!;await act(async()=>{select.value=initial.cities[1].id;select.dispatchEvent(new Event('change',{bubbles:true}));});expect(box.querySelector('dialog')).toBeNull();expect(box.textContent).toContain('可用容量');expect(box.textContent).toContain('不足量');expect(box.textContent).toContain('支援城');await click('完整領取');expect(issued).toEqual([{type:'tasks.claim',cityId:initial.cities[1].id,taskId:'N01',rewardVersion:2,expectedResources:GROWTH_TASK_BY_ID.get('N01')!.reward}]);expect(box.querySelector('[data-task-id=N01]')).toBeNull();expect(box.textContent).toContain('可領取 0');expect(document.activeElement?.id).toBe('journey-ready-heading');
 const history=box.querySelector<HTMLDetailsElement>('.journey-claimed')!;await act(async()=>{history.open=true;history.dispatchEvent(new Event('toggle'));});const row=box.querySelector<HTMLDetailsElement>('.journey-claimed-row')!;expect(row.textContent).toContain('N01');expect(row.querySelector('progress')).toBeNull();expect(row.querySelector('table')).toBeNull();expect(row.querySelector('button')).toBeNull();await act(async()=>{row.open=true;row.dispatchEvent(new Event('toggle'));});expect(row.textContent).toContain('歷史領獎明細');expect(row.querySelectorAll('tbody tr')).toHaveLength(4);
});
it('keeps insufficient tasks claimable, updates capacity without re-confirmation loops, and disables a lost city',async()=>{
 let w=ready();w.cities[0].stock.wood=800;const issue=vi.fn();await mount(<JourneyGoals world={w} city={w.cities[0]} busy={false} issue={issue}/>);const button=()=>[...box.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='完整領取')!;expect(button().disabled).toBe(true);expect(box.textContent).toContain('倉庫容量不足');expect(box.querySelector('.journey-ready [data-task-id=N01]')).not.toBeNull();expect(issue).not.toHaveBeenCalled();
 w=structuredClone(w);w.cities[0].stock={food:0,wood:0,stone:0,gold:0};await act(async()=>root!.render(<JourneyGoals world={w} city={w.cities[0]} busy={false} issue={issue}/>));expect(button().disabled).toBe(false);
 w=structuredClone(w);w.cities[0].stock.food=1;await act(async()=>root!.render(<JourneyGoals world={w} city={w.cities[0]} busy={false} issue={issue}/>));expect(button().disabled).toBe(false);expect(box.textContent).not.toContain('重新核對');expect(issue).not.toHaveBeenCalled();
 w=structuredClone(w);w.cities[0].ownerFactionId=w.factions[1].id;await act(async()=>root!.render(<JourneyGoals world={w} city={w.cities[0]} busy={false} issue={issue}/>));expect(button().disabled).toBe(true);expect(box.textContent).toContain('請選擇目前自有城市');expect(issue).not.toHaveBeenCalled();
});
it('removes formal victory panels from both legion membership states',()=>{
 const w=createFormalFixture(),render=(world:FormalWorld)=>renderToStaticMarkup(<LegionView world={world} city={world.cities[0]} issue={noop} busy={false} onWorld={noop}/>);expect(render(w)).not.toContain('正式勝利條件');w.politics={legions:[{id:'legion:test',name:'自己的軍團',leader:w.playerFactionId,members:[w.playerFactionId],description:'',empireId:null}],empires:[],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};const html=render(w);expect(html).toContain('自己的軍團');expect(html).not.toContain('正式勝利條件');expect(html).not.toContain('victory-road');
});
it('victory card data is a read-only projection and its clock never advances from the frontend display clock',async()=>{
 let w=createFormalFixture();w.cities[2].ownerFactionId=w.playerFactionId;const s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();w=advanceFormal(w,3*HOUR+30000).world;const before=structuredClone(w),count=claimableGrowthCount(w);await mount(<VictoryPanel world={w}/>);expect(box.textContent).toContain('已連續維持 3 時 0 分');expect(box.textContent).toContain('剩餘 9 時 0 分');displayClock.adopt({campaignId:w.campaignId,time:100*HOUR,speed:100,running:true});displayClock.sample();expect(box.textContent).toContain('已連續維持 3 時 0 分');expect(w).toEqual(before);expect(claimableGrowthCount(w)).toBe(count);
});
it('victory qualification loss clears progress and restores the original 12h clock; terminal state is formal and grants no task reward',async()=>{
 let w=createFormalFixture();w.cities[2].ownerFactionId=w.playerFactionId;let s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();w=advanceFormal(w,6*HOUR).world;w.cities[2].ownerFactionId=w.factions[1].id;invalidateSpatial(w);s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();await mount(<VictoryPanel world={w}/>);expect(box.textContent).toContain('條件尚未同時達標');expect(box.textContent).toContain('尚差 3.3 個百分點');w.cities[2].ownerFactionId=w.playerFactionId;invalidateSpatial(w);s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();await act(async()=>root!.render(<VictoryPanel world={w}/>));expect(box.textContent).toContain('剩餘 12 時 0 分');w=advanceFormal(w,18*HOUR).world;await act(async()=>root!.render(<VictoryPanel world={w}/>));expect(box.textContent).toContain('正式征服勝利');expect(box.textContent).not.toContain('剩餘');expect(w.growthTasks?.claimed??{}).toEqual({});
});
it('hegemony cards display authoritative 3 legions, 15 active lords, 45% shares and unique military rank, including ties',async()=>{
 let w=make();const id=empireId('journey-ui'),members=w.factions.slice(0,15).map(f=>f.id);w.politics={legions:[],empires:[{id,name:'目標帝國',leader:members[0],legions:[],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};for(let i=0;i<3;i++){const group=members.slice(i*5,i*5+5),key='legion:journey-'+i;w.politics.legions.push({id:key,name:'目標軍團',description:'',leader:group[0],members:group,empireId:id});w.politics.empires[0].legions.push(key);}for(const f of w.factions)f.empireId=members.includes(f.id)?id:null;for(let i=0;i<100;i++){w.cities[i].population=100;if(i<45)w.cities[i].ownerFactionId=members[i%15];}w.cities[0].military!.units={militia:100};invalidateSpatial(w);let s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();const c=victoryConditions(w).find(c=>c.empire?.id===id)!;expect(c.hegemony).toBe(true);w=advanceFormal(w,12*HOUR).world;await mount(<VictoryPanel world={w}/>);expect(box.textContent).toContain('有效軍團');expect(box.textContent).toContain('活躍領主');expect(box.textContent).toContain('剩餘 12 時 0 分');expect(box.textContent).toContain('第 1 名');w.cities[45].military!.units={militia:100};invalidateMilitaryPower(w);s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();await act(async()=>root!.render(<VictoryPanel world={w}/>));expect(box.textContent).toContain('並列第 1 不符合條件');expect(w.victory!.candidates.some(c=>c.kind==='hegemony')).toBe(false);
});
it('qualification without an authoritative candidate waits for B9 instead of starting a frontend timer',async()=>{
 const w=createFormalFixture();w.cities[2].ownerFactionId=w.playerFactionId;const before=structuredClone(w);await mount(<VictoryPanel world={w}/>);expect(box.textContent).toContain('等待正式計時確認');expect(box.textContent).not.toContain('已連續維持');expect(w).toEqual(before);
});
it('shows actual single-city population progress while rendering never creates completed IDs',async()=>{
 const w=ready();w.cities[0].population=490;w.cities[0].housing=1000;w.cities[0].economy!.lastSettledAt=w.time;await mount(<JourneyGoals world={w} city={w.cities[0]} busy={false} issue={noop}/>);expect(box.querySelector('[data-task-id=N13] .journey-progress')!.textContent).toContain('490／500');expect(box.querySelector('[data-task-id=N13] .journey-status')!.textContent).toBe('未完成');expect(w.growthTasks!.completed.N13).toBeUndefined();
});

it('shows historical v1 nominal amounts and actual losses rather than the reduced current reward',async()=>{
 const {readFileSync}=await import('node:fs');const old=JSON.parse(readFileSync('docs/validation/journey-goals-integration/legacy-v1.json','utf8')).cases.find((c:{name:string})=>c.name==='partial').save.snapshot as FormalWorld;
 await mount(<JourneyGoals world={old} city={old.cities[0]} busy={false} issue={noop}/>);const group=box.querySelector<HTMLDetailsElement>('.journey-claimed')!;expect(box.querySelector('.journey-history-detail')).toBeNull();await act(async()=>{group.open=true;group.dispatchEvent(new Event('toggle'));});const row=box.querySelector<HTMLDetailsElement>('.journey-claimed-row')!;expect(row.querySelector('table')).toBeNull();await act(async()=>{row.open=true;row.dispatchEvent(new Event('toggle'));});expect([...row.querySelectorAll('tbody tr:first-child td')].map(e=>e.textContent)).toEqual(['100','10','90']);expect(row.querySelector('button')).toBeNull();
});
