import {CONQUEST_REASON_LABELS,SIEGE_ROUND_LIMIT} from '../formal/battleProgress';
import {ScoutIntelDetails} from './ScoutIntelDetails';
import type {BattleReportPayload,BattleParticipant,SiegeChange} from '../formal/combatModel';
import type {FormalWorld,FormalReport} from '../formal/model';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {resourceKeys} from '../formal/model';
import {fmt,Cost} from './UI';
import {LABELS,assetURL,CIV_NAMES} from './artMap';
import {reportTime,reportEventTime} from './reportClock';
const counts=(u:Record<string,number>)=>Object.entries(u).map(([id,n])=>`${UNIT_CATALOG[id]?.name??id} ×${fmt(n)}`).join('、')||'無';
// Project only persisted final damage; never replay siege rounds or read current city levels.
function finalDamage(p:BattleReportPayload){
 const changes=new Map<string,SiegeChange>();
 for(const s of p.siege){
  if(s.target.kind==='wall')continue;
  const key=s.target.kind==='building'?`building:${s.target.key}`:`field:${s.target.slot}`;
  const prior=changes.get(key);if(prior)prior.after=s.after;else changes.set(key,{...s});
 }
 const wall:SiegeChange[] = p.wallBefore>p.wallAfter?[{target:{kind:'wall'},before:p.wallBefore,after:p.wallAfter}]:[];
 return [...wall,...changes.values()].filter(s=>s.before>s.after);
}
const total=(items:BattleParticipant[],key:'before'|'after')=>items.reduce<Record<string,number>>((out,p)=>{for(const [id,n] of Object.entries(p[key]))out[id]=(out[id]??0)+n;return out;},{});
export function BattleReportBody({battle:p,world,report}:{battle:BattleReportPayload;world:FormalWorld;report?:FormalReport}){
 const damage=finalDamage(p),reinforcements=p.history?.filter(e=>e.kind==='reinforcement').length??0;
 const owner=(id:BattleParticipant['ownerFactionId'])=>world.factions.find(f=>f.id===id)?.name??'野外守軍';
 const attack=total(p.attackers,'before'),survive=total(p.attackers,'after'),defense=total(p.defenders,'before'),remain=total(p.defenders,'after');
 const result=p.conquestReason?CONQUEST_REASON_LABELS[p.conquestReason]:({'raid-return':'掠奪結束',conquered:'攻方勝利',held:'守方勝利','mutual-destruction':'雙方全滅','wild-cleared':'攻方勝利','wild-held':'守方勝利','no-target':'目標已改變','scout-success':'偵察成功','scout-failed':'偵察失敗'})[p.outcome];
 const target=p.target,point=p.targetPoint??(target.kind==='city'?world.cities.find(c=>c.id===target.cityId):undefined);
 const banner=p.mission==='scout'?'art/scout-report.webp':target.kind==='wild'?'art/report-'+(p.targetResource??(world.worldLayer?.wildSites.find(s=>s.id===target.siteId&&s.generation===target.generation)?.resource)??'bandit')+'.webp':'art/siege-report.webp';
 const affiliations=(label:string,items:BattleParticipant[])=> <div key={label}><b>{label} · {[...new Set(items.map(g=>owner(g.ownerFactionId)))].join('、')||'野外守軍'}</b><span>軍團：{[...new Set(items.map(g=>g.legionName??'無軍團'))].join('、')}</span><span>帝國：{[...new Set(items.map(g=>g.empireName??'獨立領主'))].join('、')}</span></div>;
 return <><img className="battle-banner" src={assetURL(banner)} alt={p.mission==='scout'?'斥候偵察場景':'戰役場景'}/><div className="battle-summary"><div><strong>{result}</strong><p className="battle-participants"><span className="battle-attacker">{[...new Set(p.attackers.map(a=>owner(a.ownerFactionId)))].join('、')}</span>{p.mission==='scout'?' 偵察 ':' 攻擊 '}<span className="battle-defender">{p.targetName}</span>{point&&<span className="battle-coordinates">（{point.x}, {point.y}）</span>}</p></div></div>
 <div className="battle-affiliations">{affiliations('攻方',p.attackers)}{affiliations('守方',p.defenders)}</div>
 <details className="battle-details"><summary>戰鬥詳情 <span>▾</span></summary><p>主戰 {p.rounds} 回合{p.siegeRounds!==undefined&&<> · 攻城 {p.siegeRounds}／{SIEGE_ROUND_LIMIT} 回合</>} · 結算 {reportTime(p.realResolvedAt??(report?reportEventTime(report,p.resolvedAt):undefined))}。</p><p>投入：{counts(attack)}<br/>存活：{counts(survive)}</p>{p.siegeRounds!==undefined&&<p>城牆 Lv{p.wallBefore} → Lv{p.wallAfter}{p.conquestReason==='siege-timeout'&&' · 守軍已清零／城牆未突破'}</p>}{reinforcements>0&&<p>增援加入：{reinforcements} 次{p.historyOmitted?'（已保留紀錄）':''}。</p>}{p.ownerBefore!==p.ownerAfter&&<p>城市領主：{owner(p.ownerBefore)} → {owner(p.ownerAfter)}<br/>平民人口：{fmt(p.populationBefore)} → {fmt(p.populationAfter)}</p>}</details>
 <div className="table-wrap report-armies"><table><thead><tr><th>部隊</th><th>攻方出戰／損失</th><th>剩餘</th><th>守方出戰／損失</th><th>剩餘</th></tr></thead><tbody>{Array.from(new Set([...Object.keys(attack),...Object.keys(defense)])).filter(id=>(attack[id]??0)+(defense[id]??0)>0).map(id=><tr key={id}><td>{UNIT_CATALOG[id]?.name??id}</td><td>{fmt(attack[id]??0)}／{fmt(Math.max(0,(attack[id]??0)-(survive[id]??0)))}</td><td>{fmt(survive[id]??0)}</td><td>{fmt(defense[id]??0)}／{fmt(Math.max(0,(defense[id]??0)-(remain[id]??0)))}</td><td>{fmt(remain[id]??0)}</td></tr>)}</tbody></table></div>
 {damage.length>0&&<section className="report-damage"><h3>建築／城牆損失</h3><p>{damage.map((s,i)=><span key={i}>{i>0?'、':''}{s.target.kind==='wall'?'城牆':s.target.kind==='field'?'資源田 '+(s.target.slot+1):LABELS[s.target.key.split('.')[0]]??s.target.key} Lv{s.before} → Lv{s.after}</span>)}</p></section>}
 {p.exileReward&&<p>收編：{counts(p.exileReward.units)} · 工匠團 ×1（{CIV_NAMES[p.exileReward!.craftsmanCivilizationId]}）</p>}
 {p.intel&&<ScoutIntelDetails intel={p.intel} world={world} observedRealAt={p.intel.observedRealAt??(report?reportEventTime(report,p.intel.observedAt):undefined)}/>}

 {resourceKeys.some(r=>p.loot[r]>0)&&<div className="report-loot"><span>攜回資源 · 戰利品</span><Cost cost={p.loot}/><small>隨部隊返城入庫，受倉庫容量限制。</small></div>}</>;
}
