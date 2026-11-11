import {assetURL,ART_CACHE} from './artUrl';
type State='queued'|'loading'|'ready'|'failed';
type Entry={state:State;priority:number;error?:string};
/** Download only: no background Image/decode storm, no Worker or save dependencies. */
export class ArtLoader {
 private entries=new Map<string,Entry>();private listeners=new Set<()=>void>();private active=0;private version=0;
 constructor(private concurrency=2,private timeoutMs=15000,private storage:CacheStorage|undefined=globalThis.caches,private request:typeof fetch=(...args)=>fetch(...args)){}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 snapshot=()=>this.version;
 private emit(){this.version++;for(const fn of this.listeners)fn();}
 state(path:string){return this.entries.get(path)?.state;}
 progress(paths:readonly string[]){const total=new Set(paths).size,loaded=[...new Set(paths)].filter(p=>this.state(p)==='ready').length,failed=[...new Set(paths)].filter(p=>this.state(p)==='failed');return {total,loaded,remaining:total-loaded,percent:total?Math.floor(loaded/total*100):100,failed};}
 enqueue(paths:readonly string[],priority=0){for(const path of new Set(paths)){const e=this.entries.get(path);if(!e)this.entries.set(path,{state:'queued',priority});else e.priority=Math.max(e.priority,priority);}this.pump();}
 retry(paths:readonly string[]){for(const p of paths){const e=this.entries.get(p);if(e?.state==='failed')this.entries.set(p,{state:'queued',priority:100});}this.emit();this.pump();}
 /** Recheck CacheStorage on entry, including eviction after this tab preloaded an asset. */
 async inspect(paths:readonly string[]){
  let cache:Cache|undefined;try{cache=await this.storage?.open(ART_CACHE);}catch{/* HTTP cache remains usable. */}
  if(cache)for(const path of new Set(paths)){let hit:Response|undefined;try{hit=await cache.match(assetURL(path));}catch{continue;}const old=this.entries.get(path);if(hit?.ok)this.entries.set(path,{state:'ready',priority:100});else if(old?.state==='ready')this.entries.set(path,{state:'queued',priority:100});}
  this.enqueue(paths,100);this.emit();return this.progress(paths);
 }
 private pump(){while(this.active<this.concurrency){const next=[...this.entries].filter(([,e])=>e.state==='queued').sort((a,b)=>b[1].priority-a[1].priority)[0];if(!next)break;this.active++;next[1].state='loading';void this.download(...next);}this.emit();}
 private async download(path:string,entry:Entry){
  const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),this.timeoutMs);
  try{
   let cache:Cache|undefined;try{cache=await this.storage?.open(ART_CACHE);}catch{/* Private mode / quota: use normal browser cache. */}
   const url=assetURL(path);let response:Response|undefined;try{response=await cache?.match(url);}catch{/* Cache failure does not block fetching. */}
   if(!response?.ok){response=await this.request(url,{signal:abort.signal,cache:'force-cache',priority:entry.priority>=100?'high':'low'} as RequestInit);if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/'))throw new Error('圖片回應無效');const copy=response.clone();await response.arrayBuffer();try{await cache?.put(url,copy);}catch{/* A full cache must not masquerade as a download failure. */}}
   entry.state='ready';entry.error=undefined;
  }catch{entry.state='failed';entry.error='無法下載圖片；請確認網路後重試。';}
  finally{clearTimeout(deadline);this.active--;this.pump();}
 }
}
export const artLoader=new ArtLoader();
