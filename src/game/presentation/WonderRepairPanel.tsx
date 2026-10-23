import {useState} from 'react';
import type {FormalCommand,FormalWorld,LargeProject} from '../formal/model';
import {resourceKeys,zeroResources} from '../formal/model';
import {repairQuote,repairWork,wonderAvailable} from '../formal/wonderCondition';
import {wonderRemaining} from '../formal/wonder';
import {caravanStatus,citySnapshot} from '../formal/economy';
import {Cost,fmt} from './UI';
import {Countdown} from './LiveValues';
import {LABELS} from './artMap';
export function WonderRepairPanel({world:w,wonder,issue,busy}:{world:FormalWorld;wonder:LargeProject;issue:(p:FormalCommand)=>void;busy:boolean}){
 const [sourceId,setSourceId]=useState(''),[cargo,setCargo]=useState(zeroResources),owned=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId),source=owned.find(c=>c.id===sourceId)??owned[0],d=wonder.wonder?.durability;
 if(!source||!d)return null;
 const repair=w.largeProjects.find(p=>p.repair?.wonderProjectId===wonder.projectId&&p.repair.phase!=='completed'),r=repair?.repair,missing=d.maximum-d.current,quote=missing>0?repairQuote(missing):undefined,available=wonderAvailable(w,wonder),stock=citySnapshot(w,source.id)!.stock,caravans=caravanStatus(w,source),remaining=repair?wonderRemaining(repair):zeroResources(),total=resourceKeys.reduce((n,k)=>n+cargo[k],0),valid=available&&total>0&&total<=caravans.available*2000&&resourceKeys.every(k=>Number.isSafeInteger(cargo[k])&&cargo[k]>=0&&cargo[k]<=Math.min(remaining[k],stock[k]));
 return <section aria-label="奇觀耐久與修復"><h3>奇觀耐久與修復</h3><p>耐久 {fmt(d.current)}／{fmt(d.maximum)} · {wonder.wonder?.integrity==='ruins'?'廢墟':wonder.wonder?.integrity==='damaged'?'受損':'完好'}</p>{!available&&<p>奇觀城市失守：原帝國必須真正征服收復，才能修復或續建。</p>}
 {!repair&&quote&&<><Cost cost={quote.resources}/><p>本次缺損快照 {fmt(missing)}，修復需 {(quote.durationMs/3600000).toFixed(2)} 世界小時；實體商隊到齊且敵軍戰鬥結束後開始。</p><button disabled={busy||!available} onClick={()=>issue({type:'wonder.repair.start',cityId:source.id,projectId:wonder.projectId})}>啟動奇觀修復</button></>}
 {repair&&r&&<><p>修復{r.phase==='paused'?'暫停':r.phase==='funding'?'募集資源':'施工中'} · 已完成 {Math.floor(repairWork(w,repair)/repair.durationMs*100)}%</p><p>本輪最多恢復 {fmt(r.missingSnapshot)} 耐久；再次受擊會暫停，追加缺損不免費修復。</p><Cost cost={repair.poolResources}/>{r.activeSince!==null&&<p>剩餘 <Countdown world={w} at={r.activeSince+repair.durationMs-r.workMs}/></p>}
 {resourceKeys.some(k=>remaining[k]>0)&&<><label>修復資源來源<select aria-label="修復資源來源" value={source.id} onChange={e=>{setSourceId(e.target.value);setCargo(zeroResources());}}>{owned.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Cost cost={stock}/><p>尚可派送</p><Cost cost={remaining}/><p>可用商隊 {caravans.available} 支，每支載量 2,000。</p><div className="v94-unit-inputs">{resourceKeys.map(k=><label key={k}>{LABELS[k]}<input aria-label={'修復運送'+LABELS[k]} type="number" min={0} step={1} value={Number.isFinite(cargo[k])?cargo[k]:''} onChange={e=>setCargo({...cargo,[k]:e.target.valueAsNumber})}/></label>)}</div><button disabled={busy||!valid} onClick={()=>{issue({type:'wonder.repair.ship',cityId:source.id,projectId:repair.projectId,resources:cargo});setCargo(zeroResources());}}>派出修復商隊</button></>}
 {(w.logistics??[]).filter(t=>t.projectId===repair.projectId).map(t=><p key={t.shipmentId}>修復商隊 · {t.phase==='outbound'?'載貨在途':resourceKeys.some(k=>(t.returnCargo?.[k]??0)>0)?'載貨返程':'空車返程'} · <Countdown world={w} at={t.phase==='outbound'?t.arrivalAt:t.returnAt}/></p>)}</>}
 </section>;
}
