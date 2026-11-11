import {expect,it} from 'vitest';
import {existsSync,readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {GAME_ART,firstScreenArt,COMMON_ART} from './artInventory';
import {FormalBuildingSprite,FormalResourceSprite,Art} from './Art';
import {CIV_ART,BUILDING_ALIAS,NEW_BUILDINGS,unitArt,techArt} from './artMap';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {TECH_CATALOG} from '../formal/techCatalog';
import {createFormalWorld} from '../formal/generator';
import {Shell} from './Shell';
import {CityScenes} from './CityScenes';
const paths=(html:string)=>[...html.matchAll(/art\/[\w./-]+\.(?:webp|svg|png)/g)].map(m=>m[0]);
function covered(html:string){for(const p of paths(html))expect(GAME_ART,p).toContain(p);}
it('production inventory covers actual renderer output for six civilizations/four ages, both construction states, all units and technology cards',()=>{
 for(const civ of Object.values(CIV_ART))for(const age of [0,1,2,3] as const){for(const kind of [...Object.keys(BUILDING_ALIAS),...NEW_BUILDINGS])for(const constructing of [false,true])covered(renderToStaticMarkup(<FormalBuildingSprite kind={kind} civ={civ} age={age} constructing={constructing}/>));for(const building of ['farm','lumber','quarry','mine'] as const)for(const level of [0,5,6,9,10,11,15])for(const constructing of [false,true])covered(renderToStaticMarkup(<FormalResourceSprite building={building} level={level} age={age} constructing={constructing} targetLevel={level}/>));}
 for(const id of Object.keys(UNIT_CATALOG))covered(renderToStaticMarkup(<Art spec={unitArt(id)} label={id}/>));for(const id of Object.keys(TECH_CATALOG))covered(renderToStaticMarkup(<Art spec={techArt(id)} label={id}/>));
});
it('every inventory URL is a real image; unused public art is explicitly excluded',()=>{
 for(const p of GAME_ART)expect(existsSync('public/'+p),p).toBe(true);
 const all=readdirSync('public/art',{recursive:true}).filter(p=>/\.(webp|png|svg)$/.test(String(p))).map(p=>'art/'+p);
 expect(GAME_ART.length).toBeLessThan(all.length);expect(GAME_ART).not.toContain('art/terrain-base.webp');expect(GAME_ART).not.toContain('art/town-wall-dark.png');
 const report={used:GAME_ART.map(path=>({path,bytes:readFileSync('public/'+path).length})),excluded:all.filter(p=>!GAME_ART.includes(String(p)))};
 if(process.env.ART_INVENTORY_REPORT){mkdirSync('artifacts/home-art',{recursive:true});writeFileSync('artifacts/home-art/inventory.json',JSON.stringify(report,null,2));}
});
it('entry freezes only the actual outskirts first screen and includes current construction, never other civilizations/menus',()=>{
 for(const civilizationId of Object.keys(CIV_ART)){const w=createFormalWorld({campaign:'art-'+civilizationId,seed:90217,civilizationId}),city=w.cities.find(c=>c.ownerFactionId===w.playerFactionId)!;const required=firstScreenArt(w,city),html=renderToStaticMarkup(<CityScenes world={w} city={city} onBuilding={()=>{}} onField={()=>{}}/>);const shell=renderToStaticMarkup(<Shell world={w} city={city} cities={[city]} mobile view="city" onView={()=>{}} onCity={()=>{}} onHome={()=>{}} onResource={()=>{}} onMore={()=>{}} moreOpen={false} busy={false}>{null}</Shell>);for(const p of paths(html+shell))expect(required,p).toContain(p);expect(required).not.toContain(unitArt('militia').path);expect(required.length).toBeLessThan(COMMON_ART.length);}
});
