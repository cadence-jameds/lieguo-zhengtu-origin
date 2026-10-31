// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,it,expect,vi} from 'vitest';
import {RebirthView} from './ExtinctionView';
import {ProtectionStatus} from './ProtectionStatus';
import {createFormalWorld} from '../formal/generator';
import {changeCityOwner,HOUR} from '../formal/economy';
import {EventScheduler} from '../formal/scheduler';
import {resolveExtinctions,rebirthCandidates} from '../formal/extinction';
vi.mock('../FormalWorldMap',()=>({default:({onRebirthPoint}:{onRebirthPoint:(p:{x:number;y:number})=>void})=><button onClick={()=>onRebirthPoint({x:100,y:101})}>測試大地圖選址</button>}));
const hosts:HTMLElement[]=[];afterEach(()=>{for(const h of hosts.splice(0))h.remove();});
function dead(){const w=createFormalWorld({campaign:'defeat-ui',seed:90217});changeCityOwner(w,w.cities[0],w.factions[1].id,'conquest');const s=new EventScheduler(w.events);resolveExtinctions(w,s);w.events=s.snapshot();return w;}
async function mount(){const w=dead(),issue=vi.fn(),onHome=vi.fn(),onReports=vi.fn(),onLoad=vi.fn(),onExport=vi.fn(),onNew=vi.fn(),host=document.createElement('div');document.body.append(host);hosts.push(host);const root=createRoot(host);await act(async()=>root.render(<RebirthView world={w} issue={issue} busy={false} onHome={onHome} onReports={onReports} onLoad={onLoad} onExport={onExport} onNew={onNew}/>));return{w,issue,onHome,onReports,onLoad,onExport,onNew,host,root};}
const button=(host:HTMLElement,text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
const click=async(b:HTMLElement)=>act(async()=>b.click());
it('all defeat operations preserve the frozen save; ending needs a second click and can be cancelled',async()=>{
 const m=await mount();for(const [label,fn] of [['閱讀敗北戰報',m.onReports],['返回首頁',m.onHome],['匯出本局紀錄',m.onExport],['載入其他存檔',m.onLoad],['開始新戰役',m.onNew]] as const){await click(button(m.host,label));expect(fn).toHaveBeenCalledOnce();}
 await click(button(m.host,'結束本局'));expect(m.issue).not.toHaveBeenCalled();expect(m.host.textContent).toContain('存檔與戰史會保留');await click(button(m.host,'取消'));expect(m.issue).not.toHaveBeenCalled();await click(button(m.host,'結束本局'));await click(button(m.host,'確認結束本局'));expect(m.issue.mock.calls[0][0].type).toBe('player.end');await act(async()=>m.root.unmount());
});
it('candidate and map shortcuts only preview; invalid XY cannot submit, and confirmation uses exact chosen coordinates',async()=>{
 const m=await mount();await click(button(m.host,'流亡復國'));const confirm=()=>button(m.host,'確認復國位置');expect(confirm().disabled).toBe(true);const p=rebirthCandidates(m.w)[0];await click([...m.host.querySelectorAll('button')].find(b=>b.textContent?.includes('候選區域 1'))!);expect(m.issue).not.toHaveBeenCalled();await click(confirm());expect(m.issue).not.toHaveBeenCalled();await click(button(m.host,'確認重建並恢復時間'));expect(m.issue.mock.calls[0][0]).toMatchObject({type:'player.rebirth',...p});
 await click(button(m.host,'在大地圖選擇位置'));await click(button(m.host,'測試大地圖選址'));expect((m.host.querySelector('[aria-label="復國 X 座標"]') as HTMLInputElement).value).toBe('100');expect((m.host.querySelector('[aria-label="復國 Y 座標"]') as HTMLInputElement).value).toBe('101');expect(m.issue).toHaveBeenCalledOnce();await act(async()=>m.root.unmount());
});
it('ended campaign has no rebirth or end controls and still provides record operations',()=>{
 const w=dead();w.extinction!.defeat!.ended=true;const html=renderToStaticMarkup(<RebirthView world={w} issue={()=>{}} busy={false} onHome={()=>{}} onReports={()=>{}} onLoad={()=>{}} onExport={()=>{}} onNew={()=>{}}/>);expect(html).toContain('本局已結束');expect(html).toContain('世界時間已停止');expect(html).not.toContain('>流亡復國<');expect(html).not.toContain('>結束本局<');for(const x of ['閱讀敗北戰報','返回首頁','匯出本局紀錄','載入其他存檔','開始新戰役'])expect(html).toContain(x);
});
it('protection shows both world/real duration and the stored early reason without mutating the world',()=>{
 const w=createFormalWorld({campaign:'shield-ui',seed:90217,speed:25}),before=structuredClone(w),html=renderToStaticMarkup(<ProtectionStatus world={w}/>);expect(html).toContain('新手保護中');expect(html).toContain('世界時間');expect(html).toContain('現實時間');expect(w).toEqual(before);w.time=48*HOUR;expect(renderToStaticMarkup(<ProtectionStatus world={w}/>)).toContain('保護已結束');w.factions[0].protectionUntil=w.time;w.factions[0].protectionEnded={at:w.time,reason:'偵察其他領主城市'};expect(renderToStaticMarkup(<ProtectionStatus world={w}/>)).toContain('提前解除：偵察其他領主城市');
});
