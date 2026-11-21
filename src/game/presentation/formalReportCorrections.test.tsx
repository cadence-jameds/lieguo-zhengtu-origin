// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {arrive,battlefield,dispatch} from '../formal/combatTestSupport';
import {sanitizeScoutReport} from '../formal/reportScope';
import {BattleReportBody} from './BattleReportBody';
import {FormalReportsView} from './FormalReportsView';

const counterScout=(playerDefends:boolean)=>{
 const w=battlefield(),source=playerDefends?1:0,target=playerDefends?0:1;
 w.cities[source].military!.units={scout:5};
 w.cities[target].military!.units={scout:5,militia:777};
 return arrive(dispatch(w,'scout',{scout:5},source,target).world);
};

it('shows a defender’s successful counter-scout result at both report levels and preserves its historical target',()=>{
 const {world,reports:[r]}=counterScout(true),p=r.battle!;
 expect(p.outcome).toBe('scout-failed');
 expect(p.intel).toBeUndefined();
 expect(sanitizeScoutReport(world,r)).toBe(r);
 expect(sanitizeScoutReport(world,{...r,title:'偵察失敗'}).title).toBe('反偵察成功｜'+p.targetName);
 const html=renderToStaticMarkup(<BattleReportBody battle={p} world={world} report={r}/>);
 expect(html).toContain('反偵察成功');
 expect(html).not.toContain('偵察失敗');
 expect(html).not.toContain('主戰');
 expect(html).not.toContain('777');
 expect(html).not.toContain('偵察快照');
 expect(html).toContain('5／2');
});

it('keeps an attacker’s failed-scout perspective and does not disclose the target army',()=>{
 const {world,reports:[r]}=counterScout(false),p=r.battle!;
 expect(p.outcome).toBe('scout-failed');
 expect(p.defenders[0].before).toEqual({});
 const html=renderToStaticMarkup(<BattleReportBody battle={p} world={world} report={r}/>);
 expect(html).toContain('偵察失敗');
 expect(html).not.toContain('反偵察成功');
 expect(html).not.toContain('777');
 expect(html).not.toContain('偵察快照');
 expect(html).not.toContain('主戰');
 expect(html).toContain('未取得情報');
 expect(html).not.toContain('0／0');
});

let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();root=undefined;host=undefined;vi.unstubAllGlobals();});
it('marks all messages read from a filtered tab without changing the filter used for clearing',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const {world,reports:[r]}=counterScout(true),send=vi.fn();
 await act(async()=>root!.render(<FormalReportsView world={world} busy={false} rows={[r]} data={{filter:'battle',page:0,count:1}}
  epoch={0} status={{unread:2,counts:{all:2,battle:1,diplomacy:1,chronicle:0}}} send={send} initialFilter="battle" onMap={()=>{}}/>));
 const click=async(text:string)=>{const button=[...host!.querySelectorAll('button')].find(b=>b.textContent===text);expect(button).toBeDefined();await act(async()=>button!.click());};
 await click('全部已讀');
 expect(send).toHaveBeenCalledWith({type:'reportAction',action:'read',ids:undefined,filter:'all'});
 await click('清除此分類');
 await click('確認清除');
 expect(send).toHaveBeenCalledWith({type:'reportAction',action:'clear',ids:undefined,filter:'battle'});
});
