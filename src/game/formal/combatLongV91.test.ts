import {afterAll,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {battlefield,dispatch,arrive} from './combatTestSupport';
import {advanceFormal} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {liveBattleView} from './battleView';
import {BATTLE_HISTORY_LIMIT} from './battleProgress';
const results:unknown[]=[];
afterAll(()=>{mkdirSync('docs/b5-v91',{recursive:true});writeFileSync('docs/b5-v91/long-combat.json',JSON.stringify(results,null,2));});
// Independent scalar oracle for identical militia: 55 HP, attack7-defense1,
// exposure5 / interval2 => 15 damage per living attacker. Integer survivors ceil(HP/55).
function militiaOracle(a:number,d:number){let ah=a*55,dh=d*55,round=0;while(a&&d){const na=Math.max(0,ah-d*15),nd=Math.max(0,dh-a*15);ah=na;dh=nd;a=Math.ceil(ah/55);d=Math.ceil(dh/55);round++;}return{round,a,d};}
it.each([{round:1,a:1e9,d:1},{round:10,a:1e9,d:987091511},{round:30,a:1e9,d:999999821},{round:60,a:150000000000000,d:149999999999999}])('defender clears on independent main round $round, never truncated at 12 or 60',async({round,a,d})=>{
 const expected=militiaOracle(a,d);expect(expected.round).toBe(round);expect(expected.d).toBe(0);let w=battlefield();w.cities[0].military!.units={militia:a};w.cities[1].military!.units={militia:d};let t=arrive(dispatch(w,'conquest',{militia:a}).world);w=t.world;const reports=[...t.reports];const id=w.combat!.battles[0]?.id??t.reports[0].battle!.battleId;
 while(w.combat!.battles.length){const b=w.combat!.battles[0];expect(b.siegeRound).toBe(0);if(b.round===Math.min(5,round-1)){const loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded.combat!.battles[0].id).toBe(id);w=loaded;}t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);w=t.world;reports.push(...t.reports);}
 expect(reports).toHaveLength(1);const p=reports[0].battle!;expect(p.rounds).toBe(round);expect(p.siegeRounds).toBe(0);expect(p.outcome).toBe('conquered');expect(p.attackers[0].after.militia).toBe(expected.a);expect(p.history!.filter(e=>e.kind==='combat-summary').map(e=>e.combatRound)).toEqual(Array.from({length:Math.floor(round/5)},(_,i)=>(i+1)*5));results.push({fixture:'scalar-militia',round,initial:{a,d},expected,actual:p});
},30000);
it('long symmetric siege-engine stress keeps bounded summaries, HP continuity, one final report and no intermediate reports',()=>{
 // Independent two-group reference with locked base stats, no production Resolver helpers.
 // One heavy knight per side, 1M rams each: long duration is a stress fixture, not normal balance.
 let kh=206.99999999999997,rh=1e6*250,rc=1e6,expected=0;
 while(kh>1e-9){const den=rc+1,dk=(5/1.8)*(1/den)*(20.7-5)+(rc*5/3)*(1/den)*.25,dr=(5/1.8)*(rc/den)*20.7+(rc*5/3)*(rc/den);kh=Math.max(0,kh-dk);rh=Math.max(0,rh-dr);rc=Math.ceil((rh-1e-9)/250);expected++;}
 expect(expected).toBeGreaterThan(320);
 let w=battlefield();w.cities[0].military!.units={'heavy-knight':1,ram:1e6};w.cities[1].military!.units={'heavy-knight':1,ram:1e6};let t=arrive(dispatch(w,'conquest',{'heavy-knight':1,ram:1e6}).world);w=t.world;let rounds=1;const reports=[...t.reports];const views:unknown[]=[];
 while(w.combat!.battles.length){const b=w.combat!.battles[0];expect(b.history!.length).toBeLessThanOrEqual(BATTLE_HISTORY_LIMIT);expect(reports).toHaveLength(0);if([30,60,320,400].includes(rounds))views.push(liveBattleView(w,b.id));t=advanceFormal(w,b.nextRoundAt);w=t.world;reports.push(...t.reports);rounds++;}
 expect(rounds).toBe(expected);expect(reports).toHaveLength(1);expect(reports[0].battle!.outcome).toBe('mutual-destruction');expect(reports[0].battle!.history).toHaveLength(BATTLE_HISTORY_LIMIT);expect(reports[0].battle!.historyOmitted).toBeGreaterThan(0);expect(w.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);results.push({fixture:'symmetric-heavy-knight-rams',expectedRounds:expected,actualRounds:rounds,views,final:reports[0].battle});
},60000);
