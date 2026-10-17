import {afterEach,expect,it,vi} from 'vitest';
import {withSaveLock} from './saveLock';
afterEach(()=>vi.useRealTimers());
it('reports an unresponsive lock request without waiting for abort acknowledgement; late acquisition cannot write',async()=>{
 vi.useFakeTimers();let callback!:()=>Promise<void>;const acquired=vi.fn(async()=>{}),timeout=vi.fn();
 const locks={request:vi.fn((_name,_options,cb)=>{callback=cb;return new Promise(()=>{});})} as unknown as LockManager;
 void withSaveLock(locks,new AbortController().signal,acquired,timeout);
 await vi.advanceTimersByTimeAsync(8000);expect(timeout).toHaveBeenCalledOnce();await callback();expect(acquired).not.toHaveBeenCalled();
});
it('holds a successful lock and does not time out while the game is running',async()=>{
 vi.useFakeTimers();let release!:()=>void;const timeout=vi.fn();
 const locks={request:(_name:unknown,_opts:unknown,cb:()=>Promise<void>)=>cb()} as unknown as LockManager;
 const work=withSaveLock(locks,new AbortController().signal,()=>new Promise<void>(r=>{release=r;}),timeout);
 await vi.advanceTimersByTimeAsync(30000);expect(timeout).not.toHaveBeenCalled();release();await work;
});
it('unmount cancellation suppresses timeout and late worker creation',async()=>{
 vi.useFakeTimers();let cb!:()=>Promise<void>;const controller=new AbortController(),acquired=vi.fn(async()=>{}),timeout=vi.fn();
 const locks={request:(_n:unknown,_o:unknown,callback:()=>Promise<void>)=>{cb=callback;return new Promise(()=>{});}} as unknown as LockManager;
 void withSaveLock(locks,controller.signal,acquired,timeout);controller.abort();await vi.advanceTimersByTimeAsync(8000);await cb();expect(acquired).not.toHaveBeenCalled();expect(timeout).not.toHaveBeenCalled();
});
