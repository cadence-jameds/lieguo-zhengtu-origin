import {establishedGame} from './testEstablished';
import { describe,it,expect } from 'vitest';
import { civilizations } from '../content/civilizations';
import { legacyGame as newGame,distance } from './world';
import { advance,armyTotal,buildCost,checkVictory,command,faction,node,trainCost } from './engine';
import { stateHash,validate } from './persistence';
import { HEGEMONY_HOLD } from './content';
import { HOUR,MINUTE,emptyStock,emptyTroops,resources,type Game } from './types';
const player=civilizations[0].id;
const fresh=()=>establishedGame(player,20260906,120,0);
const cap=(g:Game)=>node(g,faction(g,g.player).capital);
const quiet=(g:Game)=>{g.events=g.events.filter(e=>e.type!=='ai');};
const succeed=(g:Game,c:Parameters<typeof command>[1],owner=g.player)=>expect(command(g,c,owner)).toBe('');
describe('河谷戰役的可玩循環',()=>{
  it('建立六文明、96 個獨立據點，且各出生地都有資源與盜賊',()=>{
    for(const civ of civilizations){const g=newGame(civ.id,20260906,120,0);expect(g.nodes).toHaveLength(96);expect(new Set(g.nodes.map(n=>n.x+','+n.y)).size).toBe(96);expect(g.nodes.every(n=>n.x>=0&&n.x<256&&n.y>=0&&n.y<256)).toBe(true);expect(g.nodes.some(n=>n.kind==='camp'&&distance(n,cap(g))<48)).toBe(true);validate(g);}
    expect(stateHash(fresh())).toBe(stateHash(fresh()));
  });
  it('建造與招募各自扣料、獨立結算，無法超領駐軍',()=>{
    const g=fresh();quiet(g);const n=cap(g),before={...n.stock},build=buildCost(n,'farm'),train=trainCost(g,n,'spear',20);
    succeed(g,{type:'build',city:n.id,building:'farm'});succeed(g,{type:'train',city:n.id,unit:'spear',count:20});
    for(const r of resources)expect(n.stock[r]).toBe(before[r]-build[r]-train[r]);
    expect(n.troops.spear).toBe(4);advance(g,2*HOUR);expect(n.buildings.farm).toBe(2);expect(n.troops.spear).toBe(24);expect(n.build).toHaveLength(0);validate(g);
    const other=g.nodes.find(x=>x.owner===null)!;expect(command(g,{type:'march',from:n.id,to:other.id,kind:'raid',troops:{...emptyTroops(),spear:25}})).not.toBe('');
  });
  it('佔領留下原本的存活部隊，運輸實際扣除出發城市庫存',()=>{
    const g=fresh();quiet(g);const n=cap(g),target=g.nodes.find(x=>x.owner!==player&&x.kind==='village'&&distance(x,n)<48)!;
    succeed(g,{type:'train',city:n.id,unit:'spear',count:25});succeed(g,{type:'build',city:n.id,building:'market'});advance(g,HOUR);
    const all=armyTotal(g,player);succeed(g,{type:'march',from:n.id,to:target.id,kind:'occupy',troops:{...emptyTroops(),spear:25}});expect(armyTotal(g,player)).toBe(all);
    advance(g,g.marches[0].at);expect(target.owner).toBe(player);expect(armyTotal(g,player)).toBeLessThanOrEqual(all);expect(g.marches).toHaveLength(0);
    const stock=n.stock.wood,received=target.stock.wood;succeed(g,{type:'march',from:n.id,to:target.id,kind:'transport',troops:emptyTroops(),cargo:{...emptyStock(),wood:200}});
    expect(n.stock.wood).toBe(stock-200);expect(target.stock.wood).toBe(received);
    const arrival=g.marches[0].at;advance(g,arrival);expect(target.stock.wood).toBeGreaterThanOrEqual(received+200);validate(g);
  });
  it('行軍撤退不能重複產生士兵或觸發舊抵達事件',()=>{
    const g=fresh();quiet(g);const n=cap(g),camp=g.nodes.find(x=>x.kind==='camp')!,before=armyTotal(g,player);
    succeed(g,{type:'march',from:n.id,to:camp.id,kind:'raid',troops:{...emptyTroops(),militia:12}});const m=g.marches[0];
    advance(g,MINUTE);succeed(g,{type:'retreat',march:m.id});advance(g,4*HOUR);
    expect(g.marches).toHaveLength(0);expect(armyTotal(g,player)).toBe(before);expect(g.reports.some(r=>r.kind==='battle')).toBe(false);validate(g);
  });
  it('霸權任一條件失去即重設，再次成立需完整倒數',()=>{
    const g=fresh();quiet(g);const candidates=g.nodes.filter(n=>n.kind==='village').slice(0,30);
    for(const n of candidates){n.owner=player;n.population=2000;n.troops.spear=100;}
    checkVictory(g);expect(g.hegemony?.owner).toBe(player);g.time=HOUR;
    for(const n of candidates.slice(0,3))n.integration=30;checkVictory(g);expect(g.hegemony).toBeNull();
    for(const n of candidates)n.integration=100;checkVictory(g);expect(g.hegemony?.since).toBe(HOUR);
    g.time=HOUR+HEGEMONY_HOLD;checkVictory(g);expect(g.result?.kind).toBe('hegemony');
  });
});
