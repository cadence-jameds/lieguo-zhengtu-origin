// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import DeveloperMode from './DeveloperMode';
import {developerWorld} from './scenarios';
import {displayClock} from '../presentation/liveClock';
let root:Root,container:HTMLDivElement;
afterEach(async()=>{await act(async()=>root.unmount());container.remove();displayClock.stop();vi.unstubAllGlobals();});
it('developer controls use their own worker, block concurrent requests and close only after test-store cleanup',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const requests:unknown[]=[];let instance:WorkerMock;
 class WorkerMock{onmessage=(_e:unknown)=>{};onerror=()=>{};constructor(){instance=this;}postMessage(m:unknown){requests.push(m);}terminate(){}}
 vi.stubGlobal('Worker',WorkerMock);container=document.createElement('div');document.body.append(container);root=createRoot(container);const close=vi.fn();
 await act(async()=>root.render(<DeveloperMode mobile onClose={close}/>));expect(requests[0]).toMatchObject({type:'start',config:{scenario:'new',speed:25}});
 const find=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
 expect(find('返回原戰役').disabled).toBe(true);await act(async()=>find('驗證清單').click());expect(container.textContent).toContain('尚未執行，不預先顯示通過');
 const config={scenario:'new' as const,seed:90217,speed:25,civilizationId:'civ_zhongguo'},world=developerWorld(config);
 await act(async()=>{instance!.onmessage({data:{type:'state',config,world,logs:[],results:[]}});instance!.onmessage({data:{type:'done'}});});
 expect(displayClock.time(world.campaignId,-1)).toBe(world.time);
 expect(container.querySelector<HTMLSelectElement>('select[aria-label="v85 城堡生產、400 移民、實體待命隊、取消結果"]')?.disabled).toBe(true);
 await act(async()=>find('執行全部自動檢查').click());expect(requests.at(-1)).toEqual({type:'checks'});expect(find('存檔重讀').disabled).toBe(true);
 await act(async()=>{instance!.onmessage({data:{type:'checksStarted'}});instance!.onmessage({data:{type:'check',result:{id:'probe',stage:'B4',title:'刻意失敗',spec:'v85',status:'fail',evidence:'wrong result',elapsedMs:1}}});instance!.onmessage({data:{type:'done'}});});
 expect(container.textContent).toContain('0 通過／1 失敗');expect(container.textContent).toContain('wrong result');
 const result={id:'probe',stage:'B4',title:'刻意失敗',spec:'v85',status:'fail',evidence:'wrong result',elapsedMs:1};
 await act(async()=>{instance!.onmessage({data:{type:'state',config:{...config,scenario:'colony'},checksConfig:config,world,logs:[],results:[result]}});});
 expect(container.textContent).toContain('0 通過／1 失敗');
 expect(container.querySelector<HTMLSelectElement>('select[aria-label="v85 城堡生產、400 移民、實體待命隊、取消結果"]')?.disabled).toBe(false);
 await act(async()=>find('返回原戰役').click());expect(requests.at(-1)).toEqual({type:'close'});expect(close).not.toHaveBeenCalled();await act(async()=>instance!.onmessage({data:{type:'closed'}}));expect(close).toHaveBeenCalledOnce();
});
