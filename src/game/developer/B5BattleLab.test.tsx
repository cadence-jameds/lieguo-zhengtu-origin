// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import {act,useContext,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {B5BattleLab} from './B5BattleLab';
import {B5LabSession,B5_LAB_SUFFIX,defaultLabConfig,makeLabWorld,labActiveTarget,type LabConfig} from './B5Lab';
import type {LabRequest} from './b5Lab.worker';
import type {FormalWorld} from '../formal/model';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {DeveloperControls} from '../presentation/DeveloperControls';
import {TargetIntelContext} from '../presentation/targetIntel';
import {readFileSync} from 'node:fs';
const mapProps=vi.hoisted(()=>({current:null as any,real:false}));
vi.mock('../FormalWorldMap',async importOriginal=>{const {default:RealMap}=await importOriginal<typeof import('../FormalWorldMap')>();return {default:(props:any)=>{mapProps.current=props;return mapProps.real?<RealMap {...props}/>:<MapProbe world={props.world}/>;}};});
vi.mock('../presentation/DemoMapCache',()=>({mapImage:(src:string)=>({src,complete:true,naturalWidth:1536,naturalHeight:1024,addEventListener(){},removeEventListener(){}}),mapSession:()=>({terrain:{revision:0,cache:new Map(),onChange(){},setTextures(){},pump(){}},scenery:{revision:0,cache:new Map(),pending:new Map(),assetsReady(){},beginFrame(){},draw(){},pump:()=>0}}),drawTerrain:vi.fn()}));
function MapProbe({world}:{world:FormalWorld}){const read=useContext(TargetIntelContext),[result,setResult]=useState('');return <button onClick={()=>void read(world,labActiveTarget(world)!.id).then(x=>setResult(JSON.stringify(x)))}>測試情報來源{result}</button>;}
let root:Root|undefined,container:HTMLDivElement,worker:TestWorker,locked=false,openOverride:Partial<LabConfig>|undefined;
class TestWorker {
 onmessage:((e:{data:any})=>void)|null=null;onerror:((e:any)=>void)|null=null;
 requests:LabRequest[]=[];session=new B5LabSession(B5_LAB_SUFFIX+'-ui-'+crypto.randomUUID());queue=Promise.resolve();
 constructor(url:URL){expect(url.pathname).toContain('b5Lab.worker.ts');worker=this;}
 emit(data:unknown){this.onmessage?.({data});}
 postMessage(r:LabRequest){this.requests.push(r);this.queue=this.queue.then(async()=>{
  try{
   if(r.type==='open'||r.type==='reset')await this.session[r.type](r.type==='open'?{...r.config,...openOverride}:r.config);
   else if(r.type==='order')await this.session.order(r.payload);
   else if(r.type==='incoming')await this.session.incoming(r.targetCityId,r.mission,r.units);
   else if(r.type==='advance')await this.session.advance(r.worldMs);
   else if(r.type==='reload')await this.session.reload();
   else if(r.type==='reportPage'){this.emit({type:'reportPage',data:await this.session.store.readReportPage(this.session.world!,r.page,r.filter)});return;}
   else if(r.type==='reportAction'){this.emit({type:'reportStatus',data:await this.session.store.reportAction(this.session.world!,r.action,r.ids,r.filter)});return;}
   else if(r.type==='cityIntel'){this.emit({type:'cityIntel',queryId:r.queryId,data:await this.session.store.readCityIntel(this.session.world!,r.cityId,r.generation)});return;}
   this.emit({type:'state',world:structuredClone(this.session.world)});this.emit({type:'reportStatus',data:await this.session.store.reportStatus(this.session.world!)});
  }catch(e){this.emit({type:'error',text:String(e)});}finally{this.emit({type:'done',requestId:r.requestId});}
 });}
 terminate(){this.onmessage=null;this.session.close();}
}
const base=()=>makeLabWorld(defaultLabConfig(4321,'civ_zhongguo'));
async function mount(node:React.ReactNode){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',TestWorker);Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name:string,_opts:unknown,fn:(l:unknown)=>Promise<void>)=>fn(locked?null:{})}});container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root!.render(node));}
async function settle(){await act(async()=>{await worker.queue;});}
const button=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
async function click(text:string){await act(async()=>button(text).click());await settle();}
async function input(label:string,value:string){const n=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(n,value);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));});}
async function select(label:string,value:string){const n=container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;await act(async()=>{n.value=value;n.dispatchEvent(new Event('change',{bubbles:true}));});}
afterEach(async()=>{if(root){await act(async()=>root!.unmount());root=undefined;}container?.remove();if(worker)await worker.session.store.db.delete();locked=false;openOverride=undefined;mapProps.real=false;document.querySelectorAll("style[data-lab-qa]").forEach(n=>n.remove());vi.restoreAllMocks();vi.unstubAllGlobals();});
for(const mobile of [false,true])it(`${mobile?'mobile':'desktop'}: AI selection, presets, walls, siege, finite stock and real scout command work through the isolated client`,async()=>{
 await mount(<B5BattleLab base={base()} mobile={mobile} onClose={vi.fn()}/>);await settle();expect(container.querySelector('.b5-lab')!.classList.contains('mobile')).toBe(mobile);expect(container.querySelectorAll('select[aria-label="AI 測試目標"] option')).toHaveLength(99);expect(container.querySelectorAll('select[aria-label="敵城城牆等級"] option')).toHaveLength(16);
 await select('測試情境','counter');await select('AI 測試目標','city:053');await input('敵城金庫存','8765');await click('套用／重置測試情境');expect(labActiveTarget(worker.session.world!)!.id).toBe('city:053');expect(labActiveTarget(worker.session.world!)!.stock.gold).toBe(8765);expect(labActiveTarget(worker.session.world!)!.military!.units.scout).toBe(5);expect(container.querySelector('select[aria-label="偵察情報類型"]')).toBeNull();
 await input('本次派遣兵力 · 斥候','10');await click('下達偵察命令');const order=worker.requests.findLast(r=>r.type==='order');expect(order).toMatchObject({type:'order',payload:{type:'army.dispatch',mission:'scout',units:{scout:10},target:{cityId:'city:053'}}});expect(worker.session.world!.armies).toHaveLength(1);expect(container.textContent).toContain('BattleId');await click('下一行軍／戰鬥事件');expect(worker.session.world!.armies[0].pendingIntel!.resources!.gold).toBeGreaterThanOrEqual(8765);await click('存檔重讀');await click('下一行軍／戰鬥事件');await click('正式戰報');await settle();expect(container.querySelector('.report-symbol.scout')).not.toBeNull();expect(container.querySelector('time')!.dateTime).toMatch(/^20/);expect(container.textContent).toContain('偵察情報送達');
});
it('map uses lab world and its own intel provider, and editing pending target never silently retargets live orders',async()=>{
 const original=vi.fn().mockRejectedValue(Error('must never query normal campaign'));await mount(<TargetIntelContext.Provider value={original}><B5BattleLab base={base()} mobile={false} onClose={vi.fn()}/></TargetIntelContext.Provider>);await settle();const target=labActiveTarget(worker.session.world!)!.id;await select('AI 測試目標','city:053');await click('下達掠奪命令');expect(worker.requests.findLast(r=>r.type==='order')).toMatchObject({payload:{target:{cityId:target}}});await click('測試地圖');expect(mapProps.current.combatOnly).toBe(true);expect(mapProps.current.world.campaignId).toBe(worker.session.world!.campaignId);await click('測試情報來源');expect(original).not.toHaveBeenCalled();expect(worker.requests.findLast(r=>r.type==='cityIntel')).toMatchObject({campaignId:worker.session.world!.campaignId,cityId:target});
});
it('user-triggered incoming and 200X setup are explicit commands; close returns without changing the base',async()=>{
 const w=base(),before=structuredClone(w),close=vi.fn();await mount(<B5BattleLab base={w} mobile onClose={close}/>);await settle();await select('測試世界速度','200');await click('套用／重置測試情境');expect(container.textContent).toContain('200X');expect(container.textContent).toContain('戰術倍率 10X');await click('模擬一次敵軍掠奪');expect(worker.session.world!.armies[0].ownerFactionId).not.toBe(worker.session.world!.playerFactionId);await click('返回原戰役');expect(close).toHaveBeenCalledOnce();expect(w).toEqual(before);
});
it('another-tab lock blocks opening a second writer with a visible error',async()=>{locked=true;await mount(<B5BattleLab base={base()} mobile onClose={vi.fn()}/>);expect(container.textContent).toContain('另一個分頁');expect(container.querySelector('form')).toBeNull();});
it('entry appears only inside enabled developer mode and is disabled while the normal worker is busy',async()=>{
 const w=base(),open=vi.fn();await mount(<DeveloperControls world={w} city={w.cities[0]} issue={vi.fn()} busy={false} onBattleLab={open}/>);await act(async()=>button('B5 戰鬥測試台').click());expect(open).toHaveBeenCalledOnce();await act(async()=>root!.render(<DeveloperControls world={w} city={w.cities[0]} issue={vi.fn()} busy onBattleLab={open}/>));expect(button('B5 戰鬥測試台').disabled).toBe(true);w.developer!.enabled=false;await act(async()=>root!.render(<DeveloperControls world={w} city={w.cities[0]} issue={vi.fn()} busy={false} onBattleLab={open}/>));expect(button('B5 戰鬥測試台')).toBeUndefined();
});

it('resuming a lab from another campaign uses the stored player civilization rather than the base campaign unit choices',async()=>{openOverride={civilizationId:'civ_japan',playerUnits:{militia:10,'guard.civ_japan':2}};await mount(<B5BattleLab base={base()} mobile onClose={vi.fn()}/>);await settle();expect(container.querySelector('input[aria-label="玩家測試兵力與攻城器 · '+UNIT_CATALOG['guard.civ_japan'].name+'"]')).not.toBeNull();expect(container.querySelector('input[aria-label="玩家測試兵力與攻城器 · '+UNIT_CATALOG['guard.civ_zhongguo'].name+'"]')).toBeNull();});

for(const mobile of [false,true])it(`${mobile?'mobile':'desktop'}: real lab map fills its viewport and keeps scale and tools in the formal presentation context`,async()=>{
 mapProps.real=true;
 const style=document.createElement('style');style.dataset.labQa='';style.textContent=['src/game/developer/b5Lab.css','src/game/presentation/parity.css','src/game/game.css'].map(p=>readFileSync(p,'utf8')).join('\n');document.head.append(style);
 const width=mobile?350:1000,frames=new Map<number,FrameRequestCallback>();let id=0;
 vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.set(++id,f);return id;});vi.stubGlobal('cancelAnimationFrame',(n:number)=>frames.delete(n));vi.stubGlobal('matchMedia',()=>({matches:true}));
 vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:width,bottom:500,width,height:500,toJSON(){}});
 vi.stubGlobal('ResizeObserver',class{constructor(private cb:ResizeObserverCallback){}observe(){this.cb([],this as unknown as ResizeObserver);}disconnect(){}});
 const ctx=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:(o,k,v)=>{Reflect.set(o,k,v);return true;}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext);
 await mount(<B5BattleLab base={base()} mobile={mobile} onClose={vi.fn()}/>);await settle();await click('測試地圖');
 await act(async()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(1000));});
 const map=container.querySelector<HTMLElement>('.formal-world-map')!,scale=map.querySelector<HTMLElement>('.formal-map-scale')!,overlay=map.querySelector<HTMLCanvasElement>('.map-overlay')!,background=map.querySelector<HTMLCanvasElement>('.map-background')!;
 expect(map.closest('.formal-shell')).not.toBeNull();expect(!!map.closest('.mobile-layout')).toBe(mobile);
 expect(getComputedStyle(map).height).toBe('100%');expect(getComputedStyle(map).width).toBe('100%');expect(getComputedStyle(overlay).position).toBe('absolute');expect(overlay.width).toBe(width);expect(overlay.height).toBe(500);expect(background.width).toBe(overlay.width);expect(background.height).toBe(overlay.height);expect(overlay.dataset.camera).toBeDefined();
 expect(getComputedStyle(scale).position).toBe('absolute');expect(getComputedStyle(scale).marginTop).not.toBe('8px');expect(scale.textContent).toContain('384×384');
 const tools=map.querySelector<HTMLElement>('.map-tools')!,extra=map.querySelector<HTMLElement>('.map-extra-tools')!;
 expect(getComputedStyle(tools).width).toBe(mobile?'76px':'112px');expect(getComputedStyle(extra).display).toBe(mobile?'none':'flex');
 if(mobile){await act(async()=>map.querySelector<HTMLButtonElement>('[aria-label="展開地圖工具"]')!.click());expect(getComputedStyle(extra).display).toBe('flex');}
 expect(container.textContent).toContain('獨立測試存檔');expect(worker.requests.filter(r=>r.type==='order')).toHaveLength(0);
});
