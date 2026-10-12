import {describe,it,expect} from 'vitest';
import {newGame} from './legacyWorld';
import {cultureId} from '../content/civilizations';
import {command,faction,relation} from './legacyEngine';
import {validate} from './legacyPersistence';
const fresh=()=>{const g=newGame('civ_zhongguo',8123,1,0);g.events=g.events.filter(e=>e.type!=='ai');return g;};
describe('獨立領主、城市經濟與舊存檔',()=>{
 it('跨文明軍團保留領土、禁止內戰，退出後解除軍團关系',()=>{const g=fresh(),me=faction(g,g.player),other=g.factions.find(f=>cultureId(f.id)!==cultureId(me.id))!;other.era=1;const owners=g.nodes.map(n=>n.owner);expect(command(g,{type:'league',action:'create'},other.id)).toBe('');expect(command(g,{type:'league',action:'join',target:other.id})).toBe('');expect(relation(g,me.id,other.id)).toBe('alliance');expect(command(g,{type:'diplomacy',target:other.id,action:'war'})).not.toBe('');expect(g.nodes.map(n=>n.owner)).toEqual(owners);expect(command(g,{type:'league',action:'leave'})).toBe('');expect(me.league).toBeNull();validate(g);});
 it('自治帝國必須有八城與三成員，稱帝不合併土地或立即勝利',()=>{const g=fresh(),me=faction(g,g.player);me.era=2;for(const f of g.factions.slice(0,3))f.league=me.id;expect(command(g,{type:'empire',mode:'federal'})).not.toBe('');for(const n of g.nodes.filter(n=>n.kind==='ruins').slice(0,5)){n.kind='village';n.owner=g.factions[1].id;}const owners=g.nodes.map(n=>n.owner);expect(command(g,{type:'empire',mode:'federal'})).toBe('');expect(g.nodes.map(n=>n.owner)).toEqual(owners);expect(g.result).toBeNull();validate(g);});
});
