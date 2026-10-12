import {seedHash} from './terrain';
import {describe,it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {banditShares,proportionalResources} from './banditLoot';
import {populateWild,WILD_LOOT,WILD_BUDGET} from './wildLifecycle';
import {resourceKeys} from './model';
import {battlefield,arrive} from './combatTestSupport';
import {order} from './developmentTestSupport';
import {submitFormalOrder,advanceFormal} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {carryCapacity} from './combatModifiers';
import {handleCombatEvent} from './battles';
import {EventScheduler} from './scheduler';
const total=(r:Record<string,number>)=>Object.values(r).reduce((a,b)=>a+b,0);
describe('v87 bandit loot delta',()=>{
 it('sweeps seeds/slots/generations/Lv1–10 with bounded four-resource exact totals and unchanged defender budgets',()=>{
  const w=battlefield(),s=w.worldLayer!.wildSites[0],rows=[];
  for(const seed of [0,1,20261008,4294967295])for(const slot of [0,1,217,431])for(let gen=0;gen<25;gen++)for(let level=1;level<=10;level++){
   w.seed=seed;s.spawnSlot=slot;s.generation=gen;s.level=level;s.resource='bandit';populateWild(w,s);
   const shares=banditShares(seed,slot,gen);expect(total(shares)).toBe(100);
   const pool=WILD_LOOT[level-1]*1.5;expect(total(s.loot!)).toBe(pool);
   for(const r of resourceKeys){expect(shares[r]).toBeGreaterThanOrEqual(15);expect(shares[r]).toBeLessThanOrEqual(35);expect(s.loot![r]).toBeGreaterThan(0);expect(Number.isInteger(s.loot![r])).toBe(true);expect(s.loot![r]/pool).toBeGreaterThanOrEqual(.15);expect(s.loot![r]/pool).toBeLessThanOrEqual(.35);}
   expect(s.budget).toBe(level===1?74:Math.round(WILD_BUDGET[level-1]*1.2*(.95+seedHash(seed,slot,gen,101)/4294967296*.1)));
   const copy=structuredClone(s);populateWild(w,s);expect(s).toEqual(copy);
   if(level===1)rows.push({seed,slot,gen,shares,loot:s.loot,budget:s.budget,defenders:s.defenders});
  }
  expect(new Set(rows.map(r=>JSON.stringify(r.shares))).size).toBeGreaterThan(100);
  const dir=process.env.BANDIT_EVIDENCE;if(dir){mkdirSync(dir,{recursive:true});writeFileSync(dir+'/seed-slot-generation-matrix.json',JSON.stringify(rows,null,2));}
 });
 it('ordinary pools and 30/25/20/10/15 spawn thresholds remain unchanged for all 432 slots',()=>{
  const w=battlefield();expect(w.worldLayer!.wildSites).toHaveLength(432);
  for(const site of w.worldLayer!.wildSites){const h=seedHash(w.seed,site.spawnSlot,0,90)%100;expect(site.resource).toBe(h<30?'food':h<55?'wood':h<75?'stone':h<85?'gold':'bandit');}
  const site=w.worldLayer!.wildSites[0];for(const r of resourceKeys)for(let level=1;level<=10;level++){site.resource=r;site.level=level;populateWild(w,site);expect(site.loot![r]).toBe(WILD_LOOT[level-1]);expect(total(site.loot!)).toBe(WILD_LOOT[level-1]);}
 });
 it('integer allocation conserves awkward totals/capacities and stays within one resource of ideal proportions',()=>{
  const weights={food:157,wood:263,stone:319,gold:261};
  for(const capacity of [0,1,2,3,7,37,999,1000]){const out=proportionalResources(weights,capacity);expect(total(out)).toBe(capacity);for(const r of resourceKeys)expect(Math.abs(out[r]-weights[r]*capacity/1000)).toBeLessThan(1);}
 });
 it('save/load preserves active generation stock; a limited raid uses actual ratios, clears once and cannot pay twice',async()=>{
  let w=battlefield();const site=w.worldLayer!.wildSites[0];site.resource='bandit';site.level=1;populateWild(w,site);
  const stock={...site.loot!};w=(await decodeSave(await encodeSave(w))).world;expect(w.worldLayer!.wildSites[0].loot).toEqual(stock);
  w.worldLayer!.wildSites[0].defenders={};w.cities[0].military!.units={militia:1};
  w=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'raid',target:{kind:'wild',siteId:site.id,generation:site.generation},units:{militia:1}})).world;
  const event=w.events.find(e=>e.id===w.armies[0].movementEventId)!,capacity=carryCapacity(w.armies[0].units!,w.factions[0]);const t=arrive(w);
  expect(t.reports[0].battle!.loot).toEqual(proportionalResources(stock,capacity));expect(total(t.reports[0].battle!.loot)).toBe(capacity);
  w=t.world;const before=structuredClone(w);handleCombatEvent(w,event,new EventScheduler(w.events));expect(w).toEqual(before);
  expect(w.worldLayer!.wildSites).toHaveLength(432);expect(w.worldLayer!.wildSites[0].phase).toBe('cooldown');
  const restored=(await decodeSave(await encodeSave(w))).world;expect(restored.worldLayer!.wildSites[0]).toEqual(w.worldLayer!.wildSites[0]);
  const respawn=advanceFormal(restored,restored.worldLayer!.wildSites[0].respawnAt!).world;expect(respawn.worldLayer!.wildSites[0].generation).toBe(site.generation+1);expect(respawn.worldLayer!.wildSites).toHaveLength(432);
 });
});
