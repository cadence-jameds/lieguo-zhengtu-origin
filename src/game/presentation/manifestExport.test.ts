import {mkdirSync,writeFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {TECH_CATALOG} from '../formal/techCatalog';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {BUILDING_CATALOG} from '../formal/catalogB3';
import {unitArt,techArt,BUILDING_ALIAS,CIV_ART,FIELD_ALIAS,SITE_INDEX,NEW_BUILDINGS,LABELS} from './artMap';
it('exports complete machine-readable Formal ID to presentation mapping for checkpoint audit',()=>{
 const map={civilizations:CIV_ART,visualAges:{Dark:0,Feudal:1,Castle:2,Imperial:2},buildingAliases:BUILDING_ALIAS,
 buildings:Object.keys(BUILDING_CATALOG).map(id=>({id,name:LABELS[id],alias:BUILDING_ALIAS[id]??null,new:NEW_BUILDINGS.includes(id as typeof NEW_BUILDINGS[number]),path:NEW_BUILDINGS.includes(id as typeof NEW_BUILDINGS[number])?`art/formal/building-${id}.webp`:id==='wall'?'art/city-scene-{dark|feudal|castle}-construction-v2.webp | art/city-scene-{dark-wood|feudal-stone|stone}.webp':id==='bunker'?'art/cellar.webp':id==='castle'?'art/castle-{civilizationAlias}.webp':'art/buildings-dark.webp | art/buildings-feudal.webp | art/building-atlas.webp'})),
 units:Object.keys(UNIT_CATALOG).map(id=>({id,name:UNIT_CATALOG[id].name,...unitArt(id)})),technologies:Object.values(TECH_CATALOG).filter(t=>t.scope==='traditional'||t.scope==='research-cooperation').map(t=>({id:t.id,name:t.name,...techArt(t.id)})),fields:FIELD_ALIAS,wildSites:SITE_INDEX};
 expect(map.buildings).toHaveLength(20);expect(map.units).toHaveLength(44);expect(map.technologies).toHaveLength(67);mkdirSync('docs/wall-delta-v03022',{recursive:true});writeFileSync('docs/wall-delta-v03022/formal-art-map.json',JSON.stringify(map,null,2));
});
