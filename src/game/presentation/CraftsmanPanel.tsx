import {useState} from 'react';
import type {FormalWorld,FormalCity,FormalCommand} from '../formal/model';
import type {CityId} from '../formal/ids';
import {citySnapshot} from '../formal/economy';
import {craftsmanCastleAction} from './cityActions';
import {CIV_NAMES} from './artMap';
import {Art} from './Art';
import {Cost,Dialog,realTime} from './UI';
import {Countdown} from './LiveValues';
export const CRAFTSMAN_ART={path:'art/formal/unit-craftsman.svg',origin:'new' as const};
export function CraftsmanPanel({world:w,issue,busy}:{world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(''),[destination,setDestination]=useState(''),crafts=(w.extinction?.craftsmen??[]).filter(x=>x.ownerFactionId===w.playerFactionId),x=crafts.find(x=>x.id===selected)??crafts[0],source=x?.cityId?citySnapshot(w,x.cityId):undefined;
 const idle=!!x?.cityId&&!x.eventId&&!x.carrierArmyId&&!x.constructionCommandId,quote=open&&idle&&source?craftsmanCastleAction(w,source,x.id):null;
 const state=(craft:typeof x)=>!craft?'尚無工匠團':craft.constructionCommandId?'城堡施工中':craft.eventId?'轉移中':craft.carrierArmyId?'隨收編軍隊運載／返程':'自有城市待命';
 const buildable=idle&&!!source&&!!quote?.allowed,targets=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId&&c.id!==source?.id);
 return <><button aria-label="管理工匠團" className="catalog-card special-unit-card" onClick={()=>setOpen(true)}><Art spec={CRAFTSMAN_ART} label="工匠團"/><strong>工匠團</strong><span>待命 {crafts.filter(x=>x.cityId&&!x.constructionCommandId&&!x.eventId&&!x.carrierArmyId).length} · 共 {crafts.length}</span><small>文明城堡 · 非戰鬥單位</small></button>{open&&<Dialog title="工匠團 · 文明城堡" onClose={()=>setOpen(false)} className="special-unit-dialog"><div className="special-unit-detail"><Art spec={CRAFTSMAN_ART} label="工匠團工具"/><p>收編流亡軍後取得；只能在自有城市轉移。同文明及外文明工匠均可免四資源興建對應文明城堡 Lv1，正常前置與工期不變，完成後消耗工匠；後續升級正常收費。</p></div>{crafts.length?<><label>選取工匠團<select aria-label="選取工匠團" value={x.id} onChange={e=>{setSelected(e.target.value);setDestination('');}}>{crafts.map(c=><option key={c.id} value={c.id}>{CIV_NAMES[c.civilizationId]}工匠 · {state(c)}</option>)}</select></label><h3>{CIV_NAMES[x.civilizationId]}工匠團</h3><p>{state(x)} · {source?.name??(x.destinationCityId?w.cities.find(c=>c.id===x.destinationCityId)?.name:'隨收編軍隊運載')}{x.arrivalAt!==null&&<> · 抵達 <Countdown at={x.arrivalAt} world={w}/></>}</p>{idle&&source&&<><label>自有目的城市<select aria-label="自有目的城市" value={destination} onChange={e=>setDestination(e.target.value)}><option value="">選擇城市</option>{targets.map(c=><option key={c.id} value={c.id}>{c.name}（{c.x}, {c.y}）</option>)}</select></label><button disabled={busy||!targets.some(c=>c.id===destination)} onClick={()=>issue({type:'craftsman.move',cityId:source.id,craftsmanId:x.id,destinationCityId:destination as CityId})}>轉移工匠團</button><section className="card"><h3>建造{CIV_NAMES[x.civilizationId]}城堡</h3>{quote?.cost&&<Cost cost={quote.cost} stock={source.stock}/>}<p>施工時間 {quote?realTime(quote.duration,w):'—'}</p><p>{quote?.reason}</p><button className="primary" disabled={busy||!buildable} onClick={()=>issue({type:'craftsman.castle',cityId:source.id,craftsmanId:x.id})}>工匠建造城堡 Lv1（免資源）</button></section></>}</>:<p className="empty">尚無自己的工匠團。工匠取得與文明依真實收編結果決定。</p>}</Dialog>}</>;
}
