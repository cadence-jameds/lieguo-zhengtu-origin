import {CatchupPanel} from './CatchupPanel';
import {AwarenessPanel} from './AwarenessPanel';
import {modernUnitAuthorized} from '../formal/modernAwareness';
import {ModernizationPanel} from './ModernizationPanel';
import {QUEUE_CAPACITY} from '../formal/economy';
import {CraftsmanPanel} from './CraftsmanPanel';
import {castleSource} from '../formal/buildingDetailData';
import {CombatPanel} from './CombatPanel';
import type {ArmyTarget} from '../formal/combatModel';
import {recruitmentConditions} from './cityActions';
import {RecruitAmount,RecruitmentForm,type RecruitAmountHandle} from './RecruitmentForm';
import {readyColonizationUnit} from '../formal/settlement';
import {useRef,useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {UNIT_CATALOG,ELITE_VARIANTS,UNIT_LINES,type UnitDefinition} from '../formal/unitCatalog';
import {armyUpkeep} from '../formal/military';
import {buildingLevel} from '../formal/catalogB3';
import FormalDevelopmentPanel from '../FormalDevelopmentPanel';
import {Art} from './Art';
import {unitArt} from './artMap';
import {Cost,Dialog,fmt,realTime} from './UI';
import {Countdown} from './LiveValues';
import {useLiveCity} from './liveClock';
type Props={world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean};
export {ResearchView} from './ResearchView';
export function ArmyView({world,city:sourceCity,issue,busy,targetPoint,armyTarget,initialMarch=false,mobile=false,onMap}:Props&{initialMarch?:boolean;armyTarget?:ArmyTarget;targetPoint?:{x:number;y:number};mobile?:boolean;onMap?:(p:{x:number;y:number})=>void}){
 const [unitEra,setUnitEra]=useState<'traditional'|'modern'>('traditional'),[tab,setTab]=useState<'recruit'|'march'>(initialMarch||targetPoint||armyTarget?'march':'recruit'),[unit,setUnit]=useState<string|null>(null),[settlementOpen,setSettlementOpen]=useState(!!targetPoint),batch=useRef<RecruitAmountHandle>(null),city=useLiveCity(world,sourceCity,!mobile||unit!==null||settlementOpen)!,f=world.factions.find(f=>f.id===city.ownerFactionId)!,queue=city.military?.queue??[],marches=(world.settlements??[]).filter(p=>p.ownerFactionId===world.playerFactionId&&p.phase==='travelling'),ready=readyColonizationUnit(world,city.id);
 const definitions=UNIT_LINES.map(id=>UNIT_CATALOG[(unitEra==='modern'?'modern.':'')+(id==='guard'?'guard.'+castleSource(world,sourceCity):id)]);
 const eligible=(u:UnitDefinition)=>{const elite=ELITE_VARIANTS[u.id]&&UNIT_CATALOG[ELITE_VARIANTS[u.id]];return elite&&f.techIds.includes(elite.eliteTech!)&&city.economy?.milestones.includes(elite.milestone)?elite:u;};
 const selected=unit?UNIT_CATALOG[unit]:null;
 const role=(u:UnitDefinition)=>({infantry:'在前線迎戰的徒步部隊',ranged:'從後方提供射擊火力',cavalry:'以速度與近戰衝擊迎戰', 'mounted-ranged':'兼具射擊與機動的騎射部隊',siege:'處理城防與攻城的器械',scout:'探查敵情的偵察部隊',support:'支援行軍與攜帶物資'} as Record<string,string>)[u.combatClass]??'支援城邦的部隊';
 const garrison=Object.values(city.military?.units??{}).reduce((n,c)=>n+c,0),qty=(u:UnitDefinition)=>(city.military?.units[u.id]??0)+(ELITE_VARIANTS[u.id]?city.military?.units[ELITE_VARIANTS[u.id]]??0:0);
 return <div className="view-scroll army-view"><div className="army-heading"><h1>軍隊</h1><span>{city.name} · 駐軍 {fmt(garrison)}</span><details className="army-help"><summary aria-label="軍隊操作說明">？</summary><p>駐軍、在途與訓練中分別計算。拓殖隊由城堡生產，獨立於戰鬥兵；可派遣拓殖、掠奪、征服、偵察與援軍。</p></details></div><div className="army-tabs" role="group" aria-label="軍隊分頁"><button aria-pressed={tab==='recruit'} onClick={()=>setTab('recruit')}>招募</button><button aria-pressed={tab==='march'} onClick={()=>setTab('march')}>行軍（{marches.length+world.armies.filter(a=>a.ownerFactionId===world.playerFactionId).length}）</button></div>
 {tab==='recruit'?<><details className="army-training"><summary>訓練佇列 · {queue.length}/{QUEUE_CAPACITY} · 同時訓練 {queue.filter(j=>j.startsAt<=world.time).length}/{city.economy?.milestones.includes(20000)?2:1}</summary><section className="card queue">{queue.length?queue.map(j=><div className="queue-job" key={j.commandId}><div><strong>{UNIT_CATALOG[j.unitId].name} × {j.remaining}</strong><small>{j.startsAt>world.time?'等待前一項完成':'訓練中'} · 下一名 {<Countdown at={j.nextAt} world={world}/>}</small></div><button aria-label={'取消'+UNIT_CATALOG[j.unitId].name+'訓練'} disabled={busy} onClick={()=>issue({type:'military.cancel',cityId:city.id,trainingCommandId:j.commandId})}>×</button></div>):<p className="muted">目前沒有訓練任務。</p>}<small>取消未完成部分返還80%資源與可容納的人口。</small></section></details>
 {!mobile&&<><RecruitAmount ref={batch} label="每批招募人數"/><p className="recruit-population">本城居民 {fmt(city.population)} · 軍糧 {armyUpkeep(world,city).toFixed(2)}／世界時 · 下方費用為每名，設定招募後查看本批預估。</p></>}
 <label className="recruit-amount">兵種世代<select aria-label="兵種世代" value={unitEra} onChange={e=>{setUnitEra(e.target.value as 'traditional'|'modern');setUnit(null);}}><option value="traditional">傳統兵種</option><option value="modern">現代兵種</option></select></label>
 <CatchupPanel world={world} city={city} issue={issue} busy={busy}/><AwarenessPanel world={world} city={city} issue={issue} busy={busy}/><ModernizationPanel world={world} city={city} issue={issue} busy={busy}/>
 <div className={mobile?'catalog-grid':'desktop-recruits'}>{definitions.map(base=>{const d=eligible(base);if(mobile)return <button className="catalog-card" key={base.id} onClick={()=>{setUnit(base.id);}}><Art spec={unitArt(d.id)} label={d.name}/><strong>{d.name}</strong><span>駐軍 {fmt(qty(base))}</span><small>{d.era==='modern'&&!modernUnitAuthorized(f,d.id)?'需要完整現代軍事資格或此線逆向工程':d.era!=='modern'&&(f.age??0)<d.age||buildingLevel(city,d.producer)<1?'尚未解鎖':'可招募'}</small></button>;const a=recruitmentConditions(world,city,base.id,1);return <article className="card" key={base.id}><div className="recruit-heading"><Art spec={unitArt(a.d.id)} label={a.d.name}/><div><h2>{a.d.name}</h2><small>本城駐軍 {fmt(qty(base))}</small></div></div><p>{role(a.d)}</p><div className="unit-stats">攻 {a.d.attack} · 近防 {a.d.meleeDefense} · 遠防 {a.d.rangedDefense} · 速 {a.d.secondsPerTile}秒／格</div><Cost cost={a.cost} stock={city.stock}/><p>每名訓練 {realTime(a.durationMs,world)} · 人口 {a.d.population}</p><button onClick={()=>{setUnit(base.id);}}>兵種詳情</button><button className="primary" disabled={busy||a.reasons.length>0} onClick={()=>setUnit(base.id)}>{a.reasons[0]??'設定招募'}</button></article>;})}</div>

 </>:<><CombatPanel world={world} city={city} issue={issue} busy={busy} target={armyTarget} onMap={onMap}/><div className="march-list">{marches.length?marches.map(p=><article className="card march-item march-v9" key={p.projectId}><div className="march-open"><Art spec={{path:'art/catalog-technologies.webp',sheet:'technologies',index:3,origin:'reused'}} label="拓殖行軍"/><span><strong>{world.cities.find(c=>c.id===p.sourceCityId)?.name} → {p.target!.name}</strong><small>拓殖隊 ×1 · 移民400 · 護衛 {Object.values(p.escort??{}).reduce((n,c)=>n+c,0)} 名</small></span><span className="march-time"><strong>{<Countdown at={p.arrivalAt!} world={world}/>}</strong><small>預計抵達</small></span></div>{onMap&&<button onClick={()=>onMap(p.target!)}>在地圖查看</button>}<small>出發後不可召回或更換目的地。</small></article>):<div className="empty">沒有行軍中的隊伍。</div>}</div><button onClick={()=>setSettlementOpen(true)}>查看本城拓殖隊</button></>}
 <section className="special-unit-section"><h2>特殊非戰鬥單位</h2><div className="special-unit-grid"><button aria-label="管理拓殖隊" className="catalog-card special-unit-card" onClick={()=>setSettlementOpen(true)}><Art spec={{path:'art/formal/icon-settlement.svg',origin:'reused'}} label="拓殖隊"/><strong>拓殖隊</strong><span>本城待命 ×{ready?1:0}</span><small>城堡生產 · 承載400名移民</small></button><CraftsmanPanel world={world} city={city} issue={issue} busy={busy}/></div></section>
 {settlementOpen&&<Dialog className="special-unit-dialog" title="拓殖隊 · 城堡生產與建城" onClose={()=>setSettlementOpen(false)}><FormalDevelopmentPanel targetPoint={targetPoint} world={world} city={city} issue={issue} busy={busy}/></Dialog>}
 {selected&&<Dialog title={eligible(selected).name} onClose={()=>setUnit(null)}><RecruitmentForm description={role(eligible(selected))} key={selected.id} world={world} city={city} unitId={selected.id} issue={issue} busy={busy} initial={mobile?'1':batch.current?.raw??'1'} onRawChange={mobile?undefined:raw=>batch.current?.setRaw(raw)} onRecruited={()=>setUnit(null)}/></Dialog>}</div>;
}
