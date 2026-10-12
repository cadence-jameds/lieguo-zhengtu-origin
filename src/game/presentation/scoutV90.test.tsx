// @vitest-environment happy-dom
import {it,expect,vi,afterEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoot} from 'react-dom/client';
import {act} from 'react';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {battlefield,dispatch,arrive} from '../formal/combatTestSupport';
import {build,commit} from '../formal/developmentTestSupport';
import {advanceFormal} from '../formal/reducer';
import {ArmyDispatchDialog} from './CombatPanel';
import {BattleReportBody} from './BattleReportBody';
import {FormalTargetPanel} from './FormalTargetPanel';
import {BuildingDetail} from './BuildingDetail';
import {CityScenes} from './CityScenes';
import {displayClock} from './liveClock';
import {wildSiteName,WILD_SITE_NAMES} from './wildSiteLabels';
import {reportTime} from './reportClock';
const noop=()=>{},dir='docs/scout-v03029';mkdirSync(dir,{recursive:true});
afterEach(()=>{displayClock.stop();vi.unstubAllGlobals();});
it('city scouting exposes one scout quantity and submits no information mode; wild mode remains fixed',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const w=battlefield();w.cities[0].military!.units={scout:5,militia:30};const target={kind:'city' as const,cityId:w.cities[1].id},issue=vi.fn(),el=document.createElement('div'),root=createRoot(el);document.body.append(el);
 try{await act(async()=>root.render(<ArmyDispatchDialog world={w} city={w.cities[0]} target={target} mission="scout" issue={issue} busy={false} onClose={noop}/>));expect(el.querySelector('select')).toBeNull();expect(el.textContent).not.toContain('情報類型');expect(el.textContent).not.toContain('城防與軍隊');expect(el.querySelectorAll('input')).toHaveLength(1);expect(el.querySelector('input')!.getAttribute('aria-label')).toBe('派遣斥候');await act(async()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='下達偵察命令')!.click());expect(issue).toHaveBeenCalledWith({type:'army.dispatch',cityId:w.cities[0].id,target,mission:'scout',units:{scout:2}});}
 finally{await act(async()=>root.unmount());el.remove();}
});
it('delivered city report and map show the same full snapshot, reinforcement composition, legal defense levels, real observation time and scouting art',()=>{
 let w=battlefield();w.cities[0].military!.units={scout:10};w.cities[1].military!.units={militia:28};w.cities[1].wallLevel=4;build(w.cities[1],'castle',2);build(w.cities[1],'bunker.0',3);w=arrive(dispatch(w,'scout',{scout:2}).world).world;const t=advanceFormal(w,w.armies[0].arrivalAt!),p=t.reports[0].battle!,i=p.intel!;
 i.reinforcements=[{ownerFactionId:w.factions[2].id,originCityId:w.cities[2].id,units:{knight:2}}];const obs={owner:w.cities[1].ownerFactionId,intel:i};w.cities[1].military!.units={militia:999};w.cities[1].wallLevel=9;
 const report=renderToStaticMarkup(<BattleReportBody world={w} battle={p} report={t.reports[0]}/>),target=renderToStaticMarkup(<FormalTargetPanel world={w} home={w.cities[0]} city={w.cities[1]} intel={{army:obs,resources:obs,defenses:obs}} onMission={noop} onCity={noop}/>);
 for(const html of [report,target]){for(const text of ['資源庫存','駐軍：民兵 ×28','援軍','騎士 ×2','城牆 Lv4','城堡 Lv2','地庫 Lv3',reportTime(i.observedRealAt),'當時庫存，非即時數值'])expect(html).toContain(text);expect(html).not.toContain('民兵 ×999');expect(html).not.toContain('城牆 Lv9');expect(html).not.toContain('研究佇列');}
 expect(report).toContain('art/scout-report.webp');expect(report).not.toContain('art/siege-report.webp');expect(existsSync('public/art/scout-report.webp')).toBe(true);writeFileSync(dir+'/city-scout-report.html',report);writeFileSync(dir+'/city-target-intel.html',target);
});
it('old partial city reports are explicit and never synthesize missing defenses from runtime',()=>{let w=battlefield();w.cities[0].military!.units={scout:2};w=arrive(dispatch(w,'scout',{scout:2}).world).world;const t=advanceFormal(w,w.armies[0].arrivalAt!),p=t.reports[0].battle!;delete p.intel!.garrison;delete p.intel!.reinforcements;delete p.intel!.wallLevel;delete p.intel!.defenses;const html=renderToStaticMarkup(<BattleReportBody world={w} battle={p}/>);expect(html).toContain('舊版部分情報紀錄');expect(html).not.toContain('城牆 Lv');});
it('shared operations precede detailed effects; fulfilled prerequisites collapse and unmet ones open while remaining manually toggleable',()=>{
 const w=battlefield(),c=w.cities[0];w.factions[0].age=3;build(c,'warehouse.0',5);c.stock={food:5000,wood:5000,stone:5000,gold:5000};const el=document.createElement('div');el.innerHTML=renderToStaticMarkup(<BuildingDetail world={w} city={c} buildingKey="warehouse.0" issue={noop} busy={false}/>);const ops=el.querySelector('.building-operations')!,effects=el.querySelector('.building-effect')!;expect(ops.compareDocumentPosition(effects)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();const detail=ops.querySelector('details')!;expect(detail.open).toBe(false);detail.open=true;expect(detail.open).toBe(true);w.factions[0].age=0;el.innerHTML=renderToStaticMarkup(<BuildingDetail world={w} city={c} buildingKey="workshop" issue={noop} busy={false}/>);expect(el.querySelector('details.building-prerequisites')!.hasAttribute('open')).toBe(true);expect(el.querySelector('.building-requirements .unmet')).not.toBeNull();
});
it('construction progress renders outside individual building stacking contexts at the same anchors on mobile and desktop',()=>{
 let w=battlefield();w=commit(w,{type:'building.upgrade',cityId:w.cities[0].id,key:'center'});const c=w.cities[0];for(const mobile of [false,true]){const html=renderToStaticMarkup(<CityScenes world={w} city={c} onBuilding={noop} onField={noop} initialDistrict="town" mobile={mobile}/>),el=document.createElement('div');el.innerHTML=html;expect(el.querySelector('.town-lot .construction-progress')).toBeNull();expect(el.querySelector('.construction-overlays .construction-progress')).not.toBeNull();const anchor=el.querySelector<HTMLElement>('.scene-progress-anchor')!,lot=el.querySelector<HTMLElement>('.town-lot.constructing')!;expect(anchor.style.left).toBe(lot.style.left);expect(anchor.style.top).toBe(lot.style.top);writeFileSync(dir+`/progress-${mobile?'mobile':'desktop'}.html`,html);}
 const css=readFileSync('src/game/presentation/parity.css','utf8');expect(css).toContain('z-index:200;pointer-events:none');
});
it('ground selection and flash paint before buildings; report site names use all five canonical names including gold',()=>{
 const source=readFileSync('src/game/FormalWorldMap.tsx','utf8');expect(source.indexOf('const selectedAt=')).toBeLessThan(source.indexOf('layers.sort('));expect(source.indexOf('if(flash.current&&started')).toBeLessThan(source.indexOf('layers.sort('));
 expect(WILD_SITE_NAMES.gold).toBe('黃金礦脈');for(const resource of ['food','wood','stone','gold','bandit'] as const){const w=battlefield(),site=w.worldLayer!.wildSites[0];site.resource=resource;expect(wildSiteName(site)).toBe(WILD_SITE_NAMES[resource]+' Lv.'+site.level);}
 expect(readFileSync('src/game/formal/battles.ts','utf8')).not.toContain("?'盜賊營地':'資源據點'");
});
it('build chooser keeps inline name info access, age/cap on the right, and red/green prerequisite status without a standalone info button',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const {default:FormalCityPanel}=await import('../FormalCityPanel');const w=battlefield(),el=document.createElement('div'),root=createRoot(el);document.body.append(el);
 try{await act(async()=>root.render(<FormalCityPanel world={w} cityId={w.cities[0].id} issue={noop} busy={false}/>));await act(async()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='城內')!.click());await act(async()=>el.querySelector<HTMLButtonElement>('.town-lot.vacant')!.click());await act(async()=>[...el.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==='軍事')!.click());
 const card=el.querySelector<HTMLButtonElement>('[aria-label="查看攻城工坊資訊"]')!.closest('article')!;expect(card.querySelector('.build-name-row h3')!.textContent).toBe('攻城工坊');expect(card.querySelector('.build-name-row small')!.textContent).toContain('最高Lv15');expect(card.querySelector('.building-prerequisite-summary .unmet')).not.toBeNull();expect([...card.querySelectorAll('button')].some(b=>b.textContent==='查看資訊')).toBe(false);
 await act(async()=>[...el.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==='經濟')!.click());const cellar=el.querySelector<HTMLButtonElement>('[aria-label="查看地庫資訊"]')!.closest('article')!;expect(cellar.querySelector('.building-prerequisite-summary .met')).not.toBeNull();expect(cellar.querySelector('.building-requirements')).toBeNull();expect(cellar.textContent).not.toContain('符合建造條件');writeFileSync(dir+'/build-chooser.html',el.querySelector('dialog')!.outerHTML);await act(async()=>cellar.querySelector<HTMLButtonElement>('.build-info-name')!.click());expect(el.querySelector('.shared-building-detail')!.getAttribute('data-building-kind')).toBe('bunker');
 }finally{await act(async()=>root.unmount());el.remove();}
});
