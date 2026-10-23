// @vitest-environment happy-dom
import {afterEach,expect,it} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {VictoryPanel} from './VictoryPanel';
import {createFormalFixture} from '../formal/fixture';
import {reconcileVictory} from '../formal/victory';
import {EventScheduler} from '../formal/scheduler';
import {advanceFormal} from '../formal/reducer';
import {HOUR} from '../formal/time';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined;afterEach(async()=>{await act(async()=>root?.unmount());document.body.innerHTML='';});
it('B9-5 formal victory UI follows real qualification, interrupted timing and one final result',async()=>{
 let w=createFormalFixture();const div=document.createElement('div');document.body.append(div);root=createRoot(div);const render=async()=>{await act(async()=>root!.render(<VictoryPanel world={w}/>));};await render();expect(div.textContent).toContain('條件尚未同時達標');
 w.cities[2].ownerFactionId=w.playerFactionId;let s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();await render();expect(div.textContent).toContain('全部條件持續達標');expect(div.textContent).toContain('剩餘');
 w=advanceFormal(w,6*HOUR).world;w.cities[2].ownerFactionId=w.factions[1].id;s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();await render();expect(div.textContent).toContain('條件尚未同時達標');
 w.cities[2].ownerFactionId=w.playerFactionId;s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();w=advanceFormal(w,18*HOUR).world;await render();expect(div.textContent).toContain('正式征服勝利');expect(div.textContent).not.toContain('剩餘');
});
