import {useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {defaultLogisticsSettings,logisticsAllocation} from '../formal/logisticsAllocation';
import type {ProjectId} from '../formal/ids';
import {LABELS} from './artMap';
/** One city owns one reserve and fixed, non-lending vehicle allocations. */
export function LogisticsSettingsPanel({world:w,city:c,issue,busy,wonderProjectId}:{world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean;wonderProjectId?:ProjectId}){
 const [settings,setSettings]=useState(()=>{const value=defaultLogisticsSettings(c);if(wonderProjectId&&value.wonder?.projectId!==wonderProjectId)value.wonder={projectId:wonderProjectId,maxCaravans:0,enabled:false};return value;}),[rules,setRules]=useState(()=>structuredClone(c.autoLogistics??[]));
 const owned=w.cities.filter(d=>d.ownerFactionId===c.ownerFactionId&&d.id!==c.id),a=logisticsAllocation({...c,autoLogistics:rules,logisticsSettings:settings});
 const valid=a.allocated<=a.total&&[settings.manualCaravans,...resourceKeys.map(r=>settings.reserve[r]),...rules.map(r=>r.maxCaravans),settings.wonder?.maxCaravans??0].every(n=>Number.isSafeInteger(n)&&n>=0)&&(!settings.wonder?.enabled||settings.wonder.maxCaravans>0)&&rules.every(r=>r.maxCaravans>0)&&new Set(rules.map(r=>r.destinationCityId)).size===rules.length;
 return <fieldset className="logistics-settings"><legend>{wonderProjectId?'奇觀自動補給與本城物流分配':'本城自動物流設定'}</legend>
 <p>固定分配 {a.allocated}/{a.total} 支；閒置額度不互借，在途商隊返程後才釋放。每支載量 2,000。</p>
 <fieldset><legend>本城四資源最低保留量（所有自動物流共用）</legend><div className="logistics-resource-inputs">{resourceKeys.map(r=><label key={r}>{LABELS[r]}<input aria-label={'最低保留'+LABELS[r]} type="number" min={0} step={1} value={Number.isFinite(settings.reserve[r])?settings.reserve[r]:''} onChange={e=>setSettings({...settings,reserve:{...settings.reserve,[r]:e.target.valueAsNumber}})}/></label>)}</div></fieldset>
 <label>手動預留商隊<input aria-label="手動預留商隊" type="number" min={0} max={a.total} step={1} value={Number.isFinite(settings.manualCaravans)?settings.manualCaravans:''} onChange={e=>setSettings({...settings,manualCaravans:e.target.valueAsNumber})}/></label>
 <p>一般自動物流（需商路管理）：至少 2,000 並優先滿載整數支商隊；不足時等待。</p>
 {rules.map((r,i)=><div className="logistics-route" key={i}><label>目的城市<select aria-label={'自動物流目的城市 '+(i+1)} value={r.destinationCityId} onChange={e=>setRules(rules.map((v,j)=>j===i?{...v,destinationCityId:e.target.value as typeof r.destinationCityId}:v))}>{owned.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>固定商隊<input aria-label={'自動物流商隊 '+(i+1)} type="number" min={1} max={15} step={1} value={Number.isFinite(r.maxCaravans)?r.maxCaravans:''} onChange={e=>setRules(rules.map((v,j)=>j===i?{...v,maxCaravans:e.target.valueAsNumber}:v))}/></label><button disabled={busy} onClick={()=>setRules(rules.filter((_,j)=>j!==i))}>移除此路線</button></div>)}
 <button disabled={busy||!owned.some(d=>!rules.some(r=>r.destinationCityId===d.id))||!w.factions.find(f=>f.id===c.ownerFactionId)?.techIds.includes('logistics.auto')} onClick={()=>{const d=owned.find(d=>!rules.some(r=>r.destinationCityId===d.id));if(d)setRules([...rules,{destinationCityId:d.id,maxCaravans:1,reserve:{...settings.reserve}}]);}}>新增自動物流路線</button>
 {settings.wonder&&<fieldset><legend>奇觀專用商隊</legend><label>固定額度<input aria-label="奇觀專用商隊" type="number" min={0} max={15} step={1} value={Number.isFinite(settings.wonder.maxCaravans)?settings.wonder.maxCaravans:''} onChange={e=>setSettings({...settings,wonder:{...settings.wonder!,maxCaravans:e.target.valueAsNumber}})}/></label><label><input aria-label="啟用奇觀自動補給" type="checkbox" checked={settings.wonder.enabled} onChange={e=>setSettings({...settings,wonder:{...settings.wonder!,enabled:e.target.checked}})}/>啟用奇觀自動補給</label><small>儲存後於經濟結算或商隊返程評估。停用保留專用額度；在途商隊照常到貨及返程。最後資源缺口不足 2,000 可派尾車。</small></fieldset>}
 {!valid&&<p role="alert">請輸入合法整數，且固定分配總額不得超過市場容量。</p>}
 <button disabled={busy||!valid} onClick={()=>issue({type:'logistics.configure',cityId:c.id,rules:rules.map(r=>({...r,reserve:{...settings.reserve}})),settings})}>儲存物流設定</button>
 </fieldset>;
}
