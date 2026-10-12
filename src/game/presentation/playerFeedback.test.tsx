import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createFormalWorld} from '../formal/generator';
import {CIV_ORDER,TOWN_ANCHORS,FIELD_ANCHORS,cityPresentation} from './artMap';
import {garrisonLines,Garrison} from './Garrison';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {cultureName,civilizationDetails} from './catalog';
import {Start,CivilizationDetails} from './Start';
import {CityScenes} from './CityScenes';
import {selectedReturnCity,mapBackgroundKey,mapLabels,mapLabelPreferenceKey} from './mapSemantics';
import {relationColor,politicalCells} from './mapRelations';
import {eraAtlas,eraBounds} from '../assets';
import {mountainVisualCells,decorations} from './mapPaint';
import {terrainAt,passable,buildable} from '../formal/terrain';
import {constructionAction} from './cityActions';
import {submitFormalOrder} from '../formal/reducer';
import {commandId} from '../formal/ids';
const w=createFormalWorld({campaign:'presentation-feedback',seed:90217}),c=w.cities[0],noop=()=>{};
it('six compact cards share one selected Formal detail panel and retain name dice, offline and speed modes',()=>{
 const html=renderToStaticMarkup(<Start busy={false} hasSave={false} onClose={noop} onStart={noop}/>);expect((html.match(/class="civ-option/g)??[])).toHaveLength(6);
 for(const id of CIV_ORDER){const d=civilizationDetails(id);expect(d.guard).toEqual(UNIT_CATALOG['guard.'+id]);const detail=renderToStaticMarkup(<CivilizationDetails civ={id}/>);expect(detail).toContain(d.guard.name);expect(detail).toContain(d.military);for(const tech of d.technologies)expect(detail).toContain(tech.name);expect(cultureName(id,0)).not.toBe(cultureName(id,1));}
 for(const value of [0,1,6,24,3,10,50])expect(html).toContain('value="'+value+'"');expect(html).toContain('依目前文明隨機產生領主名稱');
 expect((html.match(/class="civ-detail"/g)??[])).toHaveLength(1);const cards=[...html.matchAll(/<button[^>]*class="civ-option[^>]*>.*?<\/button>/g)].map(m=>m[0]);expect(cards).toHaveLength(6);for(const card of cards){expect(card).not.toContain('civ-detail');expect(card).not.toContain('專屬科技');}expect(html.indexOf('class="civ-detail"')).toBeGreaterThan(html.lastIndexOf('class="civ-option'));
 const source=readFileSync('src/game/presentation/Start.tsx','utf8');expect(source).toContain('onClick={()=>setCiv(id)}');expect(source).not.toMatch(/setCiv\(id\);?setName/);
});
it('11 fixed unit lines sum actual ordinary+elite garrisons and show absent modern tiers without inventing units',()=>{
 const own=structuredClone(c);own.military!.units={militia:7,swordsman:4,archer:5,crossbowman:2,'guard.civ_zhongguo':3,'elite.guard.civ_zhongguo':1};const lines=garrisonLines(w,own);
 expect(lines.map(l=>l.id)).toEqual(['scout','militia','spearman','archer','skirmisher','light-cavalry','knight','guard','ram','catapult','baggage']);expect(lines.find(l=>l.id==='militia')).toMatchObject({ordinaryCount:7,eliteCount:4,total:11,modernCount:null});expect(lines.find(l=>l.id==='guard')?.total).toBe(4);expect(lines.find(l=>l.id==='scout')?.eliteCount).toBeNull();expect(lines.every(l=>l.modernCount===null)).toBe(true);
 const html=renderToStaticMarkup(<Garrison world={w} city={own}/>);expect((html.match(/class="garrison-cell"/g)??[])).toHaveLength(11);expect(w.cities[1].military!.units).toEqual({});
});
it('Return uses selected owned city, labels default off and persisted on, background does not depend on clock or overlays',()=>{
 const v=structuredClone(w);v.cities[1].ownerFactionId=v.playerFactionId;expect(selectedReturnCity(v,v.cities[1].id).id).toBe(v.cities[1].id);expect(selectedReturnCity(v,v.cities[2].id).id).toBe(c.id);
 expect(mapLabels({getItem:()=>null})).toBe(false);expect(mapLabels({getItem:key=>key===mapLabelPreferenceKey?'true':null})).toBe(true);expect(mapLabels({getItem:()=>{throw new Error('storage');}})).toBe(false);
 const camera={x:10,y:20,z:.75},view={width:1440,height:900,dpr:1},key=mapBackgroundKey(v,camera,view,true,false,2,3);v.time=3000;v.cities[0].population=350;expect(mapBackgroundKey(v,camera,view,true,false,2,3)).toBe(key);expect(mapBackgroundKey(v,{...camera,x:11},view,true,false,2,3)).not.toBe(key);
 expect(relationColor(w,c)).toBe('#69cb7e');expect(relationColor(w,w.cities[1])).toBe('#bec1b7');expect(politicalCells(w)).toEqual([]);
 const source=readFileSync('src/game/FormalWorldMap.tsx','utf8')+readFileSync('src/game/presentation/MapToolbar.tsx','utf8');for(const action of ['回城','全區','定位','帝國','版圖','標示','★ 最愛'])expect(source).toContain(action);expect(source).not.toContain('首都');
});
it('DEMO city atlas crop and anchor/scale are used for all six civs and three visual ages',()=>{
 for(let age=0;age<3;age++)for(let i=0;i<6;i++){const crop=eraBounds(14+i,age);expect(crop.w).toBeGreaterThan(0);expect(crop.h).toBeGreaterThan(0);expect(eraAtlas(age)).toContain(age===0?'buildings-dark':age===1?'buildings-feudal':'building-atlas');}
 const source=readFileSync('src/game/FormalWorldMap.tsx','utf8');expect(source).toContain('eraBounds(14+i,age)');expect(source).toContain('size*3.8,size*3.8');expect(source).toContain('y:p.y+size*.8');
});
it('DEMO Town/Outskirts anchors, default district, mobile scale classes and construction waiting/active semantics are preserved',()=>{
 const outskirts=renderToStaticMarkup(<CityScenes world={w} city={c} mobile onBuilding={noop} onField={noop}/>),town=renderToStaticMarkup(<CityScenes initialDistrict="town" world={w} city={c} mobile onBuilding={noop} onField={noop}/>);expect(outskirts).toContain('outskirts-close');expect(town).toContain('town-close');expect((outskirts.match(/data-testid="field-anchor-/g)??[])).toHaveLength(18);expect((town.match(/data-testid="town-anchor-/g)??[])).toHaveLength(16);
 const p=cityPresentation(w,c);expect(p.lots.map(l=>l.anchor)).toEqual(TOWN_ANCHORS);expect(p.fields.map(f=>f.anchor)).toEqual(FIELD_ANCHORS);
 let r=submitFormalOrder(w,{commandId:commandId('progress-a'),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'field.upgrade',cityId:c.id,slot:0}}).world;
 r=submitFormalOrder(r,{commandId:commandId('progress-b'),campaignId:r.campaignId,issuerId:r.playerFactionId,issuedWorldTime:r.time,expectedRevision:r.revision,payload:{type:'field.upgrade',cityId:c.id,slot:1}}).world;
 const html=renderToStaticMarkup(<CityScenes world={r} city={r.cities[0]} onBuilding={noop} onField={noop}/>);expect(html).toContain('construction-progress waiting');expect(html).toContain('aria-label="等待施工"');expect(html).toContain('aria-label="施工進度"');
});
it('build dialog eligibility follows Formal catalog: era, prerequisites, costs, booster field gate, D2 and queue capacity',()=>{
 const city=structuredClone(c);expect(constructionAction(w,city,{key:'barracks'}).reasons).toContain('城市中心 Lv2');expect(constructionAction(w,city,{key:'stable'}).reasons).toContain('封建時代');expect(constructionAction(w,city,{key:'mill'}).reasons).toContain('至少一座對應資源田Lv5');city.fields![0].level=10;expect(constructionAction(w,city,{field:0}).reasons).toContain('曾達人口10,000、City晉升完成且當下住房10,000');
 const first=constructionAction(w,city,{key:'residence'});expect(first.cost).toEqual({food:25,wood:85,stone:75,gold:65});expect(first.reasons).toEqual([]);
});

it('complete mountain silhouettes match Formal blocked terrain; legal starts/sites remain outside mountain/water',()=>{
 let checked=0;for(let y=0;y<384;y+=3)for(let x=260;x<320;x++)for(const d of decorations(w,x,y).filter(d=>d.kind==='mountain')){expect(terrainAt(w,d.x,d.y)).toBe('mountain');expect(passable(terrainAt(w,d.x,d.y))).toBe(false);expect(buildable(terrainAt(w,d.x,d.y))).toBe(false);const mask=mountainVisualCells(w,d);expect(mask.length).toBeGreaterThan(0);for(const p of mask){expect(terrainAt(w,p.x,p.y)).toBe('mountain');expect(passable(terrainAt(w,p.x,p.y))).toBe(false);expect(buildable(terrainAt(w,p.x,p.y))).toBe(false);}checked++;}expect(checked).toBeGreaterThan(20);
 for(const p of [...w.cities,...w.worldLayer!.wildSites])expect(buildable(terrainAt(w,p.x,p.y))).toBe(true);
});
