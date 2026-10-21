import {CombatPanel} from '../presentation/CombatPanel';
import {SIEGE_ROUND_LIMIT} from '../formal/battleProgress';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormalWorld,FormalCommand,FormalReport} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import type {RuntimeRequest} from '../runtime.worker';
import type {LabRequest} from './b5Lab.worker';
import {B5_LAB_SUFFIX,defaultLabConfig,LAB_PRESETS,LAB_SCENARIOS,labTarget,labActiveTarget,labNextEvent,labTiming,type LabConfig,type LabScenario} from './b5LabConfig';
import {Dialog,clock,fmt} from '../presentation/UI';
import {FormalReportsView} from '../presentation/FormalReportsView';
import {TargetIntelContext} from '../presentation/targetIntel';
import type {CityIntel} from '../formal/combatModel';
import FormalWorldMap from '../FormalWorldMap';
import './b5Lab.css';
type LabInput=LabRequest extends infer R?R extends LabRequest?Omit<R,'requestId'>:never:never;
const stockNames={food:'穀',wood:'木',stone:'石',gold:'金'};
export function LabUnits({title,value,onChange,civilizationId,busy}:{title:string;value:Record<string,number>;onChange:(u:Record<string,number>)=>void;civilizationId:string;busy:boolean}){
 return <details className="b5-lab-units"><summary>{title} · {fmt(Object.values(value).reduce((n,x)=>n+x,0))} 名</summary><div className="b5-lab-unit-grid">{Object.values(UNIT_CATALOG).filter(u=>!u.civilizationId||u.civilizationId===civilizationId).map(u=><label key={u.id}>{u.name}<input type="number" min={0} max={10000} step={1} disabled={busy} aria-label={title+' · '+u.name} value={value[u.id]??0} onChange={e=>onChange({...value,[u.id]:Number(e.target.value)})}/></label>)}</div></details>;
}
export function B5BattleLab({base,mobile,onClose}:{base:FormalWorld;mobile:boolean;onClose:()=>void}){
 const civ=base.factions.find(f=>f.id===base.playerFactionId)!.civilizationId as LabConfig['civilizationId'];
 const [config,setConfig]=useState(()=>defaultLabConfig(base.seed,civ)),[world,setWorld]=useState<FormalWorld>(),[busy,setBusy]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState<'controls'|'map'|'reports'>('controls'),[point,setPoint]=useState<{x:number;y:number}>(),[deploy,setDeploy]=useState<Record<string,number>>({}),[incoming,setIncoming]=useState<Record<string,number>>({militia:300,ram:20,baggage:10});
 const [rows,setRows]=useState<FormalReport[]>([]),[data,setData]=useState<{page:number;filter:string;count:number}|null>(null),[epoch,setEpoch]=useState(0),[status,setStatus]=useState({unread:0,counts:{all:0,battle:0,chronicle:0}});
 const worker=useRef<Worker | undefined>(undefined),pending=useRef(new Set<string>()),current=useRef<FormalWorld | undefined>(undefined),file=useRef<HTMLInputElement>(null),queries=useRef(new Map<string,{resolve:(i:CityIntel)=>void;reject:(e:Error)=>void}>());
 const send=useCallback((r:LabInput)=>{if(!worker.current)return;const requestId=crypto.randomUUID();pending.current.add(requestId);setBusy(true);setError('');worker.current.postMessage({...r,requestId});},[]);
 useEffect(()=>{
  let disposed=false,release:()=>void=()=>{};
  if(!navigator.locks){setError('此瀏覽器缺少存檔鎖，無法開啟測試台。');setBusy(false);return;}
  void navigator.locks.request(B5_LAB_SUFFIX,{ifAvailable:true},async lock=>{
   if(disposed)return;if(!lock){setError('B5 測試台已在另一個分頁開啟。');setBusy(false);return;}
   const w=new Worker(new URL('./b5Lab.worker.ts',import.meta.url),{type:'module'});worker.current=w;
   w.onmessage=e=>{const r=e.data;
    if(r.type==='done'){pending.current.delete(r.requestId);setBusy(pending.current.size>0);}
    if(r.type==='state'){if(current.current?.campaignId!==r.world.campaignId){setDeploy({...r.world.cities[0].military.units});setRows([]);setData(null);setPoint(undefined);setConfig(c=>({...c,seed:r.world.seed,civilizationId:r.world.factions[0].civilizationId,targetCityId:labActiveTarget(r.world)?.id,speed:r.world.developer.speed}));}current.current=r.world;setWorld(r.world);}
    if(r.type==='reportPage'){setRows(r.data.rows);setData(r.data);}
    if(r.type==='reportStatus'){setStatus(r.data);setEpoch(n=>n+1);}
    if(r.type==='cityIntel'){const q=queries.current.get(r.queryId);queries.current.delete(r.queryId);q?.resolve(r.data);}
    if(r.type==='error'){setError(r.text);if(r.queryId){queries.current.get(r.queryId)?.reject(Error(r.text));queries.current.delete(r.queryId);}}
    if(r.type==='export'){const url=URL.createObjectURL(new Blob([r.text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='列國征途-B5戰鬥測試台.b5lab';a.click();URL.revokeObjectURL(url);}
   };
   w.onerror=e=>{const error=Error(e.message||'測試台無法載入。');setError(error.message);for(const q of queries.current.values())q.reject(error);queries.current.clear();pending.current.clear();setBusy(false);};
   send({type:'open',config});await new Promise<void>(r=>{release=r;if(disposed)r();});w.terminate();worker.current=undefined;
  }).catch(e=>{if(!disposed){setError(String(e));setBusy(false);}});
  return()=>{disposed=true;release();for(const q of queries.current.values())q.reject(Error('測試台已關閉。'));queries.current.clear();};
 },[send]);
 const reportSend=useCallback((r:RuntimeRequest)=>{if(r.type==='reportPage'||r.type==='reportAction')send(r);},[send]);
 const readIntel=useCallback((snapshot:FormalWorld,cityId:string,generation?:number)=>new Promise<CityIntel>((resolve,reject)=>{if(!worker.current){reject(Error('測試台已關閉。'));return;}const queryId=crypto.randomUUID();queries.current.set(queryId,{resolve,reject});send({type:'cityIntel',queryId,cityId,generation,campaignId:snapshot.campaignId,reportCursor:snapshot.sequences.report,time:snapshot.time});}),[send]);
 const issue=useCallback((payload:FormalCommand)=>send({type:'order',payload}),[send]);
 const playerCiv=world?.factions.find(f=>f.id===world.playerFactionId)?.civilizationId??civ;
 const home=world?.cities[0],target=world?labActiveTarget(world):undefined,configuredTarget=world?labTarget(world,config.targetCityId):undefined,configEnemyCiv=world?.factions.find(f=>f.id==='faction:'+configuredTarget?.id.slice(5))?.civilizationId??civ,enemyCiv=world?.factions.find(f=>f.id===target?.ownerFactionId)?.civilizationId??civ,timing=world?labTiming(world):undefined,next=world?labNextEvent(world):undefined;
 const scenario=(id:LabScenario)=>setConfig(c=>({...c,scenario:id,enemyUnits:{...LAB_PRESETS[id]},wallLevel:id==='wall'?7:id==='counter'?3:0}));
 const dispatch=(mission:'raid'|'conquest'|'scout')=>{if(!home||!target)return;const units=mission==='scout'?{scout:deploy.scout??0}:deploy;issue({type:'army.dispatch',cityId:home.id,mission,target:{kind:'city',cityId:target.id},units});};
 return <TargetIntelContext.Provider value={readIntel}><Dialog className="b5-lab-dialog" title="B5 戰鬥測試台" onClose={()=>{if(!busy)onClose();}}><div className={'b5-lab formal-shell'+(mobile?' mobile mobile-layout':' desktop-layout')}>
  <p className="b5-lab-isolation">獨立測試存檔 · 原戰役照常運作。測試台手動推進世界時間，關閉後保留測試進度；重置只影響測試台。</p><p>測試兵力直接建立，不扣徵兵成本；資源為有限庫存，戰鬥、偵察、行軍與戰報均走正式 B5 流程。敵軍來襲由你下令，不是 AI 決策。</p>
  <div role="status" className={error?'unmet':''}>{error||(!world?'正在讀取獨立測試進度…':busy?'處理中…':'測試進度已保存')}</div>
  {world&&home&&<><div className="b5-lab-actions"><button disabled={busy||!next} onClick={()=>send({type:'advance'})}>下一行軍／戰鬥事件</button><button disabled={busy} onClick={()=>send({type:'advance',worldMs:60000})}>＋1 世界分</button><button disabled={busy} onClick={()=>send({type:'reload'})}>存檔重讀</button><button disabled={busy} onClick={()=>send({type:'export'})}>匯出測試完整備份</button><button disabled={busy} onClick={()=>file.current?.click()}>匯入測試備份</button><button disabled={busy} onClick={onClose}>返回原戰役</button></div>
   <p>種子 {world.seed} · 世界 {clock(world.time)} · {timing!.speed}X · 戰術倍率 {timing!.tacticalSpeed}X · 每回合現實 {timing!.roundRealMs/1000} 秒{next&&' · 下一事件 '+clock(Math.max(0,next.at-world.time))+' 世界時間'}</p>
   <nav className="b5-lab-tabs" aria-label="測試台頁面">{(['controls','map','reports'] as const).map((t,i)=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{['情境與軍令','測試地圖','正式戰報'][i]}</button>)}</nav>
   {tab==='controls'&&<><form onSubmit={e=>{e.preventDefault();send({type:'reset',config});}}><div className="b5-lab-config"><label>AI 測試目標<select aria-label="AI 測試目標" disabled={busy} value={config.targetCityId??''} onChange={e=>setConfig(c=>({...c,targetCityId:e.target.value}))}>{world.cities.filter(c=>c.id!==home.id).sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y)).map(c=><option key={c.id} value={c.id}>{c.name}（{c.x}, {c.y}）{c.ownerFactionId===world.playerFactionId?' · 已占領':''}</option>)}</select></label>
    <label>測試情境<select disabled={busy} aria-label="測試情境" value={config.scenario} onChange={e=>scenario(e.target.value as LabScenario)}>{Object.entries(LAB_SCENARIOS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>敵城城牆 Lv<select aria-label="敵城城牆等級" disabled={busy} value={config.wallLevel} onChange={e=>setConfig(c=>({...c,wallLevel:Number(e.target.value)}))}>{Array.from({length:16},(_,i)=><option key={i}>{i}</option>)}</select></label><label>玩家城牆 Lv<select aria-label="玩家城牆等級" disabled={busy} value={config.playerWallLevel} onChange={e=>setConfig(c=>({...c,playerWallLevel:Number(e.target.value)}))}>{Array.from({length:16},(_,i)=><option key={i}>{i}</option>)}</select></label>
    <label>世界速度<select aria-label="測試世界速度" disabled={busy} value={config.speed} onChange={e=>setConfig(c=>({...c,speed:Number(e.target.value) as 50|100}))}><option value={50}>50X</option><option value={100}>100X</option></select></label></div>
    <LabUnits title="玩家測試兵力與攻城器" value={config.playerUnits} onChange={playerUnits=>setConfig(c=>({...c,playerUnits}))} civilizationId={playerCiv} busy={busy}/><LabUnits title="敵城測試守軍" value={config.enemyUnits} onChange={enemyUnits=>setConfig(c=>({...c,enemyUnits}))} civilizationId={configEnemyCiv} busy={busy}/>
    <fieldset><legend>測試敵城四資源庫存</legend><div className="b5-lab-config">{resourceKeys.map(r=><label key={r}>{stockNames[r]}<input type="number" min={0} max={1000000} step={1} aria-label={'敵城'+stockNames[r]+'庫存'} value={config.enemyStock[r]} disabled={busy} onChange={e=>setConfig(c=>({...c,enemyStock:{...c.enemyStock,[r]:Number(e.target.value)}}))}/></label>)}</div></fieldset><button className="primary" disabled={busy}>套用／重置測試情境</button><small>會重建測試戰役、清空本次行軍與測試戰報。上方設定在按下重置後才生效。</small>
   </form><section className="card"><h3>正式玩家軍令 · 目標 {target?.name}</h3><LabUnits title="本次派遣兵力" value={deploy} onChange={setDeploy} civilizationId={playerCiv} busy={busy}/><div className="b5-lab-actions"><button disabled={busy||!target} onClick={()=>dispatch('raid')}>下達掠奪命令</button><button disabled={busy||!target} onClick={()=>dispatch('conquest')}>下達征服命令</button><button disabled={busy||!target} onClick={()=>dispatch('scout')}>下達偵察命令</button></div><small>偵察只取上方斥候數量；其他任務依填入兵種出征，正式引擎檢查兵力與路徑。</small></section>
   <section className="card"><h3>模擬敵軍來襲</h3><LabUnits title="來襲兵力" value={incoming} onChange={setIncoming} civilizationId={enemyCiv} busy={busy}/><div className="b5-lab-actions">{(['raid','conquest'] as const).map(m=><button key={m} disabled={busy||!target} onClick={()=>send({type:'incoming',targetCityId:target!.id,mission:m,units:incoming})}>{m==='raid'?'模擬一次敵軍掠奪':'模擬一次敵軍征服'}</button>)}</div><small>每次重置限一次；先完成在途任務。來襲兵力作為敵城測試設定，之後依敵方所有權下達正式軍令。</small></section>
   <CombatPanel world={world} city={home} issue={issue} busy={busy} onMap={p=>{setPoint(p);setTab('map');}}/><section className="card"><h3>實際測試狀態</h3>{[home,target].filter(Boolean).map(c=><p key={c!.id}>{c!.name} · {c!.ownerFactionId===world.playerFactionId?'玩家持有':'敵方持有'} · 城牆 Lv{c!.wallLevel} · 穀／木／石／金 {resourceKeys.map(r=>fmt(c!.stock[r])).join('／')}<br/>駐軍 {Object.entries(c!.military!.units).map(([id,n])=>(UNIT_CATALOG[id]?.name??id)+' '+n).join('、')||'0'}</p>)}{world.armies.map(a=><p key={a.id}>{a.id} · {a.mission} · {a.status} · 負重戰利品 {Object.values(a.cargo??{}).reduce((n,x)=>n+x,0)}<br/>BattleId {a.battleId}</p>)}{world.combat?.battles.map(b=><p key={b.id}>主戰第 {b.round} 回合 · {b.phase==='siege'?'攻城中':'交戰中'} · 攻城 {b.siegeRound??0}／{SIEGE_ROUND_LIMIT} 回合 · 剩餘 {SIEGE_ROUND_LIMIT-(b.siegeRound??0)} 回合 · 下回合 {clock(b.nextRoundAt-world.time)} 世界時間</p>)}<details><summary>正式 resolution receipt（{world.combat?.receipts.length??0}）</summary><pre>{JSON.stringify(world.combat?.receipts,null,2)}</pre></details><details><summary>人工驗收順序</summary><ol><li>空城＋掠奪：調低派遣兵力，確認負重、返城入庫。</li><li>反偵察：10 斥候對 5 斥候成功；6 對 5 平手失敗，返城才交付情報。</li><li>城牆 Lv1～15：比較掠奪與征服；配置衝撞車、投石機，觀察城牆與建築損傷。</li><li>混編大軍＋征服：逐事件查看多回合與城市易主。</li><li>重置後模擬來襲：確認玩家守軍、玩家城牆與防守戰報。</li><li>50X：排程每回合折合現實 30 秒，戰術倍率封頂 10X；本台手動推進。</li><li>在途／交戰中存檔重讀或匯出再匯入，確認相同路徑、時間、BattleId，無重複戰報。</li></ol></details></section></>}
   {tab==='map'&&<div className="b5-lab-map"><FormalWorldMap world={world} mobile={mobile} combatOnly onSelect={()=>setTab('controls')} focusCityId={home.id} focusPoint={point} issue={issue} busy={busy}/></div>}
   {tab==='reports'&&<FormalReportsView world={world} busy={busy} rows={rows} data={data} epoch={epoch} status={status} send={reportSend} onMap={p=>{setPoint(p);setTab('map');}}/>}
  </>}
  <input ref={file} type="file" hidden accept=".b5lab" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f){if(f.size>100*1024*1024){setError('測試備份超過 100 MiB。');return;}void f.text().then(text=>send({type:'import',text})).catch(()=>setError('測試備份無法讀取。'));}}}/>
 </div></Dialog></TargetIntelContext.Provider>;
}
