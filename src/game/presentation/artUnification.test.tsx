import {existsSync,readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {UNIT_CATALOG,ELITE_VARIANTS} from '../formal/unitCatalog';
import {TECH_CATALOG} from '../formal/techCatalog';
import {BUILDING_CATALOG} from '../formal/catalogB3';
import {Art,FormalBuildingSprite,FormalResourceSprite} from './Art';
import {CIV_ART,cityArtAge,techArt,unitArt,FIELD_ALIAS,armyAtlasBounds} from './artMap';
import {buildingImagePath} from './artRegistry';

it('all 82 technology cards are illustrations with distinct real tier assets; symbols stay available',()=>{
 expect(Object.keys(TECH_CATALOG)).toHaveLength(82);
 for(const id of Object.keys(TECH_CATALOG)){const a=techArt(id);expect(a.path).toMatch(/\.webp$/);expect(existsSync('public/'+a.path)).toBe(true);}
 for(const id of Object.keys(TECH_CATALOG).filter(id=>id.endsWith('.1'))){const line=[1,2,3].map(n=>id.slice(0,-1)+n).filter(id=>TECH_CATALOG[id]);expect(new Set(line.map(id=>readFileSync('public/'+techArt(id).path).toString('base64'))).size).toBe(line.length);}
 expect(existsSync('public/art/formal/tech-administration.svg')).toBe(true);
});
it('real elite pairs differ in their imagery and all modern units have dedicated portraits',()=>{
 for(const [base,elite] of Object.entries(ELITE_VARIANTS))expect(unitArt(base).path).not.toBe(unitArt(elite).path);
 for(const u of Object.values(UNIT_CATALOG)){expect(existsSync('public/'+unitArt(u.id).path)).toBe(true);if(u.era==='modern'){expect(unitArt(u.id).origin).toBe('new');expect(unitArt(u.id).path).toContain('/units/modern.');}}
});
it('old portrait atlas crops follow measured row dividers and keep source images unchanged',()=>{
 expect(armyAtlasBounds('units',0)).toEqual({x:2,y:2,w:508,h:483});expect(armyAtlasBounds('units',4).y).toBe(489);expect(armyAtlasBounds('guards',3).y).toBe(507);
 const html=renderToStaticMarkup(<Art spec={unitArt('spearman')} label="槍兵"/>);expect(html).toContain('viewBox="514 2 508 483"');expect(html).toContain('art/catalog-units.webp');expect(html).not.toContain('unit-symbol');
});
it('imperial buildings and all eight newer construction sprites resolve in town and detail adapters',()=>{
 for(const civ of Object.values(CIV_ART))for(const kind of Object.keys(BUILDING_CATALOG).filter(k=>k!=='wall')){
  const complete=renderToStaticMarkup(<FormalBuildingSprite kind={kind} civ={civ} age={3}/>),construction=renderToStaticMarkup(<FormalBuildingSprite kind={kind} civ={civ} age={3} constructing/>);
  expect(buildingImagePath(kind,civ,3)).toBeTruthy();expect(buildingImagePath(kind,civ,3,true)).toBeTruthy();expect(complete).not.toBe(construction);expect(construction).not.toContain('formal-scaffold');
 }
});
it('field art changes at v95 levels 6 and 11 independently of faction era, including construction',()=>{
 for(const building of Object.values(FIELD_ALIAS))for(const age of [0,1,2,3] as const){
  const art=(level:number,constructing=false)=>renderToStaticMarkup(<FormalResourceSprite building={building} level={level} age={age} constructing={constructing} targetLevel={level}/>);
  expect(art(5)).toContain('field-'+building);expect(art(6)).not.toContain('field-'+building);expect(art(10)).not.toContain('/unified/buildings/');expect(art(11)).toContain(`/unified/buildings/${building}.imperial.webp`);expect(art(11,true)).toContain(`/unified/construction/${building}.imperial.webp`);
 }
});
it('imperial presentation preserves permanent City promotion without mutating the world',()=>{
 const w=createFormalWorld({campaign:'art-pure',seed:90217}),c=w.cities[0];c.cityPromotionCompleted=true;w.factions[0].age=3;const before=JSON.stringify(w);expect(cityArtAge(w,c)).toBe(3);expect(JSON.stringify(w)).toBe(before);w.factions[0].age=0;expect(cityArtAge(w,c)).toBe(2);
});
