import {useLayoutEffect,useRef,useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {GROWTH_TASKS,type GrowthTask} from '../formal/growthTaskCatalog';
import {growthTaskState,growthTaskStatus,quoteGrowthReward,ownedPopulationProgress,type GrowthClaim} from '../formal/growthTasks';
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
function ClaimedTask({task,claim,world}:{task:GrowthTask;claim:GrowthClaim;world:FormalWorld}){
 const [expanded,setExpanded]=useState(false);
 return <details className="journey-claimed-row" data-task-id={task.id} open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary aria-expanded={expanded} aria-controls={'history-'+task.id}><b>{task.id}</b><span>{task.title}</span><small>已領取</small></summary><div id={'history-'+task.id} className="journey-history-detail" hidden={!expanded}>{expanded&&<><p>領獎城市：{world.cities.find(c=>c.id===claim.cityId)?.name??claim.cityId} · 世界時間 {fmt(Math.floor(claim.at/3600000))} 時 {Math.floor(claim.at%3600000/60000)} 分</p><table><caption>歷史領獎明細</caption><thead><tr><th>資源</th><th>當時獎勵</th><th>實際入庫</th><th>歷史損失</th></tr></thead><tbody>{resourceKeys.map(r=><tr key={r}><th>{LABELS[r]}</th><td>{fmt(claim.accepted[r]+claim.lost[r])}</td><td>{fmt(claim.accepted[r])}</td><td>{fmt(claim.lost[r])}</td></tr>)}</tbody></table></>}</div></details>;
}
export function JourneyGoals({world,city,busy,issue}:{world:FormalWorld;city:FormalCity;busy:boolean;issue:(p:FormalCommand)=>unknown}){
 const [tab,setTab]=useState<'growth'|'victory'>('growth'),[open,setOpen]=useState<string[]>([eras[world.factions.find(f=>f.id===world.playerFactionId)?.age??0][0]]),[cityId,setCityId]=useState(city.id),[showClaimed,setShowClaimed]=useState(false);
 const root=useRef<HTMLDivElement>(null),pending=useRef<{taskId:string;nextId?:string}|null>(null);
 const owned=world.cities.filter(c=>c.ownerFactionId===world.playerFactionId),selected=owned.find(c=>c.id===cityId),state=growthTaskState(world),populationProgress=ownedPopulationProgress(world);
 const readyTasks=GROWTH_TASKS.filter(t=>growthTaskStatus(state,t)==='claimable'),claimedTasks=GROWTH_TASKS.filter(t=>growthTaskStatus(state,t)==='claimed'),ready=readyTasks.length,claimed=claimedTasks.length;
 useLayoutEffect(()=>{const p=pending.current;if(p&&state.claimed[p.taskId]&&!busy){
  const target=root.current?.querySelector<HTMLElement>(`[data-task-id="${p.nextId}"] button`)??root.current?.querySelector<HTMLElement>('#journey-ready-heading');
  target?.focus({preventScroll:true});pending.current=null;
 }},[state.claimed,busy]);
 function taskCard(t:GrowthTask){
  const status=growthTaskStatus(state,t),value=Math.min(t.target,t.fact==='population'?Math.max(state.facts.population??0,populationProgress):state.facts[t.fact]??0),quote=selected&&status==='claimable'?quoteGrowthReward(world,selected,t):null;
  return <article key={t.id} data-task-id={t.id} className={'journey-task '+status}><div className="journey-task-heading"><h3><small>{t.id}</small>{t.title}</h3><span className="journey-status">{statusNames[status]}</span></div><progress aria-label={t.id+'達成進度'} value={value} max={t.target}/><p className="journey-progress">達成進度 {fmt(value)}／{fmt(t.target)}</p><details className="journey-prerequisites"><summary>條件與正式前置</summary><p>{prerequisites(t)}</p></details><div className="journey-reward" aria-label={t.id+'名目獎勵'}>{resourceKeys.map(r=><span key={r}>{LABELS[r]} <b>{fmt(t.reward[r])}</b></span>)}</div>
  {status==='claimable'&&<div className="journey-claim-review" aria-label={t.id+'領獎容量'}><strong>領獎城市：{selected?.name??'請選擇目前自有城市'}</strong>{quote&&<><p>每種資源倉庫上限：{fmt(quote.capacity)}</p><table><thead><tr><th>資源</th><th>完整獎勵</th><th>可用容量</th><th>不足量</th></tr></thead><tbody>{resourceKeys.map(r=><tr key={r}><th>{LABELS[r]}</th><td>{fmt(t.reward[r])}</td><td>{fmt(quote.available[r])}</td><td className={quote.shortfall[r]>0?'journey-loss':''}>{fmt(quote.shortfall[r])}</td></tr>)}</tbody></table>{!quote.canClaim&&<p role="status" className="journey-loss">倉庫容量不足，請騰出空間或選擇其他自有城市；任務可無限期延後領取。</p>}</>}<button className="primary" disabled={busy||!selected||!quote?.canClaim} onClick={()=>{if(selected&&quote?.canClaim){pending.current={taskId:t.id,nextId:readyTasks[readyTasks.indexOf(t)+1]?.id};issue({type:'tasks.claim',cityId:selected.id,taskId:t.id,rewardVersion:2,expectedResources:{...t.reward}});}}}>完整領取</button></div>}
  </article>;
 }
 return <div ref={root} className="view-scroll journey-goals"><Heading title="征途目標" subtitle="你的成長與世界征途"/><div className="journey-tabs" role="tablist" aria-label="征途目標分頁"><button role="tab" id="growth-tab" aria-controls="growth-panel" aria-selected={tab==='growth'} onClick={()=>setTab('growth')}>成長任務{ready>0&&<small>{ready} 可領取</small>}</button><button role="tab" id="victory-tab" aria-controls="victory-panel" aria-selected={tab==='victory'} onClick={()=>setTab('victory')}>勝利之路</button></div>
 {tab==='victory'?<div role="tabpanel" id="victory-panel" aria-labelledby="victory-tab"><VictoryPanel world={world}/></div>:<div role="tabpanel" id="growth-panel" aria-labelledby="growth-tab"><section className="card journey-intro"><strong>已領取 {claimed}／80 · 可領取 {ready}</strong><p>可跨時代自由達成，獎勵可無限期延後領取。</p><label>領獎城市<select aria-label="領獎城市" value={selected?.id??''} onChange={e=>setCityId(e.target.value as FormalCity['id'])}>{!selected&&<option value="">請選擇目前自有城市</option>}{owned.map(c=><option key={c.id} value={c.id}>{c.name}（{c.x}, {c.y}）</option>)}</select></label><details className="journey-rules"><summary>領獎與完成規則</summary><p className="muted">建造、訓練與行軍依正式完成紀錄認定；征服現成建築不算完工。不必依序完成任務。四種資源都必須能完整入庫才可領取，可用容量會扣除預留運輸量；容量不足時保留領獎資格。</p></details></section>
 <section className="journey-ready" aria-labelledby="journey-ready-heading"><h2 id="journey-ready-heading" tabIndex={-1}>可領取任務 <small aria-live="polite">{ready} 項</small></h2>{ready?<div className="journey-task-list">{readyTasks.map(taskCard)}</div>:<p className="muted">目前沒有可領取任務。</p>}</section>
 <section className="journey-progress-section" aria-labelledby="journey-progress-heading"><h2 id="journey-progress-heading">進行中任務</h2>{eras.map(([era,name])=>{const tasks=GROWTH_TASKS.filter(t=>t.era===era&&growthTaskStatus(state,t)==='incomplete'),expanded=open.includes(era);return <details key={era} className="journey-era" open={expanded} onToggle={e=>{const isOpen=e.currentTarget.open;setOpen(previous=>isOpen?previous.includes(era)?previous:[...previous,era]:previous.filter(x=>x!==era));}}><summary aria-expanded={expanded} aria-controls={'era-'+era}>{name}<span>{tasks.length} 項進行中</span></summary><div id={'era-'+era} className="journey-task-list" hidden={!expanded}>{expanded&&<>{tasks.map(taskCard)}{!tasks.length&&<p>此時代沒有進行中的任務。</p>}</>}</div></details>;})}</section>
 <details className="journey-claimed" open={showClaimed} onToggle={e=>setShowClaimed(e.currentTarget.open)}><summary aria-expanded={showClaimed} aria-controls="journey-claimed-list">已領取紀錄 <small>{claimed} 項</small></summary><div id="journey-claimed-list" hidden={!showClaimed}>{showClaimed&&<>{claimedTasks.map(t=><ClaimedTask key={t.id} task={t} claim={state.claimed[t.id]} world={world}/>)}{!claimed&&<p>尚無已領取紀錄。</p>}</>}</div></details>
 </div>}
 </div>;
}
