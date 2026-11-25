import {useState} from 'react';
import type {CommandView} from '../useGame';
import {Dialog} from './UI';
const actions:Record<string,string>={'city.rename':'城市改名','field.upgrade':'資源地升級','building.upgrade':'建築升級','building.demolish':'拆除建築','construction.cancel':'取消工程','military.recruit':'訓練兵力','military.cancel':'取消訓練','research.start':'開始科研','research.contribute':'投入科研資源','age.start':'時代晉升','logistics.auto.set':'自動物流','logistics.configure':'物流設定','governance.set':'套用治理','army.dispatch':'派遣軍隊','campaign.configure':'戰役時間設定','player.rebirth':'流亡復國','player.end':'結束戰役'};
const dismissalStorage='formal-command-notice-dismissed-v1',dismissalLimit=256;
const key=(r:CommandView)=>JSON.stringify([r.order.campaignId,r.commandId,r.state]);
const readDismissed=()=>{try{
 const entries:unknown=JSON.parse(localStorage.getItem(dismissalStorage)??'[]');
 return new Set<string>(Array.isArray(entries)?entries.filter(v=>typeof v==='string'&&v.length<512).slice(-dismissalLimit):[]);
 }catch{return new Set<string>();}};
const terminalFailure=(r:CommandView)=>r.state==='needs-confirmation'||r.state==='retired';
/** Historical outcomes never block play. Dismissal affects notices only, not
 * command payloads, retries, receipts or the durable result. */
export function CommandFailure({rows,onQuery,onRetry,onReload}:{rows:CommandView[];onQuery:(r:CommandView)=>void;onRetry:(r:CommandView)=>void;onReload:()=>void}){
 const [dismissed,setDismissed]=useState(readDismissed);
 const row=rows.find(r=>!r.outsideActiveCampaign&&(r.state==='receive-failed'||r.state==='blocked'||(terminalFailure(r)&&r.announceTerminalFailure))&&!dismissed.has(key(r)));
 if(!row)return null;
 const done=terminalFailure(row);
 const close=()=>{
  setDismissed(current=>new Set([...current,key(row)]));
  if(done)try{localStorage.setItem(dismissalStorage,JSON.stringify([...readDismissed(),key(row)].slice(-dismissalLimit)));}catch{/* Still dismiss for this mount. */}
 };
 return <Dialog title="操作尚未完成" onClose={close}><p>{actions[row.order.payload.type]??'本次操作'}：{row.state==='receive-failed'?'尚未確認保存，請查詢結果後再重試。':row.state==='blocked'?'目前無法確認結果，請重新查詢或重新載入恢復。':'這筆指令未執行。若仍想操作，請依目前的遊戲狀態重新下令。'}</p>{!done&&<p>原始操作已保留，請勿重複送出。</p>}<div className="dialog-actions">{!done&&<button onClick={()=>onQuery(row)}>重新查詢結果</button>}{row.state==='receive-failed'&&<button onClick={()=>onRetry(row)}>重試這次操作</button>}{row.state==='blocked'&&<button onClick={onReload}>重新載入並恢復</button>}<button onClick={close}>{done?'關閉並返回遊戲':'返回遊戲'}</button></div></Dialog>;
}
