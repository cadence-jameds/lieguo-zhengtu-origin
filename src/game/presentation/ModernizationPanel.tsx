import {useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {isMissionArmy} from '../formal/combatModel';
import {modernizationTarget,UNIT_CATALOG} from '../formal/unitCatalog';
import {unitModernizationCost} from '../formal/military';
import {Cost,fmt} from './UI';
import {useLiveCity} from './liveClock';
export function ModernizationPanel({world,city:original,issue,busy}:{world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean}){
 const city=useLiveCity(world,original,true)!,[source,setSource]=useState('garrison'),[count,setCount]=useState(1),f=world.factions.find(f=>f.id===city.ownerFactionId)!,armies=world.armies.filter(isMissionArmy).filter(a=>a.ownerFactionId===f.id&&a.status==='stationed'&&a.target.kind==='city'&&a.target.cityId===city.id),army=armies.find(a=>a.id===source),units=source==='garrison'?city.military?.units??{}:army?.units??{},engaged=world.combat?.battles.some(b=>b.cityId===city.id);
 return <details className="army-training"><summary>舊兵現代化改裝</summary><section className="card"><p>{f.modernQualification==='full'?'已取得完整現代軍事資格':'需要完整現代軍事資格'}</p><p>每名使用現代兵基礎四資源成本的10%，立即完成，不另扣人口。行軍或交戰中不能改裝。</p>
 <label>改裝部隊<select aria-label="改裝部隊" value={source} onChange={e=>setSource(e.target.value)}><option value="garrison">本城駐軍</option>{armies.map(a=><option key={a.id} value={a.id}>本方駐防援軍 · {world.cities.find(c=>c.id===a.originCityId)?.name}</option>)}</select></label>
 <label>改裝數量<input aria-label="改裝數量" type="number" min={1} max={100000} value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
 {engaged&&<p role="status">本城交戰或攻城中，暫停改裝。</p>}
 {Object.entries(units).filter(([id,n])=>n>0&&modernizationTarget(id)).map(([id,n])=>{const target=modernizationTarget(id)!,cost=unitModernizationCost(target),valid=Number.isSafeInteger(count)&&count>0&&count<=n;for(const r of resourceKeys)cost[r]*=valid?count:1;return <article key={id}><p>{UNIT_CATALOG[id].name}（存活 {fmt(n)}）→ {target.name}</p><Cost cost={cost} stock={city.stock}/><button disabled={busy||f.modernQualification!=='full'||!!engaged||!valid||resourceKeys.some(r=>city.stock[r]<cost[r])} onClick={()=>issue({type:'military.modernize',cityId:city.id,unitId:id,count,...(army?{armyId:army.id}:{})})}>改裝 {target.name} ×{valid?count:0}</button></article>;})}
 {!Object.keys(units).some(id=>units[id]>0&&modernizationTarget(id))&&<p>目前沒有可改裝的存活舊兵。</p>}
 </section></details>;
}
