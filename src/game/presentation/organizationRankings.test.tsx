// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {battlefield,issue} from '../formal/combatTestSupport';
import {build} from '../formal/developmentTestSupport';
import type {FormalWorld} from '../formal/model';
import {empireOf,legionOf,type PoliticalCommand} from '../formal/politics';
import {advanceFormal} from '../formal/reducer';
import {FormalPersistence} from '../persistence';
import {empireRankings,legionRankings} from './factionRankings';
import {PoliticsView} from './PoliticsView';
const stores:FormalPersistence[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();vi.unstubAllGlobals();});
function setup(){const w=battlefield();for(const c of w.cities.slice(0,4)){w.factions.find(f=>f.id===c.ownerFactionId)!.age=2;build(c,'embassy',15);}return w;}
function political(w:FormalWorld,i:number,action:PoliticalCommand['action'],extra:object={}){const t=issue(w,{type:'politics',cityId:w.cities[i].id,action,...extra},w.cities[i].ownerFactionId);expect(t.ack?.status).toBe('committed');return t.world;}
function groups(){let w=setup();w=political(w,0,'legion-create',{name:'甲團'});w=political(w,2,'legion-create',{name:'乙團'});return w;}
function join(w:FormalWorld){w=political(w,0,'legion-invite',{target:w.cities[1].ownerFactionId});return political(w,1,'request-accept',{requestId:w.politics!.requests.at(-1)!.id});}
function empire(w:FormalWorld){w=political(w,0,'empire-propose',{target:w.cities[2].ownerFactionId,name:'甲國'});return political(w,2,'request-accept',{requestId:w.politics!.requests.at(-1)!.id});}
it('C13 formation, consented joining and leaving immediately update public organization totals',()=>{
 let w=setup();expect(legionRankings(w)).toEqual([]);expect(empireRankings(w)).toEqual([]);
 w=groups();w=join(w);expect(legionRankings(w)[0].cities).toBe(2);w=empire(w);
 expect(empireRankings(w)[0].cities).toBe(3);expect(empireRankings(w)[0].population).toBe(w.cities.slice(0,3).reduce((n,c)=>n+Math.floor(c.population),0));
 w=political(w,1,'legion-leave');expect(empireRankings(w)[0].cities).toBe(2);expect(legionRankings(w).every(r=>r.cities===1)).toBe(true);
 w=political(w,2,'empire-leave');expect(empireRankings(w)[0].cities).toBe(1);
});
it('C13 city-count precedence, population tiebreak, competition ties and stable IDs; duplicate membership cannot double count',()=>{
 const w=groups();w.cities[0].population=w.cities[2].population=1000;
 const rows=legionRankings(w);expect(rows.map(r=>r.rank)).toEqual([1,1]);expect(rows.map(r=>r.id)).toEqual(rows.map(r=>r.id).sort());
 const a=w.politics!.legions[0];a.members.push(a.leader);expect(legionRankings(w).find(r=>r.id===a.id)?.cities).toBe(1);
 w.cities[2].population=1001;expect(legionRankings(w)[0].legion.name).toBe('乙團');
 a.members.push(w.cities[1].ownerFactionId);w.cities[0].population=w.cities[1].population=1;expect(legionRankings(w)[0].legion.name).toBe('甲團');
 const e=empire(join(groups()));e.politics!.empires[0].legions.push(...e.politics!.empires[0].legions);expect(empireRankings(e)[0].cities).toBe(3);
});
it('C13 pure ranking never reads armies, technology, resources or private intelligence',()=>{
 const w=empire(join(groups())),expected=[legionRankings(w),empireRankings(w)];
 for(const c of w.cities)for(const key of ['military','stock'])Object.defineProperty(c,key,{get(){throw Error('private '+key);}});
 for(const f of w.factions)Object.defineProperty(f,'techIds',{get(){throw Error('private tech');}});
 Object.defineProperty(w,'armies',{get(){throw Error('private armies');}});
 expect([legionRankings(w),empireRankings(w)]).toEqual(expected);
});
it('C13 actual conquest and extinction remove former membership and count transferred city only for its current owner',()=>{
 let w=empire(join(groups()));const target=w.cities[2],former=target.ownerFactionId,attacker=w.cities[3];
 attacker.military!.units={militia:100,ram:2};target.military!.units={};target.wallLevel=0;
 const t=issue(w,{type:'army.dispatch',cityId:attacker.id,mission:'conquest',target:{kind:'city',cityId:target.id},units:{militia:50,ram:2}},attacker.ownerFactionId);expect(t.ack?.status).toBe('committed');w=t.world;
 for(let n=0;n<30&&w.cities[2].ownerFactionId===former;n++)w=advanceFormal(w,w.events[0].at).world;
 expect(w.cities[2].ownerFactionId).toBe(attacker.ownerFactionId);expect(legionOf(w,former)).toBeUndefined();expect(empireOf(w,former)).toBeUndefined();expect(empireRankings(w)[0].cities).toBe(2);
});
it('C13 save/load, manual Recovery and corrupt-current automatic Recovery recompute ranks from the restored world',async()=>{
 const s=new FormalPersistence({suffix:'c13-rank-'+crypto.randomUUID()});stores.push(s);const a=await s.start(empire(join(groups()))),id=(await s.backupList())[0].id;
 const b=political(a,1,'legion-leave'),saved=await s.save(b,[],a.revision);expect(empireRankings((await s.loadSave()).game!)).toEqual(empireRankings(saved));
 const restored=await s.restore(id);expect(empireRankings(restored)).toEqual(empireRankings(a));expect(legionRankings(restored)).toEqual(legionRankings(a));
 const row=await s.db.saves.get('current');if(!row||row.kind!=='world')throw Error('Missing world');row.data.checksum='0'.repeat(64);await s.db.saves.put(row);
 const recovered=await s.loadSave();expect(recovered.recovered).toBe(true);expect(empireRankings(recovered.game!)).toEqual(empireRankings(restored));
});
it('C13 UI preserves global ranks during search, details, player affiliation and rerendered membership changes',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let w=empire(join(groups()));const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 const render=()=>root.render(<PoliticsView world={w} city={w.cities[0]} issue={()=>{}} busy={false}/>);
 try{await act(async()=>render());expect(host.textContent).toContain('疆域／人口排行');expect(host.textContent).toContain('第 1 名');expect(host.textContent).toContain('所屬帝國');
  await act(async()=>{([...host.querySelectorAll('button')].find(b=>b.textContent==='軍團')!).click();});
  expect(host.querySelectorAll('.faction-rank')).toHaveLength(2);expect(host.textContent).toContain('所屬軍團');
  const input=host.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'乙');input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(host.textContent).toContain('第 2 名');expect(host.querySelectorAll('.faction-rank')).toHaveLength(1);
  await act(async()=>{([...host.querySelectorAll('button')].find(b=>b.textContent==='查看軍團與成員')!).click();});expect(host.querySelector('dialog')).not.toBeNull();
  w=political(w,1,'legion-leave');await act(async()=>render());expect(host.textContent).not.toContain('總軍力排行');
 }finally{await act(async()=>root.unmount());host.remove();}
});
