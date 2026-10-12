import {expect,it,vi,afterEach} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {TerrainCache,SceneryCache,mapSession,drawTerrain} from './DemoMapCache';
import {project} from './mapGeometry';
import {campaignId} from '../formal/ids';
const w=createFormalWorld({campaign:'cache-tests',seed:90217});
afterEach(()=>vi.unstubAllGlobals());
it('wild sites preserve scenery and reuse the same tiles through movement, cooldown and generation changes',()=>{
 const gradients=vi.fn(()=>({addColorStop(){}})),draws=vi.fn(),ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){},translate(){},scale(){},drawImage:draws,createRadialGradient:gradients,fillRect(){}} as unknown as CanvasRenderingContext2D;
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});vi.stubGlobal('Image',class{naturalWidth=1536;naturalHeight=1024;src='';});
 // A presentation-only scene without cities isolates all 432 wild slots.
 const scene=structuredClone(w);scene.cities=[];const site=scene.worldLayer!.wildSites[0],camera={...project(site),z:.75},before=JSON.stringify(scene),cache=new SceneryCache();
 cache.draw(ctx,scene,camera,400,200,1,false);while(cache.pending.size)cache.pump(100);
 expect(draws).toHaveBeenCalled();expect(gradients).not.toHaveBeenCalled();expect(JSON.stringify(scene)).toBe(before);
 const keys=[...cache.cache.keys()].sort(),misses=cache.misses;const changed=structuredClone(scene);changed.worldLayer!.wildSites.forEach((s,i)=>{s.x=(s.x+1)%384;s.y=(s.y+1)%384;s.generation++;if(i%2===0){s.phase='cooldown';s.respawnAt=scene.time+60000;}});
 cache.beginFrame();cache.draw(ctx,changed,camera,400,200,1,false);
 expect(cache.pending.size).toBe(0);expect(cache.misses).toBe(misses);expect(cache.hits).toBeGreaterThan(0);expect([...cache.cache.keys()].sort()).toEqual(keys);expect(gradients).not.toHaveBeenCalled();
 // Cities retain the DEMO clearing, even at exactly the same coordinate.
 changed.cities=[{...w.cities[0],x:site.x,y:site.y}];cache.beginFrame();cache.draw(ctx,changed,camera,400,200,1,false);while(cache.pending.size)cache.pump(100);
 expect(gradients).toHaveBeenCalled();
});
it('cold terrain requests enqueue without synchronous raster work, and pump requests one worker job',()=>{
 const sent:unknown[]=[];class WorkerMock{onmessage=()=>{};onerror=()=>{};postMessage(m:unknown){sent.push(m);}terminate(){}}
 vi.stubGlobal('Worker',WorkerMock);vi.stubGlobal('document',{createElement:()=>{throw new Error('request must not allocate/raster');}});
 const cache=new TerrainCache(w);expect(cache.request(80,150,.75,2,false)).toBeNull();expect(sent).toHaveLength(1);expect(cache.pendingCount).toBe(1);cache.pump();expect(sent).toHaveLength(2);expect(sent[1]).toMatchObject({type:'paint',cx:80,cy:150});expect(cache.active).toBeDefined();cache.pump();expect(sent).toHaveLength(2);cache.dispose();
});
it('terrain LRU includes overview in the96MiB bound and repeated cache hits reuse the same raster',()=>{
 vi.stubGlobal('Worker',class{postMessage(){}terminate(){}});const cache=new TerrainCache(w),image={width:1024,height:1024} as HTMLCanvasElement;
 cache.setOverview(image);for(let i=0;i<30;i++)cache.store(i+',0:1',{image,scale:1});expect(cache.totalBytes).toBeLessThanOrEqual(96*1024*1024);expect(cache.cache.has('0,0:1')).toBe(false);expect(cache.request(29,0,1,1,false)?.image).toBe(image);expect(cache.hits).toBe(1);
 cache.beginFrame();expect(cache.pendingCount).toBe(0);cache.dispose();
});
it('scenery uses world-space progressive tiles, reuses cached art across camera return and remains under48MiB',()=>{
 const draws=vi.fn(),ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){},translate(){},scale(){},drawImage:draws,createRadialGradient(){return {addColorStop(){}};},fillRect(){}} as unknown as CanvasRenderingContext2D;
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});vi.stubGlobal('Image',class{naturalWidth=1536;naturalHeight=1024;src='';});
 const cache=new SceneryCache(),camera={...project(w.cities[0]),z:.75},before=JSON.stringify(w);cache.draw(ctx,w,camera,400,200,1,false);expect(cache.cache.size).toBe(0);expect(cache.pending.size).toBeGreaterThan(0);expect(cache.pump()).toBeLessThanOrEqual(2);expect(cache.cache.size).toBeGreaterThan(0);expect(cache.bytes).toBeLessThanOrEqual(48*1024*1024);
 cache.beginFrame();cache.draw(ctx,w,camera,400,200,1,false);expect(cache.hits).toBeGreaterThan(0);expect(draws).toHaveBeenCalled();expect(JSON.stringify(w)).toBe(before);
 const images=[{naturalWidth:1,naturalHeight:1} as HTMLImageElement];cache.assetsReady(images);cache.cache.set('retained',{image:{} as HTMLCanvasElement,wx:0,wy:0,width:1,height:1,scale:1});cache.assetsReady(images);expect(cache.cache.has('retained')).toBe(true);
});
it('campaign sessions retain caches on remount and invalidate imported terrain changes for the same campaign',()=>{
 vi.stubGlobal('Worker',class{postMessage(){}terminate(){}});const first=mapSession(w);expect(mapSession(structuredClone(w))).toBe(first);const changed=structuredClone(w);changed.seed++;expect(mapSession(changed)).not.toBe(first);
});
it('a cold full-region frame draws coherent terrain and a world outline before the raster worker returns',()=>{
 const draws=vi.fn(),strokes=vi.fn(),ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){},drawImage:draws,stroke:strokes,fillRect(){},createImageData:(width:number,height:number)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(){}} as unknown as CanvasRenderingContext2D;
 vi.stubGlobal('Worker',class{postMessage(){}terminate(){}});vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});
 const cache=new TerrainCache(w),cam={...project({x:191.5,y:191.5}),z:.02};drawTerrain(ctx,w,cam,393,600,2,false,true,cache);
 expect(ctx.fillStyle).toBe('#29392d');expect(draws).toHaveBeenCalledOnce();expect(strokes).toHaveBeenCalledOnce();expect(cache.overview).toMatchObject({width:484,height:242});expect(cache.overviewReady).toBe(false);expect(cache.pending.has('overview')).toBe(true);
 const retained=cache.overview;cache.pump();cache.beginFrame();expect(cache.requestOverview()).toBe(retained);expect(cache.pending.size).toBe(0);cache.dispose();
});

it('opening or resetting the isolated lab never evicts the still-mounted normal campaign terrain worker',()=>{
 vi.stubGlobal('Worker',class{postMessage(){}terminate(){}});
 const normal=structuredClone(w),lab=structuredClone(w);normal.campaignId=campaignId('normal-lab-qa');lab.campaignId=campaignId('b5lab-qa-first');
 const original=mapSession(normal),normalDispose=vi.spyOn(original.terrain,'dispose');original.terrain.request(80,150,.75,1,false);original.terrain.pump();
 const pending=original.terrain.active,firstLab=mapSession(lab),labDispose=vi.spyOn(firstLab.terrain,'dispose');expect(mapSession(normal)).toBe(original);expect(original.terrain.active).toBe(pending);expect(normalDispose).not.toHaveBeenCalled();
 const reset=structuredClone(lab);reset.campaignId=campaignId('b5lab-qa-reset');const secondLab=mapSession(reset);expect(secondLab).not.toBe(firstLab);expect(labDispose).toHaveBeenCalledOnce();expect(mapSession(normal)).toBe(original);expect(normalDispose).not.toHaveBeenCalled();expect(mapSession(reset)).toBe(secondLab);
 const other=structuredClone(normal);other.campaignId=campaignId('normal-another');mapSession(other);expect(normalDispose).toHaveBeenCalledOnce();expect(mapSession(reset)).toBe(secondLab);
});
