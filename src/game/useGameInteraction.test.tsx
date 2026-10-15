// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {useGame} from './useGame';
import {createFormalFixture,fixtureIds} from './formal/fixture';
import {worldPatch} from './worldStream';
import type {FormalWorld} from './formal/model';
import {governanceBase} from './governanceAdmission';
import {playerOrderBase} from './orderAdmission';
vi.mock('./saveLock',()=>({withSaveLock:async(_locks:unknown,_signal:unknown,run:()=>Promise<void>)=>run()}));
let root:Root,container:HTMLDivElement,engine:ReturnType<typeof useGame>,port:FakeWorker,w:FormalWorld;
class FakeWorker {
 onmessage:((event:{data:unknown})=>void)|null=null;onerror:((event:{message:string})=>void)|null=null;sent:any[]=[];
 terminated=false;
 constructor(){port=this;}
 postMessage(data:unknown){this.sent.push(structuredClone(data));}
 terminate(){this.terminated=true;}
 emit(data:unknown){this.onmessage?.({data});}
}
const state=(world:FormalWorld,base=0)=>({type:'state',world,passiveRevisionBase:base,clock:{campaignId:world.campaignId,time:world.time,speed:world.speed,running:true}});
function Surface(){engine=useGame();return <button disabled={engine.busy} onClick={()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'改名'})}>確認</button>;}
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',FakeWorker);Object.defineProperty(navigator,'locks',{configurable:true,value:{}});w=createFormalFixture();container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Surface/>));await act(async()=>port.emit(state(w)));port.sent=[];
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();delete (navigator as any).locks;vi.unstubAllGlobals();});
it('background state, phase and unrelated request completions never enable a pending command button',async()=>{
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'甲'}));const request=port.sent[0];expect(engine.busy).toBe(true);expect(container.querySelector('button')!.disabled).toBe(true);
 await act(async()=>{port.emit({type:'phase',text:'背景'});port.emit(state({...w,time:1000,revision:1}));port.emit({type:'requestDone',requestId:'unrelated'});});expect(engine.busy).toBe(true);
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'乙'}));expect(port.sent).toHaveLength(1);
 await act(async()=>port.emit({type:'commandAck',ack:{commandId:request.order.commandId,status:'committed',revision:2}}));expect(engine.busy).toBe(true);
 await act(async()=>port.emit({type:'requestDone',requestId:request.requestId}));expect(engine.busy).toBe(false);
});
it('revision rejection is terminal and later snapshots never resubmit the failed intention',async()=>{
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'甲'}));const first=port.sent[0],next={...w,time:10000,revision:1};
 await act(async()=>{port.emit(state(next));port.emit({type:'commandAck',ack:{commandId:first.order.commandId,status:'rejected',revision:1,reason:'世界版本已更新，請重新確認狀態。'}});port.emit(state(next));port.emit({type:'requestDone',requestId:first.requestId});});
 expect(port.sent).toHaveLength(1);expect(engine.busy).toBe(false);expect(engine.notice).toContain('重新確認');
 await act(async()=>port.emit(state({...next,time:20000,revision:2})));expect(port.sent).toHaveLength(1);expect(engine.notice).toContain('重新確認');
});
it('a click immediately shows accepting, never labels receipt as durable success, and rapid double clicks dispatch once',async()=>{
 await act(async()=>{engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'甲'});engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'乙'});});
 expect(port.sent).toHaveLength(1);expect(engine.notice).toContain('受理中');expect(engine.busy).toBe(true);
 const request=port.sent[0];await act(async()=>port.emit({type:'commandReceived',commandId:request.order.commandId,requestId:request.requestId}));
 expect(engine.notice).toContain('已受理');expect(engine.notice).not.toContain('已提交');expect(engine.busy).toBe(true);
 await act(async()=>{port.emit({type:'commandAck',ack:{commandId:request.order.commandId,status:'rejected',revision:0,reason:'城市實際庫存不足。'}});port.emit(state(w));port.emit({type:'requestDone',requestId:request.requestId});});
 expect(engine.notice).toBe('城市實際庫存不足。');expect(engine.busy).toBe(false);expect(port.sent).toHaveLength(1);
});
it('old receipts, terminal acknowledgements and background notices cannot overwrite the current click',async()=>{
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'甲'}));const first=port.sent[0];
 await act(async()=>{port.emit({type:'commandAck',ack:{commandId:first.order.commandId,status:'rejected',revision:0,reason:'第一次失敗'}});port.emit({type:'requestDone',requestId:first.requestId});});
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'乙'}));const second=port.sent[1];
 await act(async()=>{port.emit({type:'commandReceived',commandId:first.order.commandId});port.emit({type:'commandAck',ack:{commandId:first.order.commandId,status:'committed',revision:1}});port.emit({type:'notice',text:'背景訊息'});port.emit({type:'requestDone',requestId:first.requestId});});
 expect(engine.notice).toContain('受理中');expect(engine.busy).toBe(true);
 await act(async()=>{port.emit({type:'commandAck',ack:{commandId:second.order.commandId,status:'committed',revision:1}});port.emit({type:'requestDone',requestId:second.requestId});});expect(engine.notice).toBe('命令已提交。');expect(engine.busy).toBe(false);
});
it('construction stamps the rendered target even if a Worker snapshot changes the ref before React commits',async()=>{
 const payload={type:'building.upgrade' as const,cityId:fixtureIds.home,key:'center'},renderedIssue=engine.issue;
 const next=structuredClone(w);next.revision=1;next.cities[0].buildings.center=2;
 await act(async()=>{port.emit(state(next,1));renderedIssue(payload);});
 const request=port.sent[0];expect(engine.world!.cities[0].buildings.center).toBe(2);expect(request.order.expectedRevision).toBe(w.revision);expect(request.playerBase).toEqual(playerOrderBase(w,payload));
});
it('actual event/command revision changes reject the pending intention without automatic resubmission',async()=>{
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'甲'}));const first=port.sent[0];
 await act(async()=>{port.emit({type:'commandAck',ack:{commandId:first.order.commandId,status:'rejected',revision:1,reason:'世界版本已更新，請重新確認狀態。'}});port.emit(state({...w,time:10000,revision:1},1));port.emit({type:'requestDone',requestId:first.requestId});});expect(port.sent).toHaveLength(1);expect(engine.busy).toBe(false);expect(engine.notice).toContain('重新確認');
});
it('governance uses the rendered configuration precondition even when a newer snapshot arrives before submission',async()=>{
 const base=governanceBase(w,fixtureIds.home);await act(async()=>port.emit(state({...w,revision:1,time:1000},1)));
 await act(async()=>engine.issue({type:'governance.set',cityId:fixtureIds.home,enabled:true,policy:'reserve',budget:2400,reserve:180},base));const r=port.sent[0];expect(r.order.expectedRevision).toBe(w.revision);expect(r.governanceBase).toEqual(base);
 await act(async()=>{port.emit({type:'commandAck',ack:{commandId:r.order.commandId,status:'rejected',revision:1,reason:'治理狀態已更新，已刷新城市資料；請確認方針、預算及保留量後再次套用。'}});port.emit(state({...w,revision:1,time:1000},1));port.emit({type:'requestDone',requestId:r.requestId});});expect(port.sent).toHaveLength(1);expect(engine.busy).toBe(false);expect(engine.notice).toContain('再次套用');
});

it('committed patches keep static world identity and a mismatched stream requests a full snapshot',async()=>{
 const prior=engine.world!,next={...w,time:10000,revision:1};await act(async()=>port.emit({type:'state',patch:worldPatch(w,next),passiveRevisionBase:0,clock:{campaignId:w.campaignId,time:10000,speed:1,running:true}}));expect(engine.world).toEqual(next);expect(engine.world!.cities).toBe(prior.cities);expect(port.sent).toHaveLength(0);
 await act(async()=>port.emit({type:'state',patch:worldPatch(w,{...w,time:20000,revision:2})}));expect(engine.world).toEqual(next);expect(port.sent).toEqual([{type:'snapshot'}]);expect(engine.busy).toBe(false);
});
it('historical intel query correlates Worker responses without holding the command button; lookup failure leaves the world ready',async()=>{
 const promise=engine.readCityIntel(w,fixtureIds.home),query=port.sent[0];expect(query.type).toBe('cityIntel');expect(query.reportCursor).toBe(w.sequences.report);expect(engine.busy).toBe(false);
 await act(async()=>port.emit({type:'cityIntel',queryId:query.queryId,data:{}}));await expect(promise).resolves.toEqual({});
 const failed=engine.readCityIntel(w,'wild:test',4);expect(port.sent[1].generation).toBe(4);const observed=failed.catch(e=>e.message);
 await act(async()=>port.emit({type:'cityIntel',queryId:port.sent[1].queryId,error:'查詢失敗'}));expect(await observed).toBe('查詢失敗');expect(engine.status).toBe('ready');expect(engine.world).toEqual(w);expect(engine.error).toBe('');
});
it('update save waits for its own durable acknowledgement, not an unrelated sync or request completion',async()=>{
 let saved=false,promise!:Promise<void>;await act(async()=>{promise=engine.sync().then(()=>{saved=true;});});const request=port.sent[0];expect(request.type).toBe('sync');expect(engine.busy).toBe(true);
 await act(async()=>{port.emit({type:'synced',requestId:'other'});port.emit({type:'requestDone',requestId:'other'});});expect(saved).toBe(false);
 await act(async()=>{port.emit({type:'synced',requestId:request.requestId});port.emit({type:'requestDone',requestId:request.requestId});await promise;});expect(saved).toBe(true);expect(engine.busy).toBe(false);
});
it('update save rejects storage failure and rejects a completed request that never acknowledged saving',async()=>{
 let observed!:Promise<string|void>;await act(async()=>{observed=engine.sync().catch(e=>e.message);});const first=port.sent[0];await act(async()=>{port.emit({type:'error',requestId:first.requestId,text:'IDB failure'});port.emit({type:'requestDone',requestId:first.requestId});});expect(await observed).toBe('IDB failure');expect(engine.busy).toBe(false);
 await act(async()=>{observed=engine.sync().catch(e=>e.message);});await act(async()=>port.emit({type:'requestDone',requestId:port.sent[1].requestId}));expect(await observed).toContain('保存未完成');expect(engine.busy).toBe(false);
});
it('fresh lower progress after a completed replay keeps a responsive resume alive for more than thirty seconds',async()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
 try{
  await act(async()=>{port.emit({type:'phase',text:'讀取與驗證本機存檔'});port.emit({type:'phase',text:'推進離線期間的世界'});port.emit({type:'progress',progress:1,events:19569});port.emit(state(w));});
  expect(engine.status).toBe('ready');expect(engine.loadEvents).toBe(19569);
  await act(async()=>port.emit({type:'phase',text:'讀取與驗證本機存檔'}));expect(engine.loadEvents).toBe(0);expect(engine.loadProgress).toBeNull();
  await act(async()=>port.emit({type:'phase',text:'推進離線期間的世界'}));
  for(const events of [1,16,32]){
   await act(async()=>{await vi.advanceTimersByTimeAsync(20000);port.emit({type:'progress',progress:events/64,events});});
   expect(port.terminated).toBe(false);expect(engine.status).toBe('loading');expect(engine.loadEvents).toBe(events);
  }
  await act(async()=>port.emit(state(w)));await act(async()=>vi.advanceTimersByTimeAsync(30000));
  expect(engine.status).toBe('ready');expect(port.terminated).toBe(false);expect(engine.error).toBe('');
 }finally{vi.clearAllTimers();vi.useRealTimers();}
});
it('repeated same-cycle event counts do not conceal a genuinely stalled replay from the watchdog',async()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
 try{
  await act(async()=>{port.emit({type:'phase',text:'讀取與驗證本機存檔'});port.emit({type:'phase',text:'推進離線期間的世界'});port.emit({type:'progress',progress:.1,events:16});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(20000);port.emit({type:'progress',progress:.5,events:16});});
  await act(async()=>vi.advanceTimersByTimeAsync(9999));expect(port.terminated).toBe(false);expect(engine.status).toBe('loading');
  await act(async()=>vi.advanceTimersByTimeAsync(1));expect(port.terminated).toBe(true);expect(engine.status).toBe('error');expect(engine.error).toContain('超過 30 秒沒有回應');expect(engine.world).toEqual(w);
 }finally{vi.clearAllTimers();vi.useRealTimers();}
});
