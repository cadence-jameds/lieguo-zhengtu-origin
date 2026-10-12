import {landCoverName} from './landCover';
import {empireOwner} from './influence';
import {empireUiColor} from './empirePalette';
import {mapColors,mapRelation,relationship,relationshipColor} from './mapRelations';
import {organizationName} from './organizations';
import {totalBuildingLevel} from './city';
import {fieldsAt,fieldCounts,fieldBuildings,fieldNames} from './resourceFields';
import {transportUsed} from './realmSystems';
import {uniqueCityName} from './cityNames';
import {observed,knownOwner} from './intelligence';
import { useState } from 'react';
import { civilizationById } from '../content/civilizations';
import { faction,factionName,marchDuration,protectedFaction } from './legacyEngine';
import { isWildSite, siteLevel, siteName } from './npc';
import { tileReason, settleReason, settlementCost, escortReason, settlementEscort } from './settlement';
import { resourceNames } from './content';
import { countTroops,emptyStock,emptyTroops,resources,unitIds,type Command,type Game,type Mission,type Node,type Troops,type Point } from './legacyTypes';
import { clock,Cost,Dialog,duration,fmt,unitName } from './ui';
export const missionNames:Record<Mission,string>={scout:'偵察',raid:'掠奪',occupy:'佔領',reinforce:'增援',transport:'運輸',settle:'建立聚落'};
export const needsProtectionConsent=(g:Game,n:Node,kind:Mission)=>protectedFaction(g,g.player)&&!!n.owner&&n.owner!==g.player&&['scout','raid','occupy'].includes(kind);
const kindNames={capital:'核心首都',village:'聚落',camp:'盜賊營地',iron:'採石場',horses:'沃野農莊',ruins:'無主遺址'};
export function MarchDialog({g,from,to,kind,onClose,issue,busy}:{g:Game;from:Node;to:Node;kind:Mission;onClose:()=>void;issue:(c:Command)=>void;busy:boolean}){
  const [troops,setTroops]=useState<Troops>(()=>({...emptyTroops(),...(kind==='settle'?settlementEscort(from):{}),scout:kind==='scout'?Math.min(2,from.troops.scout):0})),[cargo,setCargo]=useState(emptyStock),[accept,setAccept]=useState(false);
  const protectedTarget=!!to.owner&&to.owner!==g.player&&protectedFaction(g,to.owner)&&['scout','raid','occupy'].includes(kind),hostile=!protectedTarget&&needsProtectionConsent(g,to,kind),count=countTroops(troops),travel=marchDuration(g,from,to,troops,kind);
  const invalid=unitIds.some(u=>!Number.isSafeInteger(troops[u])||troops[u]<0||troops[u]>from.troops[u])||resources.some(r=>!Number.isFinite(cargo[r])||cargo[r]<0||cargo[r]>from.stock[r]),intel=observed(g,to);
  return <Dialog title={missionNames[kind]+' · '+to.name} onClose={onClose}><div className="mission-route"><span>{from.name}<small>出發城市</small></span><b>→</b><span>{to.name}<small>{knownOwner(g,to)===undefined?'歸屬未明':factionName(g,knownOwner(g,to)??null)}</small></span><strong>{duration(travel/g.speed)}<small>單程行軍</small></strong></div>
    {intel&&kind!=='transport'&&kind!=='reinforce'&&<p className="intel-note">上次偵察：守軍 {countTroops(intel.troops)} 名、城牆 {intel.wall} 級；情報距今 {clock(g.time-intel.at)}。駐軍可能已有變化。</p>}
    {kind==='settle'?<p>派出 400 名居民，建城消耗 350 食物、300 木材、650 石材、350 黃金。起點需至少 600 人；居民隨隊移出，途中撤回會歸還人口。</p>:kind==='transport'?<><p>商隊 {Math.max(0,totalBuildingLevel(from,'market')*5-transportUsed(g,from.id)/500)}／{totalBuildingLevel(from,'market')*5} 支可用，每支載重 500；本趟需 {Math.ceil(resources.reduce((s,r)=>s+cargo[r],0)/500)} 支。商隊返回後恢復可用。</p><div className="cargo-inputs">{resources.map(r=><label key={r}>{resourceNames[r]} <small>庫存 {fmt(from.stock[r])}</small><input type="number" min={0} max={Math.floor(from.stock[r])} value={cargo[r]} onChange={e=>setCargo({...cargo,[r]:Number(e.target.value)})}/></label>)}</div></>:<><div className="section-label"><h3>編入部隊</h3>{kind!=='scout'&&<button onClick={()=>setTroops({...from.troops,scout:0})}>投入全部戰鬥兵</button>}</div><div className="troop-inputs">{unitIds.filter(u=>kind==='scout'?u==='scout':u!=='scout').map(u=><label key={u}><span>{unitName(u,g.player)}<small>可用 {from.troops[u]}</small></span><input type="number" min={0} max={from.troops[u]} value={troops[u]} onChange={e=>setTroops({...troops,[u]:Number(e.target.value)})}/></label>)}</div></>}
    {kind==='settle'&&<><EscortInputs g={g} from={from} troops={troops} onChange={setTroops}/><p>{escortReason(from,troops)}</p></>}
    {kind==='occupy'&&<p className="muted">至少 12 名戰鬥兵出征，戰後至少存活 8 名才能佔領。佔領部隊留城駐防。</p>}
    {kind==='raid'&&<p className="muted">部隊載運量最高每人 20。戰利品隨倖存部隊返回，無法立即入庫。</p>}
    {protectedTarget&&<p className="intel-note">對方仍受新手保護，暫時不能偵察或攻擊。</p>}{hostile&&<label className="warning-check"><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/><span>確認對其他領主發出敵對命令（包含偵察）；這會立即解除全部新手保護，取消命令也不會恢復。</span></label>}
    <div className="dialog-actions"><button onClick={onClose}>返回</button><button className="primary" disabled={busy||protectedTarget||invalid||(kind==='settle'&&!!escortReason(from,troops))||(hostile&&!accept)||(!['transport','settle'].includes(kind)&&count===0)} onClick={()=>{issue({type:'march',from:from.id,to:to.id,kind,troops,cargo});onClose();}}>下達{missionNames[kind]}命令</button></div>
  </Dialog>;
}
export function Target({g,n,home,onMission,onCity}:{g:Game;n:Node;home:Node;onMission:(kind:Mission)=>void;onCity:()=>void}){
  const info=observed(g,n),own=n.owner===g.player,owner=knownOwner(g,n),culture=owner?civilizationById.get(owner):undefined,leader=owner?faction(g,owner):undefined,empire=owner?empireOwner(g,owner):null,relationKind=mapRelation(g,n);
  return <section className="target-panel"><span className="eyebrow">{kindNames[n.kind]} · ({n.x}, {n.y}){isWildSite(n)?' · Lv.'+siteLevel(n):''}</span><div className="target-name"><h2>{isWildSite(n)?siteName(n):n.name}</h2><span className="owner-stripe" style={{background:mapColors[relationKind]}}/></div>{n.owner&&protectedFaction(g,n.owner)&&<p className="intel-note">新手保護 · 剩餘 {duration(((n.owner===g.player?g.protectionUntil:faction(g,n.owner).protectionUntil??0)-g.time)/g.speed)}</p>}{owner?<dl className="target-ownership"><div><dt>玩家</dt><dd>{factionName(g,owner)}{own?' · 己方':''}</dd></div><div><dt>文明</dt><dd>{culture?.name??'未知文明'}</dd></div><div><dt>軍團</dt><dd className={leader?.league?'relation-name':undefined} style={leader?.league?{color:mapColors[relationKind]}:undefined}>{leader?.league?organizationName(g,leader.league,'league'):'無軍團'}</dd></div><div><dt>帝國</dt><dd className={empire?'empire-name':undefined} style={empire?{color:empireUiColor(g,empire)}:undefined}>{empire?organizationName(g,empire,'empire'):'獨立領主'}</dd></div><div><dt>關係</dt><dd style={{color:relationshipColor(relationKind)}}>{relationship(relationKind)}</dd></div></dl>:<p className="target-owner">中立據點 · 關係：<span style={{color:mapColors.neutral}}>中立</span></p>}
    {n.retiring?<p>此據點待既有部隊離開後退場，請選擇其他目標。</p>:n.respawnAt?<p>此處已被清除，請選擇其他據點。新的營地會在其他位置出現。</p>:<>
      <div className="target-facts"><span>{own?'駐軍':'已知駐軍'}<strong>{own?countTroops(n.troops):info?countTroops(info.troops):'尚未偵察'}</strong></span>{own&&g.marches.some(m=>m.stationed&&m.kind==='reinforce'&&m.to===n.id)&&<span>軍團援軍<strong>{g.marches.filter(m=>m.stationed&&m.kind==='reinforce'&&m.to===n.id).reduce((s,m)=>s+countTroops(m.troops),0)}</strong></span>}<span>城防<strong>{own?n.buildings.wall+' 級':info?info.wall+' 級':'尚未偵察'}</strong></span>{['capital','village'].includes(n.kind)&&<span>人口<strong>{fmt(n.population)}</strong></span>}</div>
      {!own&&(info?<small className="intel-age">駐軍情報距今 {clock(g.time-info.at)}，數量可能已變動。{info.owner!==owner?'領主已變更，這是先前的駐軍紀錄。':''}</small>:<p className="muted">駐軍情報未知，請先派遣斥候偵察。</p>)}
      {!own&&<div className="target-stock"><small>偵察資源情報</small>{info?.scouted&&info.stock?<><Cost cost={info.stock} showZero/><small>觀測於 {info.realAt===undefined?'歷史觀測時間未記錄':new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(info.realAt)} · 當時庫存，非即時數值</small></>:<p>資源庫存未知</p>}</div>}
      {isWildSite(n)&&<p className="target-note">Lv.{siteLevel(n)} 據點{n.npcResource?'，以'+resourceNames[n.npcResource]+'為主要戰利品':''}。等級越高，守軍越強、庫存越多。掠奪勝利後消失，{30+(siteLevel(n)-1)*5} 世界分鐘後在其他合法位置重生；物資受部隊載量限制。</p>}

      <div className="target-actions">{own?<>{['capital','village'].includes(n.kind)&&<button className="primary" onClick={onCity}>進入城市</button>}{n.id!==home.id&&<><button onClick={()=>onMission('reinforce')}>從 {home.name} 增援</button><button onClick={()=>onMission('transport')}>運送資源</button></>}</>:<><button onClick={()=>onMission('scout')}>派遣斥候</button><button className="primary" onClick={()=>onMission('raid')}>掠奪物資</button>{(!isWildSite(n)||n.owner)&&<button onClick={()=>onMission('occupy')}>佔領據點</button>}</>}</div>
    </>}
  </section>;
}
export function TileDialog({g,from,point,issue,busy,onClose,mobile:_mobile=false}:{mobile?:boolean;g:Game;from:Node;point:Point;issue:(c:Command)=>void;busy:boolean;onClose:()=>void}){
  const [troops,setTroops]=useState(()=>settlementEscort(from)),[step,setStep]=useState<1|2>(1),[cityName,setCityName]=useState(()=>uniqueCityName(g));
  const reason=settleReason(g,from,point)||escortReason(from,troops),inside=point.x>=0&&point.y>=0&&point.x<256&&point.y<256;
  const blocked=tileReason(g,point);
  const isFavorite=g.favoriteTiles?.some(p=>p.x===point.x&&p.y===point.y)??false;
  const travel=inside&&!blocked?marchDuration(g,from,{...from,...point,kind:'ruins'},troops,'settle'):0;
  if(blocked)return <Dialog title={'地圖位置 · ('+point.x+', '+point.y+')'} onClose={onClose}><p>{inside?landCoverName(point.x,point.y,g.seed,g.terrainVersion):'世界邊界外'}</p><p role="status">{blocked}</p><div className="dialog-actions"><button onClick={onClose}>返回地圖</button></div></Dialog>;
  return <Dialog title={'地圖位置 · ('+point.x+', '+point.y+')'} onClose={onClose} headerAction={<button type="button" className="tile-favorite-star" aria-pressed={isFavorite} aria-label={isFavorite?'從我的最愛移除這組地塊':(g.favoriteTiles?.length??0)>=5?'我的最愛已滿五組，請先移除一組':'收藏這組地塊'} title={isFavorite?'取消收藏':(g.favoriteTiles?.length??0)>=5?'最多收藏五組':'收藏這組地塊'} disabled={busy||(!isFavorite&&(g.favoriteTiles?.length??0)>=5)} onClick={()=>issue({type:'tile_favorite',action:isFavorite?'remove':'add',at:point})}>{isFavorite?'★':'☆'}</button>}>
    {<p className="settle-steps">{step===1?'1／2 · 地塊與建城資訊':'2／2 · 編組護送部隊'}</p>}
    {(step===1)?<><p className="eyebrow">{inside?landCoverName(point.x,point.y,g.seed,g.terrainVersion):'世界邊界外'}</p><h2>建立新城</h2><p className="field-composition-summary">{fieldBuildings.map(b=><span key={b}>{fieldNames[b]} <strong>{fieldCounts(fieldsAt(g,point))[b]}</strong></span>)}<small>共 18 塊 · 零級即產出</small></p><label>城市名稱<div className="name-input"><input maxLength={24} value={cityName} onChange={e=>setCityName(e.target.value)}/><button aria-label="隨機城名" onClick={()=>setCityName(uniqueCityName(g,Math.floor(Math.random()*10000)))}>🎲</button></div></label><p>從 {from.name} 派出 400 名居民。抵達後建立城市中心，18 塊城郊資源地立即產出；城內空地由你規劃。</p><Cost cost={settlementCost} stock={from.stock}/><p>出發城市人口 {fmt(from.population)}／至少 600 人。需要至少 10 名戰鬥兵護送。</p>{settleReason(g,from,point)&&<p role="status">{settleReason(g,from,point)}</p>}</>:<p>目的地 ({point.x}, {point.y}) · 從 {from.name} 出發</p>}
    {(step===2)&&<><EscortInputs g={g} from={from} troops={troops} onChange={setTroops}/><p>已選 {countTroops(troops)} 名護衛 · 單程 {duration(travel/g.speed)}</p>{reason&&<p className="muted" role="status">{reason}</p>}</>}
    <div className="dialog-actions"><button onClick={()=>step===2?setStep(1):onClose()}>{step===2?'返回建城資訊':'返回地圖'}</button>{step===1?<button className="primary" disabled={busy||!!settleReason(g,from,point)} onClick={()=>setStep(2)}>選擇護送部隊</button>:<button className="primary" disabled={busy||!!reason||!cityName.trim()} onClick={()=>{issue({type:'settle_at',from:from.id,at:point,troops,name:cityName});onClose();}}>出發建城</button>}</div>
  </Dialog>;
}

function EscortInputs({g,from,troops,onChange}:{g:Game;from:Node;troops:Troops;onChange:(troops:Troops)=>void}){
 return <section><h3>護送部隊 · 至少 10 名戰鬥兵</h3><p className="muted">斥候僅能偵察。依最慢兵種行軍，成功建城後留下駐防。</p><div className="troop-inputs">{unitIds.filter(u=>u!=='scout').map(u=><label key={u}><span>{unitName(u,g.player)}<small>可用 {from.troops[u]}</small></span><input type="number" min={0} max={from.troops[u]} value={troops[u]} onChange={e=>onChange({...troops,[u]:Number(e.target.value)})}/></label>)}</div></section>;
}
