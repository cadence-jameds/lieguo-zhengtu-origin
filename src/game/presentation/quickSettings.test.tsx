// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {createFormalFixture} from '../formal/fixture';
import {QuickSettings,clampGear,dockGear,readQuickPreference,QUICK_SETTINGS_KEY,type QuickPreference} from './QuickSettings';
import {CampaignSettings} from './CampaignSettings';
let root:Root|undefined,box:HTMLDivElement;
beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true));
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;box?.remove();localStorage.clear();vi.unstubAllGlobals();});
async function mount(node:React.ReactNode){box=document.createElement('div');document.body.append(box);root=createRoot(box);await act(async()=>root!.render(node));}
const click=async(el:Element)=>act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
it('sliders stage exact discrete values and cancel without issuing; apply submits only once with no premature success',async()=>{
 const w=createFormalFixture(),issue=vi.fn();await mount(<CampaignSettings world={w} cityId={w.cities[0].id} issue={issue} busy={false}/>);const [speed,offline]=box.querySelectorAll('input');
 await act(async()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;set.call(speed,'4');speed.dispatchEvent(new Event('input',{bubbles:true}));speed.dispatchEvent(new Event('change',{bubbles:true}));set.call(offline,'2');offline.dispatchEvent(new Event('input',{bubbles:true}));offline.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(issue).not.toHaveBeenCalled();await click([...box.querySelectorAll('button')].find(b=>b.textContent==='取消／關閉')!);expect(issue).not.toHaveBeenCalled();await click([...box.querySelectorAll('button')].find(b=>b.textContent==='套用並儲存')!);expect(issue).toHaveBeenCalledWith({type:'campaign.configure',cityId:w.cities[0].id,speed:1,offlineHours:12});expect(box.textContent).not.toContain('設定變更成功');
});
it('mouse/touch drag does not open settings; click does, hidden preference removes gear',async()=>{
 const w=createFormalFixture(),preference={visible:true,x:200,y:250},update=vi.fn();await mount(<QuickSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false} preference={preference} onPreference={update}/>);const gear=document.querySelector<HTMLButtonElement>('.quick-settings-gear')!;gear.setPointerCapture=vi.fn();gear.releasePointerCapture=vi.fn();
 for(const pointerType of ['mouse','touch']){await act(async()=>{gear.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1,pointerType,clientX:200,clientY:250}));gear.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType,clientX:230,clientY:280}));gear.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType,clientX:230,clientY:280}));gear.click();});expect(document.querySelector('[role=dialog]')).toBeNull();}expect(update).toHaveBeenCalled();await click(gear);expect(document.querySelector('[role=dialog]')).not.toBeNull();await act(async()=>root!.render(<QuickSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false} preference={{...preference,visible:false}} onPreference={update}/>));expect(document.querySelector('.quick-settings-gear')).toBeNull();
});
it('device preference survives reopen and bounds clamp across desktop/mobile resize without touching campaign',()=>{
 localStorage.setItem(QUICK_SETTINGS_KEY,JSON.stringify({visible:false,x:9999,y:9999}));expect(readQuickPreference().visible).toBe(false);for(const [width,height]of [[1440,900],[390,844],[320,568]]){const p=clampGear({visible:true,x:9999,y:9999},width,height);expect(p.x+44).toBeLessThanOrEqual(width);expect(p.y+44).toBeLessThanOrEqual(height);}expect(clampGear({visible:true,x:NaN,y:NaN},390,844).x).toBe(330);expect(clampGear({visible:true,x:-90,y:-90},390,844)).toMatchObject({x:0,y:0});
});
it('developer mode visibly owns foreground speed, while normal settings remain editable',async()=>{
 const w=createFormalFixture();w.speed=25;w.developer={enabled:true,speed:100};await mount(<CampaignSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false}/>);expect(box.textContent).toContain('目前由開發者模式控制世界速度（100X）');expect(box.textContent).toContain('目前已儲存：25X／12h');expect(box.querySelector('input')!.disabled).toBe(false);
});

it('docking uses the closest of four edges, preserves free positions, and restores docked preferences safely',()=>{
 for(const [x,y,edge] of [[0,300,'left'],[346,300,'right'],[170,0,'top'],[170,800,'bottom']] as const){
  const p=dockGear({visible:true,x,y},390,844);expect(p.edge).toBe(edge);
  localStorage.setItem(QUICK_SETTINGS_KEY,JSON.stringify(p));expect(readQuickPreference().edge).toBe(edge);
  const small=clampGear(p,320,568);expect(small.x).toBeGreaterThanOrEqual(0);expect(small.y).toBeGreaterThanOrEqual(0);expect(small.x+44).toBeLessThanOrEqual(320);expect(small.y+44).toBeLessThanOrEqual(568);
 }
 expect(dockGear({visible:true,x:170,y:300},390,844).edge).toBeUndefined();
 expect(clampGear({visible:true,x:10,y:10,edge:'invalid' as any},390,844).edge).toBeUndefined();
});
it('a tucked handle first unfolds, then opens settings; cancelled drags cannot open or submit commands',async()=>{
 const w=createFormalFixture(),issue=vi.fn();
 function Harness(){const [p,setP]=useState<QuickPreference>({visible:true,x:0,y:250,edge:'left'});return <QuickSettings world={w} cityId={w.cities[0].id} issue={issue} busy={false} preference={p} onPreference={setP}/>;}
 await mount(<Harness/>);const gear=document.querySelector<HTMLButtonElement>('.quick-settings-gear')!;
 expect(gear.dataset.edge).toBe('left');expect(gear.querySelector('svg')).not.toBeNull();expect(gear.textContent).not.toContain('⚙');
 await click(gear);expect(gear.dataset.edge).toBeUndefined();expect(document.querySelector('[role=dialog]')).toBeNull();
 gear.setPointerCapture=vi.fn();
 await act(async()=>{gear.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:2}));gear.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:2}));gear.click();});
 expect(document.querySelector('[role=dialog]')).toBeNull();expect(issue).not.toHaveBeenCalled();
 await click(gear);expect(document.querySelector('[role=dialog]')).not.toBeNull();
});
it('floating controls escape page stacking and stay within the active native modal boundary',async()=>{
 const w=createFormalFixture();await mount(<QuickSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false} preference={{visible:true,x:100,y:20}} onPreference={vi.fn()}/>);
 expect(document.querySelector('.quick-settings-gear')!.parentElement).toBe(document.body);
 const dialog=document.createElement('dialog');
 await act(async()=>{dialog.setAttribute('open','');document.body.append(dialog);});
 expect(dialog.querySelector('.quick-settings-gear')).not.toBeNull();
 await act(async()=>dialog.remove());expect(document.querySelector('.quick-settings-gear')!.parentElement).toBe(document.body);
});
