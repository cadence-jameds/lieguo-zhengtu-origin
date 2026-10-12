// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import SpecAuditPanel,{specReport} from './SpecAuditPanel';
import {createTrialWorld} from './specTrials';
import {developerOrder} from './scenarios';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import type {DeveloperLog} from './session';
let root:Root,container:HTMLDivElement;
afterEach(async()=>{await act(async()=>root.unmount());container.remove();localStorage.clear();vi.unstubAllGlobals();});
it('player picks a v85 negative prerequisite case and can only record a positive result after a real command and completion',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const config={scenario:'new' as const,seed:90217,speed:50,civilizationId:'civ_zhongguo'};
 const {world,info}=createTrialWorld({kind:'building',target:'academy',variant:'ready',level:1,config}),onTrial=vi.fn();container=document.createElement('div');document.body.append(container);root=createRoot(container);
 const render=(w=world,logs:DeveloperLog[]=[])=>root.render(<SpecAuditPanel world={w} config={config} busy={false} trial={info} logs={logs} onTrial={onTrial}/>);
 await act(async()=>render());const find=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
 const result=()=>[...container.querySelectorAll('select')].find(s=>s.querySelector('option[value="pass"]'))!;
 expect(result().disabled).toBe(true);await act(async()=>find('建築前置').click());expect(container.textContent).toContain('鐵匠鋪 Lv3');
 const variant=[...container.querySelectorAll('select')].find(s=>s.querySelector('option[value="poor"]'))!;
 await act(async()=>{variant.value='building:blacksmith';variant.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>find('建立本項試玩情境').click());expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({target:'academy',variant:'building:blacksmith'}));
 const commit=submitFormalOrder(world,developerOrder(world,info.command!));expect(commit.ack?.status).toBe('committed');const done=advanceFormal(commit.world,commit.world.cities[0].economy!.construction[0].durationMs).world;
 const logs:DeveloperLog[]=[{sequence:1,action:'building.upgrade',at:0,revision:1,result:'committed',before:null,after:null,command:info.command!},{sequence:2,action:'下一完成事件',at:done.time,revision:done.revision,result:'已原子保存',before:null,after:null}];
 await act(async()=>render(done,logs));expect(result().disabled).toBe(false);
 await act(async()=>{result().value='pass';result().dispatchEvent(new Event('change',{bubbles:true}));});const saved=Object.values(specReport().manual);expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({status:'pass',revision:done.revision,evidence:{commands:expect.arrayContaining([expect.objectContaining({command:info.command})])}});
 await act(async()=>find('戰鬥公式（B5）').click());expect(container.textContent).toContain('Formal B5 純計算函式');expect(container.textContent).toContain('6.000000');
});
