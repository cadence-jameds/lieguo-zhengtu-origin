import {it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {BUILDING_CATALOG} from '../formal/catalogB3';
import {createFormalWorld} from '../formal/generator';
import {BUILDING_CATEGORIES,availableBuildings} from './cityActions';
import {FormalBuildingSprite} from './Art';
import {Garrison} from './Garrison';
import {ArmyView} from './DevelopmentViews';
import {CIV_ORDER,NEW_BUILDINGS,unitArt} from './artMap';
it('four construction pages partition every actual buildable type once; storage duplicates remain available',()=>{
 const kinds=BUILDING_CATEGORIES.flatMap(c=>[...c.kinds]);expect(new Set(kinds).size).toBe(kinds.length);expect([...kinds].sort()).toEqual(Object.keys(BUILDING_CATALOG).filter(k=>k!=='center'&&k!=='wall').sort());expect(kinds).not.toContain('wall');expect(BUILDING_CATEGORIES.map(c=>c.name)).toEqual(['民生','經濟','軍事','科技']);
 const w=createFormalWorld({campaign:'construction-menu',seed:90217}),c=w.cities[0];c.buildings.residence=1;c.buildings.monastery=1;c.buildings['warehouse.0']=1;c.buildings['bunker.0']=1;
 expect(availableBuildings(c,'civil')).not.toContain('residence');expect(availableBuildings(c,'civil')).not.toContain('monastery');expect(availableBuildings(c,'economy')).toContain('warehouse');expect(availableBuildings(c,'economy')).toContain('bunker');
});
it('all new construction illustrations exist and render directly; original sprites resolve for every culture and age',()=>{
 for(const kind of NEW_BUILDINGS){expect(existsSync(`public/art/formal/building-${kind}.webp`)).toBe(true);const html=renderToStaticMarkup(<FormalBuildingSprite kind={kind} civ="civ_zhongguo" age={0}/>);expect(html).toContain(`art/formal/building-${kind}.webp`);}
 for(const civ of CIV_ORDER)for(const age of [0,1,2] as const)for(const cat of BUILDING_CATEGORIES)for(const kind of cat.kinds){const html=renderToStaticMarkup(<FormalBuildingSprite kind={kind} civ={civ} age={age}/>);expect(html).not.toContain('icon-slot');expect(html).not.toMatch(/NaN|undefined/);}
});

it('class icons stay in the garrison HUD; recruiting layouts use catalog portraits including unified siege artwork',()=>{
 expect(existsSync('public/art/formal/hud-unit-icons-v03015.png')).toBe(true);
 const w=createFormalWorld({campaign:'hud-scope',seed:90217}),c=w.cities[0];const hud=renderToStaticMarkup(<Garrison world={w} city={c}/>);
 expect((hud.match(/class="hud-unit-icon"/g)??[])).toHaveLength(11);expect(hud).toContain('hud-unit-icons-v03015.png');expect(hud).not.toContain('<svg');
 for(const mobile of [true,false]){const html=renderToStaticMarkup(<ArmyView world={w} city={c} mobile={mobile} busy={false} issue={()=>{}}/>);expect(html).not.toContain('hud-unit-icon');expect(html).not.toContain('unit-symbol');expect(html).toContain('art/catalog-units.webp');expect(html).toContain('art/catalog-guards.webp');expect(html).toContain(unitArt('catapult').path);}
});
