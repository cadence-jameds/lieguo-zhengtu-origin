import {afterEach,expect,it,vi} from 'vitest';
import {ConstructionPreviewController} from './constructionPreviewController';
import {calculatePreviewRequest} from './constructionPreviewCompute';
import type {PreviewRequest,PreviewResponse} from './constructionPreviewProtocol';
import {constructionPreviewContext} from './constructionPreviewContext';
import {createFormalWorld} from './formal/generator';
class Port{
 onmessage:((e:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null;
 messages:PreviewRequest[]=[];terminated=false;
 postMessage(r:PreviewRequest){this.messages.push(r);}
 terminate(){this.terminated=true;}
 reply(r=this.messages.at(-1)!){this.onmessage?.({data:calculatePreviewRequest(r)} as MessageEvent);}
}
const w=createFormalWorld({campaign:'preview-controller',seed:90217});
function request(id:number,extra:Partial<PreviewRequest>={}):PreviewRequest{return {protocolVersion:1,campaignId:w.campaignId,branch:'branch:1',revision:w.revision,cityId:w.cities[0].id,requestId:id,generation:id,context:constructionPreviewContext(w,w.cities[0].id),targets:[{field:0}],...extra};}
afterEach(()=>vi.useRealTimers());
it('bounded latest-per-channel queue discards late revision, target and branch replies',()=>{
 const port=new Port(),c=new ConstructionPreviewController(()=>port as unknown as Worker),a=vi.fn(),b=vi.fn(),d=vi.fn();
 c.request(1,request(1),a,vi.fn());c.request(1,request(2,{revision:2,targets:[{key:'wall'}]}),b,vi.fn());c.request(1,request(3,{branch:'branch:2'}),d,vi.fn());
 expect(port.messages).toHaveLength(1);port.reply(port.messages[0]);expect(a).not.toHaveBeenCalled();expect(b).not.toHaveBeenCalled();expect(port.messages).toHaveLength(2);
 port.reply(port.messages[0]);expect(d).not.toHaveBeenCalled();port.reply();expect(d).toHaveBeenCalledOnce();expect(c.metrics.discarded).toBe(2);c.dispose();
});
it('close discards results, semantic cache ignores irrelevant history/revision but respects city/queue/epoch',()=>{
 const port=new Port(),c=new ConstructionPreviewController(()=>port as unknown as Worker),done=vi.fn();c.request(1,request(1),done,vi.fn());c.cancel(1);port.reply();expect(done).not.toHaveBeenCalled();
 c.request(1,request(2,{revision:100}),done,vi.fn());expect(done).toHaveBeenCalledOnce();expect(c.metrics.cacheHits).toBe(1);
 c.request(1,request(3,{branch:'new'}),done,vi.fn());expect(port.messages).toHaveLength(2);port.reply();
 const changed=request(4,{branch:'new'});changed.context.city.stock.food=0;c.request(1,changed,done,vi.fn());expect(port.messages).toHaveLength(3);c.dispose();
});
it.each(['error','timeout','messageerror'] as const)('worker %s has finite wait and explicit re-query restarts worker',kind=>{
 vi.useFakeTimers();const ports:Port[]=[],c=new ConstructionPreviewController(()=>{const p=new Port();ports.push(p);return p as unknown as Worker;}),fail=vi.fn(),done=vi.fn();
 c.request(1,request(1),done,fail);if(kind==='error')ports[0].onerror?.();else if(kind==='messageerror')ports[0].onmessageerror?.();else vi.advanceTimersByTime(5000);
 expect(fail).toHaveBeenCalledOnce();expect(ports[0].terminated).toBe(true);expect(done).not.toHaveBeenCalled();
 c.request(1,request(2),done,fail);expect(ports).toHaveLength(2);ports[0].reply();expect(done).not.toHaveBeenCalled();ports[1].reply();expect(done).toHaveBeenCalledOnce();c.dispose();
});
it('all stamp fields and result count are checked; protocol rejects oversized/world-shaped contexts',()=>{
 const port=new Port(),c=new ConstructionPreviewController(()=>port as unknown as Worker),done=vi.fn(),fail=vi.fn(),r=request(1);c.request(1,r,done,fail);
 for(const delta of [{campaignId:'old'},{cityId:'old'},{protocolVersion:99},{generation:99}])port.onmessage?.({data:{...calculatePreviewRequest(r),...delta} as PreviewResponse} as MessageEvent);
 expect(done).not.toHaveBeenCalled();port.onmessage?.({data:{...calculatePreviewRequest(r),results:[]}} as MessageEvent);expect(fail).toHaveBeenCalledOnce();
 expect(()=>calculatePreviewRequest(request(2,{targets:Array.from({length:33},()=>({field:0}))}))).toThrow();c.dispose();
});

it('healthy time ticks reuse exact empty-queue rules; depletion and queue changes invalidate',()=>{
 const port=new Port(),c=new ConstructionPreviewController(()=>port as unknown as Worker),done=vi.fn();const a=request(1);c.request(1,a,done,vi.fn());port.reply();
 const b=request(2);b.context.time=1000;b.context.city.stock.food+=5;c.request(1,b,done,vi.fn());expect(c.metrics.calculations).toBe(1);expect(done.mock.calls.at(-1)![0].results[0].quote.startsAt).toBe(1000);expect(done.mock.calls.at(-1)![0].results[0].quote.createdAt).toBe(1000);
 const d=request(3);d.context.city.stock.food=0;c.request(1,d,done,vi.fn());expect(c.metrics.calculations).toBe(2);port.reply();expect(done.mock.calls.at(-1)![0].results[0].status).toBe('invalid');c.dispose();
});

it('unchanged insufficient stocks do not recompute on every tick, but new stocks revalidate',()=>{
 const port=new Port(),c=new ConstructionPreviewController(()=>port as unknown as Worker),done=vi.fn();const poor=request(1);poor.context.city.stock={food:0,wood:0,stone:0,gold:0};c.request(1,poor,done,vi.fn());port.reply();expect(done.mock.calls.at(-1)![0].results[0].status).toBe('invalid');
 for(let i=2;i<32;i++)c.request(1,{...poor,requestId:i,generation:i,revision:i,context:{...poor.context,time:i}},done,vi.fn());expect(c.metrics.calculations).toBe(1);expect(c.metrics.cacheHits).toBe(30);
 const funded=request(32);c.request(1,funded,done,vi.fn());expect(c.metrics.calculations).toBe(2);port.reply();expect(done.mock.calls.at(-1)![0].results[0].status).toBe('ready');c.dispose();
});
