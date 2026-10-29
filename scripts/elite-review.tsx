/** Review-only candidate gallery. No registry writes or product entry point. */
import {createRoot} from 'react-dom/client';
import {Art} from '../src/game/presentation/Art';
import {unitArt} from '../src/game/presentation/artMap';
import '../src/game/game.css';
import '../src/game/presentation/playable.css';
const root='docs/art-unification/elite-review-20261029/candidates/';
const groups=[{name:'中國',civ:'zhongguo',ids:['china-A-lamellar','china-B-scale','china-C-imperial']},{name:'日本',civ:'japan',ids:['japan-A-oyoroi','japan-B-domaru','japan-C-gusoku']}];
function Review(){return <main><h1>中國／日本精銳候選，正式映射維持 8736bad</h1>{groups.map(g=><section key={g.civ}><h2>{g.name}</h2>{[128,64].map(size=><div key={size} className={'review-row size-'+size}><article><span>普通 {size}px</span><Art label={g.name+'普通衛隊'} spec={unitArt('guard.civ_'+g.civ)}/></article>{g.ids.map((id,i)=><article key={id} data-candidate={id}><span>候選 {'ABC'[i]} {size}px</span><Art label={id} spec={{path:root+id+'.webp',origin:'new'}}/></article>)}</div>)}</section>)}</main>}
const css=document.createElement('style');css.textContent='html,body{overflow:auto;height:auto}body{margin:0;background:#18211b;color:#e4dac5;font:15px system-ui}main{padding:12px;max-width:1100px;margin:auto}h1{font-size:20px}h2{font-size:18px}.review-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0}.review-row article{display:flex;flex-direction:column;align-items:center;background:#20291f;padding:8px;min-width:0}.review-row span{font-size:12px}.size-128 .formal-art{width:128px;height:128px;flex:none}.size-64 .formal-art{width:64px;height:64px;flex:none}@media(max-width:620px){.size-128{grid-template-columns:repeat(2,minmax(0,1fr))}.size-64{gap:2px}.size-64 article{padding:4px 0}}';document.head.append(css);createRoot(document.getElementById('root')!).render(<Review/>);
