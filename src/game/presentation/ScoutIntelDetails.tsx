import type {ScoutIntel} from '../formal/combatModel';
import type {FormalWorld} from '../formal/model';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {Cost,fmt} from './UI';
import {LABELS} from './artMap';
import {reportTime} from './reportClock';
const counts=(units:Record<string,number>)=>Object.entries(units).map(([id,n])=>`${UNIT_CATALOG[id]?.name??id} ×${fmt(n)}`).join('、')||'無';
/** Render only saved observations, never fetch live target state. */
export function ScoutIntelDetails({intel,world,observedRealAt=intel.observedRealAt}:{intel:ScoutIntel;world:FormalWorld;observedRealAt?:number}){
 const complete=intel.cityId!==undefined&&intel.garrison!==undefined&&intel.reinforcements!==undefined&&intel.resources!==undefined&&intel.wallLevel!==undefined&&intel.defenses!==undefined;
 return <section className="scout-observation"><h3>偵察快照</h3><p>觀測時間：{reportTime(observedRealAt)} · 當時庫存，非即時數值</p>
 {intel.cityId!==undefined&&!complete&&<small>舊版部分情報紀錄；未記錄的項目不補推。</small>}
 <p>駐軍：{counts(intel.garrison??intel.units)}</p>
 {intel.reinforcements!==undefined&&<div className="scout-reinforcements"><h3>援軍</h3>{intel.reinforcements.length?intel.reinforcements.map((g,i)=><p key={i}>{world.factions.find(f=>f.id===g.ownerFactionId)?.name??'援軍勢力'}：{counts(g.units)}</p>):<p>無援軍</p>}</div>}
 {intel.resources&&<><h3>資源庫存</h3><Cost cost={intel.resources}/></>}
 {intel.wallLevel!==undefined&&<div className="scout-defenses"><h3>城牆／城防</h3><p>城牆 Lv{intel.wallLevel}</p>{Object.entries(intel.defenses??{}).map(([id,n])=><p key={id}>{LABELS[id.split('.')[0]]??id} Lv{n}</p>)}{!Object.keys(intel.defenses??{}).length&&<p>無防禦建築</p>}</div>}
 </section>;
}
