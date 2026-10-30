/** Review-only entry: real Art/unitArt; candidates never enter the Runtime registry. */
import {createRoot} from 'react-dom/client';
import {Art} from '../src/game/presentation/Art';
import {unitArt} from '../src/game/presentation/artMap';
import review from '../docs/art-unification/elite-final-20261030/japan/review.json';
import '../src/game/game.css';
import '../src/game/presentation/playable.css';
const choices=review.rows.slice(2);
function Review(){return <main><h1>中國精銳已定案；日本三款候選未定案</h1>
 <p>中國：3798a7f 魚鱗甲＋低姿跪射，正式卡面無損接入。日本正式映射維持現狀。</p>
 <h2>中國正式卡面：512／128／64px</h2><div className="china-sizes">{[512,128,64].map(size=><figure className={'sample-'+size} data-china-size={size} key={size}><figcaption>{size}px 正式精銳連弩衛隊</figcaption><div className="scrollable"><Art label="精銳連弩衛隊" spec={unitArt('elite.guard.civ_zhongguo')}/></div></figure>)}</div>
 <h2>日本：一般武士／現行精銳／候選 1／2／3</h2>
 {[128,64].map(size=><section key={size}><h3>原生 {size}px</h3><div className={'cards sample-'+size} data-native-size={size}>
  <figure data-role="ordinary"><figcaption>一般武士</figcaption><Art label="武士侍從隊" spec={unitArt('guard.civ_japan')}/></figure>
  <figure data-role="current"><figcaption>現行精銳</figcaption><Art label="精銳武士侍從隊" spec={unitArt('elite.guard.civ_japan')}/></figure>
  {choices.map((c,i)=><figure data-candidate={c.id} key={c.id}><figcaption>候選 {i+1}：{c.labels[1]}</figcaption><Art label={c.labels[1]} spec={{path:c.candidate!,origin:'new'}}/></figure>)}
 </div></section>)}
 </main>}
const style=document.createElement('style');style.textContent='html,body{height:auto;overflow:auto}body{margin:0;background:#18211b;color:#e4dac5;font:15px system-ui}main{padding:12px;max-width:1300px;margin:auto}h1{font-size:22px}h2{font-size:19px}h3{font-size:17px}.china-sizes{display:flex;flex-wrap:wrap;gap:12px}.china-sizes figure{max-width:100%;margin:0}.scrollable{max-width:100%;overflow:auto}.sample-512 .formal-art{width:512px;height:512px;flex:none}.sample-128 .formal-art{width:128px;height:128px;flex:none}.sample-64 .formal-art{width:64px;height:64px;flex:none}.cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.cards figure{margin:0;min-width:0;padding:8px;display:flex;flex-direction:column;align-items:center;background:#20291f}.cards figcaption{min-height:44px;font-size:12px;text-align:center;overflow-wrap:anywhere}@media(max-width:620px){.cards.sample-128{grid-template-columns:repeat(2,minmax(0,1fr))}.cards.sample-64{grid-template-columns:repeat(3,minmax(0,1fr))}.cards.sample-64 figure{padding:4px}}';document.head.append(style);createRoot(document.getElementById('root')!).render(<Review/>);
