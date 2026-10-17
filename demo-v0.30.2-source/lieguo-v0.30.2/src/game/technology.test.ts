import {describe,it,expect} from 'vitest';
import {establishedGame} from './testEstablished';
import {command,advance,faction,node,researchReason,production} from './engine';
import {validate,exportSave,importSave} from './persistence';
const ready=()=>{const g=establishedGame('civ_zhongguo',42,1,0);g.events=g.events.filter(e=>e.type!=='ai');const f=faction(g,g.player),n=node(g,f.capital);n.stock={food:2000,wood:2000,stone:2000,gold:2000};return {g,f,n};};
describe('科技樹與時代晉升',()=>{
 it('基礎科技由對應建築研究，完成後增加實際產量並可保存',()=>{const {g,f,n}=ready();const before=production(g,n).wood;expect(researchReason(g,n,'carpentry')).toBe('');expect(command(g,{type:'research',city:n.id,research:'carpentry'})).toBe('');advance(g,f.research!.at);expect(production(g,n).wood).toBeCloseTo(before*1.1);expect(importSave(exportSave(g)).factions.find(a=>a.id===g.player)!.tech).toContain('carpentry');validate(g);});
 it('前置科技與本城建築都不能跳過',()=>{const {g,f,n}=ready();f.era=1;expect(researchReason(g,n,'logistics')).toContain('市場');n.buildings.market=1;expect(researchReason(g,n,'logistics')).toContain('木工');f.tech.push('carpentry');expect(researchReason(g,n,'logistics')).toBe('');f.tech.push('forging');n.buildings.barracks=2;expect(researchReason(g,n,'steel')).toContain('城堡');f.era=2;expect(researchReason(g,n,'steel')).toBe('');});
});
