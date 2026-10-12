import {RebirthView,CraftsmanPanel} from './presentation/ExtinctionView';
import {PoliticsView} from './presentation/PoliticsView';
import {useAppUpdate} from './useAppUpdate';
import {TargetIntelContext} from './presentation/targetIntel';
import {FormalReportsView} from './presentation/FormalReportsView';
import {B5BattleLab} from './developer/B5BattleLab';
import {DeveloperControls} from './presentation/DeveloperControls';
import {effectiveSpeed} from './formal/playtest';
import type {ArmyTarget} from './formal/combatModel';
import {useEffect,useRef,useState} from 'react';
import {useGame} from './useGame';
import {Home} from './FormalHome';
import {Start} from './presentation/Start';
import {Shell,NAV,type View} from './presentation/Shell';
import {ArmyView,ResearchView} from './presentation/DevelopmentViews';
import {Dialog,Heading,clock,fmt,netProduction} from './presentation/UI';
import {ThemeSettings,useTheme} from './ThemeSettings';
import {RELEASE,releaseNotes} from './release';
import {BrandMark} from './BrandMark';
import FormalCityPanel from './FormalCityPanel';
import FormalWorldMap from './FormalWorldMap';
import FormalDevelopmentPanel from './FormalDevelopmentPanel';
import type {CityId} from './formal/ids';
import {citySnapshot} from './formal/economy';
import {resourceKeys} from './formal/model';
import {spatial} from './formal/spatial';
import {storageCapacity,protection} from './formal/catalogB3';
import {CIV_NAMES,LABELS} from './presentation/artMap';
import './presentation/playable.css';
import './presentation/parity.css';
const MOBILE_QUERY='(max-width: 760px), (max-width: 1100px) and (pointer: coarse)';
/** DEMO shell → Formal presentation → useGame → Worker → commands / persistence. */
export default function GameApp(){
 const engine=useGame(),{world,status,busy}=engine,{theme,setTheme}=useTheme();
 const [entered,setEntered]=useState(false),[fresh,setFresh]=useState(false),[view,setView]=useState<View>('city'),[selectedCity,setSelectedCity]=useState<CityId>(),[more,setMore]=useState(false),[resource,setResource]=useState<typeof resourceKeys[number]|null>(null),[pendingImport,setPendingImport]=useState<File|null>(null),[restoreId,setRestoreId]=useState<number|null>(null),[cityName,setCityName]=useState(''),[rename,setRename]=useState(false),[mapPoint,setMapPoint]=useState<{x:number;y:number}>(),[targetPoint,setTargetPoint]=useState<{x:number;y:number}>(),[armyTarget,setArmyTarget]=useState<ArmyTarget>(),[mobile,setMobile]=useState(()=>window.matchMedia(MOBILE_QUERY).matches),[toast,setToast]=useState('');
 const [battleLab,setBattleLab]=useState(false);
 const [centerRequest,setCenterRequest]=useState(0);
 const fileInput=useRef<HTMLInputElement>(null),waiting=useRef('');
 const owned=world?spatial(world).owned(world.playerFactionId):[],homeId=owned.find(c=>c.id===selectedCity)?.id??owned[0]?.id,home=world&&homeId?citySnapshot(world,homeId):undefined,f=world?.factions.find(f=>f.id===world.playerFactionId);
 useEffect(()=>{const media=window.matchMedia(MOBILE_QUERY),change=()=>{setMobile(media.matches);setMore(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{if(engine.transition&&waiting.current===engine.transition){waiting.current='';setFresh(false);setEntered(true);setView('city');setSelectedCity(undefined);setTargetPoint(undefined);setArmyTarget(undefined);}},[engine.transition]);
 useEffect(()=>{setToast(engine.error||engine.notice);const id=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(id);},[engine.error,engine.notice]);
 const navigate=(v:View)=>{setMapPoint(undefined);setView(v);setMore(false);if(v!=='army')setTargetPoint(undefined);};
 const transition=(type:'start'|'import'|'restore',data:Record<string,unknown>)=>{const id=crypto.randomUUID();waiting.current=id;if(type==='start')engine.send({type,seed:data.seed as number,speed:data.speed as number,name:data.name as string,civilizationId:data.civilizationId as string,offlineHours:data.offlineHours as 0|1|6|24,transitionId:id});else if(type==='restore')engine.send({type,id:data.id as number,transitionId:id});else engine.send({type,text:data.text as string,transitionId:id});};
 const importFile=async()=>{const file=pendingImport;if(!file)return;if(file.size>100*1024*1024){setToast('存檔超過 100 MiB。');return;}try{const text=await file.text();transition('import',{text});setPendingImport(null);}catch{setToast('無法讀取檔案，原戰役保留。');}};
 const updates=useAppUpdate(async()=>{if(world)await engine.sync();});
 const checkUpdate=updates.check,updateText=updates.text;
 const updateDisabled=busy||updates.updating||status==='loading'||status==='error';
 const fileControl=<input ref={fileInput} hidden type="file" accept=".realm-save,.json" onChange={e=>{const file=e.target.files?.[0];if(file)setPendingImport(file);e.target.value='';}}/>;

 const importModal=pendingImport&&<Dialog title="匯入戰役存檔" onClose={()=>setPendingImport(null)}><p>{pendingImport.name} · {(pendingImport.size/1024).toFixed(1)} KB</p><p>只接受正式戰役存檔。確認後驗證檢查碼、建立回復點並替換目前戰役；驗證失敗時保留原進度。</p><div className="dialog-actions"><button onClick={()=>setPendingImport(null)}>取消</button><button className="primary" disabled={busy||status==='locked'} onClick={()=>void importFile()}>確認匯入</button></div></Dialog>;
 const toastUI=toast&&<div className={'toast '+(engine.error?'error':'')} role="status">{toast}</div>;
 if(status==='locked')return <div className="loading-screen"><BrandMark/><h1>戰役已在另一個分頁開啟</h1><p>{engine.error}</p><button onClick={()=>window.location.reload()}>重新整理</button></div>;
 if(fresh)return <><Start busy={busy} hasSave={!!world} onClose={()=>setFresh(false)} onStart={(civilizationId,seed,speed,name,offlineHours)=>transition('start',{civilizationId,seed,speed,name,offlineHours})}/>{toastUI}</>;
 if(entered&&world&&!home&&f&&world.extinction?.extinct.includes(f.id))return <><RebirthView world={world} issue={engine.issue} busy={busy} onHome={()=>setEntered(false)}/>{toastUI}</>;
 if(!entered||!world||!home||!f)return <><Home updateAvailable={updates.available} updating={updates.updating} updateDisabled={updateDisabled} onUpdate={()=>void updates.update()} onCheck={()=>void checkUpdate()} updateText={updateText} world={world} theme={theme} onThemeChange={setTheme} busy={busy} loading={status==='loading'} error={engine.error} onNew={()=>setFresh(true)} onStart={()=>setEntered(true)} onRetry={()=>engine.send({type:'load'})} onExport={mode=>engine.send({type:'export',mode})} onImport={()=>fileInput.current?.click()}/>{fileControl}{importModal}{toastUI}</>;
 const props={world,city:home,issue:engine.issue,busy},p=netProduction(world,home);
 return <><TargetIntelContext.Provider value={engine.readCityIntel}><Shell world={world} city={home} cities={owned} mobile={mobile} view={view} onEra={()=>{navigate('city');setCenterRequest(n=>n+1);}} onView={navigate} onCity={id=>{setSelectedCity(id);setCityName('');setTargetPoint(undefined);}} onHome={()=>setEntered(false)} onResource={setResource} onMore={()=>setMore(true)} moreOpen={more} busy={busy} unread={engine.reportStatus?.unread??0} alerts={engine.reportStatus?.alerts??0}>
 {view==='map'&&<FormalWorldMap mobile={mobile} world={world} focusPoint={mapPoint} focusCityId={homeId} onSelect={id=>{setSelectedCity(id);navigate('city');}} issue={engine.issue} busy={busy} onSettle={p=>{setArmyTarget(undefined);setTargetPoint(p);setView('army');}}/>}
 {view==='city'&&<div className="view-scroll city-view"><FormalCityPanel world={world} cityId={home.id} onNavigate={setView} centerRequest={centerRequest} onCenterOpened={()=>setCenterRequest(0)} issue={engine.issue} busy={busy} mobile={mobile} onRename={()=>{setCityName(home.name);setRename(true);}}/></div>}
 {view==='research'&&<ResearchView key={home.id} {...props}/>}{view==='army'&&<ArmyView key={home.id+':'+JSON.stringify(armyTarget)+':'+(targetPoint?targetPoint.x+','+targetPoint.y:'')} {...props} mobile={mobile} armyTarget={armyTarget} targetPoint={targetPoint} onMap={p=>{setMapPoint(p);setArmyTarget(undefined);setTargetPoint(undefined);setView('map');}}/>}
 {view==='diplomacy'&&<><PoliticsView {...props}/><CraftsmanPanel {...props}/></>}
 {view==='reports'&&<FormalReportsView world={world} busy={busy} rows={engine.reports} data={engine.reportData} epoch={engine.reportEpoch} status={engine.reportStatus} send={engine.send} onMap={p=>{setMapPoint(p);setView('map');}}/>}
 {view==='empire'&&<div className="view-scroll empire-view"><Heading title="治理方針" subtitle="城市總覽與商隊運輸"/><div className="empire-list">{owned.map(city=>{const c=citySnapshot(world,city.id)!;return <section className="card" key={c.id}><h2>{c.name}（{c.x}, {c.y}）</h2><p>人口 {fmt(c.population)} / 住房 {fmt(c.housing)}<br/>穀／木／石／金 {resourceKeys.map(r=>fmt(c.stock[r])).join('/')}</p><button onClick={()=>{setSelectedCity(c.id);navigate('city');}}>前往城市</button></section>;})}</div><section className="card"><FormalDevelopmentPanel key={home.id} {...props} mode="logistics"/></section><section className="card"><h2>委任總督與政治</h2><p>此頁保留治理入口；總督與政治系統尚未開放。</p><button disabled>委任總督（尚未開放）</button></section></div>}
 {view==='tasks'&&<div className="view-scroll tasks-view"><Heading title="任務" subtitle="建設指引"/><section className="card objectives">{[{name:'讓糧食先行',text:'升級一塊城郊農田',done:owned.some(c=>c.fields?.some(f=>f.resource==='food'&&f.level>0)),view:'city' as View},{name:'召集第一支部隊',text:'建立兵營並招募',done:owned.some(c=>Object.values(c.military?.units??{}).some(n=>n>0)),view:'army' as View},{name:'建立第二座聚落',text:'城堡時代完成拓殖整備',done:owned.length>1,view:'army' as View}].map((s,i)=><button key={s.name} className={s.done?'done':''} onClick={()=>navigate(s.view)}><span>{s.done?'✓':i+1}</span><div><strong>{s.name}</strong><small>{s.text}</small></div></button>)}</section><section className="card"><h2>征服與帝國霸權</h2><p>掠奪、征服與偵察可由地圖或軍隊頁派遣；任務獎勵與終局勝利尚未開放。</p></section></div>}
 {view==='settings'&&<div className="view-scroll settings"><Heading title="存檔與戰役設定" subtitle="這是你的單機戰役"/><ThemeSettings theme={theme} onChange={setTheme}/><DeveloperControls {...props} onBattleLab={()=>setBattleLab(true)}/><section className="card"><h2>保存與搬移戰役</h2><p>快速存檔不含歷史紀事；完整備份包含紀事。本機進度不會自動同步。</p><div className="settings-actions"><button disabled={busy} onClick={()=>engine.send({type:'sync'})}>立即保存</button><button disabled={busy} onClick={()=>engine.send({type:'load'})}>重新讀取</button><button disabled={busy} onClick={()=>engine.send({type:'export',mode:'quick'})}>快速存檔</button><button disabled={busy} onClick={()=>engine.send({type:'export',mode:'full'})}>完整備份</button><button disabled={busy} onClick={()=>fileInput.current?.click()}>匯入存檔</button><button disabled={busy} onClick={()=>engine.send({type:'backups'})}>查看回復點</button></div><div className="backup-list">{engine.backups.map(b=><div key={b.id}><span><strong>{b.label}</strong><small>{new Date(b.at).toLocaleString('zh-TW')} · {clock(b.time)}</small></span><button disabled={busy} onClick={()=>setRestoreId(b.id)}>回復</button></div>)}</div></section><section className="card"><h2>戰役資料 · v{RELEASE.version}</h2><div className="settings-data"><span>世界種子<strong>{world.seed}</strong></span><span>世界時間<strong>{clock(world.time)}</strong></span><span>速度<strong>{effectiveSpeed(world)}X</strong></span><span>文明<strong>{CIV_NAMES[f.civilizationId]}</strong></span><span>世界<strong>{world.dimensions.width}×{world.dimensions.height}</strong></span><span>勢力／據點<strong>{world.factions.length}／{world.worldLayer?.wildSites.length}</strong></span></div><div className="settings-actions"><button onClick={()=>setEntered(false)}>返回首頁</button><button disabled={busy} onClick={()=>setFresh(true)}>開始另一場戰役</button><button onClick={()=>void checkUpdate()}>檢查更新</button></div><p role="status">{updateText}</p>{updates.available&&<button className="primary" disabled={updateDisabled} onClick={()=>void updates.update()}>{updates.updating?'正在保存並更新…':'保存進度並載入新版'}</button>}<ul>{releaseNotes.map(n=><li key={n}>{n}</li>)}</ul></section></div>}
 </Shell></TargetIntelContext.Provider>
 {updates.available&&!battleLab&&<button className={"update-alert"+(mobile?" formal-mobile-update":"")} disabled={updateDisabled} onClick={()=>void updates.update()}>{updates.updating?'正在保存並更新…':'新版可用 · 保存並更新'}</button>}
 {engine.offline&&<Dialog title="你離開後的河谷" onClose={engine.clearOffline}><p>離開 {clock(engine.offline.elapsedRealMs)}，世界前進了 {clock(engine.offline.advancedWorldMs)}。</p><p>本局離線上限 {engine.offline.capHours} 現實小時{engine.offline.elapsedRealMs>engine.offline.advancedRealMs?'；超出的時間不再補算。':'。'}</p><ul><li>完成工程 {engine.offline.buildingsCompleted} 項</li><li>訓練部隊 {engine.offline.unitsTrained} 名</li><li>完成科技 {engine.offline.technologiesCompleted} 項</li><li>建立城市 {engine.offline.citiesFounded} 座</li><li>人口變化 {Math.floor(engine.offline.populationChange)}</li></ul><button className="primary" onClick={engine.clearOffline}>回到城市</button></Dialog>}
 {resource&&<Dialog title={home.name+' · '+LABELS[resource]+'產量與倉儲'} onClose={()=>setResource(null)}><table className="hud-table"><tbody><tr><th>實際庫存</th><td>{fmt(home.stock[resource])}</td></tr><tr><th>淨產量／世界時</th><td>{p[resource]>=0?'+':''}{p[resource].toFixed(2)}</td></tr><tr><th>每種倉儲容量</th><td>{fmt(storageCapacity(home))}</td></tr><tr><th>地庫保護</th><td>{fmt(protection(home))}</td></tr><tr><th>入境預約</th><td>{fmt(home.economy?.reservedIncoming[resource]??0)}</td></tr></tbody></table><p>統治初定會降低產量；糧食淨產量已扣除城內、駐外與拓殖護衛軍糧。</p><button onClick={()=>{setResource(null);navigate('empire');}}>前往商隊運輸</button></Dialog>}
 {more&&<Dialog title="戰役總覽" onClose={()=>setMore(false)}><div className="mobile-more"><button onClick={()=>{setMore(false);setEntered(false);}}>列國征途首頁 · v{RELEASE.version}</button>{NAV.filter(n=>['tasks','settings'].includes(n.id)).map(n=><button key={n.id} onClick={()=>navigate(n.id)}>{n.icon} {n.name}</button>)}</div><p className="mobile-campaign-time">{clock(world.time)} · {effectiveSpeed(world)}X · {f.name}</p></Dialog>}
 {rename&&<Dialog title="城市改名" onClose={()=>setRename(false)}><label>城市名稱<input value={cityName} maxLength={24} onChange={e=>setCityName(e.target.value)}/></label><div className="dialog-actions"><button disabled={busy||!cityName.trim()} onClick={()=>{engine.issue({type:'city.rename',cityId:home.id,name:cityName.trim()});setRename(false);}}>確認改名</button></div></Dialog>}
 {battleLab&&world.developer?.enabled&&<B5BattleLab base={world} mobile={mobile} onClose={()=>setBattleLab(false)}/>}
 {restoreId!==null&&<Dialog title="回復先前戰役" onClose={()=>setRestoreId(null)}><p>目前進度先建立回復點，再載入選定戰役。世界從回復時間繼續。</p><div className="dialog-actions"><button onClick={()=>setRestoreId(null)}>取消</button><button className="primary" disabled={busy} onClick={()=>{transition('restore',{id:restoreId});setRestoreId(null);}}>確認回復</button></div></Dialog>}{fileControl}{importModal}{toastUI}</>;
}
