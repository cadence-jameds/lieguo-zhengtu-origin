import { describe, it, expect } from 'vitest';
import { newGame, terrainAt } from './legacyWorld';
import { advance, command, faction, node, marchDuration, production, buildCost, buildDuration, trainCost } from './legacyEngine';
import { emptyTroops, MINUTE, HOUR, type Game } from './legacyTypes';
import { PROTECTION } from './content';
import { roadNetwork, secondsPerTile, travelRoute } from './travel';
import { mapRelation } from './mapRelations';
import { makePlots } from './city';

const setup=()=>{const g=newGame('civ_japan',70910,1,0);g.events=g.events.filter(e=>e.type==='pulse');g.sandbox=true;return g;};
const home=(g:Game)=>node(g,faction(g,g.player).capital);
describe('v0.7 共用規則與數值',()=>{
  it('保護在接戰时再次檢查，舊在途軍隊不能穿透護罩',()=>{
    const g=setup(),n=home(g),ai=g.factions.find(f=>f.id!==g.player)!,target=node(g,ai.capital);ai.protectionUntil=0;
    expect(command(g,{type:'march',from:n.id,to:target.id,kind:'scout',troops:{...emptyTroops(),scout:1}})).toBe('');
    ai.protectionUntil=PROTECTION;const m=g.marches[0];advance(g,m.at);
    expect(m.status).toBe('returning');expect(faction(g,g.player).intel[target.id]).toBeUndefined();
  });
  it('外交配色按首都、己城、軍團、盟友、戰爭與中立排序',()=>{
    const g=setup(),n=home(g),me=faction(g,g.player),a=g.factions.find(f=>f.id!==g.player)!,other=node(g,a.capital);
    expect(mapRelation(g,n)).toBe('capital');expect(mapRelation(g,{...other,owner:g.player})).toBe('own');expect(mapRelation(g,other)).toBe('neutral');
    g.treaties.push({a:g.player,b:a.id,kind:'war',until:100*HOUR});expect(mapRelation(g,other)).toBe('war');
    g.treaties[0].kind='alliance';expect(mapRelation(g,other)).toBe('alliance');me.league=a.league=me.id;expect(mapRelation(g,other)).toBe('league');
  });
  it('同一格距不因首都身分延後；鄰格可少於五分鐘，混編隨慢兵',()=>{
    const g=setup(),n=home(g),next={...n,id:'preview',x:n.x+1};
    const foot=marchDuration(g,n,next,{...emptyTroops(),militia:1},'raid');
    expect(foot).toBeGreaterThan(0);expect(foot).toBeLessThan(5*MINUTE);
    expect(marchDuration(g,n,{...next,kind:'village'},{...emptyTroops(),militia:1},'raid')).toBe(foot);
    expect(marchDuration(g,n,next,{...emptyTroops(),militia:1,cavalry:1},'raid')).toBe(foot);
    expect(marchDuration(g,n,next,{...emptyTroops(),scout:1},'scout')).toBeLessThan(foot);
    expect(secondsPerTile(10000)*10000).toBe(secondsPerTile(256)*256);
  });
  it('市場道路真正減少行軍時間，鋪面升級更快；畫線與計時共用網路',()=>{
    const g=setup(),n=home(g),town=g.nodes.find(n=>n.kind==='ruins')!;town.owner=g.player;town.kind='village';town.x=n.x+8;town.y=n.y;
    const army={...emptyTroops(),militia:10},before=marchDuration(g,n,town,army,'reinforce');
    n.buildings.market=town.buildings.market=1;expect(roadNetwork(g).lines).toHaveLength(1);
    const road=marchDuration(g,n,town,army,'reinforce');expect(road).toBeCloseTo(before/1.5,-1);
    const me=faction(g,g.player);me.era=2;me.tech.push('logistics');const paved=marchDuration(g,n,town,army,'reinforce');expect(paved).toBeLessThan(road);
    expect(roadNetwork(g).lines[0].path).toEqual(travelRoute(g,n,town).path);
    const reverse=marchDuration(g,town,n,army,'reinforce');expect(reverse).toBeGreaterThan(0);
    const sum=travelRoute(g,town,n).path.slice(1).reduce((s,p)=>s+({grass:1,field:1,forest:1.4,hill:1.7,water:2.2,mountain:3.5}[terrainAt(p.x,p.y,g.seed)]),0);
    expect(reverse).toBeCloseTo(sum*15_000/2*.85,-1);
  });
  it('資源升級成本、工期及增量連續遞增；增加第二座不影響首座',()=>{
    const g=setup(),n=home(g);let time=0,cost=0,rate=0;
    for(let level=0;level<5;level++){n.buildings.lumber=level;n.plots=makePlots(n.buildings);const currentTime=buildDuration(n,'lumber'),currentCost=buildCost(n,'lumber').wood;
      expect(currentTime).toBeGreaterThan(time);expect(currentCost).toBeGreaterThan(cost);
      if(level>0){expect(production(g,n).wood).toBeGreaterThan(rate);rate=production(g,n).wood;}time=currentTime;cost=currentCost;
    }
    expect(time).toBe(45*MINUTE);expect(trainCost(g,n,'militia',10)).toEqual({food:140,wood:80,stone:0,gold:0});
  });
});
