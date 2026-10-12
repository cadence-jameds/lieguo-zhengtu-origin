import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CityView} from './CityView';
import {MarchList} from './Views';
import {ReportsView,reportEntryTime} from './ReportsView';
import {Target} from './Mission';
import {aiStep,advance,command,faction,node} from './legacyEngine';
import {empireUiColor,empireTerritoryColor} from './empirePalette';
import {mapColors,mapRelation,relationship,relationshipColor} from './mapRelations';
import {checksum,decode,envelope,validate} from './legacyPersistence';
import {newGame} from './legacyWorld';
import {emptyStock,emptyTroops,HOUR,MINUTE} from './legacyTypes';

it('moves the mobile scene toggle into the city heading and distinguishes stationed reinforcements',()=>{
  const g=newGame('civ_zhongguo',295,1,0),capital=node(g,faction(g,g.player).capital);
  const html=renderToStaticMarkup(<CityView g={g} n={capital} issue={()=>{}} busy={false} mobile/>);
  const heading=html.slice(html.indexOf('city-heading'),html.indexOf('district-toolbar'));
  expect(heading).toContain('委任總督');expect(heading).toContain('查看全景');
  expect(heading.indexOf('委任總督')).toBeLessThan(heading.indexOf('查看全景'));
  expect(html).not.toContain('class="scene-controls"');
  const target=g.nodes.find(n=>n.owner!==g.player)!;
  g.marches=[{id:999,owner:g.player,from:capital.id,to:target.id,kind:'reinforce',troops:{...emptyTroops(),spear:12},cargo:emptyStock(),started:0,at:0,status:'battle',stationed:true,path:[{x:capital.x,y:capital.y}],supply:100}];
  const army=renderToStaticMarkup(<MarchList g={g} issue={()=>{}}/>);
  expect(army).toContain('外駐增援');expect(army).toContain('駐防中');expect(army).not.toContain('⚔');
});

it('uses the same relationship colors and readable empire hue in city information',()=>{
  const g=newGame('civ_zhongguo',296,1,0),home=node(g,faction(g,g.player).capital),other=g.factions.find(f=>f.id!==g.player)!,town=node(g,other.capital);
  const me=faction(g,g.player);me.league=me.id;me.empire='direct';me.empireId=me.id;other.league=me.id;
  expect(mapRelation(g,town)).toBe('league');expect(mapColors.alliance).toBe(mapColors.league);
  const friendly=renderToStaticMarkup(<Target g={g} n={town} home={home} onMission={()=>{}} onCity={()=>{}}/>);
  expect(friendly).toContain('關係');expect(friendly).toContain('友好');expect(friendly).toContain(mapColors.league);
  expect(friendly).toContain(empireUiColor(g,me.id));
  expect(empireTerritoryColor(g,me.id)).toMatch(/^hsl\(/);
  other.league=null;g.treaties.push({a:g.player,b:other.id,kind:'war',until:10*HOUR});
  expect(relationship(mapRelation(g,town))).toBe('敵對');expect(relationshipColor(mapRelation(g,town))).toBe(mapColors.war);
});

it('keeps historical battle affiliations and clock only entries through save validation',()=>{
  const g=newGame('civ_zhongguo',297,1,0),me=faction(g,g.player),other=g.factions.find(f=>f.id!==g.player)!,from=node(g,me.capital),to=node(g,other.capital);
  g.events=[];g.sandbox=true;me.league=me.id;me.leagueName='白鶴軍團';me.empire='direct';me.empireId=me.id;me.empireName='白鶴帝國';
  other.league=other.id;other.leagueName='赤獅軍團';other.empire='direct';other.empireId=other.id;other.empireName='赤獅帝國';other.protectionUntil=0;to.troops=emptyTroops();from.troops.spear=80;
  expect(command(g,{type:'march',from:from.id,to:to.id,kind:'raid',troops:{...emptyTroops(),spear:60}})).toBe('');
  advance(g,g.marches[0].at);
  const report=g.reports.find(r=>r.kind==='battle'&&r.owner===g.player)!;
  expect(report.battleSides?.attacker.league).toBe('白鶴軍團');expect(report.battleSides?.defender.empire).toBe('赤獅帝國');
  other.empireName='改名後帝國';
  const saved=decode({...envelope(g),reports:g.reports,reportChecksum:checksum(g.reports)});
  expect(saved.reports.find(r=>r.id===report.id)?.battleSides?.defender.empire).toBe('赤獅帝國');
  expect(validate({...g,reports:[report]}).reports[0].battleSides).toEqual(report.battleSides);
  const html=renderToStaticMarkup(<ReportsView g={g} onNode={()=>{}} reportAction={()=>{}} requestReports={()=>{}} reportEpoch={0} reportPage={{campaign:g.campaign,filter:'all',page:0,data:{rows:[report],count:1,unread:0,counts:{all:1,battle:1,diplomacy:0,chronicle:0}}}} busy={false}/>);
  expect(html).toContain('白鶴軍團');expect(html).toContain('赤獅帝國');expect(html).not.toContain('改名後帝國');
  expect(reportEntryTime(Date.UTC(2026,8,29,8,55),0)).toMatch(/^\d{2}:\d{2}$/);
  expect(reportEntryTime(undefined,8*HOUR+55*MINUTE)).toBe('8時 55分');
});

it('scouts nearby enemy cities while at war before an ordinary wild site',()=>{
  const g=newGame('civ_zhongguo',298,1,0),me=faction(g,g.player),other=g.factions.find(f=>f.id!==g.player)!,cap=node(g,me.capital),enemy=node(g,other.capital);
  g.events=[];g.sandbox=true;g.time=5*HOUR;me.era=1;me.protectionUntil=0;other.protectionUntil=0;g.protectionUntil=0;
  cap.troops.scout=2;enemy.x=Math.min(255,cap.x+8);enemy.y=cap.y;
  g.treaties.push({a:g.player,b:other.id,kind:'war',until:10*HOUR});
  me.intel={};aiStep(g,g.player);
  expect(g.marches.find(m=>m.owner===g.player&&m.kind==='scout')?.to).toBe(enemy.id);
});
