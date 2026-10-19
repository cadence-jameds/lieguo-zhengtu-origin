// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {battlefield,dispatch} from '../formal/combatTestSupport';
import {Shell,type View} from './Shell';
import {ArmyView} from './DevelopmentViews';

it('C8 alert selects its target city and explicitly requests march, with no preselected enemy dispatch',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let w=battlefield();w.cities[1].military!.units={militia:20};w=dispatch(w,'raid',{militia:10},1,0).world;
 const host=document.createElement('div'),root=createRoot(host),city=w.cities[0];document.body.append(host);const calls:unknown[]=[];
 try{
  await act(async()=>root.render(<Shell world={w} city={city} cities={[city]} mobile view="city" onView={(v:View,entry?:'march')=>calls.push(['view',v,entry])} onCity={id=>calls.push(['city',id])} onHome={()=>{}} onResource={()=>{}} onMore={()=>{}} moreOpen={false} busy={false}><span>目前頁面</span></Shell>));
  await act(async()=>{(host.querySelector('.global-incoming>button') as HTMLButtonElement).click();});
  await act(async()=>{(host.querySelector('.global-incoming li button') as HTMLButtonElement).click();});
  expect(calls).toEqual([['city',city.id],['view','army','march']]);
  const rendered=document.createElement('div');rendered.innerHTML=renderToStaticMarkup(<ArmyView world={w} city={city} issue={()=>{}} busy={false} mobile initialMarch/>);
  expect(rendered.querySelector('.army-tabs button[aria-pressed="true"]')?.textContent).toContain('行軍');
  expect(rendered.querySelector('.dispatch-view')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
