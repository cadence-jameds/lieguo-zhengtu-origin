import {parseWorldSeed,randomWorldSeed} from './worldSeed';
import {CivilizationEmblem} from './CivilizationEmblem';
import {BrandMark} from './BrandMark';
import {DEFAULT_SPEED,NEW_GAME_SPEEDS} from '../config/realm';
import {lordName} from '../content/lordNames';
import {RELEASE} from './release';
import { useEffect,useId,useRef,useState,type ReactNode,type CSSProperties } from 'react';
import { civilizations,civilizationById } from '../content/civilizations';
import { bonuses,resourceIcons,resourceNames,units } from './content';
import { HOUR,MINUTE,resources,type Stock,type Unit } from './types';
export const fmt=(n:number)=>Math.floor(n).toLocaleString('zh-TW');
export const clock=(ms:number)=>Math.floor(ms/HOUR)+'時 '+String(Math.floor(ms%HOUR/MINUTE)).padStart(2,'0')+'分';
export function duration(ms:number){const s=Math.max(0,Math.ceil(ms/1000));return s>=3600?Math.floor(s/3600)+'時 '+Math.floor(s%3600/60)+'分':s>=60?Math.floor(s/60)+'分 '+s%60+'秒':s+'秒';}
export const unitName=(u:Unit,id:string)=>u==='signature'?civilizationById.get(id)?.signatureUnit.name??units[u].name:units[u].name;
export function Cost({cost,stock,showZero=false}:{cost:Stock;stock?:Stock;showZero?:boolean}){return <div className="cost">{resources.filter(r=>showZero||cost[r]>0).map(r=><span key={r} className={stock&&stock[r]<cost[r]?"resource-shortage":""} title={resourceNames[r]}><i className={'res-'+r}>{resourceIcons[r]}</i>{fmt(cost[r])}{stock&&stock[r]<cost[r]&&<small>缺 {Math.ceil(cost[r]-stock[r]).toLocaleString("zh-TW")}</small>}</span>)}</div>;}
export function Meter({value,max=100}:{value:number;max?:number}){return <div className="meter" role="meter" aria-label="進度" aria-valuenow={Math.max(0,Math.min(max,Math.round(value)))} aria-valuemin={0} aria-valuemax={max}><span style={{width:Math.max(0,Math.min(100,value/max*100))+'%'}}/></div>;}
export function Empty({children}:{children:ReactNode}){return <div className="empty">{children}</div>;}
export function Dialog({title,onClose,children,headerAction}:{title:string;onClose:()=>void;children:ReactNode;headerAction?:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null),id=useId(),backdrop=useRef(false);
  useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
  const outside=(e:{clientX:number;clientY:number})=>{const r=ref.current!.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  return <dialog ref={ref} aria-labelledby={id} onPointerDown={e=>{backdrop.current=e.target===e.currentTarget&&outside(e);}} onPointerCancel={()=>{backdrop.current=false;}} onClick={e=>{if(backdrop.current&&e.target===e.currentTarget&&outside(e)){e.stopPropagation();onClose();}backdrop.current=false;}} onCancel={e=>{e.preventDefault();onClose();}}><div className="dialog-title"><h2 id={id}>{title}</h2>{headerAction&&<div className="dialog-header-action">{headerAction}</div>}<button onClick={onClose} aria-label="關閉對話框">×</button></div><div className="dialog-body">{children}</div></dialog>;
}
export function Start({onStart,busy,onClose,hasSave=false}:{onStart:(player:string,seed:number,speed:number,name:string,offlineLimit:number)=>void;busy:boolean;onClose?:()=>void;hasSave?:boolean}){
  const [player,setPlayer]=useState(civilizations[0].id),[seedText,setSeedText]=useState(()=>String(randomWorldSeed())),[speed,setSpeed]=useState<number>(DEFAULT_SPEED),[offlineLimit,setOfflineLimit]=useState(86400000),civ=civilizationById.get(player)!;
  const seed=parseWorldSeed(seedText);
  const [name,setName]=useState(()=>lordName(civilizations[0].id,20260906)),[replace,setReplace]=useState(false);
  return <div className="start-screen"><div className="start-vignette"/><div className="start-content">
    <div className="start-mark"><BrandMark/><span>列國征途 <small>河谷戰役 · 單機策略測試版 · v{RELEASE.version}</small></span></div>
    <div className="start-heading"><p className="eyebrow">六個文明，三十六位獨立領主</p><h1>選擇你的文明</h1><p>建設城邦、偵察鄰境，讓你的旗幟越過群山與河流。</p></div>
    <div className="civ-grid">{civilizations.map(c=><button className={'civ-option '+(c.id===player?'chosen':'')} key={c.id} aria-pressed={c.id===player} style={{'--civ':c.accent} as CSSProperties} onClick={()=>setPlayer(c.id)}><CivilizationEmblem civ={c.id}/><strong>{c.name}</strong><small>{c.strategy}</small></button>)}</div>
    <div className="civ-detail"><div><span className="eyebrow">文明特性</span><p>{bonuses[player]}</p></div><div><span className="eyebrow">城堡時代代表兵種</span><p>{civ.signatureUnit.name}</p><small>{civ.signatureUnit.battlefieldRole}</small></div></div>
    <div className="start-player-name"><label htmlFor="new-player-name">玩家名字</label><div><input id="new-player-name" value={name} maxLength={24} onChange={e=>setName(e.target.value)} placeholder="輸入領主名字"/><button type="button" aria-label="隨機產生玩家名字" title="隨機命名" onClick={()=>{let next=name;for(let i=0;i<16&&next===name;i++)next=lordName(player,crypto.getRandomValues(new Uint32Array(1))[0]);setName(next);}}>🎲</button></div><small>1～24 字，之後可免費重複修改；骰子依目前文明產生名字。</small></div><div className="start-options"><label>戰役速度<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{NEW_GAME_SPEEDS.map(value=><option key={value} value={value}>{value}X（現實 1 秒 = 遊戲 {value} 秒）</option>)}</select></label><label>離線世界推進<select value={offlineLimit} onChange={e=>setOfflineLimit(Number(e.target.value))}><option value={0}>隨時玩 · 離線即停止</option><option value={3600000}>輕鬆玩 · 最多 1 小時</option><option value={21600000}>標準節奏 · 最多 6 小時</option><option value={86400000}>持續世界 · 最多現實 1 天</option></select><small>按現實時間計算，每次離線重新計時。到上限時全世界停止；運作期間仍可能受攻擊。</small></label><div className="seed-option"><label htmlFor="world-seed">世界種子碼</label><div className="seed-input-row"><input id="world-seed" type="text" inputMode="numeric" maxLength={10} value={seedText} aria-invalid={seed===null} aria-describedby="seed-help" onChange={e=>setSeedText(e.target.value)}/><button type="button" aria-label="隨機產生世界種子碼" title="隨機種子" disabled={busy} onClick={()=>setSeedText(String(randomWorldSeed()))}>🎲</button></div><small id="seed-help">開局自動隨機，也可輸入種子碼重現同版本地圖。</small>{seed===null&&<small role="alert">請輸入 0～4294967295 的整數。</small>}</div></div>
    <p className="start-note">文明決定特色，領主各有土地；軍團成員保留城市。所有領主使用相同速度。{offlineLimit===0?'離開頁面後世界停止，回來後繼續。':'離開頁面後依設定上限推進世界，回來時自動接續。'}本局開始後不再切換速度。</p>
    {hasSave&&<label className="warning-check"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/>我了解新遊戲會替換目前戰役；目前進度會先建立回復點。</label>}<div className="start-actions">{onClose&&<button onClick={onClose}>返回</button>}<button className="primary large" disabled={busy||!name.trim()||(hasSave&&!replace)||seed===null} onClick={()=>{if(seed!==null)onStart(player,seed,speed,name.trim(),offlineLimit);}}>{busy?'建立戰役中…':'升起旗幟 · 開始戰役'}</button></div>
    <small className="start-footer">純單機 · 本機存檔 · 無每日任務 · 無付費加速</small>
  </div></div>;
}
