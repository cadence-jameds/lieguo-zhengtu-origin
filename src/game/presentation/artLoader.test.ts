import {expect,it,vi} from 'vitest';
import {ArtLoader} from './artLoader';
const tick=()=>new Promise(r=>setTimeout(r,0));
const image=()=>new Response('image',{headers:{'Content-Type':'image/webp'}});
function storage(){const entries=new Map<string,Response>(),cache={match:vi.fn(async(p:string)=>entries.get(p)?.clone()),put:vi.fn(async(p:string,r:Response)=>{entries.set(p,r.clone());})} as unknown as Cache;return {entries,cache,storage:{open:async()=>cache} as unknown as CacheStorage};}
it('bounded shared queue promotes selected/required assets, progress is real and duplicate enqueue never downloads twice',async()=>{
 const resolvers:Array<()=>void>=[],order:string[]=[],fetcher=vi.fn((url:RequestInfo|URL)=>{order.push(String(url));return new Promise<Response>(r=>resolvers.push(()=>r(image())));}) as unknown as typeof fetch;
 const loader=new ArtLoader(2,15000,undefined,fetcher);loader.enqueue(['one','two','later']);loader.enqueue(['required'],100);loader.enqueue(['one']);await tick();expect(order).toEqual(['/one','/two']);expect(loader.progress(['one','required'])).toMatchObject({loaded:0,total:2,percent:0});resolvers.shift()!();await tick();expect(order[2]).toBe('/required');expect(loader.progress(['one','required'])).toMatchObject({loaded:1,remaining:1,percent:50});resolvers.shift()!();await tick();resolvers.shift()!();await tick();expect(loader.progress(['one','required']).percent).toBe(100);resolvers.shift()!();await tick();expect(fetcher).toHaveBeenCalledTimes(4);
});
it('valid cache is read without network, eviction incrementally refills, new loader reuses cache',async()=>{
 const s=storage(),fetcher=vi.fn(async()=>image()),loader=new ArtLoader(2,15000,s.storage,fetcher);loader.enqueue(['one','two']);await vi.waitFor(()=>expect(loader.progress(['one','two']).loaded).toBe(2));expect(fetcher).toHaveBeenCalledTimes(2);
 const second=new ArtLoader(2,15000,s.storage,fetcher);expect((await second.inspect(['one','two'])).percent).toBe(100);expect(fetcher).toHaveBeenCalledTimes(2);s.entries.delete('/one');await second.inspect(['one','two']);await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(3));expect(second.progress(['two']).percent).toBe(100);
});
it('offline failures stop, explicit retry resumes same fixed set, optional failures do not block ready required set',async()=>{
 const fetcher=vi.fn(async()=>{throw Error('offline');}),loader=new ArtLoader(2,15000,undefined,fetcher);loader.enqueue(['required','optional']);await vi.waitFor(()=>expect(loader.progress(['required']).failed).toEqual(['required']));loader.enqueue(['required']);expect(fetcher).toHaveBeenCalledTimes(2);fetcher.mockImplementation(async()=>image() as never);loader.retry(['required']);await vi.waitFor(()=>expect(loader.progress(['required']).percent).toBe(100));expect(loader.progress(['optional']).failed).toEqual(['optional']);
});
it('request deadline aborts once and does not become an infinite retry',async()=>{
 const fetcher=vi.fn((_u:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_r,reject)=>init?.signal?.addEventListener('abort',()=>reject(Error('aborted'))))),loader=new ArtLoader(1,10,undefined,fetcher);loader.enqueue(['slow']);await vi.waitFor(()=>expect(loader.progress(['slow']).failed).toEqual(['slow']));expect(fetcher).toHaveBeenCalledTimes(1);
});
it('quota/cache unavailable still downloads; HTML/HTTP errors never count as ready',async()=>{
 const broken={open:async()=>{throw Error('quota');}} as unknown as CacheStorage,loader=new ArtLoader(2,15000,broken,vi.fn(async url=>String(url).endsWith('valid')?image():new Response('<html>',{headers:{'Content-Type':'text/html'}})));loader.enqueue(['valid','bad']);await vi.waitFor(()=>expect(loader.progress(['valid','bad'])).toMatchObject({loaded:1,failed:['bad'],percent:50}));
});
it('explicit retry bypasses a cached HTTP error without reloading successful assets',async()=>{
 const fetcher=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>init?.cache==='reload'?image():new Response('',{status:503})),loader=new ArtLoader(2,15000,undefined,fetcher);loader.enqueue(['required']);await vi.waitFor(()=>expect(loader.progress(['required']).failed).toEqual(['required']));expect(fetcher.mock.calls[0][1]?.cache).toBe('force-cache');loader.retry(['required']);await vi.waitFor(()=>expect(loader.progress(['required']).percent).toBe(100));expect(fetcher.mock.calls[1][1]?.cache).toBe('reload');expect(fetcher).toHaveBeenCalledTimes(2);
});
