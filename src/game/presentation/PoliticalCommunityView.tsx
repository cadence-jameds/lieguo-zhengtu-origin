import {useState} from 'react';
import {empireWonder} from '../formal/wonder';
import {BreakthroughPanel} from './BreakthroughPanel';
import {EmpireManagement,LegionView,type LegionViewProps} from './LegionView';
import {politicalCommunity} from './politicalCommunity';
import {Heading} from './UI';
import {WonderPanel} from './WonderPanel';

export function PoliticalCommunityView(props:LegionViewProps){
 const state=politicalCommunity(props.world);
 if(!state)return <LegionView {...props}/>;
 // A different empire or own legion is a different view session; stale project drafts do not follow it.
 return <EmpireView key={[props.world.campaignId,state.empire.id,state.legion.id,state.empire.leader,state.legion.leader].join(':')} {...props} state={state}/>;
}

function EmpireView(props:LegionViewProps&{state:NonNullable<ReturnType<typeof politicalCommunity>>}){
 const {world:w,state:{legion,empire}}=props,me=w.playerFactionId,leader=empire.leader===me,legionLeader=legion.leader===me;
 const [selected,setSelected]=useState('帝國總覽');
 const tabs=['帝國總覽','世界奇觀','文明突破','自己的軍團',...(legionLeader?['帝國管理']:[])];
 const tab=tabs.includes(selected)?selected:'帝國總覽',wonder=empireWonder(w,empire.id);
 return <div className="view-scroll v94-view empire-community-view">
 <Heading title="帝國" subtitle={empire.name}/>
 <div className="v94-tabs" role="tablist" aria-label="帝國分頁">{tabs.map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setSelected(t)}>{t}</button>)}</div>
 <section role="tabpanel" aria-label={tab}>
 {tab==='帝國總覽'&&<section className="card"><h2>{empire.name}</h2><p>帝國領袖：{w.factions.find(f=>f.id===empire.leader)?.name??'未確認'}</p><p>我的權限：{leader?'帝國領袖':legionLeader?'成員軍團長':'帝國成員'}</p><h3>所屬軍團</h3><ul>{(w.politics?.legions??[]).filter(g=>g.empireId===empire.id&&empire.legions.includes(g.id)).map(g=><li key={g.id}>{g.name}{g.id===legion.id?'（自己的軍團）':''}</li>)}</ul><button onClick={props.onWorld}>查看天下勢力</button></section>}
 {tab==='世界奇觀'&&<WonderPanel world={w} issue={props.issue} busy={props.busy} showBreakthrough={false}/>}
 {tab==='文明突破'&&(wonder?.wonder?.phase==='completed'?<BreakthroughPanel world={w} wonder={wonder} issue={props.issue} busy={props.busy}/>:<section className="card"><h2>文明突破</h2><p>帝國完成世界奇觀後，才可啟動文明突破。</p></section>)}
 {tab==='自己的軍團'&&<LegionView {...props} nestedInEmpire/>}
 {tab==='帝國管理'&&<EmpireManagement world={w} city={props.city} issue={props.issue} busy={props.busy}/>}
 </section></div>;
}
