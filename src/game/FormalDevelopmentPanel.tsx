import {QUEUE_CAPACITY} from './formal/queueCapacity';
import {trainingSlotsUsed} from './formal/trainingSlots';
import {memo} from 'react';
import type {WorldRead} from './presentationModel';
import {LogisticsSettingsPanel} from './presentation/LogisticsSettingsPanel';
import {colonizationUnits,readyColonizationUnit} from './formal/settlement';
import {uniqueCultureName} from './formal/cultureNames';
import {buildingLevel} from './formal/catalogB3';
import {useState} from 'react';
import type {FormalCity,FormalCommand,Resources} from './formal/model';
import {resourceKeys} from './formal/model';
import {UNIT_CATALOG} from './formal/unitCatalog';
import {spatial} from './formal/spatial';
import {Icon} from './presentation/Art';
import FormalWorldMap from './FormalWorldMap';
import {Dialog} from './presentation/UI';
import {settlementSiteReason} from './presentation/settlementSite';
import {route} from './formal/routing';
import "./presentation/settlement-map-picker.css";
import type {Point} from './presentation/mapGeometry';
import {Countdown} from './presentation/LiveValues';
import {useLiveCity} from './presentation/liveClock';
const labels={food:'穀',wood:'木',stone:'石',gold:'金'};
function FormalDevelopmentPanel({world,city:sourceCity,issue,busy,mode='settlement',targetPoint}:{world:WorldRead;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean;mode?:'settlement'|'logistics';targetPoint?:{x:number;y:number}}){
 const city=useLiveCity(world,sourceCity)!;
 const [point,setPoint]=useState<Point|undefined>(targetPoint),[picking,setPicking]=useState(false),[pickError,setPickError]=useState(''),[name,setName]=useState(()=>uniqueCultureName(world.factions.find(f=>f.id===city.ownerFactionId)!.civilizationId,world.seed+world.sequences.project,'city',world.cities.map(c=>c.name))),[escort,setEscort]=useState<Record<string,number>>({spearman:20}),[destination,setDestination]=useState(''),[cargo,setCargo]=useState<Resources>({food:100,wood:0,stone:0,gold:0});
 const f=world.factions.find(f=>f.id===city.ownerFactionId)!,owned=spatial(world).owned(f.id).filter(c=>c.id!==city.id),target=owned.find(c=>c.id===destination)??owned[0],settlement=world.settlements?.find(p=>p.sourceCityId===city.id&&p.phase!=='travelling');
 const available=readyColonizationUnit(world,city.id),units=colonizationUnits(world,city.id),canProduce=(f.age??0)>=2&&buildingLevel(city,'castle')>=1&&city.population>=2000&&trainingSlotsUsed(world,city)<QUEUE_CAPACITY&&resourceKeys.every(r=>city.stock[r]>=({food:6000,wood:8000,stone:12000,gold:4000})[r]);
 const escorts=Object.entries(city.military?.units??{}).filter(([id,n])=>n>0&&['infantry','ranged','cavalry','mounted-ranged'].includes(UNIT_CATALOG[id].combatClass)),escortTotal=Object.values(escort).reduce((n,c)=>n+c,0),escortValid=Object.entries(escort).every(([id,n])=>Number.isSafeInteger(n)&&n>=0&&n<=(city.military?.units[id]??0));
 const pointReason=point&&settlementSiteReason(world,point);
 return <section className="formal-development">{mode==='settlement'&&<> <h3>拓殖隊</h3><p>整備需城堡時代、城堡與人口 2,000，移出 400 人，支付穀6,000／木8,000／石12,000／金4,000。</p>
 <p>本城待命 拓殖隊 ×{available?1:0} · 在途 {units.filter(u=>u.phase==='travelling').length} 支</p><small>城堡生產的非戰鬥單位，承載400名移民；建城後消耗，不計入駐軍與一般軍糧。整備中佔用 1 格部隊訓練佇列，完成或取消即釋出。</small>{!settlement&&<button disabled={busy||!canProduce} onClick={()=>issue({type:'settlement.prepare',cityId:city.id})}>{trainingSlotsUsed(world,city)>=QUEUE_CAPACITY?'部隊訓練佇列已滿':'生產拓殖隊'}</button>}{settlement?.phase==='preparing'&&<p>整備剩餘 <Countdown at={settlement.startedAt+settlement.prepDurationMs} world={world}/> <button disabled={busy} onClick={()=>issue({type:'settlement.cancel',cityId:city.id})}>取消整備</button><small>取消會接回全部400名移民並退回80%資源；需有足夠住房。</small></p>}
 {settlement?.phase==='ready'&&available&&<div className="dialog-actions"><div className="settlement-location"><button type="button" onClick={()=>{setPickError('');setPicking(true);}}>在世界地圖選擇建城位置</button><small role="status">{point?`建城座標：(${point.x}, ${point.y})${pointReason?' · '+pointReason:''}`:'尚未選擇建城位置'}</small></div><div className="name-input"><input aria-label="新城名稱" maxLength={24} value={name} onChange={e=>setName(e.target.value)}/><button aria-label="隨機城名" onClick={()=>setName(uniqueCultureName(f.civilizationId,Math.floor(Math.random()*4294967295),'city',[...world.cities.map(c=>c.name),name]))}>🎲</button></div><fieldset className="colonization-escort"><legend>編組護衛 · 合計 {escortTotal} 名／至少20名</legend>{escorts.map(([id,n])=><label key={id}><span>{UNIT_CATALOG[id].name} · 可用 {n}</span><input aria-label={'拓殖護衛 '+UNIT_CATALOG[id].name} type="number" min={0} max={n} value={escort[id]??0} onChange={e=>setEscort({...escort,[id]:Number(e.target.value)})}/></label>)}{!escorts.length&&<p>本城尚無可派出的戰鬥護衛。</p>}<small>可混合編組；偵察與器械不計入這20名戰鬥護衛。</small></fieldset><button disabled={busy||!available||!name.trim()||!escortValid||escortTotal<20||!point||!!pointReason} onClick={()=>{if(point&&!pointReason)issue({type:'settlement.dispatch',cityId:city.id,x:point.x,y:point.y,name,escort:Object.fromEntries(Object.entries(escort).filter(([,n])=>n>0))});}}>出發建城</button></div>}
 {picking&&settlement?.phase==='ready'&&available&&<Dialog className="settlement-map-dialog" title="選擇建城位置" onClose={()=>setPicking(false)}>
 <p className="settlement-map-guide">從 {city.name} 出發。點選空地後確認，回到拓殖隊編組；不會立即出發。</p>
 {pickError&&<p className="settlement-map-guide" role="alert">{pickError}</p>}
 <FormalWorldMap world={world} focusCityId={city.id} focusPoint={point} mobile={typeof window!=='undefined'&&window.matchMedia('(max-width: 760px), (max-width: 1100px) and (pointer: coarse)').matches} busy={busy} onSettlementPoint={p=>{
  const reason=settlementSiteReason(world,p);
  if(reason){setPickError(reason);return;}
  try{route(world,city,p);}catch{setPickError('目的地沒有可通行的拓殖路徑，請改選其他格子。');return;}
  setPoint(p);setPicking(false);
 }}/>
 </Dialog>}
 {world.settlements?.filter(p=>p.sourceCityId===city.id&&p.phase==='travelling').map(p=><p key={p.projectId}>前往 {p.target!.name}（{p.target!.x}, {p.target!.y}）・抵達剩餘 <Countdown at={p.arrivalAt!} world={world}/></p>)}
</>}{mode==='logistics'&&<> <h3><Icon name="caravan"/>城市運輸</h3>{target?<><div className="dialog-actions"><select aria-label="運輸目的地" value={target.id} onChange={e=>setDestination(e.target.value)}>{owned.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{resourceKeys.map(r=><label key={r}>{labels[r]} <input aria-label={`運輸${labels[r]}`} type="number" min={0} value={cargo[r]} onChange={e=>setCargo({...cargo,[r]:Number(e.target.value)})}/></label>)}<button disabled={busy} onClick={()=>issue({type:'logistics.dispatch',cityId:city.id,destinationCityId:target.id,resources:cargo})}>派遣商隊</button></div></>:<p>建立第二座城市後可安排商隊。</p>}
 <LogisticsSettingsPanel key={city.id+JSON.stringify(city.logisticsSettings)+JSON.stringify(city.autoLogistics)} world={world} city={city} issue={issue} busy={busy}/>
 {world.logistics?.filter(t=>t.sourceCityId===city.id).map(t=><p key={t.shipmentId}>{t.caravans} 支商隊・{t.phase==='outbound'?'運貨中':'空車返回'}・剩餘 <Countdown at={t.phase==='outbound'?t.arrivalAt:t.returnAt} world={world}/></p>)}
</>} </section>;
}

export default memo(FormalDevelopmentPanel);
