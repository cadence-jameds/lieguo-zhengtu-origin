import type {WorldRead} from '../presentationModel';
import {useState} from 'react';
import type {FormalCity,FormalCommand} from '../formal/model';
import type {CityId} from '../formal/ids';
import {citySnapshot} from '../formal/economy';
import {useConstructionPreviews,PreviewStatus} from './useConstructionPreviews';
import {CIV_NAMES} from './artMap';
import portraitURL from './media/unit-craftsman-corps.webp';
import './specialUnitPortrait.css';
import {Cost,Dialog,realTime} from './UI';
import {Countdown} from './LiveValues';
export const CRAFTSMAN_ART={path:portraitURL,origin:'new' as const};
function knownCivilization(id:string|undefined){
 return id&&Object.hasOwn(CIV_NAMES,id)?CIV_NAMES[id]:undefined;
}
function CraftsmanPortrait({civilization}:{civilization?:string}){
 const short=civilization?.[0];
 return <span className="craftsman-portrait"><img src={CRAFTSMAN_ART.path} className="craftsman-portrait-image" width={72} height={72} loading="lazy" decoding="async" alt="工匠團"/>{short&&<span className="craftsman-civ-tag" role="img" aria-label={'工匠團文明：'+civilization} title={civilization}>{short}</span>}</span>;
}
export function CraftsmanPanel({world:w,issue,busy}:{world:WorldRead;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(''),[destination,setDestination]=useState(''),crafts=(w.extinction?.craftsmen??[]).filter(x=>x.ownerFactionId===w.playerFactionId),x=crafts.find(x=>x.id===selected)??crafts[0],source=x?.cityId?citySnapshot(w,x.cityId):undefined;
 // Ownership determines who can manage a team; its own civilization still determines the castle it can build.
 const selectedCiv=knownCivilization(x?.civilizationId);
 const commonCiv=crafts.length>0&&crafts.every(c=>c.civilizationId===crafts[0].civilizationId)?knownCivilization(crafts[0].civilizationId):undefined;
 const idle=!!x?.cityId&&!x.eventId&&!x.carrierArmyId&&!x.constructionCommandId,preview=useConstructionPreviews(w,source?.id,open&&idle&&source?[{craftsmanId:x.id}]:[]),result=preview.results[0],quote=result?.status==='ready'?{allowed:true,cost:result.quote.paidResources,duration:result.quote.durationMs,reason:'符合工匠建堡資格'}:null;
 const state=(craft:typeof x)=>!craft?'尚無工匠團':craft.constructionCommandId?'城堡施工中':craft.eventId?'轉移中':craft.carrierArmyId?'隨收編軍隊運載／返程':'自有城市待命';
 const buildable=idle&&!!source&&result?.status!=='invalid',targets=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId&&c.id!==source?.id);
 return <><button aria-label="管理工匠團" className="catalog-card special-unit-card" onClick={()=>setOpen(true)}><CraftsmanPortrait civilization={commonCiv}/><strong>工匠團</strong><span>待命 {crafts.filter(x=>x.cityId&&!x.constructionCommandId&&!x.eventId&&!x.carrierArmyId).length} · 共 {crafts.length}</span><small>文明城堡 · 非戰鬥單位</small></button>{open&&<Dialog title="工匠團 · 文明城堡" onClose={()=>setOpen(false)} className="special-unit-dialog"><div className="special-unit-detail"><CraftsmanPortrait civilization={selectedCiv}/><p>收編流亡軍後取得；只能在自有城市轉移。同文明及外文明工匠均可免四資源興建對應文明城堡 Lv1，正常前置與工期不變，完成後消耗工匠；後續升級正常收費。</p></div>{crafts.length?<><label>選取工匠團<select aria-label="選取工匠團" value={x.id} onChange={e=>{setSelected(e.target.value);setDestination('');}}>{crafts.map(c=><option key={c.id} value={c.id}>{knownCivilization(c.civilizationId)??''}工匠 · {state(c)}</option>)}</select></label><h3>{selectedCiv??''}工匠團</h3><p>{state(x)} · {source?.name??(x.destinationCityId?w.cities.find(c=>c.id===x.destinationCityId)?.name:'隨收編軍隊運載')}{x.arrivalAt!==null&&<> · 抵達 <Countdown at={x.arrivalAt} world={w}/></>}</p>{idle&&source&&<><label>自有目的城市<select aria-label="自有目的城市" value={destination} onChange={e=>setDestination(e.target.value)}><option value="">選擇城市</option>{targets.map(c=><option key={c.id} value={c.id}>{c.name}（{c.x}, {c.y}）</option>)}</select></label><button disabled={busy||!targets.some(c=>c.id===destination)} onClick={()=>issue({type:'craftsman.move',cityId:source.id,craftsmanId:x.id,destinationCityId:destination as CityId})}>轉移工匠團</button><section className="card"><h3>建造{selectedCiv??''}城堡</h3><PreviewStatus preview={preview}/><Cost cost={{food:0,wood:0,stone:0,gold:0}} stock={source.stock}/><p>施工時間 {quote?realTime(quote.duration,w):'—'}</p><p>{quote?.reason??(result&&result.status!=='ready'?result.reason:'正式提交時驗證工匠資格')}</p><button className="primary" disabled={busy||!buildable} onClick={()=>issue({type:'craftsman.castle',cityId:source.id,craftsmanId:x.id})}>工匠建造城堡 Lv1（免資源）</button></section></>}</>:<p className="empty">尚無自己的工匠團。工匠取得與文明依真實收編結果決定。</p>}</Dialog>}</>;
}
