import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {newGame} from './world';
import {ReportsView,battlePresentation} from './ReportsView';
import {validate} from './persistence';
import {emptyTroops,type Report} from './types';

it('shows wild site name and original battle coordinates after the site moves',()=>{
  const g=newGame('civ_zhongguo',902,1,0),site=g.nodes.find(n=>n.npcResource==='wood')!;
  const report:Report={id:900,at:0,owner:g.player,node:site.id,kind:'battle',title:'山林木寨 Lv.1 · 攻方勝利',text:'村上宗久 攻擊 中立。地形：森林。',location:{x:222,y:195},before:{...emptyTroops(),militia:12},after:{...emptyTroops(),militia:11},enemyBefore:{...emptyTroops(),militia:4},enemyAfter:emptyTroops()};
  expect(validate({...g,reports:[report]}).reports[0].location).toEqual({x:222,y:195});
  site.x=18;site.y=31;site.generation=1;
  expect(battlePresentation(report,site).heading).toBe('村上宗久 攻擊 山林木寨 Lv1 (222, 195)');
  const html=renderToStaticMarkup(<ReportsView g={g} onNode={()=>{}} reportAction={()=>{}} requestReports={()=>{}} reportEpoch={0} reportPage={{campaign:g.campaign,filter:'all',page:0,data:{rows:[report],count:1,unread:0,counts:{all:1,battle:1,diplomacy:0,chronicle:0}}}} busy={false}/>);
  expect(html.replace(/<[^>]*>/g,'')).toContain('村上宗久 攻擊 山林木寨 Lv1 (222, 195)');
  expect(html).toContain('class="battle-attacker">村上宗久</span>');
  expect(html).toContain('class="battle-defender">山林木寨 Lv1</span>');
  expect(html).toContain('class="battle-details-collapsed">展開</span>');
  expect(html).not.toContain('攻擊 中立');
  expect(html).toContain('12／1');
  expect(html).not.toContain('前往 '+site.name);
  expect(battlePresentation({...report,location:undefined},site).heading).toBe('村上宗久 攻擊 山林木寨 Lv1');
  const players=battlePresentation({...report,text:'戈弗雷·德雷 攻擊 村上宗久。'},g.nodes.find(n=>n.kind==='capital'));
  expect(players.attacker).toBe('戈弗雷·德雷');
  expect(players.defender).toBe('村上宗久');
});
