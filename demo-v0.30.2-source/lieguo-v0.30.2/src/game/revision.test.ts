import {describe,it,expect} from 'vitest';
import {newGame} from './world';
import {command,advance,node,faction,governorStep,buildDuration} from './engine';
import {knownOwner,observed} from './intelligence';
import {stateHash} from './persistence';
import {MINUTE,HOUR} from './types';
const setup=()=>{const g=newGame('civ_zhongguo',90217,1,0);g.events=g.events.filter(e=>e.type!=='ai');return g;};
const home=(g:ReturnType<typeof setup>)=>node(g,faction(g,g.player).capital);
describe('開局、總督與情報修訂',()=>{
 it('工期前快後慢，命令與顯示共用同一計算',()=>{const g=setup(),n=home(g);const times:number[]=[];for(let i=0;i<5;i++){n.buildings.farm=i;n.plots[1].building=i?'farm':null;n.plots[1].level=i;times.push(buildDuration(n,'farm',1));}expect(times[0]).toBe(30000);expect(times[1]).toBe(120000);expect(times.every((t,i)=>!i||t>times[i-1])).toBe(true);});
 it('低黃金不會擋住不花黃金的資源工程，零預算不偷建',()=>{const g=setup(),n=home(g);n.stock.gold=0;Object.assign(n.governor,{enabled:true,budget:0,reserve:100});governorStep(g,n);expect(n.build).toHaveLength(0);n.governor.budget=1500;governorStep(g,n);expect(n.build.length).toBeGreaterThan(0);expect(n.stock.gold).toBe(0);});
 it('敵方歸屬公開更新，駐軍只讀偵察快照',()=>{const g=setup(),enemy=g.nodes.find(n=>n.owner&&n.owner!==g.player)!;expect(knownOwner(g,enemy)).toBe(enemy.owner);expect(observed(g,enemy)).toBeUndefined();faction(g,g.player).intel[enemy.id]={at:1,owner:enemy.owner,wall:0,troops:{...enemy.troops}};const seen=observed(g,enemy)!.troops.militia;enemy.owner=null;enemy.troops.militia+=20;expect(knownOwner(g,enemy)).toBeNull();expect(observed(g,enemy)!.troops.militia).toBe(seen);});
 it('離線整段追算與分段含總督仍相同',()=>{const g=setup(),n=home(g);command(g,{type:'governor',cities:[n.id],enabled:true,policy:'balanced',budget:1500,reserve:100});const b=structuredClone(g);advance(g,6*HOUR);for(let i=1;i<=36;i++)advance(b,i*10*MINUTE);expect(stateHash(b)).toBe(stateHash(g));});
});
