import {describe,expect,it} from 'vitest';
import {TECH_CATALOG,BLACKSMITH_CAPS} from '../formal/techCatalog';
import {make,researchCity,commit} from '../formal/developmentTestSupport';
import {researchFacts,researchLayout,researchState,visibleResearch} from './researchTree';
import {TREE_NODE_HEIGHT} from './researchTree';
import {modernFundingFixture} from '../formal/modernFundingTestSupport';

describe('Formal catalog technology tree',()=>{
 it('preserves 66 traditional and 16 modern entries and the official ages',()=>{
  const all=Object.values(TECH_CATALOG),traditional=all.filter(d=>d.scope==='traditional');
  expect(traditional).toHaveLength(66);expect(all.length-traditional.length).toBe(16);
  expect([...new Set(traditional.map(d=>d.age))].sort()).toEqual([1,2,3]);
  expect(all.filter(d=>d.scope==='modern-common')).toHaveLength(9);
  expect(all.filter(d=>d.scope==='modern-civilization')).toHaveLength(6);
 });
 for(const civ of Object.keys(BLACKSMITH_CAPS))it(civ+' shows only its own exclusives with exact prerequisite edges',()=>{
  const techs=visibleResearch(civ);
  expect(techs.every(d=>!d.civilizationId||d.civilizationId===civ)).toBe(true);
  expect(techs.filter(d=>d.scope==='modern-civilization')).toHaveLength(1);
  for(const scope of ['traditional','modern'] as const){
   const layout=researchLayout(techs,scope),ids=new Set(layout.nodes.map(n=>n.tech.id));
   const expected=layout.nodes.flatMap(n=>n.tech.prerequisites.filter(p=>ids.has(p)).map(p=>p+'>'+n.tech.id));
   expect(layout.edges.map(e=>e.from.tech.id+'>'+e.to.tech.id).sort()).toEqual(expected.sort());
   for(const n of layout.nodes){
    if(scope==='traditional')expect(n.x).toBe((n.tech.age-1)*266+16);
    for(const id of n.tech.prerequisites){const from=layout.nodes.find(n=>n.tech.id===id);if(from)expect(from.x<n.x||from.y+TREE_NODE_HEIGHT<=n.y).toBe(true);}
   }
   expect(new Set(layout.nodes.map(n=>n.x+','+n.y)).size).toBe(layout.nodes.length);
  }
 });
 it('requires official qualifications, resources and a free shared queue for gold borders',()=>{
  const w=make(),c=researchCity(w),d=TECH_CATALOG['blacksmith.melee.1'];
  const facts=researchFacts(w,c,[d]);expect(researchState(w,c,d,facts[d.id]).state).toBe('available');
  c.stock.gold=0;expect(researchState(w,c,d,facts[d.id]).state).toBe('locked');
  c.stock.gold=100000;c.buildings.blacksmith=0;expect(researchState(w,c,d,researchFacts(w,c,[d])[d.id]).state).toBe('locked');
  c.buildings.blacksmith=15;const next=commit(w,{type:'research.start',cityId:c.id,techId:d.id});
  expect(researchState(next,next.cities[0],d,researchFacts(next,next.cities[0],[d])[d.id]).state).toBe('active');
  const other=TECH_CATALOG['blacksmith.ranged.1'];expect(researchState(next,next.cities[0],other,researchFacts(next,next.cities[0],[other])[other.id]).available).toBe(false);
  const done=structuredClone(w);done.factions[0].techIds.push(d.id);expect(researchState(done,done.cities[0],d,facts[d.id]).state).toBe('done');
 });
 it('preserves multi-city funding even when one city cannot afford the project',()=>{
  const w=make(),c=researchCity(w,true),d=TECH_CATALOG['modern.infantry-weapons'];c.stock={food:0,wood:0,stone:0,gold:0};
  const s=researchState(w,c,d,researchFacts(w,c,[d])[d.id]);expect(s.canStart).toBe(true);expect(s.available).toBe(true);expect(s.state).toBe('available');expect(s.availableLabel).toBe('可建立籌資');
 });
 for(const id of ['modern.infantry-weapons','modern.civ_zhongguo.exclusive'])for(const funded of [false,true])it(`${id} gold funding eligibility with single-city funds=${funded}`,()=>{
  const {world:w}=modernFundingFixture('funding-state',id),c=w.cities[0],d=TECH_CATALOG[id],originalStock={...c.stock};if(funded)c.stock={...d.cost};
  const state=()=>researchState(w,c,d,researchFacts(w,c,[d])[id]);expect(state()).toMatchObject({canStart:true,available:true,state:'available',availableLabel:'可建立籌資'});
  w.factions[0].modernQualification='none';expect(state()).toMatchObject({canStart:false,state:'locked'});w.factions[0].modernQualification='full';
  w.factions[0].researchCooperation=false;expect(state().state).toBe('locked');w.factions[0].researchCooperation=true;
  c.stock=originalStock;const busy=commit(w,{type:'research.start',cityId:c.id,techId:id}),p=busy.researchProjects[0];expect(researchState(busy,busy.cities[0],d,researchFacts(busy,busy.cities[0],[d])[id])).toMatchObject({state:'active',project:{phase:'funding'}});expect(p.startedAt).toBeUndefined();
 });
 for(const id of ['blacksmith.melee.1','research.cooperation'])it(id+' still requires single-city payment and never uses funding eligibility',()=>{
  const w=make(),c=researchCity(w),d=TECH_CATALOG[id];w.factions[0].modernQualification='full';
  for(const r of ['food','wood','stone','gold'] as const)c.stock[r]=0;
  expect(researchState(w,c,d,researchFacts(w,c,[d])[id])).toMatchObject({canStart:false,available:false,state:'locked'});
  c.stock={...d.cost};expect(researchState(w,c,d,researchFacts(w,c,[d])[id])).toMatchObject({canStart:true,available:true,state:'available',availableLabel:'可以研發'});
 });
});
