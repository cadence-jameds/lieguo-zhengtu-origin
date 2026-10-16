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
const next=RELEASE.version.split('.').map(Number);next[2]++;const newVersion=next.join('.');
function Surface(){updates=useAppUpdate(save);return <Home theme="dark" onThemeChange={()=>{}} world={null} busy={false} loading={false} onNew={()=>{}} onStart={()=>{}} onRetry={()=>{}} onExport={()=>{}} onImport={()=>{}} onCheck={()=>void updates.check()} updateText={updates.text} updateAvailable={updates.available} updating={updates.updating} updateDisabled={updates.updating} onUpdate={()=>void updates.update()}/>;}
async function mount(){await act(async()=>root.render(<Surface/>));}
beforeEach(()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);save=vi.fn().mockResolvedValue(undefined);fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version})});vi.stubGlobal('fetch',fetcher);
 container=Object.assign(new EventTarget(),{getRegistration:vi.fn()}) as unknown as ServiceWorkerContainer;
 worker=Object.assign(new EventTarget(),{state:'installed',postMessage:vi.fn()}) as unknown as ServiceWorker;
 registration=Object.assign(new EventTarget(),{waiting:null,installing:null,update:vi.fn().mockResolvedValue(undefined)}) as unknown as ServiceWorkerRegistration;
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
 let completed!:Promise<void>;await act(async()=>{completed=updates.update();});expect(save).toHaveBeenCalledOnce();expect(worker.postMessage).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();
 await act(async()=>saved());expect(worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(replace).not.toHaveBeenCalled();
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await completed;});expect(replace).toHaveBeenCalledOnce();expect(replace).toHaveBeenCalledWith(expect.stringContaining('_appUpdate='+newVersion));
});
it('waits for installation to complete before saving; duplicate clicks cannot submit twice',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});(registration as any).installing=worker;await mount();let completed!:Promise<void>;await act(async()=>{completed=updates.update();void updates.update();});expect(save).not.toHaveBeenCalled();
 await act(async()=>{(registration as any).waiting=worker;worker.dispatchEvent(new Event('statechange'));});expect(save).toHaveBeenCalledOnce();expect(worker.postMessage).toHaveBeenCalledOnce();
 await act(async()=>{container.dispatchEvent(new Event('controllerchange'));await completed;});expect(replace).toHaveBeenCalledOnce();
});
it('save failure never activates or reloads and allows retry',async()=>{
 (registration as any).waiting=worker;fetcher.mockResolvedValue({ok:true,json:async()=>({version:newVersion})});save.mockRejectedValueOnce(new Error('IDB failed'));await mount();await act(async()=>updates.update());expect(worker.postMessage).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();expect(updates.text).toContain('IDB failed');expect(updates.updating).toBe(false);
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
it('same numeric version with a different deployment SHA is actionable; identical metadata is not',async()=>{
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version,commitSha:'f'.repeat(40)})});await mount();expect(updates.available).toBe(true);expect(updates.text).toContain('可用更新建置');
 fetcher.mockResolvedValue({ok:true,json:async()=>({version:RELEASE.version,commitSha:RELEASE.commitSha})});await act(async()=>updates.check());expect(updates.available).toBe(false);expect(updates.text).toContain('已確認為最新版本');
 pwa.register.mock.calls[0][0].onNeedRefresh();await act(async()=>Promise.resolve());expect(updates.available).toBe(false);
});
it('offline checks retain bundled release notes and never activate or reload',async()=>{fetcher.mockRejectedValue(new Error('offline'));await mount();expect(updates.available).toBe(false);expect(el.textContent).toContain('目前無法確認更新');expect(el.textContent).toContain('近期版本與過往紀錄');expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();});
it('a fully downloaded waiting worker remains usable when the metadata endpoint is offline',async()=>{fetcher.mockRejectedValue(new Error('offline'));await mount();(registration as any).waiting=worker;await act(async()=>{pwa.register.mock.calls[0][0].onNeedRefresh();});expect(updates.available).toBe(true);expect(updates.text).toContain('已下載完成');expect(save).not.toHaveBeenCalled();expect(replace).not.toHaveBeenCalled();});
