import {describe,expect,it} from 'vitest';
import {economicChoices} from './autonomy';
import {traitsFor,type Agent} from './autonomyModel';
import {commit,make,researchCity} from './developmentTestSupport';
import {unitRecruitCost} from './military';
import {advanceFormal} from './reducer';
import {TECH_CATALOG} from './techCatalog';
import {ELITE_VARIANTS,UNIT_CATALOG} from './unitCatalog';

const cases=Object.entries(ELITE_VARIANTS).map(([base,eliteId])=>[base,UNIT_CATALOG[eliteId]] as const);

describe('AI elite recruitment parity with authoritative production',()=>{
 for(const [base,elite] of cases) it(`${base} stays available until both ${elite.eliteTech} and the city milestone`,()=>{
  const w=make(),city=researchCity(w),f=w.factions[0];
  if(elite.civilizationId)f.civilizationId=elite.civilizationId;
  const a:Agent={factionId:f.id,traits:traitsFor(w.seed,f.id),decisions:0,nextAt:0,eventId:null,active:true,budgetPercent:100,lastWarAt:0,memory:[],intel:[]};
  for(const [tech,milestone] of [[false,false],[false,true],[true,false],[true,true]]){
   f.techIds=tech?[elite.eliteTech!]:[];
   city.economy!.milestones=milestone?[elite.milestone]:[];
   const expected=tech&&milestone?elite.id:base;
   const choices=economicChoices(w,city,a).flatMap(q=>
    q.command.type==='military.recruit'&&(q.command.unitId===base||q.command.unitId===elite.id)?[{order:q.command,cost:q.cost}]:[]);
   expect(choices.map(q=>q.order.unitId)).toEqual([expected]);
   const [{order,cost}]=choices,unitCost=unitRecruitCost(w,city,UNIT_CATALOG[expected]);
   expect(cost).toEqual(Object.fromEntries(Object.entries(unitCost).map(([r,n])=>[r,n*order.count])));
   const enrolled=commit(w,{...order,unitId:base}).cities[0].military!.queue[0];
   expect(enrolled).toMatchObject({unitId:expected,unitCost});
  }
 });
 for(const milestone of [false,true])it(`military governor actually recruits ${milestone?'elite':'ordinary'} from the shared candidate set`,()=>{
  const w=make(),city=researchCity(w),f=w.factions[0],elite=UNIT_CATALOG.swordsman;
  for(const k of ['archery','stable','workshop','castle']){delete city.buildings[k];delete city.economy!.slots[k];}
  f.techIds=[elite.eliteTech!];f.age=3;
  city.economy!.milestones=milestone?[elite.milestone]:[];
  city.military!.units={spearman:5000,pikeman:5000,scout:100};
  const governed=commit(w,{type:'governance.set',cityId:city.id,enabled:true,policy:'military',budget:100000,reserve:0});
  const at=governed.governors![0].nextAt;
  const after=advanceFormal(governed,at).world;
  expect(after.cities[0].military!.queue.map(q=>q.unitId)).toContain(milestone?elite.id:'militia');
 });
 it('labels only the existing targets of the modern siege technology',()=>{
  expect(TECH_CATALOG['modern.siege-engineering'].effect).toBe('破障車對城牆、自走火炮對建築、資源田與世界奇觀的破壞力 +20%。');
 });
});
