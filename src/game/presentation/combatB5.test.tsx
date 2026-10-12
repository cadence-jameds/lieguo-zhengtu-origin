// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {ArmyView} from './DevelopmentViews';
import {CombatPanel} from './CombatPanel';
import {BattleReportBody} from './BattleReportBody';
import {battlefield,dispatch,arrive} from '../formal/combatTestSupport';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import {order} from '../formal/developmentTestSupport';
let root:Root,container:HTMLDivElement;
const mount=async(node:React.ReactNode)=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(node));};
const button=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
const input=async(label:string,value:string)=>{const node=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});};
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
for(const viewport of ['desktop','mobile'])it(`${viewport}: existing dialog dispatches actual Formal order, then raid result renders without HP/formula/ID leakage`,async()=>{let w=battlefield();w.cities[0].military!.units={militia:40};const source=w.cities[0].id,target={kind:'city' as const,cityId:w.cities[1].id},issue=vi.fn();await mount(<ArmyView world={w} city={w.cities[0]} issue={issue} busy={false} mobile={viewport==='mobile'} armyTarget={target}/>);await input('派遣民兵','20');expect(button('下達掠奪命令').disabled).toBe(false);await act(async()=>button('下達掠奪命令').click());expect(issue).toHaveBeenCalledWith({type:'army.dispatch',cityId:source,mission:'raid',target,units:{militia:20}});const transition=submitFormalOrder(w,order(w,issue.mock.calls[0][0]));expect(transition.ack?.status).toBe('committed');w=transition.world;const t=arrive(w),report=t.reports[0].battle!;await act(async()=>root.render(<BattleReportBody battle={report} world={t.world}/>));expect(container.textContent).toContain('民兵 ×20');expect(container.textContent).toContain('攜回資源');for(const hidden of ['resolution:','battle:','hpPerUnit','半剋制','Exposure'])expect(container.textContent).not.toContain(hidden);});
it('scout selector submits scout-only mode and returned report displays stable observed intel',async()=>{let w=battlefield();w.cities[0].military!.units={scout:10,militia:40};w.cities[1].military!.units={militia:7};const issue=vi.fn();await mount(<CombatPanel world={w} city={w.cities[0]} issue={issue} busy={false} target={{kind:'city',cityId:w.cities[1].id}}/>);await act(async()=>button('返回').click());await act(async()=>button('派遣斥候').click());expect(container.querySelector('input[aria-label="派遣民兵"]')).toBeNull();await input('派遣斥候','6');await act(async()=>button('下達偵察命令').click());expect(issue.mock.calls[0][0]).toMatchObject({mission:'scout',units:{scout:6}});w=submitFormalOrder(w,order(w,issue.mock.calls[0][0])).world;w=arrive(w).world;const t=advanceFormal(w,w.armies[0].arrivalAt!);await act(async()=>root.render(<BattleReportBody battle={t.reports[0].battle!} world={t.world}/>));expect(container.textContent).toContain('偵察快照');expect(container.textContent).toContain('民兵 ×7');expect(container.textContent).toContain('庫存');});
it('busy state prevents duplicate click and exact incoming counts remain hidden',async()=>{let w=battlefield();w.cities[1].military!.units={militia:40,ram:4};w=dispatch(w,'conquest',{militia:40,ram:4},1,0).world;await mount(<CombatPanel world={w} city={w.cities[0]} issue={vi.fn()} busy/>);expect(button('派遣部隊').disabled).toBe(true);expect(container.textContent).toContain('敵軍來襲');expect(container.textContent).not.toContain('衝撞車');expect(container.textContent).not.toContain('民兵 ×40');});
it('DEMO mission route previews the exact Formal arrival time; negative quantities and unsupported armies cannot submit',async()=>{
 const w=battlefield();w.cities[0].military!.units={militia:10,ram:3};const issue=vi.fn();
 await mount(<CombatPanel world={w} city={w.cities[0]} issue={issue} busy={false} target={{kind:'city',cityId:w.cities[1].id}}/>);
 expect(container.querySelector('input[aria-label="派遣 X"]')).toBeNull();expect(container.querySelector('.mission-route')!.textContent).toContain('單程行軍');
 await input('派遣衝撞車','2');expect(button('下達掠奪命令').disabled).toBe(true);
 await input('派遣民兵','-1');expect(button('下達掠奪命令').disabled).toBe(true);
 await input('派遣民兵','5');expect(button('下達掠奪命令').disabled).toBe(false);
 const t=dispatch(w,'raid',{militia:5,ram:2}),arrival=t.world.armies[0].arrivalAt!;
 const {realTime}=await import('./UI');expect(container.querySelector('.mission-route>strong')!.textContent).toBe(realTime(arrival-w.time,w)+'單程行軍');
 await act(async()=>button('返回').click());expect(issue).not.toHaveBeenCalled();expect(container.textContent).toContain('派遣斥候');expect(container.textContent).toContain('佔領據點');
});
it('DEMO target shows unscouted defenses instead of leaking live enemy wall; historical resources retain their own timestamp',async()=>{
 const w=battlefield(),city=w.cities[1];city.wallLevel=9;city.military!.units={militia:999};const onMission=vi.fn();
 const {FormalTargetPanel}=await import('./FormalTargetPanel');
 await mount(<FormalTargetPanel world={w} home={w.cities[0]} city={city} onMission={onMission} onCity={()=>{}}/>);
 expect(container.querySelector('.target-facts')!.textContent).toContain('尚未偵察');expect(container.querySelector('.target-facts')!.textContent).not.toMatch(/999|9 級/);
 await act(async()=>button('派遣斥候').click());expect(onMission).toHaveBeenCalledWith('scout');
 const obs={owner:city.ownerFactionId,intel:{observedAt:0,cityId:city.id,units:{militia:28},wallLevel:1,resources:{food:2500,wood:2500,stone:124,gold:1752}}};
 await act(async()=>root.render(<FormalTargetPanel world={w} home={w.cities[0]} city={city} intel={{army:obs,resources:obs,defenses:obs}} onMission={onMission} onCity={()=>{}}/>));
 expect(container.querySelector('.target-facts')!.textContent).toContain('28');expect(container.querySelector('.target-facts')!.textContent).toContain('1 級');expect(container.textContent).toContain('當時庫存，非即時數值');
});
it('wild resource scout menu exposes scout counts and submits fixed resources-army without an intel selector',async()=>{
 const w=battlefield();w.cities[0].military!.units={scout:3,militia:20};const site=w.worldLayer!.wildSites[0],target={kind:'wild' as const,siteId:site.id,generation:site.generation},issue=vi.fn();
 const {ArmyDispatchDialog}=await import('./CombatPanel');await mount(<ArmyDispatchDialog world={w} city={w.cities[0]} issue={issue} busy={false} target={target} mission="scout" onClose={()=>{}}/>);
 expect(container.querySelector('select[aria-label="偵察情報類型"]')).toBeNull();expect(container.querySelector('input[aria-label="派遣斥候"]')).not.toBeNull();expect(container.querySelector('input[aria-label="派遣民兵"]')).toBeNull();expect(button('下達偵察命令').disabled).toBe(false);
 await act(async()=>button('下達偵察命令').click());expect(issue).toHaveBeenCalledWith({type:'army.dispatch',cityId:w.cities[0].id,target,mission:'scout',units:{scout:2},scoutMode:'resources-army'});
 const {FormalTargetPanel}=await import('./FormalTargetPanel');await act(async()=>root.render(<FormalTargetPanel world={w} home={w.cities[0]} site={site} onMission={()=>{}} onCity={()=>{}}/>));expect(button('派遣斥候').disabled).toBe(false);expect(container.querySelector('.target-facts')!.textContent).not.toContain('城防');
});
