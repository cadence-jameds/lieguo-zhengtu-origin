import type {FormalReport} from './model';
import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {battlefield,dispatch} from './combatTestSupport';
import {advanceFormal} from './reducer';
import {buildable,terrainAt} from './terrain';
import {spatial,invalidateSpatial} from './spatial';
import {route} from './routing';
it('12 concurrent real battles keep per-BattleId bounded history and one final report each',()=>{
 let w=battlefield();const home=w.cities[0],occupied=spatial(w),claimed=new Set<string>();let moved=0;
 for(let dy=-8;dy<=8&&moved<12;dy++)for(let dx=-8;dx<=8&&moved<12;dx++){const x=home.x+dx,y=home.y+dy,key=x+','+y;if(!buildable(terrainAt(w,x,y))||occupied.at(x,y).city||occupied.at(x,y).site||claimed.has(key))continue;try{route(w,home,{x,y});}catch{continue;}claimed.add(key);const c=w.cities[++moved];c.x=x;c.y=y;c.wallLevel=15;c.military!.units={};}
 expect(moved).toBe(12);invalidateSpatial(w);w.cities[0].military!.units={militia:12,ram:12};for(let target=1;target<=12;target++)w=dispatch(w,'conquest',{militia:1,ram:1},0,target).world;
 const first=advanceFormal(w,Math.max(...w.armies.map(a=>a.arrivalAt!)));w=first.world;expect(first.reports).toHaveLength(0);expect(w.combat!.battles).toHaveLength(12);const reports:FormalReport[]=[];
 while(w.combat!.battles.length){expect(w.combat!.battles.every(b=>b.history!.length<=64&&b.siegeHistory!.length<=12)).toBe(true);const t=advanceFormal(w,Math.min(...w.combat!.battles.map(b=>b.nextRoundAt)));w=t.world;reports.push(...t.reports);}
 expect(reports).toHaveLength(12);expect(new Set(reports.map(r=>r.battle!.battleId)).size).toBe(12);expect(reports.every(r=>r.battle!.siegeRounds===12&&r.battle!.conquestReason==='siege-timeout')).toBe(true);expect(w.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(12);mkdirSync('docs/b5-v91',{recursive:true});writeFileSync('docs/b5-v91/concurrent-battles.json',JSON.stringify({concurrent:12,reportCount:reports.length,receiptCount:w.combat!.receipts.length,finals:reports.map(r=>({battleId:r.battle!.battleId,siegeRounds:r.battle!.siegeRounds,history:r.battle!.history!.length,reason:r.battle!.conquestReason}))},null,2));
},60000);
