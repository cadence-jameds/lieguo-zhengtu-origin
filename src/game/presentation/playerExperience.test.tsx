// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ProtectionStatus} from './ProtectionStatus';
import {CommandFailure} from './CommandFailure';
import {Home} from '../FormalHome';
import {createFormalWorld} from '../formal/generator';
import {displayClock} from './liveClock';
import type {CommandView} from '../useGame';
async function mount(){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);return {host,root,close:async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}};}
it('shield ticks in real seconds at campaign speed, details close outside/Escape, rebirth/early end/expiry hide without mutating authority',async()=>{
 const m=await mount(),w=createFormalWorld({campaign:'shield-compact',seed:90217,speed:25}),before=JSON.stringify(w);displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:25,running:true});
 try{await act(async()=>m.root.render(<ProtectionStatus world={w}/>));expect(m.host.textContent).toContain('新手保護 01:55:12');expect(m.host.querySelector('.protection-details')).toBeNull();await act(async()=>{displayClock.adopt({campaignId:w.campaignId,time:w.time+25000,speed:25,running:true});});expect(m.host.textContent).toContain('01:55:11');expect(JSON.stringify(w)).toBe(before);
 await act(async()=>m.host.querySelector('button')!.click());expect(m.host.textContent).toContain('剩餘世界時間');expect(m.host.textContent).toContain('剩餘現實時間');expect(m.host.textContent).toContain('主動宣戰');await act(async()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));expect(m.host.querySelector('.protection-details')).toBeNull();await act(async()=>m.host.querySelector('button')!.click());await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));expect(m.host.querySelector('.protection-details')).toBeNull();
 const reborn=structuredClone(w);reborn.factions[0].protectionKind='rebirth';await act(async()=>m.root.render(<ProtectionStatus world={reborn}/>));expect(m.host.textContent).toContain('復國保護');reborn.factions[0].protectionUntil=w.time;await act(async()=>m.root.render(<ProtectionStatus world={{...reborn}}/>));expect(m.host.textContent).toBe('');const ended=structuredClone(w);ended.time=ended.factions[0].protectionUntil!;displayClock.stop();await act(async()=>m.root.render(<ProtectionStatus world={ended}/>));expect(m.host.textContent).toBe('');expect(JSON.stringify(w)).toBe(before);
 }finally{displayClock.stop();await m.close();}
});
it('normal durable states never show player command management; actionable failures retain same-order retry and reload',async()=>{
 const m=await mount(),onQuery=vi.fn(),onRetry=vi.fn(),onReload=vi.fn(),w=createFormalWorld({campaign:'failure-presentation',seed:90217}),row={commandId:'command:ui',order:{commandId:'command:ui',campaignId:w.campaignId,payload:{type:'city.rename',cityId:w.cities[0].id,name:'新城'}}} as CommandView;
 const render=async(state:CommandView['state'])=>act(async()=>m.root.render(<CommandFailure rows={[{...row,state}]} onQuery={onQuery} onRetry={onRetry} onReload={onReload}/>));
 try{for(const s of ['created','pending','retryable','committed','rejected'] as const){await render(s);expect(m.host.textContent).toBe('');}await render('receive-failed');expect(m.host.textContent).toContain('城市改名');expect(m.host.textContent).not.toContain('收件匣');await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.textContent==='重試這次操作')!.click());expect(onRetry).toHaveBeenCalledWith({...row,state:'receive-failed'});await render('pending');expect(m.host.textContent).toBe('');await render('blocked');await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.textContent==='重新載入並恢復')!.click());expect(onReload).toHaveBeenCalledOnce();await render('needs-confirmation');expect(m.host.textContent).toContain('重新下令');await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.textContent==='返回確認操作')!.click());expect(m.host.textContent).toBe('');expect(onRetry).toHaveBeenCalledOnce();}finally{await m.close();}
});
it('storage manager is an independent home action even during failure/busy, never inside settings',async()=>{
 const m=await mount(),onManageStorage=vi.fn();try{await act(async()=>m.root.render(<Home world={null} loading={false} busy error="世界引擎無法啟動" theme="classic" onThemeChange={()=>{}} onNew={()=>{}} onStart={()=>{}} onRetry={()=>{}} onExport={()=>{}} onImport={()=>{}} onManageStorage={onManageStorage}/>));const rows=m.host.querySelector('.home-entry-actions')!;expect([...rows.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['開始遊戲','載入進度','⚙ 設定','管理本機戰役存檔']);const button=m.host.querySelector<HTMLButtonElement>('.home-storage-button')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(onManageStorage).toHaveBeenCalledOnce();await act(async()=>m.host.querySelector<HTMLButtonElement>('.home-settings-button')!.click());expect(m.host.querySelector('dialog')!.textContent).not.toContain('管理本機戰役存檔');}finally{await m.close();}
});
