// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {LocalCampaignManager} from './LocalCampaignManager';
import {deleteLocalCampaigns,inspectLocalCampaigns} from './storageRecovery';
vi.mock('./storageRecovery',()=>({inspectLocalCampaigns:vi.fn(async()=>[{name:'lieguo-formal-bounded-v1',label:'現行正式戰役',scope:'全部戰役資料',state:'present',tables:{saves:1}}]),exportSelectedCampaigns:vi.fn(),deleteLocalCampaigns:vi.fn()}));
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
it('starts unselected, requires confirmation, and cancellation never invokes deletion',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const el=document.createElement('div');document.body.append(el);const root=createRoot(el),suspend=vi.fn(async()=>{}),complete=vi.fn();
 await act(async()=>root.render(<LocalCampaignManager suspend={suspend} onClose={()=>{}} onComplete={complete}/>));expect(suspend).toHaveBeenCalledOnce();expect((el.querySelector('input') as HTMLInputElement).checked).toBe(false);
 const button=(text:string)=>[...el.querySelectorAll('button')].find(b=>b.textContent===text)!;
 expect(button('刪除／重設所選戰役').disabled).toBe(true);await act(async()=>el.querySelector('input')!.click());await act(async()=>button('刪除／重設所選戰役').click());expect(el.textContent).toContain('刪除後無法復原');await act(async()=>button('取消，保留全部資料').click());expect(deleteLocalCampaigns).not.toHaveBeenCalled();
 vi.mocked(deleteLocalCampaigns).mockResolvedValue([{name:'lieguo-formal-bounded-v1',state:'failed',text:'blocked：未刪除'}]);await act(async()=>button('刪除／重設所選戰役').click());await act(async()=>button('確認永久刪除所選資料').click());expect(el.textContent).toContain('blocked：未刪除');expect(complete).not.toHaveBeenCalled();expect(inspectLocalCampaigns).toHaveBeenCalled();
 vi.mocked(deleteLocalCampaigns).mockResolvedValue([{name:'lieguo-formal-bounded-v1',state:'uncertain',text:'等待重新檢查'}]);await act(async()=>button('刪除／重設所選戰役').click());await act(async()=>button('確認永久刪除所選資料').click());expect(el.textContent).toContain('可重試或返回首頁');expect(complete).not.toHaveBeenCalled();await act(async()=>root.unmount());vi.unstubAllGlobals();
});
