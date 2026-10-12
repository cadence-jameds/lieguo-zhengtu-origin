import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createFormalWorld} from '../formal/generator';
import {ArmyView} from './DevelopmentViews';
import {CityScenes} from './CityScenes';
import {Cost,realTime,remaining} from './UI';
import {UnitIcon} from './UnitIcon';
import {UNIT_LINES} from '../formal/unitCatalog';
import {CIV_ORDER} from './artMap';
import {CivilizationDetails} from './Start';
import {constructionPreview,recruitmentPreview} from './cityActions';
const w=createFormalWorld({campaign:'feedback-v85',seed:90217}),c=w.cities[0],noop=()=>{};
it('resource costs use colored text without resource image assets',()=>{const html=renderToStaticMarkup(<Cost cost={{food:1,wood:2,stone:3,gold:4}}/>);for(const [id,text] of [['food','穀'],['wood','木'],['stone','石'],['gold','金']]){expect(html).toContain('res-'+id);expect(html).toContain(text);}expect(html).not.toContain('<img');expect(html).not.toContain('糧');});
it('classification art stays in HUD; recruitment restores original unit portraits with separate colonization',()=>{for(const line of UNIT_LINES){const html=renderToStaticMarkup(<UnitIcon line={line} label={line}/>);expect(html).toContain('hud-unit-icon');expect(html).not.toContain('catalog-image');}const html=renderToStaticMarkup(<ArmyView mobile world={w} city={c} busy={false} issue={noop}/>);expect((html.match(/class="catalog-card"/g)??[])).toHaveLength(11);expect(html).not.toContain('hud-unit-icon');expect(html).not.toContain('unit-symbol');expect(html).toContain('art/catalog-units.webp');expect(html).toContain('特殊非戰鬥單位');expect(html).toContain('本城待命 ×0');expect(html).toContain('招募');expect(html).toContain('行軍（0）');});
it('mobile city heading and field count summary restore DEMO names while preserving actual anchors',()=>{const html=renderToStaticMarkup(<CityScenes mobile world={w} city={c} onRename={noop} onBuilding={noop} onField={noop}/>);for(const text of ['農田','林地','石場','金礦','更改城名','scene-view-shortcut','city-inline-coordinates'])expect(html).toContain(text);expect(html).not.toMatch(/木田|石田|金田|district-options|18座資源田環繞/);expect((html.match(/data-testid="field-anchor-/g)??[])).toHaveLength(18);const summary=html.match(/class="field-composition-summary".*?<\/div>/)?.[0]??'';expect([...summary.matchAll(/>(農|林|石|金) <strong>(\d+)/g)].map(m=>[m[1],m[2]])).toEqual([['農','6'],['林','5'],['石','4'],['金','3']]);const desktop=renderToStaticMarkup(<CityScenes world={w} city={c} onBuilding={noop} onField={noop}/>);expect(desktop).toContain('>農田 <strong>6');expect(desktop).toContain('>林地 <strong>5');});
it('all civilization stories retain castle units without military abbreviations',()=>{for(const civ of CIV_ORDER){const html=renderToStaticMarkup(<CivilizationDetails civ={civ}/>);expect(html).toContain('城堡時代代表兵種');expect(html).not.toMatch(/步甲|遠甲|騎甲/);}});
it('construction ETA comes from the actual Formal queue without changing the live world',()=>{const before=JSON.stringify(w),first=constructionPreview(w,c,{field:0});expect(first?.startsAt).toBe(0);expect(first?.durationMs).toBe(50000);expect(JSON.stringify(w)).toBe(before);});

it('recruitment preview uses Formal queue completion and leaves source untouched',()=>{
 const w=createFormalWorld({campaign:'recruit-preview',seed:90217}),c=w.cities[0];c.population=2000;c.housing=2500;c.stock={food:600,wood:600,stone:600,gold:600};c.buildings.barracks=1;c.economy!.slots.barracks=0;
 const before=JSON.stringify(w),p=recruitmentPreview(w,c,'militia',2);expect(p?.remaining).toBe(2);expect(p?.startsAt).toBe(w.time);expect(p?.nextAt).toBe(w.time+p!.durationMs);expect(JSON.stringify(w)).toBe(before);
});

it('50X duration previews and queue countdowns use the same real seconds',()=>{const fast={...w,speed:50};expect(realTime(100000,fast)).toBe('2秒');expect(remaining(fast.time+100000,fast)).toBe('2秒');expect(remaining(fast.time-1,fast)).toBe('0秒');expect(realTime(100000,{...w,speed:1})).toBe('1分 40秒');});
