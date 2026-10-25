import {memo,useEffect,useMemo,useRef,useState} from 'react';
import type {FormalCity,FormalCommand,FormalWorld,ResearchProject} from '../formal/model';
import {resourceKeys,zeroResources} from '../formal/model';
import {TECH_CATALOG,type TechDefinition} from '../formal/techCatalog';
import type {Requirement} from '../formal/buildingDetailData';
import {combatStats} from '../formal/combatModifiers';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {effectiveSpeed} from '../formal/playtest';
import {Art} from './Art';
import {AGE_NAMES,CIV_NAMES,LABELS,techArt} from './artMap';
import {Cost,Dialog,fmt,Heading} from './UI';
import {useDisplayTime,useLiveCity} from './liveClock';
import {researchFacts,researchGroup,researchLayout,researchState,visibleResearch,RESEARCH_GROUPS,TREE_NODE_HEIGHT,TREE_NODE_WIDTH,type ResearchScope} from './researchTree';
import './research.css';

type Props={world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean;mobile?:boolean};
type Browse={scope:ResearchScope;age:number;closed:string[]};
const PREFERENCE='lieguo.research-browse.v1';
const scrollPositions=new Map<string,{top:number;left:number}>();
function readBrowse(age:number):Browse{
 try{const value=JSON.parse(localStorage.getItem(PREFERENCE)??'null');if(value&&['traditional','modern'].includes(value.scope)&&[1,2,3].includes(value.age)&&Array.isArray(value.closed))return {scope:value.scope,age:value.age,closed:value.closed.filter((s:unknown):s is string=>typeof s==='string')};}catch{/* Storage is optional. */}
 return {scope:'traditional',age:Math.max(1,Math.min(3,age)),closed:[]};
}
/** Same display clock as the HUD; only this small leaf subscribes to countdown ticks. */
export function researchRealTime(ms:number,world:FormalWorld){
 const seconds=Math.max(0,Math.ceil(ms/effectiveSpeed(world)/1000));
 return `${Math.floor(seconds/3600)} 時 ${Math.floor(seconds%3600/60)} 分 ${seconds%60} 秒`;
}
export function ResearchCountdown({world,project}:{world:FormalWorld;project:ResearchProject}){
 const time=useDisplayTime(world,1000);
 if(project.phase!=='researching')return null;
 const end=project.startedAt!+project.durationSnapshot.durationMs;
 return <span className="research-countdown">{time>=end?'完成確認中':researchRealTime(end-time,world)+'（現實時間）'}</span>;
}
function requirementText(r:Requirement){
 switch(r.kind){
  case 'age':return AGE_NAMES[+r.required]+'時代';
  case 'building':return (LABELS[r.id]??r.id)+' Lv'+r.required+'（目前 Lv'+r.current+'）';
  case 'tech':return TECH_CATALOG[r.id]?.name??r.id;
  case 'milestone':return '本城曾達人口 '+fmt(+r.required);
  case 'cap':return '本文明此系上限 '+r.current+' 階（需要 '+r.required+' 階）';
  case 'civilization':return CIV_NAMES[String(r.required)]+'文明';
  case 'modern':return '完整現代軍事資格';
  default:return r.id+' '+r.required;
 }
}
function Effect({tech,faction}:{tech:TechDefinition;faction:FormalWorld['factions'][number]}){
 if(tech.effect)return <p>{tech.effect}</p>;
 if(tech.category==='elite')return <p>解鎖 {Object.values(UNIT_CATALOG).filter(u=>u.eliteTech===tech.id&&(!u.civilizationId||u.civilizationId===faction.civilizationId)).map(u=>u.name).join('、')}；招募仍須符合本城人口及生產建築資格。</p>;
 // The catalog has no prose for blacksmith upgrades. Preview the real combat
 // projection instead of maintaining a second table of modifier values.
 const ids=new Set(faction.techIds.filter(id=>id!==tech.id));
 const addPrerequisites=(d:TechDefinition)=>{for(const id of d.prerequisites){ids.add(id);addPrerequisites(TECH_CATALOG[id]);}};
 addPrerequisites(tech);
 const before={...faction,techIds:[...ids]},after={...before,techIds:[...ids,tech.id]};
 const changes=Object.values(UNIT_CATALOG).filter(u=>!u.civilizationId||u.civilizationId===faction.civilizationId).flatMap(u=>{const a=combatStats(u.id,before),b=combatStats(u.id,after);return a.attack!==b.attack||a.hp!==b.hp?[`${u.name}：${a.attack!==b.attack?'攻擊 '+a.attack.toFixed(1)+' → '+b.attack.toFixed(1):'生命 '+a.hp.toFixed(1)+' → '+b.hp.toFixed(1)}`]:[];});
 return <details><summary>研究效果：{changes.length?changes.length+' 種兵種'+(tech.id.includes('armor')?'生命':'攻擊')+'提升':'目前已達本文明此系上限'}（展開預覽）</summary>{changes.length?<ul>{changes.map(s=><li key={s}>{s}</li>)}</ul>:<p>目前科技組合已達本文明此系上限。</p>}</details>;
}
const Connections=memo(function Connections({layout}:{layout:ReturnType<typeof researchLayout>}){
 return <svg className="research-connections" width={layout.width} height={layout.height} aria-hidden="true">{layout.edges.map(({from,to})=>{
  const cross=from.x!==to.x,x1=from.x+(cross?TREE_NODE_WIDTH:TREE_NODE_WIDTH/2),y1=from.y+(cross?TREE_NODE_HEIGHT/2:TREE_NODE_HEIGHT),x2=to.x+(cross?0:TREE_NODE_WIDTH/2),y2=to.y+(cross?TREE_NODE_HEIGHT/2:0);
  const path=to.x-from.x>266?`M ${x1} ${y1} L ${x1+30} ${y1} L ${x1+30} ${to.y-8} L ${x2-20} ${to.y-8} L ${x2-20} ${y2} L ${x2} ${y2}`:cross?`M ${x1} ${y1} C ${x1+34} ${y1}, ${x2-34} ${y2}, ${x2} ${y2}`:`M ${x1} ${y1} L ${x2} ${y2}`;
  return <path key={from.tech.id+'>'+to.tech.id} data-from={from.tech.id} data-to={to.tech.id} d={path}/>;
 })}</svg>;
});
function Funding({city,project,issue,busy}:Props&{project:ResearchProject}){
 const [contribution,setContribution]=useState(zeroResources);
 const remaining=zeroResources();for(const r of resourceKeys)remaining[r]=Math.max(0,project.requiredResources[r]-project.contributedResources[r]);
 const canContribute=!busy&&resourceKeys.some(r=>contribution[r]>0)&&resourceKeys.every(r=>Number.isSafeInteger(contribution[r])&&contribution[r]>=0&&contribution[r]<=city.stock[r]&&contribution[r]<=remaining[r]);
 return <section className="research-funding card"><h2>多城科研籌資中</h2><p>{city.name} · 四資源全額到位後開始研究</p><small>投入總額</small><Cost cost={project.contributedResources}/><small>目標投入</small><Cost cost={project.requiredResources}/><small>剩餘需求</small><Cost cost={remaining}/><div className="research-funding-fields">{resourceKeys.map(r=><label key={r}>{LABELS[r]}<input aria-label={'科研投入'+r} type="number" min={0} max={Math.min(city.stock[r],remaining[r])} value={contribution[r]} onChange={e=>setContribution({...contribution,[r]:Number(e.target.value)})}/></label>)}</div><div className="research-actions"><button disabled={!canContribute} onClick={()=>issue({type:'research.contribute',projectId:project.projectId,cityId:city.id,resources:contribution})}>投入所選科研資源</button><button disabled={busy||!resourceKeys.some(r=>Math.min(city.stock[r],remaining[r])>0)} onClick={()=>{const resources=zeroResources();for(const r of resourceKeys)resources[r]=Math.min(city.stock[r],remaining[r]);issue({type:'research.contribute',projectId:project.projectId,cityId:city.id,resources});}}>由此城投入可用資源</button></div></section>;
}
export function ResearchView({world,city:sourceCity,issue,busy,mobile=false}:Props){
 const faction=world.factions.find(f=>f.id===sourceCity.ownerFactionId)!;
 const [browse,setBrowse]=useState(()=>readBrowse(faction.age??0)),[selected,setSelected]=useState<string|null>(null),[starting,setStarting]=useState(false);
 const startLock=useRef(false);
 const scroll=useRef<HTMLDivElement>(null),treeScroll=useRef<HTMLDivElement>(null);
 const techs=useMemo(()=>visibleResearch(faction.civilizationId),[faction.civilizationId]);
 // Qualifications and quotes are independent of the projected resource tick.
 const facts=useMemo(()=>researchFacts(world,sourceCity,techs),[world,sourceCity,techs]);
 const city=useLiveCity(world,sourceCity)!;
 const layout=useMemo(()=>researchLayout(techs,browse.scope),[techs,browse.scope]);
 const project=world.researchProjects.find(p=>p.projectId===faction.researchQueue);
 const selectedTech=techs.find(d=>d.id===selected),fact=selectedTech?facts[selectedTech.id]:undefined;
 const state=selectedTech&&fact?researchState(world,city,selectedTech,fact):undefined;
 const scrollKey=world.campaignId+':'+browse.scope+':'+(mobile?browse.age:'desktop');
 useEffect(()=>{if(!busy){startLock.current=false;setStarting(false);}},[world,busy]);
 useEffect(()=>{try{localStorage.setItem(PREFERENCE,JSON.stringify(browse));}catch{/* Optional UI preferences never enter FormalWorld. */}},[browse]);
 useEffect(()=>{
  const outer=scroll.current!,tree=treeScroll.current,saved=scrollPositions.get(scrollKey);
  outer.scrollTop=saved?.top??0;if(tree)tree.scrollLeft=saved?.left??Math.max(0,Math.min(2,(faction.age??1)-1))*266;
  return()=>{scrollPositions.set(scrollKey,{top:outer.scrollTop,left:tree?.scrollLeft??0});};
 },[scrollKey,mobile,faction.age]);
 const select=(id:string)=>setSelected(id);
 const node=(d:TechDefinition)=>{
  const s=researchState(world,city,d,facts[d.id]);
  return <article className={'research-node research-'+s.state+(selected===d.id?' is-selected':'')} data-tech-id={d.id} data-state={s.state}>
   <button aria-label={d.name+' · '+(s.done?'已完成':s.project?s.project.phase==='funding'?'籌資中':'研究中':s.available?'可以研發':'未研發')} aria-pressed={selected===d.id} onClick={()=>select(d.id)}>
    <Art spec={techArt(d.id)} label={d.name}/><span className="research-node-copy"><strong>{d.name}</strong><small>{s.done?'✓ 已完成':s.project?s.project.phase==='funding'?'籌資中':'研究中':s.available?'可以研發':'未研發'}</small>{s.project?.phase==='researching'&&<ResearchCountdown world={world} project={s.project}/>}</span>
   </button>
  </article>;
 };
 const detail=selectedTech&&fact&&state&&<>
  <div className={'research-detail-art research-'+state.state}><Art spec={techArt(selectedTech.id)} label={selectedTech.name}/><span>{state.done?'✓ 已完成':state.project?.phase==='funding'?'籌資中':state.project?'研究中':state.available?'可以研發':'未研發'}</span></div>
  <Effect tech={selectedTech} faction={faction}/>
  <p>所屬時代：{selectedTech.scope==='traditional'?AGE_NAMES[selectedTech.age]:'現代科研'} · 文明：{selectedTech.civilizationId?CIV_NAMES[selectedTech.civilizationId]:'各文明共通'}</p>
  <h3>前置科技</h3>{selectedTech.prerequisites.length?<div className="research-prerequisites">{selectedTech.prerequisites.map(id=><button key={id} onClick={()=>select(id)}>{TECH_CATALOG[id].name}</button>)}</div>:<p>無前置科技</p>}
  <h3>研究資格</h3><ul className="research-requirements">{fact.requirements.map((r,i)=><li key={r.kind+r.id+i} data-met={r.met}>{r.met?'✓':'○'} {requirementText(r)}</li>)}</ul>
  <h3>四項資源成本</h3><Cost cost={state.project?.requiredResources??fact.quote.cost} stock={city.stock}/>
  {state.project?.phase==='funding'?<p>多城科研籌資中 · 資源到齊後開始研究。</p>:state.project?<p>剩餘 <ResearchCountdown world={world} project={state.project}/></p>:null}
  <p>研究時間 {researchRealTime(state.project?.durationSnapshot.durationMs??fact.quote.durationMs,world)}（現實時間）</p>
  <div className="research-start"><button className="primary" disabled={busy||starting||!state.canStart} onClick={()=>{if(startLock.current)return;startLock.current=true;setStarting(true);issue({type:'research.start',cityId:city.id,techId:selectedTech.id});}}>{state.done?'已完成':state.project?'研究佇列已占用':selectedTech.scope==='modern-common'||selectedTech.scope==='modern-civilization'?'建立科研籌資':'啟動研究'}</button>
   {!state.done&&<p>{busy||starting?'指令處理中':faction.researchQueue?'勢力共用研究佇列已占用':fact.requirements.some(r=>!r.met)?'尚需：'+fact.requirements.filter(r=>!r.met).map(requirementText).join('、'):!state.affordable&&(selectedTech.scope==='traditional'||selectedTech.scope==='research-cooperation')?'本城資源不足':!state.affordable?'可先建立籌資，再由同勢力多城投入資源':'本城符合研究資格'}</p>}
  </div>
 </>;
 const groups=browse.scope==='traditional'?RESEARCH_GROUPS.map(([id,label])=>({id,label,techs:layout.nodes.map(n=>n.tech).filter(d=>d.age===browse.age&&researchGroup(d)===id)})):[
  {id:'cooperation',label:'科研協同體系',techs:techs.filter(d=>d.scope==='research-cooperation')},
  {id:'modern-common',label:'現代共通科技',techs:techs.filter(d=>d.scope==='modern-common')},
  {id:'modern-civilization',label:'文明專屬科技',techs:techs.filter(d=>d.scope==='modern-civilization')},
 ];
 return <div ref={scroll} className={'view-scroll research-view research-workspace '+(mobile?'research-mobile':'research-desktop')}>
  <div className="research-sticky">
   <div className="research-current" role="status">{project?<><strong>{project.phase==='funding'?'目前科研：':'目前正在研究：'}{TECH_CATALOG[project.techId].name}{project.phase==='funding'?'｜籌資中':''}</strong>{project.phase==='researching'&&<span>剩餘現實時間：<ResearchCountdown world={world} project={project}/></span>}</>:<strong>目前沒有進行中的研究</strong>}</div>
   <div className="research-tabs" role="group" aria-label="科技世代">{(['traditional','modern'] as const).map(scope=><button key={scope} aria-pressed={browse.scope===scope} onClick={()=>{setBrowse({...browse,scope});setSelected(null);}}>{scope==='traditional'?'傳統科技':'現代科研'}</button>)}</div>
   {mobile&&browse.scope==='traditional'&&<div className="research-ages" role="group" aria-label="傳統科技時代">{[1,2,3].map(age=><button key={age} aria-pressed={browse.age===age} onClick={()=>setBrowse({...browse,age})}>{AGE_NAMES[age]}</button>)}</div>}
  </div>
  <Heading title="科技研發" subtitle={city.name+' · 勢力共用唯一研究佇列'}/>
  <div className="research-legend"><span>○ 未研發</span><span className="research-gold">◇ 可以研發／研究中</span><span>✓ 已完成 {faction.techIds.length} 項</span></div>
  {browse.scope==='modern'&&<p className="research-modern-note">科研協同體系 → 現代共通科技／文明專屬科技 · {faction.modernQualification==='full'?'已取得完整現代軍事資格':'尚需完整現代軍事資格'}</p>}
  {project?.phase==='funding'&&<Funding key={project.projectId+city.id} world={world} city={city} project={project} issue={issue} busy={busy}/>}
  <div className="research-content">
   {mobile?<div className="research-grid research-mobile-groups">{groups.filter(g=>g.techs.length).map(g=>{const key=browse.scope+':'+browse.age+':'+g.id;return <details key={key} open={!browse.closed.includes(key)} onToggle={e=>{const open=e.currentTarget.open;setBrowse(current=>{const closed=current.closed.includes(key);return open===!closed?current:{...current,closed:open?current.closed.filter(k=>k!==key):[...current.closed,key]};});}}><summary>{g.label}<span>{g.techs.length} 項</span></summary><div className="research-group-nodes">{g.techs.map(d=><div key={d.id}>{node(d)}</div>)}</div></details>;})}</div>:<div className="research-tree-column"><p className="muted">向下捲動瀏覽分類；左右捲動查看時代。點選節點查看研究條件。</p><div className="research-tree-scroll" ref={treeScroll} tabIndex={0} aria-label="科技樹，可左右捲動"><div className="research-grid research-tree" style={{width:layout.width,height:layout.height}}>
    <div className="research-tree-headings">{(browse.scope==='traditional'?['封建','城堡','帝王']:['科研協同體系','現代共通科技','文明專屬科技']).map(s=><h2 key={s}>{s}</h2>)}</div>
    <Connections layout={layout}/>{layout.labels.map(g=><h3 className="research-group-label" style={{top:g.y}} key={g.label}>{g.label}</h3>)}
    {layout.nodes.map(n=><div className="research-position" key={n.tech.id} style={{left:n.x,top:n.y,width:TREE_NODE_WIDTH,height:TREE_NODE_HEIGHT}}>{node(n.tech)}</div>)}
   </div></div></div>}
   {!mobile&&<aside className="research-detail card" aria-label="科技詳情">{selectedTech?<><div className="research-detail-title"><h2>{selectedTech.name}</h2><button aria-label="關閉科技詳情" onClick={()=>setSelected(null)}>×</button></div>{detail}</>:<div className="research-detail-empty"><span>◇</span><h2>選擇一項科技</h2><p>查看效果、前置資格與本城研究成本。</p></div>}</aside>}
  </div>
  {mobile&&selectedTech&&<Dialog className="research-detail research-sheet" title={selectedTech.name} onClose={()=>setSelected(null)}>{detail}</Dialog>}
 </div>;
}
