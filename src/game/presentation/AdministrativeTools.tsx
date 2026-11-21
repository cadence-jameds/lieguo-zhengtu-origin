import {useState} from 'react';
import type {WorldRead} from '../presentationModel';
import type {CityId} from '../formal/ids';
import {GOVERNANCE_POLICIES,GOVERNOR_DEFAULTS} from '../formal/governance';
import {ADMIN_COORDINATION,ADMIN_POLICY_LABELS,TERRITORY_REGISTER,GOVERNANCE_BATCH_LIMIT,GOVERNANCE_TEMPLATE_LIMIT,RESOURCE_LABELS,hasAdministration,getTemplates,isGovernanceTemplate,templateKey,governanceCityEligible,registerAlerts,type GovernanceBatchResult,type GovernanceTemplate} from '../administration';
import {playerMessage} from '../playerMessage';

export type ApplyGovernanceTemplate=(ids:CityId[],template:GovernanceTemplate)=>Promise<GovernanceBatchResult[]>;
const stateLabels={applied:'已套用',changed:'條件改變，需重新確認',failed:'未套用',uncertain:'結果待查，請勿重複送出',unsent:'尚未送出'};
const BATCH_PAGE=20;
function Coordination({world,applyTemplate,busy}:{world:WorldRead;applyTemplate:ApplyGovernanceTemplate;busy:boolean}){
 const key=templateKey(world);
 const [templates,setTemplates]=useState(()=>{try{return getTemplates(localStorage,key);}catch{return [];}});
 const [draft,setDraft]=useState<GovernanceTemplate>({name:'',policy:'balanced',...GOVERNOR_DEFAULTS});
 const [selected,setSelected]=useState<CityId[]>([]),[name,setName]=useState(''),[page,setPage]=useState(0);
 const [notice,setNotice]=useState(''),[results,setResults]=useState<GovernanceBatchResult[]>([]);
 const active=templates.find(t=>t.name===name),draftName=draft.name.trim();
 const eligible=world.cities.filter(c=>governanceCityEligible(world,c));
 const eligibleIds=new Set(eligible.map(c=>c.id)),ids=selected.filter(id=>eligibleIds.has(id));
 const pageCount=Math.max(1,Math.ceil(eligible.length/BATCH_PAGE)),pageAt=Math.min(page,pageCount-1);
 const save=(next:GovernanceTemplate[])=>{try{localStorage.setItem(key,JSON.stringify(next));setTemplates(next);setNotice('');return true;}catch{setNotice('瀏覽器無法保存範本；沒有變更治理設定。');return false;}};
 const saveDraft=()=>{if(!isGovernanceTemplate(draft))return;const t={...draft,name:draftName},old=templates.some(value=>value.name===t.name);if(!old&&templates.length>=GOVERNANCE_TEMPLATE_LIMIT)return;
  if(save(old?templates.map(v=>v.name===t.name?t:v):[...templates,t])){setName(t.name);setNotice('範本已儲存，尚未套用任何城市。');}
 };
 const choose=(n:string)=>{setName(n);const t=templates.find(t=>t.name===n);if(t)setDraft({...t});};
 const go=async()=>{if(!active||busy||!ids.length)return;setResults([]);setNotice('');try{setResults(await applyTemplate(ids,active));}catch(e){setNotice(playerMessage(e instanceof Error?e.message:'','治理批次未完成，請重新確認城市與範本。'));}};
 return <section className="card" aria-label="行政統籌"><h2>行政統籌 · 治理範本</h2>
  <p>可保存 {GOVERNANCE_TEMPLATE_LIMIT} 組範本，每批最多 {GOVERNANCE_BATCH_LIMIT} 城。範本儲存在本機瀏覽器，不會自動開啟或停止總督；各城各自依範本上限支出、保留庫存，不共用資源。</p>
  <label>已儲存的範本<select value={name} disabled={busy} onChange={e=>choose(e.target.value)}><option value="">選擇範本</option>{templates.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}</select></label>
  <label>範本名稱<input maxLength={24} value={draft.name} disabled={busy} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
  <label>範本治理方針<select value={draft.policy} disabled={busy} onChange={e=>setDraft({...draft,policy:e.target.value as GovernanceTemplate['policy']})}>{GOVERNANCE_POLICIES.map(p=><option key={p} value={p}>{ADMIN_POLICY_LABELS[p]}</option>)}</select></label>
  <label>範本每世界小時預算<input type="number" min="0" value={Number.isNaN(draft.budget)?'':draft.budget} disabled={busy} onChange={e=>setDraft({...draft,budget:e.target.valueAsNumber})}/></label>
  <label>範本每種資源保留<input type="number" min="0" value={Number.isNaN(draft.reserve)?'':draft.reserve} disabled={busy} onChange={e=>setDraft({...draft,reserve:e.target.valueAsNumber})}/></label>
  <button type="button" disabled={busy||!isGovernanceTemplate(draft)||templates.length===GOVERNANCE_TEMPLATE_LIMIT&&!templates.some(t=>t.name===draftName)} onClick={saveDraft}>{templates.some(t=>t.name===draftName)?'更新同名範本':'儲存範本'}</button>
  <button type="button" disabled={busy||!active} onClick={()=>{if(save(templates.filter(t=>t.name!==name)))setName('');}}>移除所選範本</button>
  <details><summary>選擇套用城市（{ids.length}/{GOVERNANCE_BATCH_LIMIT}）</summary>
   <p>只列自己的市政廳 Lv1 以上城市；不會套用到未勾選的城。</p>
   {!eligible.length&&<p>目前沒有符合條件的城市。</p>}
   {eligible.slice(pageAt*BATCH_PAGE,(pageAt+1)*BATCH_PAGE).map(c=><label key={c.id}><input type="checkbox" checked={ids.includes(c.id)} disabled={busy||!ids.includes(c.id)&&ids.length>=GOVERNANCE_BATCH_LIMIT} onChange={e=>setSelected(e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id))}/>{c.name}（{c.x}, {c.y}）</label>)}
   {pageCount>1&&<div className="report-pager"><button disabled={!pageAt} onClick={()=>setPage(pageAt-1)}>上一頁</button><span>{pageAt+1}/{pageCount}</span><button disabled={pageAt+1>=pageCount} onClick={()=>setPage(pageAt+1)}>下一頁</button></div>}
  </details>
  {active&&<p>套用「{active.name}」：{ADMIN_POLICY_LABELS[active.policy]}、每城預算 {active.budget}、每種資源保留 {active.reserve}。</p>}
  <button type="button" disabled={busy||!active||!ids.length} onClick={()=>void go()}>將所選範本套用到 {ids.length} 城</button>
  {notice&&<p role="status">{notice}</p>}
  {!!results.length&&<ul aria-label="逐城套用結果">{results.map(r=><li key={r.cityId}>{world.cities.find(c=>c.id===r.cityId)?.name??'原選取城市'}：{stateLabels[r.status]}</li>)}</ul>}
 </section>;
}
function TerritoryRegister({world}:{world:WorldRead}){
 const [threshold,setThreshold]=useState(''),[page,setPage]=useState(0),[alertsOnly,setAlertsOnly]=useState(true);
 const value=threshold.trim()===''?undefined:Number(threshold),valid=value===undefined||Number.isSafeInteger(value)&&value>=0;
 const rows=registerAlerts(world,valid?value:undefined).filter(r=>!alertsOnly||r.low.length||r.full.length||r.idle.length||r.housing);
 const size=25,count=Math.max(1,Math.ceil(rows.length/size)),pageAt=Math.min(page,count-1);
 return <section className="card" aria-label="領地帳冊"><h2>領地帳冊 · 跨城告警</h2><p>只讀。低庫存以每城總督保留量為預設；住房與倉庫達 90% 時提醒，倉庫計入已預約的在途物資。</p>
 <label>統一低庫存門檻（選填）<input type="number" min="0" value={threshold} onChange={e=>{setThreshold(e.target.value);setPage(0);}}/></label>
 {!valid&&<p role="alert">請填非負整數；目前仍用每城預設門檻。</p>}
 <label><input type="checkbox" checked={alertsOnly} onChange={e=>{setAlertsOnly(e.target.checked);setPage(0);}}/>只顯示有提醒的城市</label>
 <ul>{rows.slice(pageAt*size,(pageAt+1)*size).map(r=><li key={r.cityId}><strong>{r.name}</strong> · 庫存門檻 {r.minimum}
 {r.low.length>0&&<> · 低庫存：{r.low.map(k=>RESOURCE_LABELS[k]).join('、')}</>}
 {r.idle.length>0&&<> · 閒置佇列：{r.idle.join('、')}</>}
 {r.housing&&<> · 住房快滿</>}
 {r.full.length>0&&<> · 倉庫快滿：{r.full.map(k=>RESOURCE_LABELS[k]).join('、')}</>}</li>)}</ul>
 {!rows.length&&<p>沒有符合的城市提醒。</p>}
 {count>1&&<div className="report-pager"><button disabled={!pageAt} onClick={()=>setPage(pageAt-1)}>上一頁</button><span>{pageAt+1}/{count}</span><button disabled={pageAt+1>=count} onClick={()=>setPage(pageAt+1)}>下一頁</button></div>}</section>;
}
export function AdministrativeTools({world,applyTemplate,busy}:{world:WorldRead;applyTemplate?:ApplyGovernanceTemplate;busy:boolean}){
 return <>{applyTemplate&&hasAdministration(world,ADMIN_COORDINATION)&&<Coordination key={templateKey(world)} world={world} applyTemplate={applyTemplate} busy={busy}/>}
 {hasAdministration(world,TERRITORY_REGISTER)&&<TerritoryRegister key={templateKey(world)} world={world}/>}</>;
}
