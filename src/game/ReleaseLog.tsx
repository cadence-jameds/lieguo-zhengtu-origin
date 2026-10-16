import {RELEASE,releaseHistory} from './release';
import legacyChangelog from '../../releases/legacy-changelog.md?raw';
export function ReleaseLog(){return <div className="release-log">
 <p className="muted">{RELEASE.date} · 建置 {RELEASE.commitSha.slice(0,7)}{RELEASE.dirty?' · 本機待審預覽':''}</p>
 <h3>{releaseHistory[0].title}</h3><ul>{releaseHistory[0].notes.map(n=><li key={n}>{n}</li>)}</ul>
 <details><summary>近期版本與過往紀錄</summary>
 {releaseHistory.slice(1).map(r=><section key={r.version}><h3>v{r.version} · {r.date} · {r.title}</h3>{r.pr&&<small>已合併變更 #{r.pr}（補登紀錄，非另一次發布聲明）</small>}<ul>{r.notes.map(n=><li key={n}>{n}</li>)}</ul></section>)}
 <details><summary>更早更新重點（保留原始未分版紀錄）</summary><ul>{RELEASE.legacyNotes.map((n,i)=><li key={i}>{n}</li>)}</ul></details>
 <details><summary>早期版本原始更新日誌</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit'}}>{legacyChangelog}</pre></details>
 </details></div>;}
