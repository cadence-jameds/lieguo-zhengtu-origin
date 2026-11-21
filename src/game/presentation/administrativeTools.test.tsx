// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {battlefield} from '../formal/combatTestSupport';
import {build} from '../formal/developmentTestSupport';
import {ADMIN_COORDINATION,TERRITORY_REGISTER,templateKey,getTemplates} from '../administration';
import {AdministrativeTools,type ApplyGovernanceTemplate} from './AdministrativeTools';
it('gates both tools independently and saves a campaign-local preset without issuing commands',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();
 const w=battlefield(),player=w.factions.find(f=>f.id===w.playerFactionId)!,[home,foreign]=w.cities,host=document.createElement('div');document.body.append(host);
 build(home,'townhall',1);build(foreign,'townhall',1);
 let root=createRoot(host);
 const applyTemplate=vi.fn<ApplyGovernanceTemplate>().mockResolvedValue([{cityId:home.id,status:'applied'}]);
 const render=async()=>act(async()=>root.render(<AdministrativeTools world={{...w}} busy={false} applyTemplate={applyTemplate}/>));
 try{
  await render();expect(host.textContent).toBe('');
  player.techIds=[ADMIN_COORDINATION];
  await render();expect(host.textContent).toContain('治理範本');expect(host.textContent).not.toContain('跨城告警');
  const findButton=(name:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===name)!;
  const input=host.querySelector<HTMLInputElement>('input[maxlength="24"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'晚間');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>findButton('儲存範本').click());
  expect(getTemplates(localStorage,templateKey(w))).toMatchObject([{name:'晚間',policy:'balanced'}]);expect(applyTemplate).not.toHaveBeenCalled();
  await act(async()=>root.unmount());root=createRoot(host);
  await render();const select=host.querySelector<HTMLSelectElement>('select')!;
  expect(Array.from(select.options).map(v=>v.text)).toContain('晚間');
  await act(async()=>{select.value='晚間';select.dispatchEvent(new Event('change',{bubbles:true}));});
  const boxes=host.querySelectorAll<HTMLInputElement>('input[type=checkbox]');expect(boxes).toHaveLength(1);
  await act(async()=>boxes[0].click());
  await act(async()=>findButton('將所選範本套用到 1 城').click());
  expect(applyTemplate).toHaveBeenCalledWith([home.id],expect.objectContaining({name:'晚間'}));expect(host.textContent).toContain('已套用');
  player.techIds=[TERRITORY_REGISTER];await render();expect(host.textContent).not.toContain('治理範本');expect(host.textContent).toContain('跨城告警');
  expect(applyTemplate).toHaveBeenCalledTimes(1);
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();}
});
