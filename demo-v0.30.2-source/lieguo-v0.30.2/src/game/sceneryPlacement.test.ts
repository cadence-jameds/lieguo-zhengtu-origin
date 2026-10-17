import {expect,it} from 'vitest';
import {decorationsAt,sceneryNodeKey} from './sceneryPlacement';

import {waterAt,regionalTerrainAt,mountainFootprint,mountainSprites,setMountainClearings} from './terrainRegions';
import {landCoverName} from './landCover';
import {newGame} from './world';

it('同種子重現景物與三種陸地，不同種子產生不同配置',()=>{
 const sample=(seed:number)=>{const result=[];for(let y=12;y<240;y+=14)for(let x=12;x<240;x+=14)result.push({cover:landCoverName(x,y,seed,1),items:decorationsAt(x,y,seed,1)});return result;};
 const a=sample(902),b=sample(903);expect(a).not.toEqual(b);expect(sample(902)).toEqual(a);
 const covers=new Set(a.map(p=>p.cover));for(const name of ['草原','荒原','石塊地'])expect(covers.has(name)).toBe(true);
 const trees=a.flatMap(p=>p.items).filter(p=>p.kind==='tree');expect(new Set(trees.map(p=>p.variant)).size).toBeGreaterThan(5);expect(new Set(trees.map(p=>p.width)).size).toBeGreaterThan(8);
});
it('實際山體覆蓋的格子全部不可通行，水面不會被山體覆蓋',()=>{
 let count=0;for(const seed of [1,902,21721]){setMountainClearings(seed,[]);for(const d of mountainSprites(seed,1)){
  count++;for(const p of mountainFootprint(d)){expect(waterAt(p.x,p.y,seed,1)).toBe(false);expect(regionalTerrainAt(p.x,p.y,seed,1)).toBe('mountain');}
 }}expect(count).toBeGreaterThan(20);
});
it('野外據點增減及冷卻不改變背景快取，城市位置變更才失效',()=>{
 const n={id:'wild_test',kind:'camp' as const,x:70,y:70},before=structuredClone(decorationsAt(70,70,902,1));
 expect(sceneryNodeKey([n])).toBe(sceneryNodeKey([{...n,respawnAt:100}]));
 expect(sceneryNodeKey([n])).toBe(sceneryNodeKey([{...n,x:72}]));
 expect(sceneryNodeKey([n])).toBe(sceneryNodeKey([]));expect(decorationsAt(70,70,902,1)).toEqual(before);
 expect(sceneryNodeKey([{...n,kind:'capital'}])).not.toBe(sceneryNodeKey([]));
});
it('玩家與 AI 起始位置由種子決定，且避開山脈與水域',()=>{
 const a=newGame('civ_byzantion',902,1,0),b=newGame('civ_byzantion',902,1,0),c=newGame('civ_byzantion',903,1,0);
 const homes=(g:typeof a)=>g.factions.map(f=>g.nodes.find(n=>n.id===f.capital)!);
 const coords=(g:typeof a)=>homes(g).map(n=>[n.x,n.y]);expect(coords(a)).toEqual(coords(b));expect(coords(a)).not.toEqual(coords(c));
 for(const g of [a,c])for(const n of homes(g))expect(['water','mountain']).not.toContain(regionalTerrainAt(n.x,n.y,g.seed,g.terrainVersion));
});
