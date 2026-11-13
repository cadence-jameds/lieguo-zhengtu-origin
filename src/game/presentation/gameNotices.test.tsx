// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {GameNotices} from './GameNotices';
import {healthySave,type SaveStatus} from '../saveStatus';
it('renders one safe compact notice and keeps distinct persistent save recovery after dismissal and time',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.useFakeTimers();const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSave=vi.fn(),onDismiss=vi.fn();
 const render=async(status:SaveStatus)=>act(async()=>root.render(<GameNotices text={'[{"code":"invalid_type","path":["savedAt"]}]'} error onDismiss={onDismiss} saveStatus={status} onSave={onSave} onReload={()=>{}} onBackup={()=>{}}/>));
 try{await render(healthySave);expect(document.body.textContent).not.toContain('invalid_type');expect(document.querySelectorAll('.game-notice-region .toast')).toHaveLength(1);await render({...healthySave,state:'blocked',code:'SAVE_BLOCKED'});expect(document.body.textContent).toContain('目前無法保存進度');expect(document.querySelectorAll('.game-notice-region .toast')).toHaveLength(2);await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="收合保存提示"]')!.click());await act(async()=>vi.advanceTimersByTimeAsync(60000));expect(document.body.textContent).toContain('保存需要處理');await act(async()=>document.querySelector<HTMLButtonElement>('.notice-reopen')!.click());await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('.notice-actions button')].find(b=>b.textContent==='重試保存')!.click());expect(onSave).toHaveBeenCalledOnce();expect(document.body.textContent).not.toContain('已恢復保存');await render({...healthySave,state:'recovered'});expect(document.body.textContent).toContain('遊戲進度已恢復保存');await act(async()=>vi.advanceTimersByTimeAsync(2001));expect(document.body.textContent).not.toContain('遊戲進度已恢復保存');}finally{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();}
});
