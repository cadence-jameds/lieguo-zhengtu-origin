// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {CombatPanel} from './CombatPanel';
import {BattleReportBody} from './BattleReportBody';
import {LiveBattleDetails} from './LiveBattleDetails';
import {battlefield,dispatch,arrive} from '../formal/combatTestSupport';
import {advanceFormal} from '../formal/reducer';
import type {FormalWorld,FormalReport} from '../formal/model';
let root:Root,container:HTMLDivElement;
async function mount(node:React.ReactNode){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(node));}
afterEach(async()=>{await act(async()=>root?.unmount());container?.remove();vi.unstubAllGlobals();});
const button=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
const panel=(w:FormalWorld)=><CombatPanel world={w} city={w.cities[0]} issue={vi.fn()} busy={false}/>;
for(const width of [390,1440])it(`${width}px DOM: engaged army stays visible, details update from persisted rounds and mask enemy/HP/durability`,async()=>{
 vi.stubGlobal('innerWidth',width);let w=battlefield();w.cities[0].military!.units={militia:1,ram:1};w.cities[1].wallLevel=15;w=arrive(dispatch(w,'conquest',{militia:1,ram:1}).world).world;
 await mount(panel(w));expect(container.textContent).toContain('攻城中');await act(async()=>button('部隊資訊／即時戰況').click());expect(container.querySelector('dialog')).not.toBeNull();expect(container.textContent).toContain('攻城第 1／12 回合');expect(container.textContent).toContain('剩餘 11 回合');expect(container.querySelectorAll('.live-battle-details tbody tr')).toHaveLength(2);
 w=advanceFormal(w,w.combat!.battles[0].nextRoundAt).world;await act(async()=>root.render(panel(w)));expect(container.textContent).toContain('攻城第 2／12 回合');for(const hidden of ['wallDamage','hpPerUnit','60.21','210','係數','resolution:'])expect(container.textContent).not.toContain(hidden);
 const reports:FormalReport[]=[];while(w.combat!.battles.length){const t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);w=t.world;reports.push(...t.reports);}await act(async()=>root.render(<BattleReportBody battle={reports[0].battle!} world={w}/>));expect(container.textContent).toContain('征服未成｜攻城期限已到（城牆未破）');expect(container.textContent).toContain('攻城 12／12 回合');expect(container.textContent).not.toContain('守方勝利');
});
for(const width of [390,1440])it(`${width}px DOM: sole garrison defender has 本城防守中 entry without own ArmyId`,async()=>{
 vi.stubGlobal('innerWidth',width);let w=battlefield();w.cities[0].military!.units={militia:777};w.cities[1].military!.units={militia:1000};w=arrive(dispatch(w,'conquest',{militia:1000},1,0).world).world;
 expect(w.armies.every(a=>a.ownerFactionId!==w.playerFactionId)).toBe(true);await mount(panel(w));expect(container.textContent).toContain('本城防守中');await act(async()=>button('查看戰況').click());expect(container.textContent).toContain('我方兵力');expect(container.textContent).not.toContain('1,000');expect(container.querySelector('.live-battle-details table')!.textContent).toContain('777');expect(container.textContent).toContain('歷史快照');
});
it('no-wall-change siege timeout remains fully reported; legacy report lacks fabricated rounds/history; unauthorized live BattleId has no details',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:1};w.cities[1].wallLevel=15;w=arrive(dispatch(w,'conquest',{militia:1}).world).world;const id=w.combat!.battles[0].id,reports=[];while(w.combat!.battles.length){const t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);w=t.world;reports.push(...t.reports);}
 const p=reports[0].battle!;expect(p.siege).toHaveLength(0);await mount(<BattleReportBody battle={p} world={w}/>);expect(container.textContent).toContain('城牆 Lv15 → Lv15');expect(container.textContent).toContain('守軍已清零／城牆未突破');
 const old={...p};delete old.conquestReason;delete old.siegeRounds;delete old.siegeHistory;delete old.history;delete old.historyOmitted;await act(async()=>root.render(<BattleReportBody battle={old} world={w}/>));expect(container.textContent).not.toContain('攻城 12');expect(container.textContent).not.toContain('攻城期限已到');
 await act(async()=>root.render(<LiveBattleDetails world={w} battleId={id} onClose={()=>{}}/>));expect(container.querySelector('.live-battle-details')).toBeNull();
});
for(const width of [390,1440])it(`${width}px final report shows compact final building/wall damage directly after troop losses, without round logs`,async()=>{
 vi.stubGlobal('innerWidth',width);let w=battlefield();w.cities[0].military!.units={militia:1,ram:20};w.cities[1].wallLevel=15;w=arrive(dispatch(w,'conquest',{militia:1,ram:20}).world).world;
 const end=advanceFormal(w,w.combat!.battles[0].nextRoundAt),p=end.reports[0].battle!;
 // Persisted legacy/multi-entry damage is reduced to each target's final level, not current city state.
 p.siege.push({target:{kind:'building',key:'warehouse.1'},before:5,after:4},{target:{kind:'building',key:'warehouse.1'},before:4,after:2},{target:{kind:'field',slot:0},before:3,after:1},{target:{kind:'building',key:'barracks'},before:5,after:5});
 end.world.cities[1].wallLevel=7;
 await mount(<BattleReportBody battle={p} world={end.world}/>);
 const table=container.querySelector('.report-armies')!,damage=container.querySelector('.report-damage')!;
 expect(table.nextElementSibling).toBe(damage);expect(damage.textContent).toContain('城牆 Lv15 → Lv0');expect(damage.textContent).toContain('倉庫 Lv5 → Lv2');expect(damage.textContent).toContain('資源田 1 Lv3 → Lv1');expect(damage.textContent).not.toContain('兵營');
 expect(damage.textContent!.match(/倉庫/g)).toHaveLength(1);expect(container.textContent).not.toContain('攻城第');expect(container.textContent).not.toContain('戰役歷程');expect(container.textContent).not.toContain('階段摘要');expect(container.textContent).toContain('攻城 2／12 回合');
 const undamaged={...p,wallBefore:7,wallAfter:7,siege:[]};await act(async()=>root.render(<BattleReportBody battle={undamaged} world={end.world}/>));expect(container.querySelector('.report-damage')).toBeNull();
});
