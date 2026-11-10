// @vitest-environment happy-dom
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Home} from './FormalHome';
import {Start} from './presentation/Start';
import {OLD_CAMPAIGN_MESSAGE} from './formal/saveCodec';
let root:Root,container:HTMLDivElement;
const start=vi.fn(),backup=vi.fn();
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);start.mockClear();backup.mockClear();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const click=async(text:string)=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text);expect(b).toBeDefined();await act(async()=>b!.click());};
function Entry({safe=true,error=OLD_CAMPAIGN_MESSAGE}:{safe?:boolean;error?:string}){
 const [fresh,setFresh]=useState(false);
 return fresh?<Start busy={false} hasSave incompatible onClose={()=>setFresh(false)} onStart={start}/>:<Home world={null} theme="light" onThemeChange={()=>{}} loading={false} busy={false} error={error} campaignStatus="incompatible" canReplaceIncompatible={safe} onExportRaw={backup} onNew={()=>setFresh(true)} onStart={()=>{}} onRetry={()=>{}} onExport={()=>{}} onImport={()=>{}}/>;
}
it('incompatible activity opens settings without backup; cancel never submits; explicit confirmation preserves selected parameters',async()=>{
 await act(async()=>root.render(<Entry/>));expect(container.textContent).toContain('或直接建立新戰役');await click('開始新遊戲');expect(container.textContent).toContain('選擇你的文明');
 await act(async()=>{const name=container.querySelector<HTMLInputElement>('#new-player-name')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(name,'新領主');name.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('升起旗幟 · 開始戰役');expect(container.querySelector('dialog')?.textContent).toContain('建立新戰役將取代目前活動戰役。舊版歷史資料不會自動轉換。');expect(start).not.toHaveBeenCalled();expect(backup).not.toHaveBeenCalled();
 await click('取消');expect(start).not.toHaveBeenCalled();expect(container.querySelector('dialog')).toBeNull();
 await click('升起旗幟 · 開始戰役');await click('確認建立新戰役');expect(start).toHaveBeenCalledTimes(1);expect(backup).not.toHaveBeenCalled();
});
it.each(['IndexedDB 無法讀取','世界 checksum 損毀','仍有未完成的持久命令'])('unsafe %s remains blocked instead of becoming an old-format override',async error=>{
 await act(async()=>root.render(<Entry safe={false} error={error}/>));const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='開始新遊戲')!;expect(button.disabled).toBe(true);await click('開始新遊戲');expect(start).not.toHaveBeenCalled();expect(container.textContent).toContain('本機進度無法讀取');
});
