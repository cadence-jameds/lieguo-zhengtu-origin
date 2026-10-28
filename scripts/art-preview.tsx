import {useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createArtPreviewWorld} from './art-preview-world';
import {UNIT_CATALOG} from '../src/game/formal/unitCatalog';
import {TECH_CATALOG} from '../src/game/formal/techCatalog';
import {BUILDING_CATALOG} from '../src/game/formal/catalogB3';
import {Shell,type View} from '../src/game/presentation/Shell';
import {ArmyView,ResearchView} from '../src/game/presentation/DevelopmentViews';
import FormalCityPanel from '../src/game/FormalCityPanel';
import FormalWorldMap from '../src/game/FormalWorldMap';
import {Art,FormalBuildingSprite,FormalResourceSprite} from '../src/game/presentation/Art';
import {CIV_ART,unitArt,techArt,LABELS,FIELD_ALIAS} from '../src/game/presentation/artMap';
import {displayClock} from '../src/game/presentation/liveClock';
import '../src/game/game.css';
import '../src/game/presentation/playable.css';
import '../src/game/presentation/parity.css';
import '../src/game/presentation/integrationV94.css';
const params=new URLSearchParams(location.search),civ=params.get('civ')??'civ_zhongguo',age=Number(params.get('age')??3) as 0|1|2|3,mode=params.get('mode')??'city',state=params.get('state')??'complete',mobile=innerWidth<=760;
const noop=()=>{};
function Preview(){
 const [view,setView]=useState<View>(mode==='gallery'?'city':mode as View);
 const world=useMemo(()=>{const w=createArtPreviewWorld(civ,age,state);displayClock.adopt({campaignId:w.campaignId,time:w.time,speed:w.speed,running:false});return w;},[]),city=world.cities[0];
 if(mode==='gallery')return <div className="formal-shell" style={{display:'block',height:'auto',padding:16,overflow:'visible'}}><h1>美術驗收用合成圖板</h1><section className="audit-grid">{Object.values(UNIT_CATALOG).map(u=><article key={u.id}><Art spec={unitArt(u.id)} label={u.name}/><small>{u.id}</small></article>)}</section><h2>82 項科技</h2><section className="audit-grid">{Object.values(TECH_CATALOG).map(t=><article key={t.id}><Art spec={techArt(t.id)} label={t.name}/><small>{t.id}</small></article>)}</section><h2>完工／施工／詳情圖</h2><section className="audit-grid buildings">{Object.keys(BUILDING_CATALOG).map(kind=><article key={kind}><strong>{LABELS[kind]}</strong><div><FormalBuildingSprite kind={kind} civ={CIV_ART[civ]} age={age}/><FormalBuildingSprite kind={kind} civ={CIV_ART[civ]} age={age} constructing/><FormalBuildingSprite kind={kind} civ={CIV_ART[civ]} age={age}/></div></article>)}</section><h2>資源田三階段</h2><section className="audit-grid buildings">{Object.values(FIELD_ALIAS).map(building=><article key={building}>{[5,6,11].map(level=><FormalResourceSprite key={level} building={building} level={level} age={age}/>)}</article>)}</section></div>;
 return <Shell world={world} city={city} cities={[city]} mobile={mobile} view={view} onView={setView} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false}>{view==='city'?<div className="view-scroll city-view"><FormalCityPanel world={world} cityId={city.id} issue={noop} busy={false} mobile={mobile}/></div>:view==='army'?<ArmyView world={world} city={city} issue={noop} busy={false} mobile={mobile}/>:view==='research'?<ResearchView world={world} city={city} issue={noop} busy={false} mobile={mobile}/>:<FormalWorldMap world={world} mobile={mobile}/>}</Shell>;
}
const style=document.createElement('style');style.textContent='.audit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}.audit-grid article{display:flex;flex-direction:column;align-items:center;background:#1c241d;padding:12px;min-width:0}.audit-grid small{font-size:10px;overflow-wrap:anywhere}.audit-grid .formal-art{width:100px;height:100px}.audit-grid.buildings{grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr))}.audit-grid.buildings article>div{display:flex;height:130px;width:100%;justify-content:space-between}.audit-grid.buildings .formal-new-building,.audit-grid.buildings .building-sprite,.audit-grid.buildings .resource-field-art{position:relative;inset:auto;width:96px;height:120px;object-fit:contain;transform:none}';document.head.append(style);
createRoot(document.getElementById('root')!).render(<Preview/>);
