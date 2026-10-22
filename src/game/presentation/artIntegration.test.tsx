import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {BUILDING_CATALOG} from '../formal/catalogB3';
import {TECH_CATALOG} from '../formal/techCatalog';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {BuildingSprite,constructionArtPath,eraAtlas} from '../assets';
import type {Building} from '../legacyTypes';
import {MiniatureCity} from '../MiniatureCity';
import {CityScenes} from './CityScenes';
import {BUILDING_ALIAS,CIV_ART,NEW_BUILDINGS,visualAge,unitArt,techArt,cityPresentation,TOWN_ANCHORS,FIELD_ANCHORS,FIELD_ALIAS,civilizationIndex,SITE_INDEX} from './artMap';
const publicPath=(p:string)=>resolve('public',p);
const exists=(p:string)=>expect(existsSync(publicPath(p)),p).toBe(true);
describe('B4 art integration authority and asset coverage',()=>{
 it('civilization aliases are explicit; Byzantine and Mongolian never use China index',()=>{
 expect(CIV_ART.civ_byzantium).toBe('civ_byzantion');expect(CIV_ART.civ_mongolia).toBe('civ_mongol');expect(civilizationIndex('civ_byzantium')).toBe(1);expect(civilizationIndex('civ_mongolia')).toBe(5);
 for(const id of Object.keys(CIV_ART)){exists('art/castle-'+CIV_ART[id]+'.webp');const html=renderToStaticMarkup(<BuildingSprite building="castle" civ={CIV_ART[id]}/>);expect(html).toContain('castle-'+CIV_ART[id]);}
 });
 it('visual Dark/Feudal/Castle/Imperial uses only era0-2 and existing walls/cities',()=>{
 expect([0,1,2,3].map(visualAge)).toEqual([0,1,2,2]);for(const age of [0,1,2,3])for(const civ of Object.keys(CIV_ART)){const era=visualAge(age);exists(eraAtlas(era));exists(`art/cities-age-${era}.webp`);exists(`art/wall-ring-${era}.webp`);const html=renderToStaticMarkup(<MiniatureCity civ={CIV_ART[civ]} era={era} wall={3}/>);expect(html).not.toContain('age-3');expect(html).not.toContain('ring-3');}
 });
 it('all 20 formal buildings have valid aliases or independent new assets, including fixed wall and repeated identities',()=>{
 for(const k of Object.keys(BUILDING_CATALOG)){expect(BUILDING_ALIAS[k]||NEW_BUILDINGS.includes(k as typeof NEW_BUILDINGS[number]),k).toBeTruthy();if(!BUILDING_ALIAS[k])exists(`art/formal/building-${k}.webp`);}
 expect(BUILDING_ALIAS.center).toBe('hall');expect(BUILDING_ALIAS.residence).toBe('house');expect(BUILDING_ALIAS.bunker).toBe('cellar');expect(BUILDING_ALIAS.archery).toBe('range');
 });
 it('all reused construction paths resolve for every visual age, civilization and field',()=>{
 for(const alias of [...Object.values(BUILDING_ALIAS),...Object.values(FIELD_ALIAS)])for(const age of [0,1,2])for(const civ of Object.values(CIV_ART))exists(constructionArtPath(alias as Building,age,civ,1));
 });
 it('all 28 units and 67 B4 tech presentations resolve without indexing formal catalog position',()=>{
 expect(Object.keys(UNIT_CATALOG)).toHaveLength(44);for(const id of Object.keys(UNIT_CATALOG)){const a=unitArt(id);exists(a.path);if(a.index!==undefined)expect(a.index).toBeGreaterThanOrEqual(0);}
 const techs=Object.values(TECH_CATALOG).filter(t=>t.scope==='traditional'||t.scope==='research-cooperation');expect(techs).toHaveLength(67);for(const t of techs)exists(techArt(t.id).path);expect(techArt('research.cooperation').path).toContain('cooperation');expect(unitArt('swordsman').badge).toContain('ELITE');
 });
 it('15 slots are unique and map to exact DEMO anchors plus center',()=>{
 const w=createFormalWorld({campaign:'art-town',seed:90217}),c=w.cities[0];for(let i=0;i<15;i++){c.economy!.slots['warehouse.'+i]=i;c.buildings['warehouse.'+i]=1;}
 const before=JSON.stringify(w),p=cityPresentation(w,c);expect(p.lots).toHaveLength(16);expect(p.lots[0].key).toBe('center');expect(p.lots.slice(1).map(l=>l.slot)).toEqual(Array.from({length:15},(_,i)=>i));expect(new Set(p.lots.map(l=>l.anchor.join(','))).size).toBe(16);expect(JSON.stringify(w)).toBe(before);
 });
 it('18 fields map uniquely including Lv0/15, formal new game remains6/5/4/3',()=>{
 const w=createFormalWorld({campaign:'art-fields',seed:90217}),c=w.cities[0],p=cityPresentation(w,c);expect(p.fields).toHaveLength(18);expect(new Set(p.fields.map(f=>f.anchor.join(','))).size).toBe(18);expect(['food','wood','stone','gold'].map(r=>p.fields.filter(f=>f.resource===r).length)).toEqual([6,5,4,3]);c.fields![17].level=15;expect(cityPresentation(w,c).fields[17].level).toBe(15);
 });
 it('rendered scenes expose center+15 and 18 selected fields without reading a legacy Node',()=>{
 const w=createFormalWorld({campaign:'scene-markup',seed:90217}),c=w.cities[0];const html=renderToStaticMarkup(<CityScenes initialDistrict="town" world={w} city={c} onBuilding={()=>{}} onField={()=>{}}/>);expect((html.match(/data-testid="town-anchor-/g)??[])).toHaveLength(16);const outskirts=renderToStaticMarkup(<CityScenes world={w} city={c} onBuilding={()=>{}} onField={()=>{}}/>);expect((outskirts.match(/data-testid="field-anchor-/g)??[])).toHaveLength(18);expect(html+outskirts).not.toContain('undefined');expect(html).not.toContain('NaN');
 });
 it('anchors are copied exactly from DEMO; formal rendering never imports legacy engine or generation',()=>{
 const town=readFileSync('src/game/TownScene.tsx','utf8'),fields=readFileSync('src/game/OutskirtsScene.tsx','utf8');for(const [x,y] of TOWN_ANCHORS)expect(town).toContain(`[${x},${y}]`);for(const [x,y] of FIELD_ANCHORS)expect(fields).toContain(`[${x},${y}]`);
 for(const path of ['src/game/FormalWorldMap.tsx','src/game/presentation/CityScenes.tsx','src/game/presentation/artMap.ts'])expect(readFileSync(path,'utf8')).not.toMatch(/from ['"].*(legacyEngine|legacyWorld|legacyUseGame|legacyTypes)['"]/);
 });
 it('all world referenced paths exist, five site crops are explicit',()=>{
 expect(SITE_INDEX).toEqual({food:0,wood:1,stone:2,gold:3,bandit:6});for(const path of ['world-terrain-023','world-water-029','world-riverbanks-0301','world-trees-0299','world-mountains-0299','world-details-0299','world-resources','civilization-emblems-023'])exists('art/'+path+'.webp');
 });
 it('UI SVGs resolve including research, population, housing, City and logistics',()=>{for(const name of ['population','housing','food','wood','stone','gold','construction','slot','caravan','baggage','reservation','research','funding','queue','military','elite','age','milestone','city','integration','settlement','escort','journey','capacity','level'])exists('art/formal/icon-'+name+'.svg');});
});
