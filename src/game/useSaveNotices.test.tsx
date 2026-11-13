// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {useGame} from './useGame';
import {createFormalFixture,fixtureIds} from './formal/fixture';
import {fixtureStream} from './formal/projectionFixtureSupport';
import type {FormalWorld} from './formal/model';
vi.mock('./saveLock',()=>({withSaveLock:async(_locks:unknown,_signal:unknown,run:()=>Promise<void>)=>run()}));
let root:Root,container:HTMLDivElement,engine:ReturnType<typeof useGame>,port:FakeWorker,w:FormalWorld;
class FakeWorker {
 onmessage:((event:{data:unknown})=>void)|null=null;onerror:((event:{message:string})=>void)|null=null;sent:any[]=[];
 readonly stream=fixtureStream();terminated=false;
 constructor(){port=this;}
 postMessage(data:unknown){this.sent.push(structuredClone(data));}
 terminate(){this.terminated=true;}
 emit(data:unknown){this.onmessage?.({data});}
}
const state=(world:FormalWorld,base=0)=>({type:'state',commandEpoch:'1234567890abcdef1234567890abcdef.1.0',projection:port.stream.publish(world,{branch:0,writerEpoch:0},true),passiveRevisionBase:base,clock:{campaignId:world.campaignId,time:world.time,speed:world.speed,running:true}});
function Surface(){engine=useGame();return <button disabled={engine.inputBusy} onClick={()=>engine.issue({type:'city.rename',cityId:fixtureIds.home,name:'改名'})}>確認</button>;}
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',FakeWorker);Object.defineProperty(navigator,'locks',{configurable:true,value:{}});w=createFormalFixture();container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Surface/>));await act(async()=>port.emit(state(w)));port.sent=[];
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();delete (navigator as any).locks;vi.unstubAllGlobals();});

it('keeps save failure independent from ordinary projections and only accepts a committed recovery',async()=>{
 await act(async()=>port.emit({type:'saveStatus',status:{state:'blocked',failures:3,recovery:'save',code:'SAVE_BLOCKED'}}));await act(async()=>port.emit(state(w)));expect(engine.saveStatus.state).toBe('blocked');expect(engine.error).toBe('');
 await act(async()=>port.emit({type:'saveStatus',status:{state:'healthy',failures:0,recovery:'save',code:''}}));expect(engine.saveStatus.state).toBe('blocked');
 await act(async()=>port.emit({type:'saveStatus',committed:true,status:{state:'healthy',failures:0,recovery:'save',code:''}}));expect(engine.saveStatus.state).toBe('recovered');
});
it('failed manual save rejects its promise and cannot publish a saved message from an unrelated projection',async()=>{
 let result:Promise<void>;await act(async()=>{result=engine.sync();});const request=port.sent.at(-1);const failed=expect(result!).rejects.toThrow('保存尚未完成');
 await act(async()=>{port.emit({type:'saveStatus',status:{state:'blocked',failures:3,recovery:'save',code:'SAVE_BLOCKED'}});port.emit({type:'error',saveFailure:true,operation:'sync',requestId:request.requestId,text:'[{"code":"invalid_type","path":["savedAt"]}]'});port.emit({type:'requestDone',requestId:request.requestId});port.emit(state(w));});await failed;expect(engine.saveStatus.state).toBe('blocked');expect(engine.notice).not.toContain('已保存');expect(engine.world).not.toBeNull();expect(engine.error).toBe('');const prior=engine.noticeEvent;await act(async()=>port.emit({type:'notice',error:true,saveFailure:true,text:'raw technical diagnostic'}));expect(engine.noticeEvent).toBe(prior);expect(engine.notice).not.toContain('diagnostic');
});
it('sanitizes repeated raw Worker validation errors while preserving recovery status',async()=>{
 const text=JSON.stringify([{code:'invalid_type',expected:'integer',received:'float',path:['savedAt']}]);await act(async()=>port.emit({type:'notice',error:true,text}));expect(engine.feedback.text).not.toContain('invalid_type');expect(engine.notice).not.toContain('savedAt');expect(engine.feedback.text).toBeTruthy();
});

it('deduplicates identical diagnostics but preserves distinct failures that share safe copy',async()=>{
 const emit=async(text:string)=>act(async()=>port.emit({type:'notice',error:true,text}));const a='[{"code":"invalid_type","path":["savedAt"]}]',b='[{"code":"invalid_type","path":["recovery",1,"at"]}]';await emit(a);const first=engine.noticeEvent,safe=engine.notice;await emit(a);expect(engine.noticeEvent).toBe(first);await emit(b);expect(engine.notice).toBe(safe);expect(engine.noticeEvent).toBeGreaterThan(first);
});
