// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {GovernorControls,GovernanceView} from './GovernanceView';
import {make,build} from '../formal/developmentTestSupport';
it('real governor controls send Formal command and forbid enemy city controls',async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const w=make(),c=w.cities[0];build(c,'townhall',1);const issue=vi.fn(),host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(async()=>root.render(<GovernorControls world={w} city={c} issue={issue} busy={false}/>));const button=[...host.querySelectorAll('button')].find(b=>b.textContent==='委任總督')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'governance.set',cityId:c.id,enabled:true,policy:'balanced',budget:2400,reserve:180});expect(renderToStaticMarkup(<GovernorControls world={w} city={w.cities[1]} issue={issue} busy={false}/>)).toBe('');}finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}});
it('governance view renders only owned cities and all five policy options',()=>{const w=make();build(w.cities[0],'townhall',1);const html=renderToStaticMarkup(<GovernanceView world={w} issue={vi.fn()} busy={false}/>);for(const label of ['均衡','經濟','人口','軍事','資源儲備','每世界小時支出上限'])expect(html).toContain(label);expect(html).toContain(w.cities[0].name);expect(html).not.toContain(w.cities[1].name);});
