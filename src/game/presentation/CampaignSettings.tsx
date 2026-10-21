import {useEffect,useState} from 'react';
import type {FormalCommand,FormalWorld} from '../formal/model';
import type {CityId} from '../formal/ids';
import {CAMPAIGN_SPEEDS,OFFLINE_HOURS,type CampaignSpeed,type OfflineHours} from '../formal/campaignTime';
export function CampaignSettings({world,cityId,issue,busy,onClose}:{world:FormalWorld;cityId:CityId;issue:(p:FormalCommand)=>void;busy:boolean;onClose?:()=>void}){
 const [speed,setSpeed]=useState(world.speed as CampaignSpeed),[hours,setHours]=useState<OfflineHours>(world.offlineHours??12),[submitted,setSubmitted]=useState(false);
 useEffect(()=>{if(submitted&&!busy){setSubmitted(false);}},[busy,submitted]);
 useEffect(()=>{setSpeed(world.speed as CampaignSpeed);setHours(world.offlineHours??12);},[world.speed,world.offlineHours]);
 return <section className="card campaign-time-settings"><h2>戰役時間設定</h2>{world.developer?.enabled&&<p role="status">目前由開發者模式控制世界速度（{world.developer.speed}X）。一般速度將在關閉開發者模式後恢復。</p>}
 <label>戰役速度：<output>{speed}X</output><input aria-label="戰役速度滑條" aria-valuetext={speed+'X'} type="range" min={0} max={4} step={1} value={CAMPAIGN_SPEEDS.indexOf(speed)} disabled={busy} onChange={e=>{const v=CAMPAIGN_SPEEDS[Number(e.target.value)];if(v!==undefined)setSpeed(v);}}/></label><div className="setting-ticks">{CAMPAIGN_SPEEDS.map(v=><span key={v}>{v}X</span>)}</div>
 <label>離線推進：<output>{hours?hours+'h':'關閉'}</output><input aria-label="離線推進滑條" aria-valuetext={hours?hours+'小時':'關閉'} type="range" min={0} max={4} step={1} value={OFFLINE_HOURS.indexOf(hours)} disabled={busy} onChange={e=>{const v=OFFLINE_HOURS[Number(e.target.value)];if(v!==undefined)setHours(v);}}/></label><div className="setting-ticks">{OFFLINE_HOURS.map(v=><span key={v}>{v?v+'h':'關閉'}</span>)}</div>
 <p>離線按一般戰役速度推進，最多計入所選現實時數；開發者加速只用於前景。</p><p>目前已儲存：{world.speed}X／{world.offlineHours??12}h</p>
 <div className="settings-actions"><button className="primary" disabled={busy||submitted} onClick={()=>{setSubmitted(true);issue({type:'campaign.configure',cityId,speed,offlineHours:hours});}}>套用並儲存</button><button disabled={busy} onClick={()=>{setSpeed(world.speed as CampaignSpeed);setHours(world.offlineHours??12);onClose?.();}}>取消／關閉</button></div>
 <p role="status">{busy&&submitted?'正在確認並保存設定…':'設定以保存完成後的目前值為準。'}</p></section>;
}
