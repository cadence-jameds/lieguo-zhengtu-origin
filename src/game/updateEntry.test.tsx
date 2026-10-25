// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Home} from './FormalHome';
const props={theme:'dark' as const,onThemeChange:()=>{},world:null,busy:false,loading:false,onNew:()=>{},onStart:()=>{},onRetry:()=>{},onExport:()=>{},onImport:()=>{},updateAvailable:true,updateDisabled:true};
it('an unreadable campaign must never be described as absent',()=>{const html=renderToStaticMarkup(<Home {...props} error="正式存檔與回復點均無法讀取，資料保留。"/>);expect(html).not.toContain('尚無本機進度，請選擇開始新遊戲。');expect(html).toContain('資料保留');});
it('loading is not an empty campaign confirmation',()=>{const html=renderToStaticMarkup(<Home {...props} loading/>);expect(html).not.toContain('尚無本機進度，請選擇開始新遊戲。');expect(html).toContain('正在確認');});
it('confirmed empty campaign has a direct-update label instead of promising a nonexistent save',()=>{const extra={updateLabel:'載入新版',campaignStatus:'empty' as const};const html=renderToStaticMarkup(<Home {...props} {...extra}/>);expect(html).toContain('載入新版');expect(html).not.toMatch(/<button[^>]*>保存進度並載入新版<\/button>/);});

import {updateEligibility} from './updateEligibility';
const empty={status:'ready' as const,hasWorld:false,busy:false,updating:false,campaignStatus:'empty' as const};
it('only read-confirmed absence can bypass a save, including a failed empty engine',()=>{expect(updateEligibility(empty)).toMatchObject({disabled:false,code:'empty',label:'載入新版'});expect(updateEligibility({...empty,status:'error'}).disabled).toBe(false);for(const campaignStatus of ['checking','stored','incompatible','unreadable'] as const)expect(updateEligibility({...empty,campaignStatus}).disabled).toBe(true);});
it('loading, busy, locked and updating retain explicit blocking reasons even if old state was empty',()=>{for(const p of [{status:'loading' as const},{status:'locked' as const},{busy:true},{updating:true}]){const gate=updateEligibility({...empty,...p});expect(gate.disabled).toBe(true);expect(gate.reason.length).toBeGreaterThan(5);}});
it('an active campaign always requires saving and an active engine error stays blocked',()=>{expect(updateEligibility({...empty,hasWorld:true})).toMatchObject({code:'save',disabled:false,label:'保存進度並載入新版'});expect(updateEligibility({...empty,hasWorld:true,status:'error'})).toMatchObject({code:'engine-error',disabled:true});});
it('historical action is available but never supersedes active/error/loading/busy/locked gates',()=>{const archive={...empty,campaignStatus:'historical' as const};expect(updateEligibility(archive)).toMatchObject({code:'historical',disabled:false,label:'保留歷史資料並載入新版'});for(const p of [{status:'loading' as const},{status:'locked' as const},{busy:true},{updating:true},{hasWorld:true,status:'error' as const}])expect(updateEligibility({...archive,...p}).disabled).toBe(true);expect(updateEligibility({...archive,hasWorld:true})).toMatchObject({code:'save',label:'保存進度並載入新版'});});

import {act} from 'react';
import {createRoot} from 'react-dom/client';
it('history confirmation offers export and cancellation, and only explicit confirmation requests preservation',async()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const el=document.createElement('div');document.body.append(el);const root=createRoot(el),requests:(boolean|undefined)[]=[],exports:string[]=[];const render=async(disabled=false)=>act(async()=>root.render(<Home {...props} campaignStatus="historical" updateDisabled={disabled} updateLabel="保留歷史資料並載入新版" onExportRaw={()=>exports.push('raw')} onUpdate={confirmed=>requests.push(confirmed)}/>));const click=async(name:string,dialog=false)=>{const scope=dialog?el.querySelector('dialog')!:el;const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===name)!;expect(b).toBeTruthy();await act(async()=>b.click());};try{await render();await click('保留歷史資料並載入新版');expect(requests).toEqual([]);expect(el.querySelector('dialog')?.textContent).toContain('這不是戰役保存完成確認');await click('匯出本機原始備份',true);expect(exports).toEqual(['raw']);expect(requests).toEqual([]);await click('取消',true);expect(el.querySelector('dialog')).toBeNull();await click('保留歷史資料並載入新版');await render(true);expect([...el.querySelectorAll('dialog button')].find(b=>b.textContent==='確認保留並載入新版')?.hasAttribute('disabled')).toBe(true);await render();await click('確認保留並載入新版',true);expect(requests).toEqual([true]);expect(el.querySelector('dialog')).toBeNull();}finally{await act(async()=>root.unmount());el.remove();delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;}});

import {OLD_CAMPAIGN_MESSAGE} from './formal/saveCodec';
it('old-campaign new start is enabled only after the current namespace is confirmed empty and legacy is historical',()=>{
 for(const campaignStatus of ['historical','checking','stored','incompatible','unreadable','empty'] as const){
  const html=renderToStaticMarkup(<Home {...props} campaignStatus={campaignStatus} error={OLD_CAMPAIGN_MESSAGE} legacyAvailable onExportLegacy={()=>{}}/>),box=document.createElement('div');box.innerHTML=html;
  const start=[...box.querySelectorAll('button')].find(b=>b.textContent==='開始新遊戲')!;
  expect(start.disabled,campaignStatus).toBe(campaignStatus!=='historical');expect(html).toContain('匯出舊存檔備份');expect(html).not.toContain('尚無本機進度，請選擇開始新遊戲。');
 }
});

import {createFormalFixture} from './formal/fixture';
it('a failed active-campaign save keeps a read-only raw backup exit without claiming the latest save succeeded',()=>{const html=renderToStaticMarkup(<Home {...props} world={createFormalFixture()} campaignStatus="active" error="保存失敗" onExportRaw={()=>{}}/>);expect(html).toContain('匯出本機原始備份');expect(html).toContain('不代表本次保存成功');expect(html).toContain('重新讀取（保留資料）');});
