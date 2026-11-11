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
function Panel({world,field,cityIndex}:{world:FormalWorld;field:number;cityIndex:number}){const preview=useConstructionPreviews(world,world.cities[cityIndex].id,[{field}]);return <><PreviewStatus preview={preview}/><span data-status={preview.status} data-display={preview.displayResults[0]?.status} data-result>{preview.results[0]?.status==='ready'?JSON.stringify(preview.results[0].quote.target):''}</span></>;}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',Port);Port.ports=[];el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());constructionPreviews.dispose();el.remove();vi.useRealTimers();vi.unstubAllGlobals();});
const advance=async(ms=80)=>act(async()=>vi.advanceTimersByTime(ms));
it('initial render stays interactive; target and branch reject old quotes while unrelated revisions retain a checked result',async()=>{
 await act(async()=>root.render(<View/>));expect(el.textContent).toContain('正在取得施工時間');expect(Port.ports).toHaveLength(0);await advance();const port=Port.ports[0],first=port.messages[0];
 await act(async()=>root.render(<View field={1}/>));await advance();await act(async()=>port.reply(first));expect(el.querySelector('[data-result]')!.textContent).toBe('');await act(async()=>port.reply());expect(el.querySelector('[data-result]')!.textContent).not.toBe('');expect(el.querySelector('.construction-preview-status')).toBeNull();expect(el.textContent).toContain('"slot":1');
 const next={...w,revision:w.revision+1};await act(async()=>root.render(<View world={next} field={1}/>));expect(el.querySelector('[data-result]')!.textContent).toContain('"slot":1');expect(el.querySelector('.construction-preview-status')).toBeNull();expect(port.messages).toHaveLength(2);
 await act(async()=>root.render(<View world={next} field={1} branch="2"/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');
});
it('worker interruption/timeout shows recovery and retry succeeds; close discards old reply',async()=>{
 await act(async()=>root.render(<View/>));await advance();await advance(5000);expect(el.textContent).toContain('暫時無法預估');
 await act(async()=>el.querySelector('button')!.click());await advance();const port=Port.ports.at(-1)!;await act(async()=>port.reply());expect(el.querySelector('[data-result]')!.textContent).not.toBe('');expect(el.querySelector('.construction-preview-status')).toBeNull();
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
 await act(async()=>port.reply());expect(el.querySelector('[data-result]')!.textContent).not.toBe('');expect(el.querySelector('.construction-preview-status')).toBeNull();
 const restored={...other,campaignId:'campaign:recovered-preview' as FormalWorld['campaignId']};await act(async()=>root.render(<View world={restored} cityIndex={1}/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');await advance();await act(async()=>port.reply());expect(el.querySelector('[data-result]')!.textContent).not.toBe('');expect(el.querySelector('.construction-preview-status')).toBeNull();expect(port.messages.at(-1)!.campaignId).toBe(restored.campaignId);
});

it('worker failure stays actionable across world ticks and never creates an automatic retry storm',async()=>{
 await act(async()=>root.render(<View/>));await advance();await act(async()=>Port.ports[0].onerror?.());expect(el.textContent).toContain('暫時無法預估');
 for(let i=1;i<=30;i++){await act(async()=>root.render(<View world={{...w,revision:w.revision+i}}/>));await advance(100);expect(el.textContent).toContain('重新查詢預覽');}
 expect(Port.ports).toHaveLength(1);await act(async()=>el.querySelector('button')!.click());await advance();expect(Port.ports).toHaveLength(2);await act(async()=>Port.ports[1].reply());expect(el.querySelector('[data-result]')!.textContent).not.toBe('');expect(el.querySelector('.construction-preview-status')).toBeNull();
});

it('insufficient resources stay an invalid result without duplicating the live Cost error',async()=>{
 const poor={...w,cities:w.cities.map((c,i)=>i===0?{...c,stock:{food:0,wood:0,stone:0,gold:0}}:c)};
 await act(async()=>root.render(<View world={poor}/>));await advance();await act(async()=>Port.ports[0].reply());expect(el.querySelector('[data-result]')!.textContent).toBe('');expect(el.querySelector('[data-result]')!.getAttribute('data-display')).toBe('invalid');expect(el.querySelector('.construction-preview-status')).toBeNull();
 await act(async()=>root.render(<BuildingDetail world={poor} city={poor.cities[0]} buildingKey="wall" issue={vi.fn()} busy={false}/>));await advance();await act(async()=>Port.ports[0].reply());expect(el.querySelector('.cost')!.textContent).toContain('石 160缺 160');expect(el.querySelector('.cost')).not.toBeNull();expect(el.textContent).not.toContain('預覽已更新');expect(el.textContent).not.toContain('城市實際庫存不足');
});
it.each([1,10,25])('production at %sX refreshes live affordability without visible status churn or repeated Worker calculations',async speed=>{
 const base=structuredClone(w);base.speed=speed;base.cities[0].stock={food:0,wood:0,stone:0,gold:0};
 await act(async()=>root.render(<View world={base}/>));await advance();const port=Port.ports[0];await act(async()=>port.reply());
 for(let i=1;i<=30;i++){const next=structuredClone(base);next.revision+=i;next.time+=i*speed*1000;await act(async()=>root.render(<View world={next}/>));expect(el.querySelector('.construction-preview-status')).toBeNull();await advance();expect(el.querySelector('.construction-preview-status')).toBeNull();expect(el.querySelector('[data-result]')!.getAttribute('data-display')).toBe('invalid');}
 expect(port.messages).toHaveLength(1);
 const funded=structuredClone(base);funded.revision+=31;funded.cities[0].stock={food:600,wood:600,stone:600,gold:600};await act(async()=>root.render(<View world={funded}/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');expect(el.querySelector('[data-result]')!.getAttribute('data-display')).toBe('invalid');await advance();expect(port.messages).toHaveLength(2);await act(async()=>port.reply());expect(el.querySelector('[data-result]')!.textContent).toContain('"slot":0');expect(el.querySelector('.construction-preview-status')).toBeNull();
});
it('changed qualification invalidates Ready immediately, retains display only, and a late reply cannot replace the latest target',async()=>{
 await act(async()=>root.render(<View/>));await advance();const port=Port.ports[0];await act(async()=>port.reply());
 const changed=structuredClone(w);changed.cities[0].fields![0].level=10;changed.revision++;
 await act(async()=>root.render(<View world={changed}/>));expect(el.querySelector('[data-result]')!.textContent).toBe('');expect(el.querySelector('[data-result]')!.getAttribute('data-display')).toBe('ready');expect(el.querySelector('.construction-preview-status')).toBeNull();await advance();const obsolete=port.messages.at(-1)!;
 await act(async()=>root.render(<View world={changed} field={1}/>));await advance();await act(async()=>port.reply(obsolete));expect(el.querySelector('[data-result]')!.textContent).toBe('');await act(async()=>port.reply());expect(el.querySelector('[data-result]')!.textContent).toContain('"slot":1');
});
