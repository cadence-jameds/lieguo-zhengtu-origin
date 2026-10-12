import {ScoutIntelDetails} from './ScoutIntelDetails';
import {reportTime} from './reportClock';
import {intelAge,useRealNow} from './intelTime';
import type {FormalCity,FormalWorld,WildSite} from '../formal/model';
import type {ArmyMissionState} from '../formal/combatModel';
import type {CityIntel} from '../formal/combatModel';
import {canReinforce} from '../formal/armies';
import {citySnapshot} from '../formal/economy';
import {relationColor} from './mapRelations';
import {wildSiteName} from './wildSiteLabels';
import {CIV_NAMES} from './artMap';
import {Cost,fmt} from './UI';
export function FormalTargetPanel({world,home,city,site,intel={},intelFailed=false,onMission,onCity,busy=false,cityEntryLabel}:{world:FormalWorld;home:FormalCity;city?:FormalCity;site?:WildSite;intel?:CityIntel;intelFailed?:boolean;onMission:(mission:ArmyMissionState['mission'])=>void;onCity:()=>void;busy?:boolean;cityEntryLabel?:string}){
 const now=useRealNow(),full=intel.army?.intel.cityId!==undefined&&intel.army.intel.garrison!==undefined?intel.army.intel:undefined;
 const owner=city?world.factions.find(f=>f.id===city.ownerFactionId):undefined,own=owner?.id===world.playerFactionId,friend=!!city&&canReinforce(world,home.ownerFactionId,city.ownerFactionId),at=city??site!;
 const army=own?Object.values(city!.military?.units??{}).reduce((n,c)=>n+c,0):intel.army?Object.values(intel.army.intel.units).reduce((n,c)=>n+c,0):undefined;
 const wall=own?city!.wallLevel??0:intel.defenses?.intel.wallLevel;
 return <section className="target-panel formal-demo-target"><>{city&&<span className="eyebrow">聚落 · （{at.x}, {at.y}）</span>}</><div className="target-name"><h2>{city?.name??`${wildSiteName(site!).replace(' Lv.','Lv.')}（${at.x}, ${at.y}）`}</h2><span className="owner-stripe" style={{background:city?relationColor(world,city):'#bec1b7'}}/></div>
 {owner?<dl className="target-ownership"><div><dt>玩家</dt><dd>{owner.name}{own?' · 己方':''}</dd></div><div><dt>文明</dt><dd>{CIV_NAMES[owner.civilizationId]}</dd></div><div><dt>軍團</dt><dd>尚未開放</dd></div><div><dt>帝國</dt><dd>{owner.empireId?'同盟帝國':'獨立領主'}</dd></div><div><dt>關係</dt><dd>{own?'己方':friend?'同帝國':'中立'}</dd></div></dl>:<p className="target-owner">中立據點 · 關係：中立</p>}
 <div className="target-facts"><span>{own?'駐軍':'已知駐軍'}<strong>{army===undefined?'尚未偵察':fmt(army)}</strong></span>{city&&<span>城防<strong>{wall===undefined?'尚未偵察':wall+' 級'}</strong></span>}{city&&<span>人口<strong>{fmt(citySnapshot(world,city.id)!.population)}</strong></span>}</div>
 {!own&&(intel.army?<small className="intel-age">{intelAge(intel.army.intel.observedRealAt,now)}，數量可能已變動。{city&&intel.army.owner!==owner?.id?'領主已變更，這是先前的駐軍紀錄。':''}</small>:<p className="muted">{intelFailed?'暫時無法讀取歷史情報，請稍後再開啟。':site?'駐軍情報未知。':'駐軍情報未知，請先派遣斥候偵察。'}</p>)}
 {!own&&full&&<ScoutIntelDetails intel={full} world={world}/>}
 {!own&&!full&&<div className="target-stock"><small>偵察資源情報</small>{intel.resources?<><Cost cost={intel.resources.intel.resources!}/><small>觀測於 {reportTime(intel.resources.intel.observedRealAt)} · 當時庫存，非即時數值</small></>:<p>資源庫存未知</p>}</div>}
 {!own&&!full&&intel.defenses&&<small className="intel-age">城防觀測於 {reportTime(intel.defenses.intel.observedRealAt)} · 非即時數值</small>}

 <div className="target-actions">{own?<><button className="primary" onClick={onCity}>{cityEntryLabel??'進入城市'}</button>{city?.id!==home.id&&<button disabled={busy} onClick={()=>onMission('reinforce')}>從 {home.name} 增援</button>}</>:friend?<button className="primary" disabled={busy} onClick={()=>onMission('reinforce')}>派遣援軍</button>:<><button disabled={busy} onClick={()=>onMission('scout')}>派遣斥候</button><button className="primary" disabled={busy} onClick={()=>onMission('raid')}>掠奪物資</button>{city&&<button disabled={busy} onClick={()=>onMission('conquest')}>佔領據點</button>}</>}</div>
 </section>;
}
