import type {FormalWorld} from '../formal/model';
import {victoryConditions,victoryScope,VICTORY_DURATION} from '../formal/victory';
import {Countdown} from './LiveValues';
export function VictoryPanel({world:w}:{world:FormalWorld}){
 const scope=victoryScope(w,w.playerFactionId),c=victoryConditions(w).find(c=>c.scope===scope),result=w.victory?.result;
 return <section className="card" aria-label="正式勝利條件"><h2>正式勝利條件</h2>{result?<p role="status">正式{result.kind==='conquest'?'征服':'帝國霸權'}勝利 · {result.scope} · 世界時間 {(result.at/3600000).toFixed(2)}h</p>:<>
 <p>城市 {((c?.cityShare??0)*100).toFixed(1)}% · 人口 {((c?.populationShare??0)*100).toFixed(1)}%</p><p>征服：城市／人口各 ≥70%，無控制 ≥15% 城市的敵對帝國 · {c?.hostileEmpire?'敵對帝國條件未達成':'敵對帝國條件已達成'} · 連續 12 世界小時。</p>
 <p>帝國霸權：3 軍團、15 活躍領主、城市／人口各 ≥45%、世界軍力第 1 · 連續 24 世界小時。{c?.empire&&<>目前 {c.legions} 軍團／{c.activeLords} 活躍領主／軍力第 {c.militaryRank??'—'} 名。</>}</p>
 {(['conquest','hegemony'] as const).map(kind=>{const timer=w.victory?.candidates.find(t=>t.scope===scope&&t.kind===kind);return <p key={kind}>{kind==='conquest'?'征服':'帝國霸權'}：{timer?<>全部條件持續達標，剩餘 <Countdown world={w} at={timer.startedAt+VICTORY_DURATION[kind]}/></>:'條件尚未同時達標'}</p>;})}
 <p>任一條件失效即重新計時。奇觀、文明突破及現代化本身不觸發勝利。</p></>}</section>;
}
