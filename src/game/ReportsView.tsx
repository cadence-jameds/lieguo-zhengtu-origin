import {importantMessage} from './messages';
import {reportArt} from './legacyEngine';
import {art} from './assets';
import {isWildSite} from './npc';
import { useEffect, useState } from 'react';
import { reportTabs, type ReportTab } from './progress';
import { countTroops,unitIds, type BattleParty, type Game, type Node, type Report } from './legacyTypes';
import type {ReportPage} from './legacyPersistence';
import { units } from './content';
import { clock, Cost, Empty } from './ui';
const reportDate=new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const reportClock=new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});
export const reportTime=(realAt:number|undefined,worldAt:number)=>realAt===undefined?'世界 '+clock(worldAt):reportDate.format(realAt);
export const reportEntryTime=(realAt:number|undefined,worldAt:number)=>realAt===undefined?clock(worldAt):reportClock.format(realAt);

export function battlePresentation(r:Report,destination?:Node){
  const split=r.title.lastIndexOf(' · '),originalTarget=split<0?r.title:r.title.slice(0,split);
  const wild=destination?isWildSite(destination):/^(?:沃野農莊|山林木寨|採石場|黃金礦脈|盜賊營地) Lv\.?\d+$/.test(originalTarget);
  const target=originalTarget.replace(/ Lv\.(\d+)$/,' Lv$1');
  const narrative=wild?r.text.replace(' 攻擊 中立。',' 攻擊 '+target+'。'):r.text;
  // A wild site can move when it respawns. Older reports lack a location snapshot.
  const position=r.location??(destination?.generation?undefined:destination);
  const sentence=narrative.replace(/^守方戰報。/,'').split('。')[0];
  const divider=sentence.indexOf(' 攻擊 '),coordinates=position?`(${position.x}, ${position.y})`:null;
  return {heading:sentence+(coordinates?' '+coordinates:''),narrative,
    attacker:divider<0?null:sentence.slice(0,divider),defender:divider<0?null:sentence.slice(divider+4),coordinates};
}

export function battleScene(r:Report,destination?:Node):string|null{
  if(!r.text.includes(' 攻擊 ')||!r.before||!r.after||!r.enemyBefore||!r.enemyAfter)return null;
  const title=r.title.split(' · ').at(-1)??'',wild=destination?isWildSite(destination):/^(?:沃野農莊|山林木寨|採石場|黃金礦脈|盜賊營地) Lv\.?\d+/.test(r.title);
  const wall=Number(r.text.match(/城牆 (\d+) 級/)?.[1]??0),siege=!wild&&wall>0;
  const attack=countTroops(r.before),defense=countTroops(r.enemyBefore),attackLoss=Math.max(0,attack-countTroops(r.after)),defenseLoss=Math.max(0,defense-countTroops(r.enemyAfter));
  const approach=siege?'軍隊沿著城牆展開，前鋒向城門逼近。':wild?'隊伍穿過野地，向資源據點推進。':'兩軍在聚落外列陣，前鋒率先接觸。';
  const opening=r.before.siege>0&&siege?'攻城器敲擊防線，守軍從城牆上還擊。':r.before.archer>0?'弓手放箭掩護前鋒，雙方很快陷入近戰。':r.before.cavalry>0?'騎兵從側翼衝入戰線，步兵緊隨其後。':'前鋒交錯衝擊，攻守雙方在陣前纏鬥。';
  const response=defense===0?'據點沒有守軍出戰。':defenseLoss>0?'守軍迎擊後折損 '+defenseLoss+' 人；攻方也付出 '+attackLoss+' 人的代價。':'守軍擋下衝擊，攻方折損 '+attackLoss+' 人。';
  const result=title==='攻方勝利'?'這一役攻方取得勝勢，餘部依戰果駐防或返城。':title==='守方勝利'?'守方守住陣地，攻擊隊伍未能得手。':/第 \d+ 回合/.test(title)?'雙方暫時拉開距離，下一回合仍將交鋒。':'雙方清點兵力，等待戰局下一步發展。';
  return approach+(defense?opening:'')+response+result;
}

function BattleHeading({battle}:{battle:ReturnType<typeof battlePresentation>}){
  if(battle.attacker===null||battle.defender===null)return <>{battle.heading}</>;
  return <><span className="battle-attacker">{battle.attacker}</span>{' 攻擊 '}<span className="battle-defender">{battle.defender}</span>{battle.coordinates&&<> <span className="battle-coordinates">{battle.coordinates}</span></>}</>;
}
function BattleAffiliations({sides}:{sides:NonNullable<Report['battleSides']>}){
  const side=(party:BattleParty,label:string)=><div><b>{label} · {party.lord}</b><span>軍團：<span className={party.leagueColor?'relation-name':undefined} style={party.leagueColor?{color:party.leagueColor}:undefined}>{party.league??'無軍團'}</span></span><span>帝國：<span className={party.empire?'empire-name':undefined} style={party.empireColor?{color:party.empireColor}:undefined}>{party.empire??'獨立領主'}</span></span></div>;
  return <div className="battle-affiliations">{side(sides.attacker,'攻方')}{side(sides.defender,'守方')}</div>;
}

export function ReportsView({g,onNode,busy,requestReports,reportPage,reportEpoch,reportAction}:{g:Game;onNode:(id:string)=>void;busy:boolean;requestReports:(filter:ReportTab,page:number)=>void;reportPage:{campaign:string;filter:ReportTab;page:number;data:ReportPage}|null;reportEpoch:number;reportAction:(action:'read'|'clear',ids?:number[],filter?:ReportTab)=>void}) {
  const [filter,setFilter]=useState<ReportTab>('all'),[page,setPage]=useState(0),[clearing,setClearing]=useState(false);
  useEffect(()=>{requestReports(filter,page);},[g.campaign,filter,page,reportEpoch,requestReports]);
  const campaignPage=reportPage?.campaign===g.campaign?reportPage:null;
  const data=campaignPage?.filter===filter&&campaignPage.page===page?campaignPage.data:null;
  const counts=campaignPage?.data.counts;
  const reports=data?.rows??[],count=data?.count??counts?.[filter]??0,pages=Math.max(1,Math.ceil(count/50)),current=Math.min(page,pages-1);
  const pager=<div className="report-pager"><button disabled={!data||!current} onClick={()=>setPage(current-1)}>上一頁</button><span>{current+1} / {pages} · {count} 則</span><button disabled={!data||current>=pages-1} onClick={()=>setPage(current+1)}>下一頁</button></div>;
  return <div className="view-scroll reports-view">
    <div className="reports-toolbar"><h1 className="reports-heading">戰報與紀事</h1><div><button disabled={busy||!g.reportUnread} onClick={()=>reportAction('read',undefined,filter)}>全部已讀</button><button disabled={busy||!data||!count} onClick={()=>setClearing(!clearing)}>清除{filter==='all'?'全部':'此分類'}</button></div></div>
    <p className="message-retention">歷史戰報獨立保存；每次只讀取 50 則。與玩家無關的 AI 戰鬥只計入統計。</p><div className="report-tabs" role="group" aria-label="戰報分類">{reportTabs.map(tab=><button key={tab.id} aria-pressed={filter===tab.id} onClick={()=>{setFilter(tab.id);setPage(0);setClearing(false);}}>{tab.name}<small>{counts?.[tab.id]??'…'}</small></button>)}</div>
    {clearing&&<div className="report-clear-confirm"><span>清除{filter==='all'?'全部':reportTabs.find(t=>t.id===filter)?.name} {count} 則消息？</span><button onClick={()=>setClearing(false)}>取消</button><button disabled={busy} onClick={()=>{reportAction('clear',undefined,filter);setClearing(false);setPage(0);}}>確認清除</button></div>}
    {count>50&&pager}
    {!data?<p className="report-loading" role="status">正在讀取{reportTabs.find(tab=>tab.id===filter)?.name}戰報…</p>:reports.length?<div className="reports-list" key={filter+current}>{reports.map(r=>{
      const destination=g.nodes.find(n=>n.id===r.node),battle=r.kind==='battle'?battlePresentation(r,destination):null,scene=r.kind==='battle'?battleScene(r,destination):null;
      const canVisit=destination&&!destination.respawnAt&&destination.kind!=='ruins'&&(!isWildSite(destination)||(r.location?destination.x===r.location.x&&destination.y===r.location.y:!destination.generation));
      return <details className={'report compact-report'+(r.read===false?' unread':'')} key={r.id} onToggle={e=>{if(e.currentTarget.open&&r.read===false&&!busy)reportAction('read',[r.id]);}}>
        <summary><span className={'report-symbol '+r.kind} aria-hidden="true">{(/^(工程完成|總督)/.test(r.title)?'建':({battle:'戰',scout:'探',economy:'記',diplomacy:'盟',system:'記'})[r.kind])}</span><strong>{r.read===false&&<i className="unread-dot" aria-label="未讀"/>}{r.title}{importantMessage(r)&&<small className="permanent-report">重大</small>}</strong><time dateTime={r.realAt===undefined?undefined:new Date(r.realAt).toISOString()}>{reportTime(r.realAt,r.at)}</time><span className="disclosure" aria-hidden="true">＋</span></summary>
        <div className="report-body">{r.kind==='battle'?<><img className="battle-banner" src={import.meta.env.BASE_URL+(r.art??(destination?reportArt(destination):art.report))} alt="戰役場景"/><div className="battle-summary"><div><strong>{r.title.split(' · ').at(-1)}</strong><p className="battle-participants"><BattleHeading battle={battle!}/></p></div></div>{r.battleSides&&<BattleAffiliations sides={r.battleSides}/>}<details className="battle-details"><summary><span>戰鬥詳情</span><span className="battle-details-state" aria-hidden="true"><span className="battle-details-collapsed">展開</span><span className="battle-details-expanded">收合</span></span><span className="battle-details-chevron" aria-hidden="true">▾</span></summary><p>{scene??battle!.narrative}</p>{scene&&<details className="battle-record"><summary>查看原始戰況紀錄</summary><p>{battle!.narrative}</p></details>}</details></>:<p>{r.text}</p>}{r.entries&&(r.entries.some(entry=>entry.city)?<div className="city-message-groups">{Array.from(new Set(r.entries.map(entry=>entry.city??'其他'))).map(city=><section key={city}><h3>{city}</h3><ul className="city-message-entries">{r.entries!.filter(entry=>(entry.city??'其他')===city).map((entry,i)=><li key={i}>{entry.at!==undefined&&<time>{reportEntryTime(entry.realAt,entry.at)} · </time>}{entry.text}{entry.count>1?' × '+entry.count:''}</li>)}</ul></section>)}</div>:<ul className="city-message-entries">{r.entries.map((entry,i)=><li key={i}>{entry.at!==undefined&&<time>{reportEntryTime(entry.realAt,entry.at)} · </time>}{entry.text}{entry.count>1?' × '+entry.count:''}</li>)}</ul>)}{(r.before||r.enemyAfter)&&<div className="table-wrap report-armies"><table><thead><tr><th>部隊</th>{r.before&&<><th>攻方出戰／損失</th><th>剩餘</th></>}<th>守方{r.enemyBefore?'出戰／損失':'駐軍'}</th>{r.enemyBefore&&<th>剩餘</th>}</tr></thead><tbody>{unitIds.filter(u=>(r.before?.[u]??0)+(r.enemyBefore?.[u]??0)+(r.enemyAfter?.[u]??0)>0).map(u=><tr key={u}><td>{units[u].name}</td>{r.before&&<><td>{r.before[u]}／{Math.max(0,r.before[u]-(r.after?.[u]??0))}</td><td>{r.after?.[u]??0}</td></>}<td>{(r.enemyBefore??r.enemyAfter)?.[u]??0}{r.enemyBefore&&'／'+Math.max(0,(r.enemyBefore?.[u]??0)-(r.enemyAfter?.[u]??0))}</td>{r.enemyBefore&&<td>{r.enemyAfter?.[u]??0}</td>}</tr>)}</tbody></table></div>}
          {r.scoutIntel&&<div className="scout-observation"><p>觀測時間：{reportTime(r.scoutIntel.realAt??r.realAt,r.scoutIntel.at)} · 情報保留偵察當時狀態</p><h3>資源庫存</h3>{r.scoutIntel.stock?<Cost cost={r.scoutIntel.stock} showZero/>:<p>未知</p>}<p>城防：{r.scoutIntel.wall===0?'無城牆':r.scoutIntel.era===undefined?'城牆':(['木牆','石牆','垛牆'][r.scoutIntel.era])} · {r.scoutIntel.wall} 級</p>{r.enemyAfter&&unitIds.every(u=>r.enemyAfter![u]===0)&&<p>守軍及援軍：0 名</p>}</div>}
          {r.loot&&<div className="report-loot"><span>{r.kind==='battle'?(r.text.startsWith('守方戰報。')?'被掠奪資源':'戰利品'):'物資'}</span><Cost cost={r.loot}/>{r.kind==='battle'&&!r.text.startsWith('守方戰報。')&&<small>隨部隊返城入庫，受倉庫容量限制。</small>}</div>}
          <div className="report-actions">{canVisit&&<button onClick={()=>onNode(destination.id)}>前往 {destination.name}</button>}<button disabled={busy} onClick={()=>reportAction('clear',[r.id])}>清除此則</button></div>
        </div>
      </details>;
    })}</div>:<Empty>此分類目前沒有消息。</Empty>}
    {count>50&&pager}
  </div>;
}
