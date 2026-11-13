import {playerMessage} from './playerMessage';
import {useEffect,useState} from 'react';
import {Dialog} from './presentation/UI';
import {deleteLocalCampaigns,exportSelectedCampaigns,inspectLocalCampaigns,type StorageEntry,type DeleteResult} from './storageRecovery';

/** Deliberately independent of the Runtime Worker and its request queue. */
export function LocalCampaignManager({suspend,onClose,onComplete}:{suspend:()=>Promise<void>;onClose:()=>void;onComplete:()=>void}){
 const [rows,setRows]=useState<StorageEntry[]>([]),[selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[results,setResults]=useState<DeleteResult[]>([]);
 const refresh=async()=>{const found=await inspectLocalCampaigns();setRows(found);setResults(old=>old.map(r=>{
  if(r.state!=='uncertain')return r;const observed=found.find(x=>x.name===r.name);
  if(observed?.state==='absent')return {...r,state:'absent',text:'重新檢查已確認資料庫不存在。'};
  // A completed read-open is ordered after the pending delete request. If the
  // DB is readable again, allow preserving it and leaving this recovery screen.
  return observed?.state==='present'?{...r,state:'failed',text:'重新檢查資料庫仍存在，未確認清理完成；可重試或返回首頁。'}:r;
 }));};
 useEffect(()=>{let active=true;void suspend().then(async()=>{if(active)await refresh();}).catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 const close=()=>{if(busy)return;if(results.some(r=>r.state==='uncertain')){setError('仍有未確認的刪除請求，請關閉其他遊戲分頁後重新檢查；尚未重新啟動引擎。');return;}onClose();};
 const backup=async()=>{setBusy(true);setError('');try{const text=await exportSelectedCampaigns(selected),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='列國征途-刪除前原始備份.realm-save';a.click();URL.revokeObjectURL(url);}catch(e){setError(String(e));}finally{setBusy(false);}};
 const remove=async()=>{setConfirm(false);setBusy(true);setError('');try{const outcome=await deleteLocalCampaigns(selected,true,navigator.locks);setResults(outcome);await refresh();if(outcome.every(r=>r.state==='deleted'||r.state==='absent')){onComplete();return;}}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <Dialog title="管理本機戰役存檔" onClose={close} className="campaign-storage-manager">
  <p>世界引擎會先停止並釋放寫入鎖。這裡只管理列出的本遊戲戰役資料，不清除 Service Worker、快取或遊戲 UI 設定。</p>
  {busy&&<p role="status">正在處理本機戰役資料…</p>}{error&&<p role="alert">{playerMessage(error,'無法完成存檔管理，原始資料保留；請重新檢查。')}</p>}
  <fieldset disabled={busy}><legend>選擇資料範圍（預設不選取）</legend>{rows.map(row=><div key={row.name} className="campaign-storage-row"><label><input type="checkbox" checked={selected.includes(row.name)} disabled={row.state==='absent'} onChange={e=>setSelected(old=>e.target.checked?[...old,row.name]:old.filter(n=>n!==row.name))}/>{row.label}</label><code>{row.name}</code><small>{row.scope}</small><small>{row.state==='absent'?'不存在':row.state==='unreadable'?'無法讀取：'+playerMessage(row.error,'請重新檢查或保留原始資料。'):'已存在 · '+Object.entries(row.tables??{}).map(([k,n])=>`${k}: ${n}`).join('、')}</small></div>)}</fieldset>
  <div className="dialog-actions"><button disabled={busy} onClick={()=>setSelected(rows.filter(r=>r.state!=='absent').map(r=>r.name))}>選取全部列出的戰役</button><button disabled={busy} onClick={()=>{setBusy(true);setError('');void refresh().catch(e=>setError(String(e))).finally(()=>setBusy(false));}}>重新檢查／診斷</button><button disabled={busy||!selected.length} onClick={()=>void backup()}>匯出所選原始備份（可選）</button><button disabled={busy||!selected.length} onClick={()=>setConfirm(true)}>刪除／重設所選戰役</button><button disabled={busy} onClick={close}>保留資料並返回首頁</button></div>
  {results.length>0&&<section aria-label="逐項刪除結果">{results.map(r=><p key={r.name} role={r.state==='failed'||r.state==='uncertain'?'alert':'status'}><code>{r.name}</code>：{playerMessage(r.text,'此項操作未完成，請重新檢查；未確認成功。')}</p>)}</section>}
  {confirm&&<Dialog title="確認永久刪除戰役資料" onClose={()=>setConfirm(false)}><p>將永久刪除以下資料庫及其全部戰役資料，包含未完成命令與回復點。刪除後無法復原。</p><ul>{selected.map(n=><li key={n}><code>{n}</code>：{rows.find(r=>r.name===n)?.scope}</li>)}</ul><p>各資料庫分別刪除；部分失敗時，已刪除的項目無法整批回滾。備份是可選操作，不必先匯出。</p><div className="dialog-actions"><button onClick={()=>setConfirm(false)}>取消，保留全部資料</button><button className="primary" onClick={()=>void remove()}>確認永久刪除所選資料</button></div></Dialog>}
 </Dialog>;
}
