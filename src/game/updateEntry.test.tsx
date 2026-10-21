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
