import {it,expect} from 'vitest';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {newGame,legacyGame,terrainAt,repairWaterCities} from './legacyWorld';
import {waterGeography,watersAt} from './terrainRegions';
import {initializeWildSites,relocateWildSite,regionQuotas,wildCooldown} from './wildSpawns';
import {isWildSite,siteStock,siteTroops,resetSite} from './npc';
import {exportSave,importSave} from './legacyPersistence';
import {command,advance,owned} from './legacyEngine';
import {emptyTroops,MINUTE,resources} from './legacyTypes';
import {observed} from './intelligence';
import {Target} from './Mission';
import {ReportsView} from './ReportsView';
import {tileReason} from './settlement';
const game=()=>newGame('civ_zhongguo',902,1,0);
it('256 slots have exact type totals, quotas and legal unique positions across seeds',()=>{
 for(const seed of [0,1,902,903,4294967295]){
  const g=newGame('civ_zhongguo',seed,1,0),sites=g.nodes.filter(isWildSite),counts=new Array(64).fill(0);
  expect(sites).toHaveLength(256);expect(['food','wood','stone','gold',undefined].map(r=>sites.filter(n=>n.npcResource===r).length)).toEqual([77,64,51,26,38]);
  expect(new Set(g.nodes.filter(n=>!n.respawnAt&&n.kind!=='ruins').map(n=>n.x+','+n.y)).size).toBe(292);
  for(const n of sites){expect(n.respawnAt).toBeUndefined();expect(terrainAt(n.x,n.y,seed,1)).not.toBe('water');counts[Math.floor(n.y/32)*8+Math.floor(n.x/32)]++;}
  expect(counts).toEqual(regionQuotas(g));expect(counts.every(n=>n>=3&&n<=5)).toBe(true);
  for(const n of g.nodes.filter(n=>!!n.owner))expect(terrainAt(n.x,n.y,seed,1)).not.toBe('water');
 }
});
it('seeded rivers and connected lakes vary, reproduce and persist without changing legacy water',()=>{
 const a=game(),b=game(),c=newGame('civ_zhongguo',903,1,0);expect(a).toEqual(b);expect(waterGeography(a.seed)).not.toEqual(waterGeography(c.seed));
 expect(waterGeography(a.seed).lakes.length).toBeGreaterThanOrEqual(2);
 for(const lake of waterGeography(a.seed).lakes)expect(watersAt(Math.round(lake.x),Math.round(lake.y),a.seed)).toBe(true);
 const copy=importSave(exportSave(a));expect(copy.terrainVersion).toBe(1);expect(copy.nodes).toEqual(a.nodes);
 const old=legacyGame('civ_zhongguo',902,1,0),legacy=importSave(exportSave(old));expect(legacy.terrainVersion).toBeUndefined();
 for(let y=0;y<256;y++)for(let x=0;x<256;x+=7)expect(terrainAt(x,y,legacy.seed)==='water').toBe(Math.abs(x-(126+Math.sin((y+902%79)/23)*20))<2.7);
 expect(tileReason(a,{x:-1,y:128})).toContain('邊界');
});
it('rewards and cooldown follow every specified level; bandits pay 17.5% more with stronger defenders',()=>{
 const n=game().nodes.find(isWildSite)!;n.npcResource='wood';const factors=[1,1.35,1.8,2.4,3.1,4,5.1,6.4,7.9,9.6];
 for(let i=0;i<10;i++){n.npcLevel=i+1;expect(wildCooldown(n)).toBe((30+i*5)*MINUTE);expect(siteStock(n)).toEqual({food:0,wood:Math.round(450*factors[i]),stone:0,gold:0});const guards=siteTroops(n);delete n.npcResource;const value=resources.reduce((s,r)=>s+siteStock(n)[r],0);expect(value/(450*factors[i])).toBeGreaterThanOrEqual(1.15);expect(value/(450*factors[i])).toBeLessThanOrEqual(1.2);expect(siteTroops(n).militia).toBeGreaterThan(guards.militia);n.npcResource='wood';}
});
it('successful scout records immutable resources, all guards and walls; unknown target never leaks live stock',()=>{
 const g=game();g.events=[];const home=owned(g,g.player)[0],n=g.nodes.find(isWildSite)!;n.stock={food:1234,wood:2345,stone:0,gold:4567};n.troops={...emptyTroops(),spear:7};n.buildings.wall=2;Object.assign(n.plots[16],{building:'wall',level:2});
 const target=()=>render(<Target g={g} n={n} home={home} onCity={()=>{}} onMission={()=>{}}/>);
 expect(target()).toContain('資源庫存未知');expect(target()).not.toContain('4,567');
 expect(command(g,{type:'march',from:home.id,to:n.id,kind:'scout',troops:{...emptyTroops(),scout:1}})).toBe('');advance(g,g.marches[0].at);
 const report=g.reports.find(r=>r.scoutIntel)!;expect(report.scoutIntel!.stock).toEqual(n.stock);expect(report.scoutIntel!.troops.spear).toBe(7);expect(report.scoutIntel!.wall).toBe(2);
 expect(JSON.parse(exportSave(g)).snapshot.reports).toBeUndefined();
 n.stock.gold=9999;n.troops.spear=999;expect(target()).toContain('4,567');expect(target()).not.toContain('9,999');
 const html=render(<ReportsView g={g} onNode={()=>{}} reportAction={()=>{}} requestReports={()=>{}} reportEpoch={0} reportPage={{campaign:g.campaign,filter:'all',page:0,data:{rows:[report],count:1,unread:1,counts:{all:1,battle:1,diplomacy:0,chronicle:0}}}} busy={false}/>);expect(html).toContain('資源庫存');expect(html).toContain('觀測時間');expect(html).toContain('城防');expect(html).toContain('4,567');
 const before={x:n.x,y:n.y};n.respawnAt=g.time+wildCooldown(n);expect(observed(g,n)).toBeUndefined();expect(relocateWildSite(g,n)).toBe(true);expect({x:n.x,y:n.y}).not.toEqual(before);expect(observed(g,n)).toBeUndefined();expect(report.scoutIntel!.stock!.gold).toBe(4567);
});
it('cleared sites wait through cooldown, respawn elsewhere, and migration is idempotent',()=>{
 const g=game();g.events=g.events.filter(e=>e.type==='pulse');const n=g.nodes.find(isWildSite)!;resetSite(n,1);const before={x:n.x,y:n.y};n.respawnAt=30*MINUTE;n.stock={food:0,wood:0,stone:0,gold:0};n.troops=emptyTroops();advance(g,29*MINUTE);expect(n.respawnAt).toBe(30*MINUTE);advance(g,30*MINUTE);expect(n.respawnAt).toBeUndefined();expect({x:n.x,y:n.y}).not.toEqual(before);expect(n.generation).toBe(1);expect(g.nodes.filter(isWildSite)).toHaveLength(256);
 const old=legacyGame('civ_zhongguo',1,1,0),cities=old.nodes.filter(n=>n.owner).map(n=>[n.id,n.x,n.y]);initializeWildSites(old);const snapshot=JSON.stringify(old);initializeWildSites(old);expect(JSON.stringify(old)).toBe(snapshot);expect(old.nodes.filter(n=>n.owner).map(n=>[n.id,n.x,n.y])).toEqual(cities);
});
it('water city repair keeps identity and contents without reporting',()=>{
 const g=game(),n=owned(g,g.player)[0],before=g.reports.length,stock={...n.stock};let water:{x:number;y:number}|undefined;
 for(let x=0;x<256&&!water;x++)for(let y=0;y<256;y++)if(terrainAt(x,y,g.seed,1)==='water'){water={x,y};break;}
 Object.assign(n,water);repairWaterCities(g);expect(terrainAt(n.x,n.y,g.seed,1)).not.toBe('water');expect(n.stock).toEqual(stock);expect(g.reports).toHaveLength(before);
});

it('winning a raid starts the level-based cooldown and removes live site intel',()=>{
 const g=game();g.events=[];const home=owned(g,g.player)[0],n=g.nodes.find(isWildSite)!,position={x:n.x,y:n.y};resetSite(n,3);n.troops=emptyTroops();home.troops.militia=200;
 expect(command(g,{type:'march',from:home.id,to:n.id,kind:'raid',troops:{...emptyTroops(),militia:100}})).toBe('');
 advance(g,g.marches[0].at);for(let i=0;i<8&&!n.respawnAt;i++){const event=g.events.filter(e=>e.type==='round').sort((a,b)=>a.at-b.at)[0];if(!event)break;advance(g,event.at);}
 expect(n.respawnAt).toBe(g.time+40*MINUTE);expect(n.stock).toEqual({food:0,wood:0,stone:0,gold:0});expect(observed(g,n)).toBeUndefined();
 expect(g.reports.find(r=>r.kind==='battle'&&r.node===n.id)?.location).toEqual(position);
});
