import {expect,it} from 'vitest';
import {newGame} from './world';
import {appendMessage,importantMessage,messageBucket} from './messages';
import {production,productionDetail} from './engine';
import {resources} from './types';

it('repeated city and wild production retains the values shown in resource details',()=>{
 const g=newGame('civ_britannia',9381,6,0);
 const n=g.nodes.find(n=>n.owner===g.player)!;
 n.integration=62;n.policy='industry';n.plots.find(p=>p.building==='farm')!.level=2;
 n.plots.find(p=>p.building==='lumber')!.level=3;
 g.factions.find(f=>f.id===g.player)!.tech.push('carpentry','agriculture');
 const ledger=new Map([[n.id,41]]),result=production(g,n,ledger);
 for(const r of resources)expect(result[r]).toBeCloseTo(productionDetail(g,n,r,ledger).total,8);
});

it('long battle history remains available without trimming ordinary reports',()=>{
 const g=newGame('civ_zhongguo',19,1,0);g.reports=[];
 const owner=g.player;
 for(let i=0;i<300;i++)appendMessage(g,{owner,kind:'battle',title:'交戰 '+i,text:''});
 const promoted=g.reports[0];promoted.important=true;
 for(let i=300;i<312;i++)appendMessage(g,{owner,kind:'battle',title:'交戰 '+i,text:''});
 const ordinary=g.reports.filter(r=>r.owner===owner&&!importantMessage(r)&&messageBucket(r)==='battle');
 expect(ordinary).toHaveLength(311);
 expect(g.reports).toContain(promoted);
 expect(ordinary[0].title).toBe('交戰 1');
 expect(ordinary.at(-1)?.title).toBe('交戰 311');
});
