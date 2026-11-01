// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useConstructionPreviews,PreviewStatus,PreviewBranchContext} from './useConstructionPreviews';
import {constructionPreviews} from '../constructionPreviewController';
import {calculatePreviewRequest} from '../constructionPreviewCompute';
import type {PreviewRequest} from '../constructionPreviewProtocol';
import {createFormalWorld} from '../formal/generator';
import type {FormalWorld} from '../formal/model';
import {BuildingDetail} from './BuildingDetail';
let root:ReturnType<typeof createRoot>,el:HTMLDivElement;
class Port{
 static ports:Port[]=[];onmessage:((e:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror=null;messages:PreviewRequest[]=[];
 constructor(){Port.ports.push(this);}postMessage(r:PreviewRequest){this.messages.push(r);}terminate(){}reply(r=this.messages.at(-1)!){this.onmessage?.({data:calculatePreviewRequest(r)} as MessageEvent);}
}
const w=createFormalWorld({campaign:'preview-ui',seed:90217});
function View({world=w,field=0,branch='1',cityIndex=0}:{world?:FormalWorld;field?:number;branch?:string;cityIndex?:number}){return <PreviewBranchContext.Provider value={branch}><Panel world={world} field={field} cityIndex={cityIndex}/></PreviewBranchContext.Provider>;}
function Panel({world,field,cityIndex}:{world:FormalWorld;field:number;cityIndex:number}){const preview=useConstructionPreviews(world,world.cities[cityIndex].id,[{field}]);return <><PreviewStatus preview={preview}/><span data-result>{preview.results[0]?.status==='ready'?JSON.stringify(preview.results[0].quote.target):''}</span></>;}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',Port);Port.ports=[];el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());constructionPreviews.dispose();el.remove();vi.useRealTimers();vi.unstubAllGlobals();});
const advance=async(ms=80)=>act(async()=>vi.advanceTimersByTime(ms));
it('initial render is interactive and full Reducer is never a render dependency; target/revision/branch stale result disappears immediately',async()=>{
 await act(async()=>root.render(<View/>));expect(el.textContent).toContain('預覽計算中');expect(Port.ports).toHaveLength(0);await advance();const port=Port.ports[0],first=port.messages[0];
 await act(async()=>root.render(<View field={1}/>));await advance();await act(async()=>port.reply(first));expect(el.querySelector('[data-result]')!.textContent).toBe('');await act(async()=>port.reply());expect(el.textContent).toContain('預覽已更新');expect(el.textContent).toContain('"slot":1');
 const next={...w,revision:w.revision+1};await act(async()=>root.render(<View world={next} field={1}/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');expect(el.textContent).toContain('過期');
 await act(async()=>root.render(<View world={next} field={1} branch="2"/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');
});
it('worker interruption/timeout shows recovery and retry succeeds; close discards old reply',async()=>{
 await act(async()=>root.render(<View/>));await advance();await advance(5000);expect(el.textContent).toContain('暫時無法預估');
 await act(async()=>el.querySelector('button')!.click());await advance();const port=Port.ports.at(-1)!;await act(async()=>port.reply());expect(el.textContent).toContain('預覽已更新');
 await act(async()=>root.render(<View branch="other"/>));await advance();await act(async()=>root.render(<div>closed</div>));await act(async()=>port.reply());expect(el.textContent).toBe('closed');
});
it('high-frequency revisions coalesce with a bounded delay rather than resetting forever',async()=>{
 for(let i=0;i<30;i++){await act(async()=>root.render(<View world={{...w,revision:i}}/>));await advance(10);}
 expect(Port.ports).toHaveLength(1);expect(Port.ports[0].messages).toHaveLength(1);await advance(250);await act(async()=>Port.ports[0].reply());expect(Port.ports[0].messages.length).toBeLessThanOrEqual(2);
});
it('formal submit remains available during pending preview and after preview worker failure',async()=>{
 const issue=vi.fn();await act(async()=>root.render(<BuildingDetail world={w} city={w.cities[0]} buildingKey="wall" issue={issue} busy={false}/>));
 const button=[...el.querySelectorAll('button')].find(b=>b.textContent?.includes('升級至'))!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'building.upgrade',cityId:w.cities[0].id,key:'wall'});
 await advance();await act(async()=>Port.ports[0].onerror?.());expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledTimes(2);
});

it('unsupported context gives an explicit unavailable state and query entry, never a fabricated quote',async()=>{
 const legacy={...w,economyVersion:undefined};await act(async()=>root.render(<View world={legacy}/>));await advance();expect(el.textContent).toContain('暫時無法預估');expect(el.textContent).toContain('重新查詢預覽');expect(Port.ports).toHaveLength(0);
});

it('city and campaign changes at the same revision reject late results from the previous screen',async()=>{
 const other={...w,cities:w.cities.map((c,i)=>i===1?{...c,ownerFactionId:w.playerFactionId}:c)};
 await act(async()=>root.render(<View/>));await advance();const port=Port.ports[0],old=port.messages[0];
 await act(async()=>root.render(<View world={other} cityIndex={1}/>));await advance();await act(async()=>port.reply(old));expect(el.querySelector('[data-result]')!.textContent).toBe('');expect(port.messages.at(-1)!.cityId).toBe(w.cities[1].id);
 await act(async()=>port.reply());expect(el.textContent).toContain('預覽已更新');
 const restored={...other,campaignId:'campaign:recovered-preview' as FormalWorld['campaignId']};await act(async()=>root.render(<View world={restored} cityIndex={1}/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');await advance();await act(async()=>port.reply());expect(el.textContent).toContain('預覽已更新');expect(port.messages.at(-1)!.campaignId).toBe(restored.campaignId);
});

it('worker failure stays actionable across world ticks and never creates an automatic retry storm',async()=>{
 await act(async()=>root.render(<View/>));await advance();await act(async()=>Port.ports[0].onerror?.());expect(el.textContent).toContain('暫時無法預估');
 for(let i=1;i<=30;i++){await act(async()=>root.render(<View world={{...w,revision:w.revision+i}}/>));await advance(100);expect(el.textContent).toContain('重新查詢預覽');}
 expect(Port.ports).toHaveLength(1);await act(async()=>el.querySelector('button')!.click());await advance();expect(Port.ports).toHaveLength(2);await act(async()=>Port.ports[1].reply());expect(el.textContent).toContain('預覽已更新');
});
