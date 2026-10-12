// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {useGame} from './useGame';
import {createFormalFixture,fixtureIds} from './formal/fixture';
import {worldPatch} from './worldStream';
import type {FormalWorld} from './formal/model';
import {governanceBase} from './governanceAdmission';
vi.mock('./saveLock',()=>({withSaveLock:async(_locks:unknown,_signal:unknown,run:()=>Promise<void>)=>run()}));
let root:Root,container:HTMLDivElement,engine:ReturnType<typeof useGame>,port:FakeWorker,w:FormalWorld;
class FakeWorker {
 onmessage:((event:{data:unknown})=>void)|null=null;onerror:((event:{message:string})=>void)|null=null;sent:any[]=[];
 constructor(){port=this;}
 postMessage(data:unknown){this.sent.push(structuredClone(data));}
 terminate(){}
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
it('clock-only refresh retries the same intention once without a gap in busy tracking',async()=>{
 await act(async()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'甲'}));const first=port.sent[0],next={...w,time:10000,revision:1};
 await act(async()=>{port.emit(state(next));port.emit({type:'commandAck',ack:{commandId:first.order.commandId,status:'rejected',revision:1,reason:'世界版本已更新，請重新確認狀態。'}});port.emit(state(next));port.emit({type:'requestDone',requestId:first.requestId});});
 expect(port.sent).toHaveLength(2);const second=port.sent[1];expect(second.order.commandId).toBe(first.order.commandId);expect(second.order.payload).toEqual(first.order.payload);expect(second.order.expectedRevision).toBe(1);expect(second.requestId).not.toBe(first.requestId);expect(engine.busy).toBe(true);
 await act(async()=>{port.emit({type:'commandAck',ack:{commandId:second.order.commandId,status:'committed',revision:2}});port.emit(state({...next,revision:2},2));port.emit({type:'requestDone',requestId:second.requestId});});expect(engine.busy).toBe(false);expect(port.sent).toHaveLength(2);
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
