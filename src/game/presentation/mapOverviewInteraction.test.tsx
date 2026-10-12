// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {expect,it,vi,afterEach} from 'vitest';
import FormalWorldMap from '../FormalWorldMap';
import {createFormalWorld} from '../formal/generator';
import {project} from './mapGeometry';
import {overviewZoom} from './mapPaint';
import {createExile} from '../formal/extinction';

// Exercise the real React renderer and toolbar; raster scheduling is tested by
// DemoMapCache.test.ts. This is canvas/DOM instrumentation, not a browser smoke.
vi.mock('./DemoMapCache',()=>{
 const images=new Map<string,unknown>();
 return {mapImage:(path:string)=>{if(!images.has(path))images.set(path,{src:path,complete:true,naturalWidth:1536,naturalHeight:1024,addEventListener(){},removeEventListener(){}});return images.get(path);},
  mapSession:()=>({terrain:{revision:0,cache:new Map(),totalBytes:0,pendingCount:0,hits:0,misses:0,onChange(){},setTextures(){},pump(){}},scenery:{revision:0,cache:new Map(),bytes:0,pending:new Map(),hits:0,misses:0,spriteDraws:0,assetsReady(){},beginFrame(){},draw(){},pump:()=>0}}),drawTerrain:vi.fn()};
});
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());container?.remove();root=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
it('the real renderer keeps exile identity while ordinary labels are hidden and never mutates the world',async()=>{
 localStorage.clear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.push(f);return frames.length;});vi.stubGlobal('cancelAnimationFrame',vi.fn());vi.stubGlobal('matchMedia',()=>({matches:true}));
 vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:800,bottom:600,width:800,height:600,toJSON(){}});vi.stubGlobal('ResizeObserver',class{constructor(private cb:ResizeObserverCallback){}observe(){this.cb([],this as unknown as ResizeObserver);}disconnect(){}});
 const texts:string[]=[],ctx=new Proxy({fillText:(text:string)=>texts.push(text),measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext);
 const w=createFormalWorld({campaign:'exile-hidden-labels',seed:90217});createExile(w,w.factions[1].id,{militia:12},[],w.cities[0]);const before=JSON.stringify(w);container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root!.render(<FormalWorldMap world={w}/>));await act(async()=>frames.splice(0).forEach(f=>f(1000)));
 expect(texts).toContain('流');expect(texts.every(t=>t==='流')).toBe(true);expect(JSON.stringify(w)).toBe(before);expect([...container.querySelectorAll('button')].some(b=>b.textContent==='顯示標示')).toBe(true);
});
for(const width of [393,1440])it(`${width}px all-region rendering skips city/wall atlases and retains accurate city selection and label toggle`,async()=>{
 localStorage.clear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const frames=new Map<number,FrameRequestCallback>();let id=0;
 vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.set(++id,f);return id;});vi.stubGlobal('cancelAnimationFrame',(n:number)=>frames.delete(n));
 vi.stubGlobal('matchMedia',()=>({matches:true}));
 const rect={x:0,y:0,left:0,top:0,right:width,bottom:600,width,height:600,toJSON(){}};
 vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue(rect);
 vi.spyOn(HTMLCanvasElement.prototype,'setPointerCapture').mockImplementation(()=>{});vi.spyOn(HTMLCanvasElement.prototype,'hasPointerCapture').mockReturnValue(false);
 const resizeCallbacks:ResizeObserverCallback[]=[];vi.stubGlobal('ResizeObserver',class{constructor(cb:ResizeObserverCallback){resizeCallbacks.push(cb);}observe(){resizeCallbacks.at(-1)!([],this as unknown as ResizeObserver);}disconnect(){}});
 const images:unknown[][]=[],glyphs:string[]=[],ctx=new Proxy({drawImage:(...args:unknown[])=>images.push(args),measureText:()=>({width:20}),fillText:(text:string)=>glyphs.push(text)},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:(o,k,v)=>{Reflect.set(o,k,v);return true;}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext);
 const w=createFormalWorld({campaign:'overview-dom-'+width,seed:90217});w.cities[0].wallLevel=1;w.cities[0].military!.units={militia:10,scout:3};const before=JSON.stringify(w);
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 const flush=()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(1000));};
 await act(async()=>root!.render(<FormalWorldMap world={w} mobile={width<800}/>));await act(async()=>flush());
 expect(images.some(args=>String((args[0] as {src:string}).src).includes('buildings-'))).toBe(true);
 const click=async(text:string)=>{const b=[...container!.querySelectorAll('button')].find(b=>b.textContent===text)!;expect(b).toBeDefined();await act(async()=>b.click());await act(async()=>flush());};
 images.length=0;await click('全區');const canvas=container.querySelector<HTMLCanvasElement>('.map-overlay')!,camera=JSON.parse(canvas.dataset.camera!);
 expect(camera.z).toBeCloseTo(overviewZoom(w,width,600));expect(images).toHaveLength(0);
 await click('顯示標示');expect(glyphs.length).toBeGreaterThan(0);
 const c=w.cities[0],p=project(c),px=(p.x-camera.x)*camera.z+width/2,py=(p.y-camera.y)*camera.z+300;
 const pointer=(type:string)=>new PointerEvent(type,{clientX:px,clientY:py,pointerId:1,pointerType:'touch',bubbles:true});
 await act(async()=>{canvas.dispatchEvent(pointer('pointerdown'));canvas.dispatchEvent(pointer('pointerup'));});
 expect(container.textContent).toContain(c.name);expect(container.textContent).not.toContain('地形');
 expect(container.querySelector('.dialog-title .tile-favorite-star')!.textContent).toBe('☆');expect(container.querySelector('.target-map-actions')).toBeNull();expect(container.textContent).not.toContain('返回地圖');await click('☆');expect(container.querySelector('.dialog-title .tile-favorite-star')!.getAttribute('aria-pressed')).toBe('true');await click('★');await click('×');images.length=0;await click('回城');expect(images.length).toBeGreaterThan(0);
 expect(container.querySelector('.map-overlay')).toBe(canvas);
 // Open a foreign city on the same canvas, select a mission, go back, then submit without navigating to ArmyView.
 const enemy=w.cities[1],issue=vi.fn();
 await act(async()=>root!.render(<FormalWorldMap world={w} mobile={width<800} focusPoint={enemy} issue={issue}/>));await act(async()=>flush());
 const position=canvas.dataset.camera;
 await act(async()=>canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 await click('派遣斥候');expect(container.querySelector('dialog h2')!.textContent).toBe('偵察 · '+enemy.name);
 expect(container.querySelector('input[aria-label="派遣斥候"]')).not.toBeNull();expect(container.querySelector('input[aria-label="派遣民兵"]')).toBeNull();
 expect(container.querySelector('input[aria-label="派遣 X"]')).toBeNull();await click('返回');expect(container.textContent).toContain('已知駐軍');
 expect(canvas.dataset.camera).toBe(position);await click('掠奪物資');
 const count=container.querySelector<HTMLInputElement>('input[aria-label="派遣民兵"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(count,'5');count.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('下達掠奪命令');expect(issue).toHaveBeenCalledWith({type:'army.dispatch',cityId:w.cities[0].id,target:{kind:'city',cityId:enemy.id},mission:'raid',units:{militia:5}});
 expect(container.querySelector('dialog')).toBeNull();expect(container.querySelector('.map-overlay')).toBe(canvas);expect(JSON.stringify(w)).toBe(before);
});

it('DEMO triangles animate own scouts and enemy marches from durable path times on the existing canvas',async()=>{
 const {battlefield,dispatch}=await import('../formal/combatTestSupport'),{displayClock}=await import('./liveClock');localStorage.clear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let real=10000;vi.spyOn(performance,'now').mockImplementation(()=>real);
 const frames=new Map<number,FrameRequestCallback>();let serial=0;vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.set(++serial,f);return serial;});vi.stubGlobal('cancelAnimationFrame',(n:number)=>frames.delete(n));vi.stubGlobal('matchMedia',()=>({matches:true}));
 vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:393,bottom:600,width:393,height:600,toJSON(){}});vi.stubGlobal('ResizeObserver',class{constructor(private cb:ResizeObserverCallback){}observe(){this.cb([],this as unknown as ResizeObserver);}disconnect(){}});
 let points:number[][]=[],color='',position:number[]=[];const triangles:{color:string;points:number[][];position:number[]}[]=[],images:string[]=[];const ctx=new Proxy({translate:(x:number,y:number)=>{position=[x,y];},beginPath:()=>{points=[];},moveTo:(x:number,y:number)=>points.push([x,y]),lineTo:(x:number,y:number)=>points.push([x,y]),fill:()=>{if(points.length===3)triangles.push({color,points:[...points],position:[...position]});},drawImage:(im:{src:string})=>images.push(im.src),measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:(o,k,v)=>{if(k==='fillStyle')color=v;Reflect.set(o,k,v);return true;}});vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext);
 let w=battlefield();w.cities[0].military!.units={scout:3};w.cities[1].military!.units={militia:10};w=dispatch(w,'scout',{scout:2}).world;w=dispatch(w,'raid',{militia:5},1,0).world;const before=JSON.stringify(w);displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:50,running:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);
 const flush=()=>{const work=[...frames.values()];frames.clear();work.forEach(f=>f(real));};await act(async()=>root!.render(<FormalWorldMap world={w} mobile/>));await act(async()=>flush());const canvas=container.querySelector('.map-overlay'),own=triangles.find(t=>t.color==='#f4e5b5')!,enemy=triangles.find(t=>t.color==='#bec1b7')!;expect(own).toBeDefined();expect(enemy).toBeDefined();expect(images.some(s=>/walls-|wall-ring/.test(s))).toBe(false);expect(frames.size).toBeGreaterThan(0);
 triangles.length=0;real+=100;await act(async()=>flush());expect(triangles.find(t=>t.color==='#f4e5b5')!.position).not.toEqual(own.position);expect(triangles.find(t=>t.color==='#bec1b7')!.position).not.toEqual(enemy.position);expect(container.querySelector('.map-overlay')).toBe(canvas);expect(JSON.stringify(w)).toBe(before);displayClock.stop();
});
