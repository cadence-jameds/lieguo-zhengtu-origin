import {incomingAlerts} from '../formal/aiKnowledge';
import {LiveBattleDetails} from './LiveBattleDetails';
import type {BattleId} from '../formal/ids';
import {liveBattleView} from '../formal/battleView';
import {reportTime} from './reportClock';
import {intelAge,useRealNow} from './intelTime';
import {useMemo,useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import type {ArmyMissionState,ArmyTarget} from '../formal/combatModel';
import {isMissionArmy} from '../formal/combatModel';
import {armyPosition} from '../formal/armyPosition';
import {canReinforce} from '../formal/armies';
import {effectiveUnit,marchSeconds} from '../formal/combatModifiers';
import {route} from '../formal/routing';
import {UNIT_CATALOG,isScoutUnit,scoutUnits} from '../formal/unitCatalog';
import {spatial} from '../formal/spatial';
import {Dialog,fmt,realTime} from './UI';
import {Countdown} from './LiveValues';
import {wildSiteName} from './wildSiteLabels';
import {useTargetIntel} from './targetIntel';
type Mission=ArmyMissionState['mission'];
type Props={world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean;target?:ArmyTarget;onMap?:(p:{x:number;y:number})=>void};
export const missionName={raid:'掠奪',conquest:'佔領',scout:'偵察',reinforce:'增援'};
const statusName={waiting:'等待會師出發',outbound:'前往目標',engaged:'交戰中',stationed:'駐防中',returning:'返回城市',stranded:'等待歸隊'};
export function ArmyDispatchDialog({world,city,issue,busy,target,mission,onClose,onBack=onClose}:{world:FormalWorld;city:FormalCity;issue:Props['issue'];busy:boolean;target:ArmyTarget;mission:Mission;onClose:()=>void;onBack?:()=>void}){
 const now=useRealNow();
 const dest=target.kind==='city'?spatial(world).cities.get(target.cityId):spatial(world).sites.get(target.siteId);
 const [units,setUnits]=useState<Record<string,number>>(():Record<string,number>=>mission==='scout'?Object.fromEntries(Object.entries(scoutUnits(city.military?.units??{})).map(([id,n])=>[id,Math.min(2,n)])):{}),[submitted,setSubmitted]=useState(false);
 const {intel}=useTargetIntel(world,target.kind==='city'?target.cityId:target.siteId,target.kind==='wild'?target.generation:undefined);
 const faction=world.factions.find(f=>f.id===city.ownerFactionId)!,owner=dest&&'ownerFactionId' in dest?world.factions.find(f=>f.id===dest.ownerFactionId):undefined;
 const path=useMemo(()=>{if(!dest)return null;try{return route(world,city,dest);}catch{return null;}},[world.worldLayer?.terrain,city.x,city.y,dest?.x,dest?.y]);
 const selected=Object.fromEntries(Object.entries(units).filter(([,n])=>n>0));
 const authorized=!!dest&&(target.kind==='wild'?(mission==='raid'||mission==='scout')&&'generation' in dest&&dest.generation===target.generation:mission==='reinforce'?canReinforce(world,city.ownerFactionId,owner!.id):!canReinforce(world,city.ownerFactionId,owner!.id));
 const invalid=!authorized||!path||dest?.x===city.x&&dest?.y===city.y||!Object.keys(selected).length||Object.entries(units).some(([id,n])=>!Number.isSafeInteger(n)||n<0||n>(city.military?.units[id]??0))||(mission!=='scout'&&mission!=='reinforce'&&!Object.keys(selected).some(effectiveUnit));
 const duration=path&&Object.keys(selected).length?Math.max(1,Math.ceil(path.distance*marchSeconds(selected,faction)*1000)):null;
 const available=mission==='scout'?Object.entries(scoutUnits(city.military?.units??{})):Object.entries(city.military?.units??{}).filter(([id,n])=>n>0&&(mission==='reinforce'||!isScoutUnit(id)));
 return <Dialog className="formal-mission-dialog" title={missionName[mission]+' · '+(dest?('name' in dest?dest.name:wildSiteName(dest)):'目標已消失')} onClose={onClose}>
 <div className="mission-route"><span>{city.name}<small>出發城市</small></span><b aria-hidden="true">→</b><span>{dest?('name' in dest?dest.name:wildSiteName(dest)):'目標已消失'}<small>{owner?.name??'中立據點'}</small></span><strong>{duration===null?'—':realTime(duration,world)}<small>單程行軍</small></strong></div>
 {intel.army&&mission!=='reinforce'&&<p className="intel-note">上次偵察：守軍 {fmt(Object.values(intel.army.intel.units).reduce((n,c)=>n+c,0))} 名{intel.defenses&&`、城牆 ${intel.defenses.intel.wallLevel} 級（觀測於 ${reportTime(intel.defenses.intel.observedRealAt)}）`}；{intelAge(intel.army.intel.observedRealAt,now)}。駐軍可能已有變化。</p>}
 {mission==='scout'&&target.kind==='wild'&&<p className="muted">偵察資源與軍隊。</p>}
 <div className="section-label"><h3>編入部隊</h3>{mission!=='scout'&&<button disabled={busy||submitted} onClick={()=>setUnits(Object.fromEntries(available))}>投入全部戰鬥兵</button>}</div>
 <div className="troop-inputs">{available.map(([id,n])=><label key={id}><span>{UNIT_CATALOG[id].name}<small>可用 {fmt(n)}</small></span><input aria-label={'派遣'+UNIT_CATALOG[id].name} type="number" inputMode="numeric" min={0} max={n} value={units[id]??0} disabled={busy||submitted} onChange={e=>setUnits(old=>({...old,[id]:Number(e.target.value)}))}/></label>)}</div>
 {!available.length&&<p className="muted">本城沒有可派遣的部隊，請先招募。</p>}
 {mission==='conquest'&&<p className="muted">抵達後立即接戰。擊破守軍與城牆、仍有戰鬥兵存活時才會佔領；接戰後不可撤退。</p>}
 {mission==='raid'&&<p className="muted">戰利品受存活部隊載量限制，隨部隊返回後入庫。</p>}
 {mission==='reinforce'&&<p className="muted">援軍抵達後留城駐防，可由行軍頁召回。</p>}
 {!path&&<p role="alert">目標沒有可通行的行軍路徑。</p>}{!authorized&&<p role="alert">目標狀態已變更，請返回地圖重新選擇。</p>}
 <div className="dialog-actions"><button onClick={onBack}>返回</button><button className="primary" disabled={busy||submitted||invalid} onClick={()=>{setSubmitted(true);issue({type:'army.dispatch',cityId:city.id,mission,target,units:selected,...(mission==='scout'&&target.kind==='wild'?{scoutMode:'resources-army' as const}:{})});onClose();}}>下達{missionName[mission]}命令</button></div>
 </Dialog>;
}
export function CombatPanel({world,city,issue,busy,target,onMap}:Props){
 const [liveId,setLiveId]=useState<BattleId>();
 const defenses=(world.combat?.battles??[]).filter(b=>b.ownerBefore===world.playerFactionId||b.participants.some(p=>p.ownerFactionId===world.playerFactionId&&p.armyId!==null&&world.armies.some(a=>a.id===p.armyId&&a.status==='stationed')));
 const [open,setOpen]=useState(!!target),[x,setX]=useState(''),[y,setY]=useState(''),[picked,setPicked]=useState<ArmyTarget|undefined>(target),[mission,setMission]=useState<Mission|undefined>(target?'raid':undefined),[error,setError]=useState('');
 const dest=picked?.kind==='city'?spatial(world).cities.get(picked.cityId):picked?.kind==='wild'?spatial(world).sites.get(picked.siteId):undefined,friend=!!dest&&'ownerFactionId' in dest&&canReinforce(world,city.ownerFactionId,dest.ownerFactionId);
 const armies=world.armies.filter(isMissionArmy).filter(a=>a.ownerFactionId===world.playerFactionId),incoming=world.armies.filter(isMissionArmy).filter(a=>a.status==='outbound'&&a.target.kind==='city'&&a.target.cityId===city.id&&!canReinforce(world,a.ownerFactionId,city.ownerFactionId));
 const locate=()=>{const xx=Number(x),yy=Number(y);if(!x||!y||!Number.isInteger(xx)||!Number.isInteger(yy)||xx<0||yy<0||xx>383||yy>383){setError('請輸入 0～383 的整數座標。');return;}const p=spatial(world).at(xx,yy);if(p.city)setPicked({kind:'city',cityId:p.city.id});else if(p.site)setPicked({kind:'wild',siteId:p.site.id,generation:p.site.generation});else{setError('此座標沒有可派遣的城市或據點。');return;}setError('');setMission(undefined);};
 return <section className="card"><h2>派遣與駐外部隊</h2>{defenses.map(b=><article className="march-item" key={b.id}><h3>本城防守中 · {world.cities.find(c=>c.id===b.cityId)?.name} · {b.phase==='siege'?'攻城中':'交戰中'}</h3><button onClick={()=>setLiveId(b.id)}>查看戰況</button></article>)}{incoming.map(a=><p role="status" key={a.id}>敵軍來襲{incomingAlerts(world,city.ownerFactionId).find(t=>t.armyId===a.id)?.composition?.map(id=>UNIT_CATALOG[id].name).join('／')} · 預計抵達 {<Countdown at={a.arrivalAt} world={world}/>}</p>)}<button className="primary" disabled={busy} onClick={()=>{setMission(undefined);setOpen(true);}}>派遣部隊</button>{armies.length?armies.map(a=>{const p=armyPosition(a,world.time)!,targetCity=a.target.kind==='city'?spatial(world).cities.get(a.target.cityId):undefined;return <article className="march-item" key={a.id}><h3>{missionName[a.mission]} · {a.status==='engaged'&&world.combat?.battles.find(b=>b.id===a.battleId)?.phase==='siege'?'攻城中':statusName[a.status]}</h3><p>{targetCity?.name??'野外據點'} · {Object.entries(a.units).map(([id,n])=>`${UNIT_CATALOG[id].name} ×${fmt(n)}`).join('、')}</p>{['outbound','returning'].includes(a.status)&&<p>抵達倒數 {<Countdown at={a.arrivalAt} world={world}/>}</p>}{a.status==='engaged'&&<p>下一回合 {<Countdown at={world.combat!.battles.find(b=>b.id===a.battleId)!.nextRoundAt} world={world}/>}</p>}<div className="dialog-actions">{a.status==='engaged'&&liveBattleView(world,a.battleId)&&<button onClick={()=>setLiveId(a.battleId)}>部隊資訊／即時戰況</button>}{onMap&&<button onClick={()=>onMap(p)}>在地圖查看</button>}{a.status==='stationed'&&<button disabled={busy} onClick={()=>issue({type:'army.recall',cityId:city.id,armyId:a.id})}>召回援軍</button>}</div></article>}):<p className="muted">沒有駐外或行軍中的部隊。</p>}
 {liveId&&<LiveBattleDetails world={world} battleId={liveId} onClose={()=>setLiveId(undefined)}/>}
 {open&&picked&&mission?<ArmyDispatchDialog key={JSON.stringify(picked)+mission} {...{world,city,issue,busy}} target={picked} mission={friend?'reinforce':mission} onClose={()=>setOpen(false)} onBack={()=>setMission(undefined)}/>:open&&<Dialog title="選擇派遣目標" onClose={()=>setOpen(false)}><p>由 {city.name} 出發</p><div className="settings-actions"><label>X<input aria-label="派遣 X" type="number" min={0} max={383} value={x} onChange={e=>setX(e.target.value)}/></label><label>Y<input aria-label="派遣 Y" type="number" min={0} max={383} value={y} onChange={e=>setY(e.target.value)}/></label><button onClick={locate}>選擇座標</button></div>{dest&&<><p>目標：{'name' in dest?dest.name:wildSiteName(dest)}（{dest.x}, {dest.y}）</p><div className="target-actions">{friend?<button onClick={()=>setMission('reinforce')}>派遣援軍</button>:<><button onClick={()=>setMission('scout')}>派遣斥候</button><button className="primary" onClick={()=>setMission('raid')}>掠奪物資</button>{picked?.kind==='city'&&<button onClick={()=>setMission('conquest')}>佔領據點</button>}</>}</div></>}{error&&<p role="alert">{error}</p>}</Dialog>}
 </section>;
}
