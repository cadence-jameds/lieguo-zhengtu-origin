// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useAppUpdate} from './useAppUpdate';
import {Home} from './FormalHome';
import {RELEASE} from './release';
const pwa=vi.hoisted(()=>({register:vi.fn()}));
vi.mock('virtual:pwa-register',()=>({registerSW:pwa.register}));
let root:Root,el:HTMLDivElement,updates:ReturnType<typeof useAppUpdate>,save:ReturnType<typeof vi.fn<()=>Promise<void>>>,fetcher:ReturnType<typeof vi.fn>,replace:ReturnType<typeof vi.spyOn>;
let registration:ServiceWorkerRegistration,container:ServiceWorkerContainer,worker:ServiceWorker;
let workerRelease:Record<string,unknown>;
const workerPost=()=>vi.fn((message:any,ports?:any)=>{if(message.type==='GET_APP_RELEASE')ports[0].reply(workerRelease);});
const activations=(w:ServiceWorker)=>vi.mocked(w.postMessage).mock.calls.filter(([message])=>message.type==='SKIP_WAITING');
const next=RELEASE.version.split('.').map(Number);next[2]++;const newVersion=next.join('.');
function Surface(){updates=useAppUpdate(save);return <Home theme="dark" onThemeChange={()=>{}} world={null} busy={false} loading={false} onNew={()=>{}} onStart={()=>{}} onRetry={()=>{}} onExport={()=>{}} onImport={()=>{}} onCheck={()=>void updates.check()} updateText={updates.text} updateAvailable={updates.available} updating={updates.updating} updateDisabled={updates.updating} onUpdate={()=>void updates.update()}/>;}
async function mount(){await act(async()=>root.render(<Surface/>));}
beforeEach(()=>{
 workerRelease={version:newVersion,contentSha:'e'.repeat(40)};
 vi.stubGlobal('MessageChannel',class {port1={onmessage:null as any,close:vi.fn()};port2={close:vi.fn(),reply:(data:unknown)=>queueMicrotask(()=>this.port1.onmessage?.({data}))};});
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);save=vi.fn().mockResolvedValue(undefined);fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version})});vi.stubGlobal('fetch',fetcher);
 container=Object.assign(new EventTarget(),{getRegistration:vi.fn(),register:vi.fn()}) as unknown as ServiceWorkerContainer;
 worker=Object.assign(new EventTarget(),{state:'installed',scriptURL:new URL('/sw.js',location.href).href,postMessage:workerPost()}) as unknown as ServiceWorker;
 registration=Object.assign(new EventTarget(),{scope:new URL('/',location.href).href,active:worker,waiting:null,installing:null,update:vi.fn().mockResolvedValue(undefined)}) as unknown as ServiceWorkerRegistration;
 (container as any).controller=worker;vi.mocked(container.getRegistration).mockResolvedValue(registration);vi.mocked(container.register).mockRejectedValue(new Error('registration unavailable'));
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:container});Object.defineProperty(document,'hidden',{configurable:true,value:false});
 pwa.register.mockImplementation(options=>{options.onRegisteredSW('/sw.js',registration);return vi.fn();});
 replace=vi.spyOn(window.location,'replace').mockImplementation(()=>{});el=document.createElement('div');document.body.append(el);root=createRoot(el);
});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();delete (navigator as any).serviceWorker;delete (document as any).hidden;delete window.__FORMAL_EMBEDDED_ASSETS;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();pwa.register.mockReset();});
it('automatically checks on entry, each minute, focus, foreground and online, then removes listeners',async()=>{
 await mount();expect(fetcher).toHaveBeenCalledTimes(1);const [url,options]=fetcher.mock.calls[0];expect(String(url)).toContain('version.json?_check=');expect(options.cache).toBe('no-store');
 await act(async()=>vi.advanceTimersByTimeAsync(60000));expect(fetcher).toHaveBeenCalledTimes(2);
 for(const [target,event] of [[window,'focus'],[document,'visibilitychange'],[window,'online']] as const){await act(async()=>target.dispatchEvent(new Event(event)));}expect(fetcher).toHaveBeenCalledTimes(5);
 await act(async()=>root.unmount());await act(async()=>{window.dispatchEvent(new Event('focus'));vi.advanceTimersByTime(60000);});expect(fetcher).toHaveBeenCalledTimes(5);
});
it('shows an actionable update without reloading or saving on discovery, even if a worker changes externally',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();expect(el.textContent).toContain('可用新版 v'+newVersion);expect([...el.querySelectorAll('button')].some(b=>b.textContent==='保存進度並載入新版')).toBe(true);
 pwa.register.mock.calls[0][0].onNeedReload();expect(replace).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
 fetcher.mockRejectedValue(new Error('offline'));await act(async()=>updates.check());expect(updates.available).toBe(true);expect(el.textContent).toContain(newVersion);
});
it('waits for a correlated durable save before activating the waiting worker, and control before reloading',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).waiting=worker;await mount();let saved!:()=>void;save.mockImplementation(()=>new Promise<void>(r=>saved=r));
 let completed!:Promise<void>;await act(async()=>{completed=updates.update();});expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();
 await act(async()=>saved());expect(worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(replace).not.toHaveBeenCalled();
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await completed;});expect(replace).toHaveBeenCalledOnce();expect(replace).toHaveBeenCalledWith(expect.stringContaining('_appUpdate='+newVersion));
});
it('waits for installation to complete before saving; duplicate clicks cannot submit twice',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).installing=worker;await mount();let completed!:Promise<void>;await act(async()=>{completed=updates.update();void updates.update();});expect(save).not.toHaveBeenCalled();
 await act(async()=>{(registration as any).waiting=worker;worker.dispatchEvent(new Event('statechange'));});expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(1);
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await completed;});expect(replace).toHaveBeenCalledOnce();
});
it('save failure never activates or reloads and allows retry',async()=>{
 (registration as any).waiting=worker;fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});save.mockRejectedValueOnce(new Error('IDB failed'));await mount();await act(async()=>updates.update());expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();expect(updates.text).toContain('未取得保存完成確認');expect(updates.text).not.toContain('IDB failed');expect(updates.updating).toBe(false);
});
it('download timeout never saves or reloads, while activation timeout keeps the page',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();let completed!:Promise<void>;await act(async()=>{completed=updates.update();});await act(async()=>{await vi.advanceTimersByTimeAsync(30000);await completed;});expect(updates.text).toContain('新版下載尚未完成');expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();
 (registration as any).waiting=worker;await act(async()=>{completed=updates.update();});await act(async()=>{await vi.advanceTimersByTimeAsync(15000);await completed;});expect(updates.text).toContain('啟用等待逾時');expect(replace).not.toHaveBeenCalled();
});
it('invalid and older versions do not offer an update; offline packages never register or fetch',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:'invalid'})});await mount();expect(updates.available).toBe(false);expect(updates.text).toContain('無法確認');
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:'0.1.0'})});await act(async()=>updates.check());expect(updates.available).toBe(false);
 await act(async()=>root.unmount());window.__FORMAL_EMBEDDED_ASSETS={};fetcher.mockClear();pwa.register.mockClear();root=createRoot(el);await mount();expect(fetcher).not.toHaveBeenCalled();expect(pwa.register).not.toHaveBeenCalled();expect(updates.text).toContain('離線試玩包');
});
it('browsers without a service worker still save before a cache-busted navigation',async()=>{
 delete (navigator as any).serviceWorker;fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();await act(async()=>updates.update());expect(save).toHaveBeenCalledOnce();expect(replace).toHaveBeenCalledOnce();
});
it('same numeric version with different playable content is actionable; identical content is not',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version,commitSha:'f'.repeat(40),contentSha:'e'.repeat(40)})});await mount();expect(updates.available).toBe(true);expect(updates.text).toContain('可用更新建置');
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version,commitSha:RELEASE.commitSha,contentSha:RELEASE.contentSha})});await act(async()=>updates.check());expect(updates.available).toBe(false);expect(updates.text).toContain('已確認為最新版本');
 pwa.register.mock.calls[0][0].onNeedRefresh();await act(async()=>Promise.resolve());expect(updates.available).toBe(false);
});
it('offline checks retain bundled release notes and never activate or reload',async()=>{fetcher.mockRejectedValue(new Error('offline'));await mount();expect(updates.available).toBe(false);expect(el.textContent).toContain('目前無法確認更新');expect(el.textContent).toContain('近期版本與過往紀錄');expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();});
it('a fully downloaded waiting worker remains usable when the metadata endpoint is offline',async()=>{fetcher.mockRejectedValue(new Error('offline'));await mount();(registration as any).waiting=worker;await act(async()=>{pwa.register.mock.calls[0][0].onNeedRefresh();});expect(updates.available).toBe(true);expect(updates.text).toContain('已下載完成');expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();});

it('docs-only deployment changes neither offer an update nor activate a waiting SW, including after going offline',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,commitSha:'d'.repeat(40)})});await mount();expect(updates.available).toBe(false);expect(updates.text).toContain('已確認為最新版本');
 (registration as any).waiting=worker;await act(async()=>pwa.register.mock.calls[0][0].onNeedRefresh());expect(updates.available).toBe(false);expect([...el.querySelectorAll('button')].some(b=>b.textContent==='保存進度並載入新版')).toBe(false);
 fetcher.mockRejectedValue(new Error('offline'));await act(async()=>updates.check());expect(updates.available).toBe(false);expect(save).not.toHaveBeenCalled();expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();
});
it('docs-only content verified before a worker finishes downloading stays suppressed offline',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,commitSha:'d'.repeat(40)})});await mount();fetcher.mockRejectedValue(new Error('offline'));(registration as any).waiting=worker;
 await act(async()=>pwa.register.mock.calls[0][0].onNeedRefresh());expect(updates.available).toBe(false);expect(save).not.toHaveBeenCalled();expect(activations(worker)).toHaveLength(0);
});
it('a genuine same-version content update remains usable offline and saves before SW activation',async()=>{
 workerRelease={version:RELEASE.version,contentSha:'e'.repeat(40)};
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,commitSha:'f'.repeat(40),contentSha:'e'.repeat(40)})});await mount();expect(updates.available).toBe(true);
 (registration as any).waiting=worker;fetcher.mockRejectedValue(new Error('offline'));await act(async()=>pwa.register.mock.calls[0][0].onNeedRefresh());expect(updates.available).toBe(true);
 let saved!:()=>void;save.mockImplementation(()=>new Promise<void>(r=>saved=r));let completed!:Promise<void>;await act(async()=>{completed=updates.update();});expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();
 await act(async()=>saved());expect(worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(replace).not.toHaveBeenCalled();await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await completed;});expect(save).toHaveBeenCalledOnce();expect(replace).toHaveBeenCalledOnce();
});
it('deployment SHA alone or malformed content identity never implies a same-version playable update',async()=>{
 for(const contentSha of [undefined,'invalid','f'.repeat(39)]){fetcher.mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version,commitSha:'f'.repeat(40),contentSha})});if(!fetcher.mock.calls.length)await mount();else await act(async()=>updates.check());expect(updates.available).toBe(false);}
});

it('a later real content update clears docs-only suppression, and matching content withdraws an earlier offer',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,commitSha:'d'.repeat(40)})});await mount();(registration as any).waiting=worker;expect(updates.available).toBe(false);
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,commitSha:'f'.repeat(40),contentSha:'e'.repeat(40)})});await act(async()=>updates.check());expect(updates.available).toBe(true);
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,commitSha:'d'.repeat(40)})});await act(async()=>updates.check());expect(updates.available).toBe(false);
 fetcher.mockRejectedValue(new Error('offline'));await act(async()=>updates.check());expect(updates.available).toBe(false);expect(activations(worker)).toHaveLength(0);
});
it('matching content identity is sufficient even without a deployment SHA',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version,contentSha:RELEASE.contentSha})});await mount();(registration as any).waiting=worker;await act(async()=>pwa.register.mock.calls[0][0].onNeedRefresh());expect(updates.available).toBe(false);expect(updates.text).toContain('已確認為最新版本');
});

it('invalid registration before saving gives a Chinese retry message without claiming this attempt was saved',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();
 vi.mocked(registration.update).mockRejectedValue(new DOMException('The object is in an invalid state.','InvalidStateError'));
 vi.mocked(container.getRegistration).mockResolvedValue(registration);
 await act(async()=>updates.update());
 expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();
 expect(updates.text).toContain('本次尚未執行保存');expect(updates.text).toContain('重試');
 expect(updates.text).not.toContain('目前頁面與已保存進度保留');expect(updates.text).not.toContain('invalid state');
});
it('recovers a stale registration through the current scope and saves exactly once before activation',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();
 const fresh=Object.assign(new EventTarget(),{scope:new URL('/',location.href).href,waiting:worker,installing:null,update:vi.fn().mockResolvedValue(undefined)}) as unknown as ServiceWorkerRegistration;
 vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(fresh);
 let done!:Promise<void>;await act(async()=>{done=updates.update();});
 expect(container.getRegistration).toHaveBeenCalled();expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(1);
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});
it('a rejected durable save is never described as successfully saved',async()=>{
 (registration as any).waiting=worker;fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});save.mockRejectedValue(new Error('IDB failed'));await mount();await act(async()=>updates.update());
 expect(updates.text).toContain('未取得保存完成確認');expect(updates.text).not.toContain('目前頁面與已保存進度保留');expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();
});

it('invalid registrations retry at most twice and a later explicit retry can succeed',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockClear().mockRejectedValue(new DOMException('invalid','InvalidStateError'));
 await act(async()=>updates.update());expect(registration.update).toHaveBeenCalledTimes(2);expect(container.getRegistration).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled();expect(updates.updating).toBe(false);
 (registration as any).waiting=worker;let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(save).toHaveBeenCalledOnce();await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});
it('a missing registration is recreated only at the exact plugin script and scope without deleting site data',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(undefined);
 const fresh=Object.assign(new EventTarget(),{scope:new URL('/',location.href).href,waiting:worker,update:vi.fn()}) as unknown as ServiceWorkerRegistration;vi.mocked(container.register).mockResolvedValue(fresh);
 let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(container.register).toHaveBeenCalledOnce();expect(container.register).toHaveBeenCalledWith(new URL('/sw.js',location.href).href,{scope:new URL('/',location.href).href,type:'classic',updateViaCache:'none'});expect(fresh.update).not.toHaveBeenCalled();
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(save).toHaveBeenCalledOnce();
});
it('a redundant cached worker is ignored and a fresh pending install is awaited before saving',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();(registration as any).active={state:'redundant'};(registration as any).waiting={state:'redundant'};
 const fresh=Object.assign(new EventTarget(),{scope:new URL('/',location.href).href,waiting:null,installing:worker,update:vi.fn().mockResolvedValue(undefined)}) as unknown as ServiceWorkerRegistration;vi.mocked(container.getRegistration).mockResolvedValue(fresh);
 let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(save).not.toHaveBeenCalled();await act(async()=>{(fresh as any).waiting=worker;worker.dispatchEvent(new Event('statechange'));});expect(save).toHaveBeenCalledOnce();await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});
});
it('ordinary network failures are not retried or shown as raw native errors',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockClear().mockRejectedValue(new TypeError('network native stack'));
 await act(async()=>updates.update());expect(registration.update).toHaveBeenCalledOnce();expect(container.getRegistration).toHaveBeenCalledOnce();expect(container.register).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();expect(updates.text).not.toContain('network native stack');
});
it('activation exceptions preserve the confirmed save and permit a later retry without duplicate clicks',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).waiting=worker;await mount();const respond=workerPost();let fail=true;vi.mocked(worker.postMessage).mockImplementation((message,ports:any)=>{if(message.type==='SKIP_WAITING'&&fail){fail=false;throw new DOMException('native activation failure','InvalidStateError');}respond(message,ports);});
 await act(async()=>updates.update());expect(updates.text).toContain('本次保存已確認');expect(updates.text).toContain('新版啟用失敗');expect(updates.text).not.toContain('native activation failure');expect(replace).not.toHaveBeenCalled();
 let done!:Promise<void>;await act(async()=>{done=updates.update();void updates.update();});expect(save).toHaveBeenCalledTimes(2);expect(activations(worker)).toHaveLength(2);await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});
it('an unrelated controller change cannot cause navigation',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).waiting=worker;(container as any).controller=null;await mount();let done!:Promise<void>;await act(async()=>{done=updates.update();});
 await act(async()=>container.dispatchEvent(new Event('controllerchange')));expect(replace).not.toHaveBeenCalled();(container as any).controller=worker;await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});
it('foreground and online events during a save cannot duplicate saves or activation',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).waiting=worker;await mount();let saved!:()=>void;save.mockImplementation(()=>new Promise<void>(r=>saved=r));let done!:Promise<void>;await act(async()=>{done=updates.update();});
 await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));void updates.update();});expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(0);
 await act(async()=>saved());await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(activations(worker)).toHaveLength(1);
});
it('an unopened campaign is never described as having performed a save',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).waiting=worker;save.mockResolvedValue('no-campaign' as never);await mount();let done!:Promise<void>;await act(async()=>{done=updates.update();});await act(async()=>{await vi.advanceTimersByTimeAsync(15000);await done;});expect(updates.text).toContain('目前沒有開啟戰役');expect(updates.text).not.toContain('本次保存已確認');expect(replace).not.toHaveBeenCalled();
});
it('loading the old application after a version-targeted reload reports the mismatch without claiming a save',async()=>{
 const prior=window.location.href;window.history.replaceState(null,'','?_appUpdate='+newVersion);try{await mount();expect(updates.text).toContain('重新載入後仍未取得預期新版');expect(updates.text).not.toContain('本次保存已確認');}finally{window.history.replaceState(null,'',prior);}
});

it('re-registration cannot begin until a durable save has been acknowledged',async()=>{
 (container as any).controller=null;
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(undefined);
 let saved!:()=>void;save.mockImplementation(()=>new Promise<void>(r=>saved=r));let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(save).toHaveBeenCalledOnce();expect(container.register).not.toHaveBeenCalled();
 const fresh=Object.assign(new EventTarget(),{scope:new URL('/',location.href).href,active:null,waiting:null,installing:worker}) as unknown as ServiceWorkerRegistration;vi.mocked(container.register).mockResolvedValue(fresh);
 await act(async()=>saved());expect(container.register).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(0);(fresh as any).installing=null;(fresh as any).active=worker;(worker as any).state='activated';(container as any).controller=worker;
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(save).toHaveBeenCalledOnce();expect(replace).toHaveBeenCalledOnce();
});
it('a failed save prevents even same-scope registration and automatic activation',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(undefined);save.mockRejectedValue(new Error('durable failure'));
 await act(async()=>updates.update());expect(container.register).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();expect(updates.text).toContain('未取得保存完成確認');
});
it('a background check never recreates an invalid registration or performs a save',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(undefined);
 await act(async()=>updates.check());expect(container.register).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();expect(updates.text).toContain('本次尚未執行保存');expect(updates.available).toBe(true);
});

it('a native TypeError on a removed reference can recover through a different live registration',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockRejectedValue(new TypeError('Not found'));
 const fresh=Object.assign(new EventTarget(),{scope:new URL('/',location.href).href,waiting:worker,update:vi.fn()}) as unknown as ServiceWorkerRegistration;vi.mocked(container.getRegistration).mockResolvedValue(fresh);let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(save).toHaveBeenCalledOnce();await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});

it('re-registering a still-controlled old worker must await the new worker rather than reloading the old controller',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(undefined);
 const nextWorker=Object.assign(new EventTarget(),{state:'installing',scriptURL:worker.scriptURL,postMessage:workerPost()}) as unknown as ServiceWorker;
 const fresh=Object.assign(new EventTarget(),{scope:registration.scope,active:worker,waiting:null,installing:nextWorker}) as unknown as ServiceWorkerRegistration;vi.mocked(container.register).mockResolvedValue(fresh);
 let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(save).toHaveBeenCalledOnce();expect(replace).not.toHaveBeenCalled();expect(activations(nextWorker)).toHaveLength(0);
 await act(async()=>container.dispatchEvent(new Event('controllerchange')));expect(replace).not.toHaveBeenCalled();
 (fresh as any).installing=null;(fresh as any).waiting=nextWorker;(nextWorker as any).state='installed';await act(async()=>nextWorker.dispatchEvent(new Event('statechange')));expect(activations(nextWorker)).toHaveLength(1);expect(save).toHaveBeenCalledOnce();
 (container as any).controller=nextWorker;await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});

it('a slow background check cannot overwrite the confirmed save status during activation',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).waiting=worker;await mount();let finish!:()=>void;fetcher.mockImplementationOnce(()=>new Promise(r=>finish=()=>r({ok:true,json:async()=>({...RELEASE})})));let check!:Promise<void>,done!:Promise<void>;
 await act(async()=>{check=updates.check();done=updates.update();});expect(updates.text).toContain('本次保存已確認');await act(async()=>{finish();await check;});expect(updates.text).toContain('本次保存已確認');expect(save).toHaveBeenCalledOnce();
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});

it('a failed background refresh discards a stale waiting reference before the explicit retry',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();(registration as any).waiting=worker;vi.mocked(registration.update).mockRejectedValue(new DOMException('invalid waiting registration','InvalidStateError'));vi.mocked(container.getRegistration).mockResolvedValue(undefined);
 await act(async()=>updates.check());expect(save).not.toHaveBeenCalled();
 const newWorker=Object.assign(new EventTarget(),{state:'installed',scriptURL:worker.scriptURL,postMessage:workerPost()}) as unknown as ServiceWorker;
 const fresh=Object.assign(new EventTarget(),{scope:registration.scope,waiting:newWorker}) as unknown as ServiceWorkerRegistration;vi.mocked(container.register).mockResolvedValue(fresh);
 let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(container.register).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(0);expect(activations(newWorker)).toHaveLength(1);
 (container as any).controller=newWorker;await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});

for(const background of ['failed','pending','completed'] as const)it(`rejects a docs-only waiting worker when real content metadata exists and background update is ${background}`,async()=>{
 workerRelease={...RELEASE,commitSha:'d'.repeat(40)};(registration as any).waiting=worker;
 fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,contentSha:'e'.repeat(40)})});
 if(background==='failed')vi.mocked(registration.update).mockRejectedValue(new TypeError('download failed'));
 if(background==='pending')vi.mocked(registration.update).mockImplementation(()=>new Promise(()=>{}));
 await mount();await act(async()=>updates.update());expect(activations(worker)).toHaveLength(0);expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();expect(updates.text).toContain('本次尚未執行保存');expect(updates.text).toContain('新版下載尚未完成');
});
it('a newer but different waiting content identity cannot stand in for the requested build',async()=>{
 workerRelease={version:RELEASE.version,contentSha:'f'.repeat(40)};(registration as any).waiting=worker;fetcher.mockResolvedValue({ok:true,json:async()=>({...RELEASE,contentSha:'e'.repeat(40)})});await mount();await act(async()=>updates.update());expect(save).not.toHaveBeenCalled();expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();
});
it('a replaced waiting worker during durable save is not activated and the confirmed save is retained',async()=>{
 (registration as any).waiting=worker;fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();let saved!:()=>void;save.mockImplementation(()=>new Promise<void>(r=>saved=r));let done!:Promise<void>;await act(async()=>{done=updates.update();});
 (registration as any).waiting={state:'installed'};await act(async()=>{saved();await done;});expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();expect(updates.text).toContain('本次保存已確認');
});
it('an unsupported worker identity times out without save, activation, navigation or an unbounded retry',async()=>{
 (registration as any).waiting=worker;vi.mocked(worker.postMessage).mockImplementation(()=>{});fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();let done!:Promise<void>;await act(async()=>{done=updates.update();});await act(async()=>{await vi.advanceTimersByTimeAsync(3000);await done;});expect(save).not.toHaveBeenCalled();expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();expect(updates.updating).toBe(false);expect(worker.postMessage).toHaveBeenCalledOnce();
});
it('a malformed worker reply fails safely rather than escaping the update error handler',async()=>{
 workerRelease={version:'invalid',contentSha:'e'.repeat(40)};(registration as any).waiting=worker;fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});await mount();await act(async()=>updates.update());expect(save).not.toHaveBeenCalled();expect(activations(worker)).toHaveLength(0);expect(replace).not.toHaveBeenCalled();
});
it('an independently downloaded real waiting worker can be verified offline without metadata',async()=>{
 fetcher.mockRejectedValue(new TypeError('offline'));(registration as any).waiting=worker;await mount();let done!:Promise<void>;await act(async()=>{done=updates.update();});expect(save).toHaveBeenCalledOnce();expect(activations(worker)).toHaveLength(1);await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await done;});expect(replace).toHaveBeenCalledOnce();
});
