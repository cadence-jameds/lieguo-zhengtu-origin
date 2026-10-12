import { describe,it,expect } from 'vitest';
import { newGame } from './legacyWorld';
import { advance,checkVictory,command,faction,node,overlord,protectedFaction,relation } from './legacyEngine';
import { emptyTroops,HOUR,countTroops } from './legacyTypes';
import { needsProtectionConsent } from './Mission';
import { resetSite,siteLevel,siteName,siteStock,siteTroops } from './npc';
import { exportSave,importSave,validate } from './legacyPersistence';
const setup=()=>{const g=newGame('civ_zhongguo',20260909,1,0);g.sandbox=true;g.events=g.events.filter(e=>e.type==='pulse');return g;};
const home=(g:ReturnType<typeof setup>)=>node(g,faction(g,g.player).capital);
describe('十項批次更新的遊戲規則',()=>{
  it('保護中的敵對命令才需確認，到期或已解除立即消失，中立目標不需要',()=>{
    const g=setup(),enemy=node(g,g.factions[1].capital),camp=g.nodes.find(n=>n.kind==='camp')!;
    for(const kind of ['scout','raid','occupy'] as const)expect(needsProtectionConsent(g,enemy,kind)).toBe(true);
    expect(needsProtectionConsent(g,camp,'raid')).toBe(false);expect(needsProtectionConsent(g,home(g),'reinforce')).toBe(false);
    g.time=g.protectionUntil;expect(needsProtectionConsent(g,enemy,'raid')).toBe(false);expect(protectedFaction(g,g.player)).toBe(false);
    g.time=0;faction(g,enemy.owner!).protectionUntil=0;expect(command(g,{type:'march',from:home(g).id,to:enemy.id,kind:'scout',troops:{...emptyTroops(),scout:1}})).toBe('');
    expect(needsProtectionConsent(g,enemy,'scout')).toBe(false);expect(protectedFaction(g,g.player)).toBe(false);
  });
  it('十級守軍及資源嚴格遞增，名稱保留據點種類且不含流水號',()=>{
    const g=setup(),n=g.nodes.find(n=>n.npcResource==='stone')!;let force=0,loot=0;
    for(let level=1;level<=10;level++){resetSite(n,level);expect(n.name).toBe('採石場 Lv.'+level);expect(countTroops(siteTroops(n))).toBeGreaterThan(force);expect(Object.values(siteStock(n)).reduce((a,b)=>a+b,0)).toBeGreaterThan(loot);force=countTroops(n.troops);loot=Object.values(n.stock).reduce((a,b)=>a+b,0);}
    expect(new Set(g.nodes.filter(n=>n.npcLevel).map(siteLevel)).size).toBe(10);
    expect(siteName(n)).toBe('採石場 Lv.10');expect(importSave(exportSave(g)).nodes.find(a=>a.id===n.id)?.npcLevel).toBe(10);
  });
  it('舊戰役更新保留已在途的野外遭遇與部隊，後续重生按等級配置',()=>{
    const g=setup(),n=home(g),camp=g.nodes.find(n=>n.kind==='camp')!;expect(command(g,{type:'march',from:n.id,to:camp.id,kind:'scout',troops:{...emptyTroops(),scout:1}})).toBe('');
    for(const c of g.nodes)delete c.npcLevel;for(const r of g.reports)delete r.read;delete faction(g,g.player).objectives;
    const troops={...camp.troops},stock={...camp.stock},marches=structuredClone(g.marches),saved=importSave(exportSave(g));
    expect(saved.marches).toEqual(marches);expect(node(saved,camp.id).troops).toEqual(troops);expect(node(saved,camp.id).stock).toEqual(stock);
    expect(saved.nodes.every(n=>!['camp','iron','horses'].includes(n.kind)||n.npcLevel!==undefined)).toBe(true);
    const respawn=node(saved,camp.id);respawn.respawnAt=6*HOUR;respawn.troops=emptyTroops();respawn.stock={food:0,wood:0,stone:0,gold:0};advance(saved,6*HOUR);
    expect(respawn.troops).toEqual(siteTroops(respawn));expect(respawn.stock).toEqual(siteStock(respawn));validate(saved);
  });
  it('附庸的附庸計入征服，保留土地並禁止內戰',()=>{
    const g=setup(),[a,b,c]=g.factions;g.sandbox=false;b.vassal=a.id;c.vassal=b.id;for(const f of g.factions.slice(3))f.vassal=a.id;
    const owners=g.nodes.map(n=>n.owner);expect(overlord(g,c.id)).toBe(a.id);expect(relation(g,a.id,c.id)).toBe('vassal');checkVictory(g);expect(g.result?.winner).toBe(a.id);expect(g.result?.kind).toBe('conquest');expect(g.nodes.map(n=>n.owner)).toEqual(owners);
  });
});
