import {it,expect} from 'vitest';
import {newGame} from './world';
import {command,owned,buildCost} from './engine';
import {buildInfluence} from './influence';

it('cancels only a waiting construction, refunds its city and reschedules later events',()=>{
 const g=newGame('civ_zhongguo',902,1,0),n=owned(g,g.player)[0];g.events=[];g.sandbox=true;n.stock={food:10000,wood:10000,stone:10000,gold:10000};
 for(const [b,p] of [['farm',17],['lumber',23],['quarry',27]] as const)expect(command(g,{type:'build',city:n.id,building:b,plot:p})).toBe('');
 const [first,middle,last]=n.build,refund=buildCost(n,'lumber',23),before={...n.stock},end=last.at;
 expect(command(g,{type:'cancel_build',city:n.id,job:first.id})).toContain('施工中');
 expect(command(g,{type:'cancel_build',city:n.id,job:middle.id})).toBe('');
 expect(n.build.map(j=>j.id)).toEqual([first.id,last.id]);
 expect(last.at).toBe(end-(middle.at-first.at));
 expect(g.events.find(e=>e.id===last.id)?.at).toBe(last.at);
 expect(g.events.some(e=>e.id===middle.id)).toBe(false);
 for(const r of ['food','wood','stone','gold'] as const)expect(n.stock[r]).toBe(before[r]+refund[r]);
});
it('territory joins nearby same-empire cities without coloring a rival city',()=>{
 const g=newGame('civ_zhongguo',902,1,0),a=owned(g,g.player)[0];g.factions.find(f=>f.id===g.player)!.empire='direct';
 const b=structuredClone(a);b.id='nearby';b.x=a.x+19;b.y=a.y;g.nodes.push(b);
 const influence=buildInfluence(g);expect(influence.cells.some(c=>c.owner===g.player&&Math.hypot(c.x-a.x,c.y-a.y)>8&&Math.hypot(c.x-b.x,c.y-b.y)>8)).toBe(true);
});
