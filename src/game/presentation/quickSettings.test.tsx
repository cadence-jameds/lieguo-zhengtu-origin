// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {createFormalFixture} from '../formal/fixture';
import {QuickSettings,clampGear,readQuickPreference,QUICK_SETTINGS_KEY} from './QuickSettings';
import {CampaignSettings} from './CampaignSettings';
let root:Root|undefined,box:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;box?.remove();localStorage.clear();});
async function mount(node:React.ReactNode){box=document.createElement('div');document.body.append(box);root=createRoot(box);await act(async()=>root!.render(node));}
const click=async(el:Element)=>act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
it('sliders stage exact discrete values and cancel without issuing; apply submits only once with no premature success',async()=>{
 const w=createFormalFixture(),issue=vi.fn();await mount(<CampaignSettings world={w} cityId={w.cities[0].id} issue={issue} busy={false}/>);const [speed,offline]=box.querySelectorAll('input');
 await act(async()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;set.call(speed,'4');speed.dispatchEvent(new Event('input',{bubbles:true}));speed.dispatchEvent(new Event('change',{bubbles:true}));set.call(offline,'2');offline.dispatchEvent(new Event('input',{bubbles:true}));offline.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(issue).not.toHaveBeenCalled();await click([...box.querySelectorAll('button')].find(b=>b.textContent==='取消／關閉')!);expect(issue).not.toHaveBeenCalled();await click([...box.querySelectorAll('button')].find(b=>b.textContent==='套用並儲存')!);expect(issue).toHaveBeenCalledWith({type:'campaign.configure',cityId:w.cities[0].id,speed:1,offlineHours:12});expect(box.textContent).not.toContain('設定變更成功');
});
it('mouse/touch drag does not open settings; click does, hidden preference removes gear',async()=>{
 const w=createFormalFixture(),preference={visible:true,x:200,y:250},update=vi.fn();await mount(<QuickSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false} preference={preference} onPreference={update}/>);const gear=box.querySelector('button')!;gear.setPointerCapture=vi.fn();gear.releasePointerCapture=vi.fn();
 for(const pointerType of ['mouse','touch']){await act(async()=>{gear.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1,pointerType,clientX:200,clientY:250}));gear.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType,clientX:230,clientY:280}));gear.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType,clientX:230,clientY:280}));gear.click();});expect(box.querySelector('[role=dialog]')).toBeNull();}expect(update).toHaveBeenCalled();await click(gear);expect(box.querySelector('[role=dialog]')).not.toBeNull();await act(async()=>root!.render(<QuickSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false} preference={{...preference,visible:false}} onPreference={update}/>));expect(box.textContent).toBe('');
});
it('device preference survives reopen and bounds clamp across desktop/mobile resize without touching campaign',()=>{
 localStorage.setItem(QUICK_SETTINGS_KEY,JSON.stringify({visible:false,x:9999,y:9999}));expect(readQuickPreference().visible).toBe(false);for(const [width,height]of [[1440,900],[390,844],[320,568]]){const p=clampGear({visible:true,x:9999,y:9999},width,height);expect(p.x+44).toBeLessThanOrEqual(width);expect(p.y+44).toBeLessThanOrEqual(height-100);}expect(clampGear({visible:true,x:NaN,y:NaN},390,844).x).toBe(330);
});
it('developer mode visibly owns foreground speed, while normal settings remain editable',async()=>{
 const w=createFormalFixture();w.speed=25;w.developer={enabled:true,speed:100};await mount(<CampaignSettings world={w} cityId={w.cities[0].id} issue={vi.fn()} busy={false}/>);expect(box.textContent).toContain('目前由開發者模式控制世界速度（100X）');expect(box.textContent).toContain('目前已儲存：25X／12h');expect(box.querySelector('input')!.disabled).toBe(false);
});
