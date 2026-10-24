import {useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {GROWTH_TASKS,type GrowthTask} from '../formal/growthTaskCatalog';
import {growthTaskState,growthTaskStatus,quoteGrowthReward,ownedPopulationProgress} from '../formal/growthTasks';
import {BUILDING_CATALOG,type BuildingKind,RESOURCE_BOOSTS} from '../formal/catalogB3';
import {AGE_NAMES,LABELS} from './artMap';
import {Heading,fmt} from './UI';
import {VictoryPanel} from './VictoryPanel';
import './journeyGoals.css';
const eras=[['N','黑暗時代'],['F','封建時代'],['C','城堡時代'],['I','帝王時代']] as const;
const statusNames={incomplete:'未完成',claimable:'可領取',claimed:'已領取'};
function prerequisites(t:GrowthTask){
 const kind=t.fact.startsWith('building:')?t.fact.split(':')[1] as BuildingKind:undefined,d=kind?BUILDING_CATALOG[kind]:undefined;
 if(!d)return t.prerequisites;
 const requirements=[`${AGE_NAMES[d.age]}時代`,...Object.entries(d.prerequisites).map(([id,n])=>`${LABELS[id]??id} Lv${n}`)];
 const resource=kind?RESOURCE_BOOSTS[kind as keyof typeof RESOURCE_BOOSTS]:undefined;if(resource)requirements.push(`對應${LABELS[resource]}資源田 Lv5`);
 return `${requirements.join('、')}。${t.prerequisites}`;
}
export function JourneyGoals({world,city,busy,issue}:{world:FormalWorld;city:FormalCity;busy:boolean;issue:(p:FormalCommand)=>unknown}){
 const [tab,setTab]=useState<'growth'|'victory'>('growth'),[open,setOpen]=useState<string[]>([eras[world.factions.find(f=>f.id===world.playerFactionId)?.age??0][0]]),[cityId,setCityId]=useState(city.id);
 const [review,setReview]=useState<{taskId:string;cityId:FormalCity['id'];quote:ReturnType<typeof quoteGrowthReward>}|null>(null);
 const owned=world.cities.filter(c=>c.ownerFactionId===world.playerFactionId),selected=owned.find(c=>c.id===cityId),state=growthTaskState(world),populationProgress=ownedPopulationProgress(world);
 const claimed=Object.keys(state.claimed).length,ready=GROWTH_TASKS.filter(t=>growthTaskStatus(state,t)==='claimable').length;
 return <div className="view-scroll journey-goals"><Heading title="征途目標" subtitle="你的成長與世界征途"/><div className="journey-tabs" role="tablist" aria-label="征途目標分頁"><button role="tab" id="growth-tab" aria-controls="growth-panel" aria-selected={tab==='growth'} onClick={()=>setTab('growth')}>成長任務{ready>0&&<small>{ready} 可領取</small>}</button><button role="tab" id="victory-tab" aria-controls="victory-panel" aria-selected={tab==='victory'} onClick={()=>setTab('victory')}>勝利之路</button></div>
 {tab==='victory'?<div role="tabpanel" id="victory-panel" aria-labelledby="victory-tab"><VictoryPanel world={world}/></div>:<div role="tabpanel" id="growth-panel" aria-labelledby="growth-tab"><section className="card journey-intro"><strong>已領取 {claimed}／80 · 可領取 {ready}</strong><p>可跨時代自由達成，獎勵可延後領取。</p><label>領獎城市<select aria-label="領獎城市" value={selected?.id??''} onChange={e=>{setCityId(e.target.value as FormalCity['id']);setReview(null);}}>{!selected&&<option value="">請選擇目前自有城市</option>}{owned.map(c=><option key={c.id} value={c.id}>{c.name}（{c.x}, {c.y}）</option>)}</select></label><details className="journey-rules"><summary>領獎與完成規則</summary><p className="muted">建造、訓練與行軍依正式完成紀錄認定；征服現成建築不算完工。不必依序完成任務，獎勵可無限期延後領取。獎勵直接入庫，超出容量部分將直接損失。</p></details></section>
 {eras.map(([era,name])=>{const tasks=GROWTH_TASKS.filter(t=>t.era===era),expanded=open.includes(era),count=tasks.filter(t=>growthTaskStatus(state,t)==='claimable').length;return <details key={era} className="journey-era" open={expanded} onToggle={e=>{const isOpen=e.currentTarget.open;setOpen(previous=>isOpen?previous.includes(era)?previous:[...previous,era]:previous.filter(x=>x!==era));}}><summary>{name}<span>{tasks.filter(t=>state.claimed[t.id]).length}／{tasks.length} 已領取{count>0&&` · ${count} 可領取`}</span></summary>{expanded&&<div className="journey-task-list">{tasks.map(t=>{
 const status=growthTaskStatus(state,t),value=Math.min(t.target,t.fact==='population'?Math.max(state.facts.population??0,populationProgress):state.facts[t.fact]??0),activeReview=review?.taskId===t.id?review:null,quote=selected&&activeReview?quoteGrowthReward(world,selected,t):null;
 const stale=!!activeReview&&(!selected||activeReview.cityId!==selected.id||!quote||resourceKeys.some(r=>quote.accepted[r]!==activeReview.quote.accepted[r]));
 return <article key={t.id} data-task-id={t.id} className={'journey-task '+status}><div className="journey-task-heading"><h3><small>{t.id}</small>{t.title}</h3><span className="journey-status">{statusNames[status]}</span></div><progress aria-label={t.id+'達成進度'} value={value} max={t.target}/><p className="journey-progress">達成進度 {fmt(value)}／{fmt(t.target)}</p><details className="journey-prerequisites"><summary>條件與正式前置</summary><p>{prerequisites(t)}</p></details><div className="journey-reward" aria-label={t.id+'名目獎勵'}>{resourceKeys.map(r=><span key={r}>{LABELS[r]} <b>{fmt(t.reward[r])}</b></span>)}</div>
 {status==='claimable'&&<><button disabled={busy||!selected} onClick={()=>{if(selected)setReview({taskId:t.id,cityId:selected.id,quote:quoteGrowthReward(world,selected,t)});}}>{activeReview?'重新核對領獎':'核對領獎'}</button>{activeReview&&<div className="journey-claim-review" aria-label={t.id+'領獎確認'}><strong>領獎城市：{owned.find(c=>c.id===activeReview.cityId)?.name??'城市已失去所有權'}</strong><table><thead><tr><th>資源</th><th>實際入庫</th><th>直接損失</th></tr></thead><tbody>{resourceKeys.map(r=><tr key={r}><th>{LABELS[r]}</th><td>{fmt(activeReview.quote.accepted[r])}</td><td className={activeReview.quote.lost[r]>0?'journey-loss':''}>{fmt(activeReview.quote.lost[r])}</td></tr>)}</tbody></table>{resourceKeys.some(r=>activeReview.quote.lost[r]>0)&&<p role="alert" className="journey-loss">倉庫容量不足！建議先升級倉庫，超出容量將直接損失，不會保留或補領。</p>}{stale&&<p role="status">城市容量、庫存或所有權已改變，請重新核對。</p>}<p>也可以取消確認，無限期延後領獎。</p><div className="journey-claim-actions"><button disabled={busy} onClick={()=>setReview(null)}>暫不領取</button><button className="primary" disabled={busy||stale||!selected} onClick={()=>{if(selected)issue({type:'tasks.claim',cityId:activeReview.cityId,taskId:t.id,expectedResources:activeReview.quote.accepted});}}>{resourceKeys.some(r=>activeReview.quote.lost[r]>0)?'確認領取並放棄溢出':'確認領取'}</button></div></div>}</>}
 </article>;})}</div>}</details>;})}</div>}
 </div>;
}
