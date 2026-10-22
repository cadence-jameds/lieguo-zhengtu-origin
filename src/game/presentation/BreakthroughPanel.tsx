import {useState} from 'react';
import type {FormalCommand,FormalWorld,LargeProject} from '../formal/model';
import {resourceKeys,zeroResources} from '../formal/model';
import {empireOf} from '../formal/politics';
import {caravanStatus,citySnapshot} from '../formal/economy';
import {BREAKTHROUGH_COST,empireBreakthrough,breakthroughWork,breakthroughStoredWork,breakthroughPauseReason} from '../formal/breakthrough';
import {wonderRemaining} from '../formal/wonder';
import {Cost} from './UI';
import {Countdown,LiveProgress} from './LiveValues';
import {LABELS} from './artMap';
export function BreakthroughPanel({world:w,wonder,issue,busy}:{world:FormalWorld;wonder:LargeProject;issue:(p:FormalCommand)=>void;busy:boolean}){
 const [sourceId,setSource]=useState(''),[cargo,setCargo]=useState(zeroResources),empire=empireOf(w,w.playerFactionId),owned=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId),source=owned.find(c=>c.id===sourceId)??owned[0];
 if(!empire||!source)return null;
 const p=empireBreakthrough(w,empire.id),b=p?.breakthrough,host=w.cities.find(c=>c.id===wonder.initiatingCityId),available=!!host&&empireOf(w,host.ownerFactionId)?.id===empire.id&&(!wonder.wonder?.integrity||wonder.wonder.integrity==='intact');
 if(!p)return <section className="card" aria-label="文明突破工程"><h3>文明突破</h3><Cost cost={{...BREAKTHROUGH_COST}}/><p>四資源經市場商隊抵達獨立工程池後，施工至少 48 世界小時。完成當下的帝國成員永久取得完整現代軍事資格。</p><button disabled={busy||empire.leader!==w.playerFactionId||!available} onClick={()=>issue({type:'breakthrough.start',cityId:source.id})}>啟動文明突破</button>{!available&&<p>奇觀城市失守或奇觀狀態不允許開工。</p>}</section>;
 const remaining=wonderRemaining(p),stock=citySnapshot(w,source.id)?.stock??source.stock,capacity=caravanStatus(w,source),total=resourceKeys.reduce((n,r)=>n+cargo[r],0),valid=b?.phase==='funding'&&!breakthroughPauseReason(w,p)&&total>0&&total<=capacity.available*2000&&resourceKeys.every(r=>Number.isSafeInteger(cargo[r])&&cargo[r]>=0&&cargo[r]<=Math.min(stock[r],remaining[r]));
 return <section className="card" aria-label="文明突破工程"><h3>文明突破 · {b?.phase==='completed'?'已完成':b?.phase==='paused'?'已暫停':b?.phase==='building'?'施工中':'籌資／運輸中'}</h3><p>獨立文明突破工程池（已抵達）</p><Cost cost={p.poolResources}/><p>工程總需求</p><Cost cost={p.requiredResources}/>
 {b?.phase==='building'&&<><LiveProgress world={w} start={b.activeSince!-breakthroughStoredWork(p)} duration={p.durationMs} label="文明突破施工進度"/><p>剩餘 <Countdown world={w} at={b.activeSince!+p.durationMs-breakthroughStoredWork(p)}/></p></>}
 {b?.phase==='paused'&&<p role="status">{breakthroughPauseReason(w,p)==='host-lost'?'奇觀城市失守':'奇觀受損／狀態不允許施工'}，進度保留 {(100*breakthroughWork(w,p)/p.durationMs).toFixed(1)}%。暫停計時與資源投入；原帝國收復且奇觀可用後續行。</p>}
 {b?.phase==='completed'&&<p>已永久授予資格：{b.qualifiedFactionIds.map(id=>w.factions.find(f=>f.id===id)?.name).join('、')}。之後加入者不會免費取得資格；文明突破不代表勝利，也沒有勝利倒數。</p>}
 {b?.phase==='funding'&&<><p>尚可派送（扣除在途預約）</p><Cost cost={remaining}/><label>突破資源來源城市<select aria-label="突破資源來源城市" value={source.id} onChange={e=>{setSource(e.target.value);setCargo(zeroResources());}}>{owned.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Cost cost={stock}/><p>可用商隊 {capacity.available}/{capacity.total}，每支載量 2,000。</p><div className="v94-unit-inputs">{resourceKeys.map(r=><label key={r}>{LABELS[r]}<input type="number" aria-label={'突破運送'+LABELS[r]} min={0} step={1} max={Math.min(stock[r],remaining[r])} value={Number.isFinite(cargo[r])?cargo[r]:''} onChange={e=>setCargo({...cargo,[r]:e.target.valueAsNumber})}/></label>)}</div><button disabled={busy||!valid} onClick={()=>{issue({type:'breakthrough.ship',cityId:source.id,projectId:p.projectId,resources:cargo});setCargo(zeroResources());}}>派出商隊投入文明突破</button></>}
 <h4>文明突破物流</h4>{(w.logistics??[]).filter(t=>t.projectId===p.projectId).map(t=><article key={t.shipmentId}><p>{w.cities.find(c=>c.id===t.sourceCityId)?.name} → 奇觀城市 · {t.phase==='outbound'?'載貨在途':p.shipments.find(r=>r.shipmentId===t.shipmentId)?.phase==='returned'?'暫停未入池，貨物返運':'空車返程'} · <Countdown world={w} at={t.phase==='outbound'?t.arrivalAt:t.returnAt}/></p><Cost cost={t.resources}/></article>)}</section>;
}
