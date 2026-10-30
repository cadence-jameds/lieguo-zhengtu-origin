/** Review-only entry using actual Runtime mappings and the real Art component. */
import {createRoot} from 'react-dom/client';
import {Art} from '../src/game/presentation/Art';
import {unitArt} from '../src/game/presentation/artMap';
import '../src/game/game.css';
import '../src/game/presentation/playable.css';
function Review(){return <main><h1>中日精銳：玩家正式定案</h1>
 <p>日本：候選 1「鬼面大鎧＋過頂舉刀」。中國：3798a7f「B 高階魚鱗甲＋低姿跪射」，保持不變。</p>
 {(['japan','zhongguo'] as const).map(civ=><section key={civ}><h2>{civ==='japan'?'日本':'中國'}正式 Runtime</h2>
 <div className="samples">{[512,128,64].map(size=><figure key={size} data-civ={civ} data-size={size}>
 <figcaption>{size}px 原生尺寸；512px 在窄螢幕可橫向捲動</figcaption>
 <div className="scrollable"><div style={{width:size,height:size}}><Art label={`${civ}精銳 ${size}px`} spec={unitArt('elite.guard.civ_'+civ)}/></div></div>
 </figure>)}</div></section>)}
 </main>}
const style=document.createElement('style');style.textContent='html,body{height:auto;overflow:auto}body{margin:0;background:#18211b;color:#e4dac5;font:15px system-ui}main{padding:12px;max-width:1300px;margin:auto}h1{font-size:22px}h2{font-size:19px}.samples{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;max-width:100%;min-width:0}figcaption{font-size:12px;margin-bottom:8px;max-width:280px}.scrollable{max-width:100%;overflow:auto}.formal-art{width:100%;height:100%;flex:none}';document.head.append(style);createRoot(document.getElementById('root')!).render(<Review/>);
