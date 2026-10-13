// @vitest-environment happy-dom
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoot} from 'react-dom/client';
import {act} from 'react';
import {mkdirSync,writeFileSync} from 'node:fs';
import {battlefield} from '../formal/combatTestSupport';
import {constructionMultiplier} from '../formal/catalogB3';
import {academyMultiplier,AGE_CATALOG} from '../formal/research';
import {Shell,MOBILE_NAV} from './Shell';
import {FormalTargetPanel} from './FormalTargetPanel';
import {ResearchView} from './DevelopmentViews';
import {EraUpgrade} from './EraUpgrade';
import {buildingEffect} from './buildingEffects';
import {reportTime} from './reportClock';
import FormalCityPanel from '../FormalCityPanel';
import {constructionArtPath} from '../assets';
const noop=()=>{},dir='docs/ui-v03027';mkdirSync(dir,{recursive:true});
it('mobile navigation keeps DEMO order plus the V94 Legion entry and redirects era entry to City Center',()=>{
 const w=battlefield(),c=w.cities[0],html=renderToStaticMarkup(<Shell world={w} city={c} cities={[c]} mobile view="map" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false}><p>世界</p></Shell>);
 expect(MOBILE_NAV.map(n=>n.id)).toEqual(['map','city','army','reports','research','legion','diplomacy','empire']);writeFileSync(dir+'/mobile-shell.html',html);
});
it('intel uses fixed real observation time across 1X/50X/200X, consolidates wild name and honestly handles missing history',()=>{
 const now=new Date('2026-10-08T04:30:00Z').getTime(),observed=now-79*60000;vi.spyOn(Date,'now').mockReturnValue(now);
 try{const w=battlefield(),site=w.worldLayer!.wildSites[0];site.resource='food';site.level=2;site.x=10;site.y=120;
 const obs={owner:null,intel:{observedAt:777,observedRealAt:observed,siteId:site.id,generation:site.generation,units:{militia:11},resources:{food:1500,wood:0,stone:0,gold:0}}};
 for(const speed of [1,50,200] as const){w.developer=speed===1?undefined:{enabled:true,speed};w.time=2130*3600000;const html=renderToStaticMarkup(<FormalTargetPanel world={w} home={w.cities[0]} site={site} intel={{army:obs,resources:obs}} onMission={noop} onCity={noop}/>);expect(html).toContain('沃野農莊Lv.2（10, 120）');expect(html).not.toContain('野外據點 ·');expect(html).toContain('駐軍情報距今 1時 19分');expect(html).toContain(reportTime(observed));expect(html).not.toContain('觀測於世界');if(speed===50)writeFileSync(dir+'/wild-intel.html',html);}
 const missing={...obs,intel:{...obs.intel,observedRealAt:undefined}};const html=renderToStaticMarkup(<FormalTargetPanel world={w} home={w.cities[0]} site={site} intel={{army:missing,resources:missing}} onMission={noop} onCity={noop}/>);expect(html).toContain('現實觀測時間未記錄');expect(html).toContain('時間未記錄');
 }finally{vi.restoreAllMocks();}
});
it('city center/academy display the same current and next reductions as Formal durations',()=>{
 for(const [kind,formula] of [['center',constructionMultiplier],['academy',academyMultiplier]] as const)for(const level of [1,4,10,15]){const next=Math.min(15,level+1),text=buildingEffect(kind,level,next)!;expect(text).toContain(((1-formula(level))*100).toFixed(1)+'% → '+((1-formula(next))*100).toFixed(1)+'%');}
 expect(buildingEffect('academy',4,5)).toContain('精銳化研究除外');expect(constructionArtPath('farm',2,undefined,9)).not.toContain('construction-farm-castle');expect(constructionArtPath('farm',2,undefined,10)).toContain('construction-farm-castle');
});
it('era advancement exists in center dialog, obeys prerequisites, submits Formal command, and building buttons fill equal columns',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const w=battlefield(),c=w.cities[0],f=w.factions[0];f.age=0;c.buildings.center=4;c.population=500;c.housing=1000;const issue=vi.fn(),container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{await act(async()=>root.render(<FormalCityPanel world={w} cityId={c.id} issue={issue} busy={false} centerRequest={1}/>));const dialog=container.querySelector('dialog')!;expect(dialog).not.toBeNull();expect(dialog.querySelector('.building-detail .badge')!.textContent).toBe('Lv4');expect(dialog.querySelector('.building-detail h3')).toBeNull();expect(dialog.textContent).toContain('施工時間縮短');expect(dialog.querySelector('.building-actions')).not.toBeNull();const button=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='晉升封建時代')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'age.start',cityId:c.id});writeFileSync(dir+'/city-center-dialog.html',container.innerHTML);
 const research=renderToStaticMarkup(<ResearchView world={w} city={c} issue={noop} busy={false}/>);expect(research).not.toContain('由此城啟動晉升');expect(research).not.toContain('city-era-upgrade');
 const low={...c,population:200};const blocked=renderToStaticMarkup(<EraUpgrade world={w} city={low} issue={noop} busy={false}/>);expect(blocked).toContain('人口至少 500');expect(blocked).toContain('disabled');expect(AGE_CATALOG[0].durationMs).toBe(4*3600000);
 }finally{await act(async()=>root.unmount());container.remove();}
});
