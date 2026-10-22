import {useState} from 'react';
import type {FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys,zeroResources} from '../formal/model';
import {empireOf} from '../formal/politics';
import {caravanStatus,citySnapshot} from '../formal/economy';
import {empireWonder,wonderRemaining,WONDER_COST} from '../formal/wonder';
import {Cost} from './UI';
import {Countdown,LiveProgress} from './LiveValues';
import {LABELS} from './artMap';
export function WonderPanel({world:w,issue,busy}:{world:FormalWorld;issue:(p:FormalCommand)=>void;busy:boolean}){
 const [hostId,setHostId]=useState(''),[sourceId,setSourceId]=useState(''),[cargo,setCargo]=useState(zeroResources);
 const empire=empireOf(w,w.playerFactionId),owned=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId),source=owned.find(c=>c.id===sourceId)??owned[0];
 if(!empire||!source)return null;
 const p=empireWonder(w,empire.id),hosts=w.cities.filter(c=>empireOf(w,c.ownerFactionId)?.id===empire.id),host=hosts.find(c=>c.id===hostId)??hosts[0],state=p?.wonder,remaining=p?wonderRemaining(p):zeroResources(),stock=citySnapshot(w,source.id)?.stock??source.stock,caravans=caravanStatus(w,source),total=resourceKeys.reduce((n,r)=>n+cargo[r],0);
 const valid=total>0&&total<=caravans.available*2000&&resourceKeys.every(r=>Number.isSafeInteger(cargo[r])&&cargo[r]>=0&&cargo[r]<=Math.min(stock[r],remaining[r]));
 return <section className="card wonder-panel" aria-label="帝國世界奇觀"><h2>帝國世界奇觀</h2>
 <p>每個帝國一座，依附成員城市；不占建築槽、資源田或地圖格。</p>
 {!p?<><Cost cost={{...WONDER_COST}}/><p>四資源抵達工程池後，施工至少 24 世界小時。承載城市領主在奇觀存在期間不得退出帝國。</p><label>奇觀承載城市<select aria-label="奇觀承載城市" value={host?.id??''} onChange={e=>setHostId(e.target.value)}>{hosts.map(c=><option value={c.id} key={c.id}>{c.name}（{w.factions.find(f=>f.id===c.ownerFactionId)?.name}）</option>)}</select></label><button className="primary" disabled={busy||empire.leader!==w.playerFactionId||w.factions.find(f=>f.id===w.playerFactionId)?.age!==3||!host} onClick={()=>issue({type:'wonder.start',cityId:source.id,hostCityId:host.id})}>指定城市並啟動奇觀</button>{empire.leader!==w.playerFactionId&&<p>由帝國領袖指定承載城市。</p>}{w.factions.find(f=>f.id===w.playerFactionId)?.age!==3&&<p>啟動世界奇觀需要完成帝王時代。</p>}</>:<>
 <p>承載城市：{w.cities.find(c=>c.id===p.initiatingCityId)?.name} · {state?.phase==='completed'?'已完成':state?.phase==='building'?'施工中':'籌資／運輸中'}</p>
 <p>工程池（已抵達）</p><Cost cost={p.poolResources}/><p>工程總需求</p><Cost cost={p.requiredResources}/>
 {state?.phase==='building'&&<><LiveProgress world={w} start={state.startedAt!} duration={p.durationMs} label="世界奇觀施工進度"/><p>施工剩餘：<Countdown at={state.startedAt!+p.durationMs} world={w}/>（依目前速度換算）</p></>}
 {state?.phase==='completed'&&<p>世界奇觀已完成。這不代表遊戲勝利；文明突破尚未開放。</p>}
 {state?.phase==='funding'&&<><p>尚可派送（已扣除在途預約）</p><Cost cost={remaining}/><label>奇觀資源來源城市<select aria-label="奇觀資源來源城市" value={source.id} onChange={e=>{setSourceId(e.target.value);setCargo(zeroResources());}}>{owned.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p>本城庫存</p><Cost cost={stock}/><p>可用商隊 {caravans.available}/{caravans.total}，每支載量 2,000；到貨入池後空車返回。同城投入亦須經市場商隊交付。</p><div className="v94-unit-inputs">{resourceKeys.map(r=><label key={r}>{LABELS[r]}<input aria-label={'奇觀運送'+LABELS[r]} type="number" min={0} step={1} max={Math.min(stock[r],remaining[r])} value={Number.isFinite(cargo[r])?cargo[r]:''} onChange={e=>setCargo({...cargo,[r]:e.target.valueAsNumber})}/></label>)}</div><button disabled={busy||!valid} onClick={()=>{issue({type:'wonder.ship',cityId:source.id,projectId:p.projectId,resources:cargo});setCargo(zeroResources());}}>派出商隊投入奇觀</button></>}
 <h3>工程物流</h3>{(w.logistics??[]).filter(t=>t.projectId===p.projectId).map(t=><article key={t.shipmentId}><p>{w.cities.find(c=>c.id===t.sourceCityId)?.name} → 奇觀城市 · {t.phase==='outbound'?'載貨在途':'空車返程'} · <Countdown at={t.phase==='outbound'?t.arrivalAt:t.returnAt} world={w}/></p><Cost cost={t.resources}/></article>)}<p>已抵達 {p.shipments.filter(t=>t.phase==='arrived').length} 批 · 在途 {p.shipments.filter(t=>t.phase==='in-transit').length} 批</p>
 </>}
 </section>;
}
