import type {FormalWorld} from '../formal/model';
import type {BattleId} from '../formal/ids';
import type {BattleLogEntry} from '../formal/combatModel';
import {liveBattleView} from '../formal/battleView';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {Dialog,fmt} from './UI';
import {Countdown} from './LiveValues';
export function battleEventText(e:BattleLogEntry){
 const labels={'combat-summary':`主戰第 ${e.combatRound} 回合階段摘要`,'siege-summary':`攻城第 ${e.siegeRound} 回合階段摘要`,'siege-start':'守軍已清空，轉入攻城','combat-resumed':'守軍補防，暫停攻城並恢復交戰',reinforcement:'合法部隊加入戰役','wall-breached':`城牆 Lv${e.wallBefore} → Lv${e.wallAfter}`,'catapult-batch':'已完成本戰役唯一的合法建築／資源田破壞批次'};
 return labels[e.kind];
}
export function LiveBattleDetails({world,battleId,onClose}:{world:FormalWorld;battleId:BattleId;onClose:()=>void}){
 const v=liveBattleView(world,battleId);
 return <Dialog title={v?`${v.defending?'本城防守中':'部隊資訊'} · ${v.targetName}`:'戰鬥已結束'} onClose={onClose}>{v?<div className="live-battle-details"><p>{v.phase==='siege'?'攻城中':'交戰中'} · 主戰第 {v.combatRound} 回合</p><p>下一回合 <Countdown at={v.nextRoundAt} world={world}/></p>{v.phase==='siege'&&<section><h3>攻城第 {v.siegeRound}／{v.siegeLimit} 回合</h3><p>城牆 Lv{v.wallBefore} → Lv{v.wallLevel} · 剩餘 {v.remainingSiegeRounds} 回合</p><progress aria-label="城牆降級進度" max={Math.max(1,v.wallBefore)} value={Math.max(0,v.wallBefore-v.wallLevel)}/><p>拆牆進行中；已降低的牆級保留。</p></section>}
 <h3>我方兵力</h3><div className="table-wrap"><table><thead><tr><th>兵種</th><th>原始／續到</th><th>目前存活</th><th>累計傷亡</th></tr></thead><tbody>{Object.keys(v.initial).map(id=><tr key={id}><td>{UNIT_CATALOG[id]?.name??id}</td><td>{fmt(v.initial[id])}</td><td>{fmt(v.alive[id]??0)}</td><td>{fmt(v.casualties[id]??0)}</td></tr>)}</tbody></table></div><p className="muted">敵方即時精確編成未公開。偵察情報是觀測當時的歷史快照。</p>
 <details open><summary>最近戰況與階段摘要</summary>{v.historyOmitted>0&&<p>較早 {v.historyOmitted} 筆摘要已省略。</p>}<ol>{v.history.map((e,i)=><li key={i}>{battleEventText(e)}{e.forces?.map(f=><span key={f.ownerFactionId}> · 我方戰鬥兵存活 {fmt(f.alive)}／累計傷亡 {fmt(f.casualties)}</span>)}（主戰 {e.combatRound}／攻城 {e.siegeRound}）</li>)}</ol></details></div>:<p>請到戰報查看本次戰役的最終正式結果。</p>}</Dialog>;
}
