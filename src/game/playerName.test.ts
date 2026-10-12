import {it,expect} from 'vitest';
import {newGame} from './legacyWorld';
import {command,factionName} from './legacyEngine';
import {exportSave,importSave} from './legacyPersistence';
it('allows repeat renames and preserves identity and names through save roundtrip',()=>{
 const g=newGame('civ_zhongguo',1,1,0),id=g.player,stock=JSON.stringify(g.nodes.map(n=>n.stock));
 for(const name of ['河谷領主','領主 123','新的名字']){expect(command(g,{type:'rename',name})).toBe('');expect(factionName(g,id)).toBe(name);}
 expect(g.player).toBe(id);expect(JSON.stringify(g.nodes.map(n=>n.stock))).toBe(stock);
 expect(factionName(importSave(exportSave(g)),id)).toBe('新的名字');
 expect(command(g,{type:'rename',name:'   '})).not.toBe('');expect(factionName(g,id)).toBe('新的名字');
});
