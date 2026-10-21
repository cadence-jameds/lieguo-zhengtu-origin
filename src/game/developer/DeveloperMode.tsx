import {useEffect,useRef,useState} from 'react';
import type {FormalCommand,FormalWorld} from '../formal/model';
import type {CityId} from '../formal/ids';
import type {DeveloperRequest} from './runtime.worker';
import {SCENARIOS,type DeveloperConfig,type Scenario} from './scenarios';
import type {CheckResult} from './checks';
import {inspectWorld,type DeveloperLog} from './session';
import {CIV_NAMES} from '../presentation/artMap';
import {citySnapshot} from '../formal/economy';
import {displayClock} from '../presentation/liveClock';
import FormalCityPanel from '../FormalCityPanel';
import FormalWorldMap from '../FormalWorldMap';
import {ArmyView,ResearchView} from '../presentation/DevelopmentViews';
import FormalDevelopmentPanel from '../FormalDevelopmentPanel';
import {BUILDING_CATALOG} from '../formal/catalogB3';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {TECH_CATALOG} from '../formal/techCatalog';
import {RELEASE} from '../release';
import './developer.css';
import SpecAuditPanel,{specReport} from './SpecAuditPanel';
import type {TrialInfo} from './specTrials';
export const MANUAL_CHECKS=[
 ['B2','world','地圖拖曳、縮放、全區小標記、選取光暈、XY／最愛','new','map'],
 ['B2','sites','五類野外據點、22% 隱藏門檻、糧木石金寇與等級','new','map'],
 ['B3','fields','四種資源田升級、Lv0～15 工期／成本／產量','economy','city'],
 ['B3','buildings','每種建築的前置、分類、美術、槽位與最高等級','economy','city'],
 ['B3','housing','民居住房、人口成長、滿庫與資源明細','economy','city'],
 ['B3','construction','兩施工線、排隊、取消及資源返還','military','city'],
 ['B3','city','City 行政晉升與 D2 永久人口／當下住房條件','economy','city'],
 ['B3','logistics','雙城運輸、載量、預約、抵達、返程與自動物流','logistics','logistics'],
 ['B3','integration','新建城統治初定、產量與市政廳網路','colony','army'],
 ['B4','age','三次時代晉升及獨立佇列','economy','research'],
 ['B4','research','傳統科技、六文明限制、前置、成本與學院快照','military','research'],
 ['B4','funding','D1 多城投入、funding→researching→completed','modern','research'],
 ['B4','recruit','各兵種招募／取消／解散、人口扣返及軍糧','military','army'],
 ['B4','elite','精銳與文明衛隊、本城里程碑、雙軍事線','military','army'],
 ['B4','colony','v85 城堡生產、400 移民、實體待命隊、取消','colony','army'],
 ['B4','escort','20 護衛、預約、45 秒／格、消耗隊與護衛轉籍','colony','army'],
 ['存檔','reload','保存重讀、Recovery、命令／事件不重複','economy','logs'],
 ['操作','mobile','手機與桌機 UI，輸入、焦點、捲動與倒數','military','city'],
] as const;
type Tab='spec'|'checks'|'city'|'map'|'research'|'army'|'logistics'|'data'|'logs';
const TABS:Record<Tab,string>={spec:'v85 規格驗證台',checks:'驗證清單',city:'城市建設',map:'世界地圖',research:'科技／時代',army:'軍隊／拓殖',logistics:'商隊物流',data:'規格資料',logs:'事件／命令'};
const initial:DeveloperConfig={scenario:'new',seed:90217,speed:25,civilizationId:'civ_zhongguo'};
type ManualResult={status:'pending'|'pass'|'fail';note:string};
export default function DeveloperMode({mobile,onClose}:{mobile:boolean;onClose:()=>void}){
 const [config,setConfig]=useState<DeveloperConfig>(initial),[activeConfig,setActiveConfig]=useState<DeveloperConfig>(initial),[world,setWorld]=useState<FormalWorld|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[results,setResults]=useState<CheckResult[]>([]),[logs,setLogs]=useState<DeveloperLog[]>([]),[tab,setTab]=useState<Tab>('spec'),[cityId,setCityId]=useState<CityId>(),[target,setTarget]=useState<{x:number;y:number}>(),[filter,setFilter]=useState(''),[showConfig,setShowConfig]=useState(false),[manual,setManual]=useState<Record<string,ManualResult>>(()=>{try{return JSON.parse(localStorage.getItem('lieguo-developer-manual-v'+RELEASE.version)??'{}');}catch{return {};}});
 const [trial,setTrial]=useState<TrialInfo|null>(null),[preview,setPreview]=useState<unknown>(null);
 const [checksConfig,setChecksConfig]=useState<DeveloperConfig|null>(null);
 const worker=useRef<Worker|null>(null),waiting=useRef(true),doneClose=useRef(onClose);doneClose.current=onClose;
 const send=(r:DeveloperRequest)=>{if(!worker.current||waiting.current)return;waiting.current=true;setBusy(true);setError('');worker.current.postMessage(r);};
 useEffect(()=>{
  const w=new Worker(new URL('./runtime.worker.ts',import.meta.url),{type:'module'});worker.current=w;
  w.onmessage=({data})=>{
   if(data.type==='closed'){doneClose.current();return;}
   if(data.type==='done'){waiting.current=false;setBusy(false);return;}
   if(data.type==='error'){setError(data.text);return;}
   if(data.type==='notice'){setNotice(data.text);return;}
   if(data.type==='checksStarted'){setResults([]);setChecksConfig(data.config);return;}
   if(data.type==='check'){setResults(rows=>[...rows,data.result]);return;}
   if(data.type==='state'){setWorld(data.world);setActiveConfig(data.config);setTrial(data.trial??null);setPreview(data.preview??null);setResults(data.results);setChecksConfig(data.checksConfig??null);setLogs(data.logs);if(data.world)displayClock.adopt({campaignId:data.world.campaignId,time:data.world.time,speed:data.world.speed,running:false});}
  };
  w.onerror=e=>{waiting.current=false;setBusy(false);setError(e.message);};w.postMessage({type:'start',config:initial});
  return()=>{w.terminate();worker.current=null;};
 },[]);
 useEffect(()=>{try{localStorage.setItem('lieguo-developer-manual-v'+RELEASE.version,JSON.stringify(manual));}catch{/* Device-local verification notes only. */}},[manual]);
 const own=world?.cities.filter(c=>c.ownerFactionId===world.playerFactionId)??[],city=world?citySnapshot(world,own.find(c=>c.id===cityId)?.id??own[0]?.id):undefined;
 const issue=(payload:FormalCommand)=>send({type:'command',payload});
 const manualKey=(id:string)=>JSON.stringify([{...activeConfig,scenario:MANUAL_CHECKS.find(c=>c[1]===id)?.[3]??activeConfig.scenario},RELEASE.version,id]),updateManual=(id:string,patch:Partial<ManualResult>)=>{const key=manualKey(id);setManual(old=>({...old,[key]:{...(old[key]??{status:'pending',note:''}),...patch}}));};
 const pass=results.filter(r=>r.status==='pass').length,fail=results.filter(r=>r.status==='fail').length;
 const exportReport=()=>{
  const report={type:'developer-verification-report',version:RELEASE.version,createdAt:new Date().toISOString(),authority:'v85 > v84 > source',config:activeConfig,scope:'B2 / B3 / B4',specVerification:specReport(),activeTrial:trial,initialEnginePreview:preview,automaticConfig:checksConfig,automatic:results,manual:Object.entries(manual).map(([key,result])=>({test:JSON.parse(key),...result})),state:world?inspectWorld(world):null,logs,gate:'待玩家 Smoke 與獨立 Astra Core Systems Gate；自動檢查不等同 Gate PASS',deferred:['B5 戰鬥／攻城／實際偵察','B6 政治／聯軍','B8 AI 決策','B9 完整現代／終局','B11 長期壓測／實機驗收']};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='列國征途-B2-B4-驗證-v'+RELEASE.version+'.json';a.click();URL.revokeObjectURL(url);
 };
 const begin=(scenario:Scenario,nextTab:Tab=tab)=>{const next={...config,scenario};setConfig(next);setCityId(undefined);setTarget(undefined);setTab(nextTab);send({type:'start',config:next});};
 const close=()=>{if(busy)return;send({type:'close'});};
 const subset=(values:Record<string,unknown>)=>Object.entries(values).filter(([key,value])=>!filter||JSON.stringify([key,value]).toLowerCase().includes(filter.toLowerCase()));
 return <div className="developer-mode">
  <header className="developer-header"><div><strong>開發者模式 · B2／B3／B4</strong><small>v{RELEASE.version} · v85 ＞ v84 ＞ source · 獨立測試戰役</small></div><button disabled={busy} onClick={close}>返回原戰役</button></header>
  <div className="developer-controls"><button disabled={busy} onClick={()=>setShowConfig(!showConfig)}>測試情境</button><button disabled={busy||!world} onClick={()=>{setTab('checks');send({type:'checks'});}}>執行全部自動檢查</button><button disabled={busy||!world} onClick={exportReport}>匯出驗證報告</button><span>{busy?'處理中…':world?'已保存測試狀態':'尚未建立'}</span></div>
  {showConfig&&<form className="developer-config" onSubmit={e=>{e.preventDefault();setCityId(undefined);setTarget(undefined);send({type:'start',config});}}>
   <label>情境<select value={config.scenario} onChange={e=>setConfig(c=>({...c,scenario:e.target.value as Scenario}))}>{Object.entries(SCENARIOS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label>文明<select value={config.civilizationId} onChange={e=>setConfig(c=>({...c,civilizationId:e.target.value}))}>{Object.entries(CIV_NAMES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>倍數<select value={config.speed} onChange={e=>setConfig(c=>({...c,speed:Number(e.target.value)}))}>{[1,3,6,10,25].map(n=><option key={n} value={n}>{n}X</option>)}</select></label>
   <label>時代<select disabled={config.scenario==='new'} value={config.age??'preset'} onChange={e=>setConfig(c=>({...c,age:e.target.value==='preset'?undefined:Number(e.target.value) as 0|1|2|3}))}><option value="preset">情境預設</option>{['黑暗','封建','城堡','帝王'].map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label><label>種子<input type="number" min={0} max={2147483647} value={config.seed} onChange={e=>setConfig(c=>({...c,seed:Number(e.target.value)}))}/></label>
   <label>起始人口（留空用預設）<input type="number" min={0} max={30400} disabled={config.scenario==='new'} value={config.population??''} onChange={e=>setConfig(c=>({...c,population:e.target.value===''?undefined:Number(e.target.value)}))}/></label>
   <label>城堡 Lv<select value={config.castleLevel??1} onChange={e=>setConfig(c=>({...c,castleLevel:Number(e.target.value)}))}>{Array.from({length:15},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
   <label><input type="checkbox" disabled={config.scenario!=='modern'} checked={config.cooperation!==false} onChange={e=>setConfig(c=>({...c,cooperation:e.target.checked}))}/>預先完成科研協同（D1 測試）</label><button disabled={busy}>重建測試情境</button><p>預設情境提供所需資源、建築或資格；之後操作均走正式命令。時間暫停，以按鈕推進。原戰役未切換。</p>
  </form>}
  {world&&<div className="developer-time"><select aria-label="測試城市" value={city?.id} onChange={e=>{setCityId(e.target.value as CityId);setTarget(undefined);}}>{own.map(c=><option key={c.id} value={c.id}>{c.name}（{c.x}, {c.y}）</option>)}</select><span>{SCENARIOS[activeConfig.scenario]} · {activeConfig.speed}X · 世界 {(world.time/3600000).toFixed(3)}h · revision {world.revision}</span>
   {[['+1 秒',1000],['+1 分',60000],['+1 世界時',3600000/world.speed],['+24 世界時',86400000/world.speed]].map(([label,realMs])=><button key={label} disabled={busy} onClick={()=>send({type:'advance',realMs:Number(realMs)})}>{label}</button>)}<button disabled={busy} onClick={()=>send({type:'advance',realMs:0,next:true})}>下一完成事件</button><button disabled={busy} onClick={()=>send({type:'reload'})}>存檔重讀</button><button disabled={busy} onClick={()=>send({type:'restore'})}>前一回復點</button><small>秒／分為現實時間；世界時直接推進遊戲時間。</small>
  </div>}
  <div className="developer-message" role="status">{error||notice||'先選 v85 規則，建立正例／反例，對照預期後親自操作。B5 尚未開始。'}</div>
  <nav className="developer-tabs">{Object.entries(TABS).map(([id,title])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id as Tab)}>{title}</button>)}</nav>
  <main className="developer-content">
   {trial&&<section className="card audit-current-trial"><h2>本項試玩：{trial.name}</h2><p>v85 行 {trial.sourceLine} · 預期操作{trial.expectedAdmission==='allow'?'允許':'阻擋'} · {trial.expectedResult}</p><ol>{trial.steps.map(s=><li key={s}>{s}</li>)}</ol><div className="audit-actions">{trial.command&&<button disabled={busy} onClick={()=>issue(trial.command!)}>執行本項正式操作</button>}<button onClick={()=>setTab(['building','field','production'].includes(trial.request.kind)||trial.request.kind==='system'&&trial.request.target==='city'?'city':trial.request.kind==='unit'||trial.request.kind==='system'&&trial.request.target==='colony'?'army':trial.request.kind==='system'&&trial.request.target==='logistics'?'logistics':'research')}>到建設／科技頁親自操作</button><button onClick={()=>setTab('army')}>到軍隊頁</button><button onClick={()=>setTab('spec')}>回規格核對／記錄結果</button></div><details><summary>建立情境時的引擎影子試算（不代表已親自玩過）</summary><pre>{JSON.stringify(preview,null,2)}</pre></details></section>}
   {tab==='spec'&&<SpecAuditPanel world={world} config={config} busy={busy} trial={trial} logs={logs} onTrial={request=>{setCityId(undefined);setTarget(undefined);send({type:'trial',request});}}/>}
   {tab==='checks'&&<><section className="card"><h2>自動規則檢查 · {pass} 通過／{fail} 失敗</h2><p>由目前版本的正式引擎實際執行，包含 1／3／6／10／50X、六文明及獨立 IndexedDB。屬代表性核心檢查；全部規格驗收仍需下方操作確認與獨立 Core Gate。</p>{results.length?<div className="developer-table"><table><thead><tr><th>階段／規格</th><th>檢查</th><th>結果與證據</th></tr></thead><tbody>{results.map(r=><tr key={r.id}><td>{r.stage}<small>{r.spec}</small></td><td>{r.title}</td><td className={r.status}><strong>{r.status==='pass'?'通過':'失敗'}</strong><details><summary>實際值 · {r.elapsedMs}ms</summary><pre>{r.evidence}</pre></details></td></tr>)}</tbody></table></div>:<p>尚未執行，不預先顯示通過。</p>}</section>
    <section className="card"><h2>玩家逐項操作確認</h2><p>操作結果由你記錄；重建情境會重設測試戰役。各情境、文明、倍數與種子的人工紀錄分開保留。</p><div className="developer-manual">{MANUAL_CHECKS.map(([stage,id,title,scenario,nextTab])=>{const r=manual[manualKey(id)]??{status:'pending',note:''};return <article key={id}><strong>{stage} · {title}</strong><button disabled={busy} onClick={()=>begin(scenario,nextTab)}>開啟情境</button><select disabled={activeConfig.scenario!==scenario||busy} aria-label={title+'結果'} value={r.status} onChange={e=>updateManual(id,{status:e.target.value as ManualResult['status']})}><option value="pending">尚未確認</option><option value="pass">親自確認通過</option><option value="fail">發現問題</option></select><input disabled={activeConfig.scenario!==scenario||busy} aria-label={title+'備註'} placeholder="操作步驟／發現問題" value={r.note} onChange={e=>updateManual(id,{note:e.target.value})}/></article>;})}</div></section>
    <section className="card"><h2>階段界線</h2><p>B2 固定世界與據點可驗證；B4 可驗證科技付款、時代、兵種生產及拓殖。野外守軍戰鬥／重生、真正偵察、攻城、政治／AI 決策、完整現代兵與終局仍屬後續階段。科技資料存在不代表戰鬥效果已接入。</p><p>目前結論：等待玩家 Smoke 與 Astra B2–B4 Core Systems Gate。開發者模式不自動授予 Gate PASS。</p></section></>}
   {world&&city&&<>
    {['city','research','army','logistics'].includes(tab)&&<div className="developer-city-summary">人口 {Math.floor(city.population)}／{city.housing} · 穀 {city.stock.food}　木 {city.stock.wood}　石 {city.stock.stone}　金 {city.stock.gold}</div>}
    {tab==='city'&&<FormalCityPanel world={world} cityId={city.id} mobile={mobile} issue={issue} busy={busy}/>}
    {tab==='map'&&<div className="developer-map"><FormalWorldMap world={world} mobile={mobile} focusCityId={city.id} focusPoint={target} onSelect={id=>{setCityId(id);setTab('city');}} onSettle={p=>{setTarget(p);setTab('army');}}/></div>}
    {tab==='research'&&<ResearchView world={world} city={city} issue={issue} busy={busy}/>}
    {tab==='army'&&<ArmyView key={city.id} world={world} city={city} mobile={mobile} issue={issue} busy={busy} targetPoint={target} onMap={p=>{setTarget(p);setTab('map');}}/>}
    {tab==='logistics'&&<FormalDevelopmentPanel world={world} city={city} issue={issue} busy={busy} mode="logistics"/>}
   </>}
   {tab==='data'&&<><input aria-label="搜尋規格資料" placeholder="搜尋建築、兵種、科技或數值" value={filter} onChange={e=>setFilter(e.target.value)}/><p>以下是目前程式實際讀取的資料。對照 v85 規格與自動檢查的預期值；可辨識錯誤轉錄，不能單憑資料存在判定功能完成。</p>{[['建築',BUILDING_CATALOG],['兵種',UNIT_CATALOG],['科技',TECH_CATALOG]].map(([label,values])=><section className="card" key={label as string}><h2>{label as string}</h2>{subset(values as Record<string,unknown>).map(([key,value])=><details key={key}><summary>{key} · {(value as {name?:string}).name??''}</summary><pre>{JSON.stringify(value,null,2)}</pre></details>)}</section>)}</>}
   {tab==='logs'&&<><section className="card"><h2>命令與實際前後結果</h2>{logs.slice().reverse().map(l=><details key={l.sequence}><summary>#{l.sequence} {l.action} · {l.result} · revision {l.revision}</summary><pre>{JSON.stringify(l,null,2)}</pre></details>)}</section><section className="card"><h2>目前事件、資源、佇列、ledger 與拓殖實體</h2><pre>{world?JSON.stringify(inspectWorld(world),null,2):'尚無測試狀態'}</pre></section></>}
  </main>
 </div>;
}
