import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {newGame,terrainAt} from './legacyWorld';
import {advance,command,owned,faction,capacity,housing,protectionLimit,production,governorRecruitment,governorStep} from './legacyEngine';
import {refreshBuildingLevel,totalBuildingLevel} from './city';
import {importSave,exportSave,validate} from './legacyPersistence';
import {emptyTroops,HOUR,resources,type Node,type Building,unitIds} from './legacyTypes';
import {tileReason,settleReason} from './settlement';
import {CityView} from './CityView';
import {TileDialog,Target} from './Mission';
import {BuildingSprite} from './assets';
import {visibleMapNode,mapMarkerSize} from './mapRelations';
import {TerrainCache,terrainRasterScale,terrainChunks} from './terrainCache';
const setup=()=>{const g=newGame('civ_zhongguo',902,1,0);g.events=[];g.sandbox=true;return g;};
const building=(n:Node,id:number,b:Building,level:number)=>{Object.assign(n.plots[id],{building:b,level});refreshBuildingLevel(n,b);};
const rich=(n:Node)=>{n.stock={food:100000,wood:100000,stone:100000,gold:100000};};
it('civilian starting population and recruitment reserve apply to every unit and owner',()=>{
 const g=setup(),n=owned(g,g.player)[0];expect(n.population).toBe(200);expect(housing(n)).toBe(400);
 for(const owner of [g.player,g.factions.find(f=>f.id!==g.player)!.id]){
  const city=owned(g,owner)[0];faction(g,owner).era=2;['barracks','range','stable','workshop','castle'].forEach((b,i)=>building(city,i+1,b as Building,2));rich(city);
  for(const unit of unitIds){city.population=205;city.train=[];expect(command(g,{type:'train',city:city.id,unit,count:5},owner)).toBe('');expect(city.population).toBe(200);expect(command(g,{type:'train',city:city.id,unit,count:1},owner)).toContain('人口不足');}
 }
});
it('four civic buildings stack completed plots; demolition preserves other copies; academy stays unique',()=>{
 const g=setup(),n=owned(g,g.player)[0];faction(g,g.player).era=2;rich(n);
 building(n,1,'house',1);building(n,2,'house',2);building(n,3,'warehouse',1);building(n,4,'warehouse',2);building(n,5,'cellar',1);building(n,6,'cellar',2);building(n,7,'market',1);building(n,8,'market',2);
 expect(housing(n)).toBe(1900);expect(capacity(n)).toBe(10000);expect(protectionLimit(n)).toBe(1500);expect(totalBuildingLevel(n,'market')).toBe(3);
 const gold=production(g,n).gold;building(n,8,'market',3);expect(production(g,n).gold-gold).toBeCloseTo(15*1.05);
 expect(command(g,{type:'build',city:n.id,building:'house',plot:9})).toBe('');expect(housing(n)).toBe(1900);advance(g,n.build[0].at);expect(housing(n)).toBe(2400);
 expect(command(g,{type:'demolish',city:n.id,plot:2})).toBe('');advance(g,n.build[0].at);expect(housing(n)).toBe(1400);expect(n.buildings.house).toBe(1);
 building(n,10,'academy',1);expect(command(g,{type:'build',city:n.id,building:'academy',plot:11})).toContain('一座');expect(importSave(exportSave(g)).nodes.find(c=>c.id===n.id)!.buildings.house).toBe(1);
});
it('settlement departs at 600 with 400 people, save round trip and arrival preserve civilians',()=>{
 const g=setup(),n=owned(g,g.player)[0];faction(g,g.player).era=2;rich(n);let at={x:0,y:0};while(tileReason(g,at))at.x++;
 n.population=599;expect(settleReason(g,n,at)).toContain('600');n.population=600;
 expect(command(g,{type:'settle_at',from:n.id,at,troops:{...emptyTroops(),militia:10}})).toBe('');expect(n.population).toBe(200);expect(g.marches[0].settlers).toBe(400);
 const returning=importSave(exportSave(g)),party=returning.marches[0];expect(command(returning,{type:'retreat',march:party.id})).toBe('');advance(returning,party.retreatAt!);advance(returning,party.at);expect(returning.nodes.find(c=>c.id===n.id)!.population).toBe(600);expect(returning.marches).toHaveLength(0);
 const copy=importSave(exportSave(g)),m=copy.marches[0];advance(copy,m.at);expect(copy.nodes.find(c=>c.id===m.to)!.population).toBe(400);validate(copy);
});
it('governor stops at target, diversifies unlocked units and includes gold in materials policy',()=>{
 const g=setup(),n=owned(g,g.player)[0];faction(g,g.player).era=1;rich(n);n.population=900;building(n,1,'barracks',2);building(n,2,'range',1);building(n,3,'house',2);n.troops={...emptyTroops(),spear:749};
 expect(governorRecruitment(g,n).unit).toBeUndefined();n.governor.enabled=true;governorStep(g,n);expect(n.train).toHaveLength(0);expect(n.governor.blocked).toContain('守軍已足夠');
 n.troops={...emptyTroops(),spear:20,militia:10};expect(governorRecruitment(g,n).unit).toBe('archer');n.population=200;expect(governorRecruitment(g,n).reason).toContain('保留 200');
 const gold=production(g,n).gold;n.policy='industry';expect(production(g,n).gold).toBeCloseTo(gold*1.2);
});
it('unbuildable tile has no settlement controls; ownership remains public without troop disclosure',()=>{
 const g=setup(),n=owned(g,g.player)[0];const point=Array.from({length:65536},(_,i)=>({x:i%256,y:Math.floor(i/256)})).find(p=>terrainAt(p.x,p.y,g.seed,g.terrainVersion)==='water')!;
 const html=renderToStaticMarkup(<TileDialog g={g} from={n} point={point} issue={()=>{}} busy={false} onClose={()=>{}}/>);expect(html).toContain('水域');expect(html).not.toContain('城市名稱');expect(html).not.toContain('18 塊');expect(html).not.toContain('選擇護送');
 const enemy=g.nodes.find(c=>c.kind==='capital'&&c.owner!==g.player)!;const target=renderToStaticMarkup(<Target g={g} n={enemy} home={n} onMission={()=>{}} onCity={()=>{}}/>);for(const text of ['玩家','文明','軍團','帝國','尚未偵察'])expect(target).toContain(text);
});
it('device scenes keep 18 resource levels and city tabs, wall art follows age',()=>{
 const g=setup(),n=owned(g,g.player)[0];for(const mobile of [false,true]){const html=renderToStaticMarkup(<CityView g={g} n={n} issue={()=>{}} busy={false} mobile={mobile}/>);expect(html.match(/class="resource-parcel /g)).toHaveLength(18);expect(html).toContain('miniature-city');expect(html).toContain('city-inline-coordinates');expect(html).not.toContain('show-field-names');}
 for(const [era,scene] of [[0,'city-scene-dark-wood.webp'],[1,'city-scene-feudal-stone.webp'],[2,'city-scene-stone.webp']] as const)expect(renderToStaticMarkup(<BuildingSprite building="wall" civ={g.player} era={era}/>)).toContain(scene);
});
it('political rendering and picking share city-only visibility, relation markers match frame dimensions',()=>{
 const g=setup();expect(g.nodes.filter(n=>visibleMapNode(n,true)).every(n=>['capital','village'].includes(n.kind))).toBe(true);expect(g.nodes.filter(n=>visibleMapNode(n,false)).length).toBeGreaterThan(g.nodes.filter(n=>visibleMapNode(n,true)).length);expect(mapMarkerSize(1)).toEqual({width:36,height:18});
});
it('zoom cache limits raster work per frame and settles without re-rasterizing unchanged terrain',()=>{
 const ctx=new Proxy({},{get:(_obj,k)=>k==='createImageData'||k==='getImageData'?(w:number,h:number)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}):()=>{}});vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});
 try{const cache=new TerrainCache();const chunks=terrainChunks(0,2560,.13,1920,1080).filter(c=>c.x>=0&&c.y>=0&&c.x<256&&c.y<256);let frames=0;
  do{cache.beginFrame();for(const c of chunks)cache.request(c.x,c.y,902,.13,2);const before=cache.misses;cache.pump(3,1000);expect(cache.misses-before).toBeLessThanOrEqual(3);frames++;}while(cache.pendingCount&&frames<150);
  expect(cache.pendingCount).toBe(0);const before=cache.misses;cache.beginFrame();for(const c of chunks)expect(cache.request(c.x,c.y,902,.13,2)).not.toBeNull();cache.pump();expect(cache.misses).toBe(before);expect(terrainRasterScale(.13,2)).toBe(.25);
  for(const zoom of [.2,.4,.8,1.5,.3,.13]){cache.beginFrame();for(const c of chunks)cache.request(c.x,c.y,902,zoom,2,true);const before=cache.misses;cache.pump(3,1000);expect(cache.misses-before).toBeLessThanOrEqual(3);}
 }finally{vi.unstubAllGlobals();}
});
it.runIf(!!process.env.REALM_REGRESSION_SAVE)('user late-game save remains valid after six more world hours',()=>{
 const g=importSave(readFileSync(process.env.REALM_REGRESSION_SAVE!,'utf8'));const before=g.time,stats={cities:g.nodes.filter(n=>['capital','village'].includes(n.kind)).length,marches:g.marches.length,reports:g.reports.length};g.sandbox=true;advance(g,before+6*HOUR);validate(g);expect(g.time).toBe(g.defeat?g.defeat.at:before+6*HOUR);expect(g.nodes.every(n=>resources.every(r=>Number.isFinite(n.stock[r])&&n.stock[r]>=0))).toBe(true);expect(()=>importSave(exportSave(g))).not.toThrow();console.log(JSON.stringify({beforeHours:before/HOUR,...stats,afterHours:g.time/HOUR}));
},120000);
