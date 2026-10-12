import {expect,it} from 'vitest';
import {newGame} from './legacyWorld';
import {appendMessage} from './messages';
import {terrainChunks} from './terrainCache';
import {HOUR} from './legacyTypes';

it('combines city work and caravan cargo from separate cities in one hourly report',()=>{
 const g=newGame('civ_zhongguo',17,1,0),first=g.nodes.find(n=>n.owner===g.player)!;
 const second={...first,id:'second-city',name:'新城',x:first.x+10,y:first.y+10};
 g.nodes.push(second);g.reports=[];g.reportUnread=0;g.time=HOUR*3+1;
 appendMessage(g,{owner:g.player,node:first.id,kind:'economy',title:'工程完成 · 民居',text:'民居提升至 2 級。'});
 appendMessage(g,{owner:g.player,node:second.id,kind:'economy',title:'總督募兵 · 弓兵',text:'招募 10 名。'});
 appendMessage(g,{owner:g.player,node:second.id,kind:'economy',title:'商隊抵達 '+second.name,text:'由 '+first.name+' 送達；石材 4 因滿倉返程。',loot:{food:16,wood:0,stone:0,gold:0}});
 expect(g.reports).toHaveLength(1);
 expect(g.reportUnread).toBe(1);
 expect(g.reports[0].entries?.map(e=>e.city)).toEqual([first.name,second.name,second.name]);
 expect(g.reports[0].entries?.[2]).toMatchObject({category:'trade',at:g.time});
 expect(g.reports[0].entries?.[2].text).toContain('糧 16');
 expect(g.reports[0].entries?.[2].text).toContain('石材 4');
 appendMessage(g,{owner:g.player,node:first.id,kind:'battle',title:'交戰',text:'守城成功'});
 expect(g.reports).toHaveLength(2);
 g.time+=HOUR;
 appendMessage(g,{owner:g.player,node:second.id,kind:'economy',title:'工程完成 · 民居',text:'民居提升至 3 級。'});
 expect(g.reports).toHaveLength(3);
});

it('renders terrain up to 50 cells beyond the playable world',()=>{
 const near=terrainChunks(0,0,.75,1440,900);
 expect(near.length).toBeGreaterThan(0);
 expect(near.every(p=>p.x>=-64&&p.x<=304&&p.y>=-64&&p.y<=304)).toBe(true);
 expect(terrainChunks(0,-1000,.75,1440,900).some(p=>p.x<0&&p.y<0)).toBe(true);
 expect(terrainChunks(100000,100000,.75,1440,900)).toHaveLength(0);
});
