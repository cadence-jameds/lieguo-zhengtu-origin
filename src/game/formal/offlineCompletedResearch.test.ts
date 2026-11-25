import {expect,it,vi} from 'vitest';
import * as governance from './governance';
import {setClockMode} from './campaignTime';
import {canonicalJSON} from './canonical';
import {build,order,researchCity,rich} from './developmentTestSupport';
import {changeCityOwner} from './economy';
import {modernFundingFixture} from './modernFundingTestSupport';
import type {FormalCommand,FormalOrder,FormalWorld} from './model';
import {advanceFormal,submitFormalOrder} from './reducer';

function issue(w:FormalWorld,p:FormalCommand,issuer=w.playerFactionId){
 const t=submitFormalOrder(w,order(w,p,undefined,issuer));
 expect(t.ack?.status,t.ack?.reason).toBe('committed');
 return t.world;
}
function basis(){
 const fixture=modernFundingFixture('offline-completed-research');
 let w=fixture.world;
 const city=researchCity(w);
 w=issue(w,{type:'research.start',cityId:city.id,techId:'blacksmith.melee.1'});
 w=advanceFormal(w,w.researchProjects[0].durationSnapshot.durationMs).world;
 expect(w.researchProjects[0].phase).toBe('completed');
 return {...fixture,world:w};
}
function governed(w:FormalWorld){
 const c=w.cities[0];build(c,'townhall',1);
 return issue(w,{type:'governance.set',cityId:c.id,enabled:true,policy:'economy',budget:250000,reserve:0});
}
function withAdmission(w:FormalWorld,payload:FormalCommand,reference:boolean, inspect?:(input:FormalWorld,output:FormalWorld)=>void){
 const handler=governance.handleGovernance;let calls=0;
 const hook=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>handler(draft,event,scheduler,(current,input)=>{
  const transition=(reference?submitFormalOrder:submit)(current,{...(input as FormalOrder),payload});
  expect(transition.ack?.status,transition.ack?.reason).toBe('committed');
  inspect?.(current,transition.world);calls++;
  return transition;
 }));
 try{const t=advanceFormal(w,w.time);expect(calls).toBe(1);return t;}finally{hook.mockRestore();}
}

it('shares only audited completed nested rows inside a detached offline command and retains exact outcome',()=>{
 const w=governed(basis().world),payload={type:'city.rename' as const,cityId:w.cities[0].id,name:'科研新城'};
 const live=structuredClone(w);
 withAdmission(live,payload,false,(before,after)=>expect(after.researchProjects[0]).not.toBe(before.researchProjects[0]));
 setClockMode(w,'offline');const canonical=canonicalJSON(w);
 const reference=withAdmission(w,payload,true);
 const actual=withAdmission(w,payload,false,(before,after)=>{
  expect(after.researchProjects).not.toBe(before.researchProjects);
  expect(after.researchProjects[0]).toBe(before.researchProjects[0]);
  expect(after.researchProjects[0].contributions).toBe(before.researchProjects[0].contributions);
 });
 expect(actual).toEqual(reference);
 expect(actual.world.researchProjects[0]).not.toBe(w.researchProjects[0]);
 expect(canonicalJSON(w)).toBe(canonical);
});

it('keeps a completed nested alias with a different domain on the original native clone path',()=>{
 const w=governed(basis().world),payload={type:'city.rename' as const,cityId:w.cities[0].id,name:'另一座科研城'};
 setClockMode(w,'offline');
 build(w.cities[3],'warehouse.0',15);
 w.cities[3].stock=w.researchProjects[0].requiredResources;
 const before=canonicalJSON(w);
 const reference=withAdmission(w,payload,true);
 const actual=withAdmission(w,payload,false,(input,output)=>{
  expect(output.researchProjects[0]).not.toBe(input.researchProjects[0]);
  expect(output.researchProjects[0].requiredResources).toBe(output.cities[3].stock);
 });
 expect(actual).toEqual(reference);expect(canonicalJSON(w)).toBe(before);
});

it('adds a live research contribution to a separate mutable draft and completes without disturbing completed rows',()=>{
 const {world,cityIds,parts,techId}=basis();let w=governed(world);
 w=issue(w,{type:'research.start',cityId:cityIds[0],techId});
 for(const [i,cityId] of cityIds.entries())w.cities.find(c=>c.id===cityId)!.stock={...parts[i]};
 const projectId=w.researchProjects[1].projectId;
 const payload={type:'research.contribute' as const,cityId:cityIds[0],projectId,resources:parts[0]};
 setClockMode(w,'offline');const before=canonicalJSON(w);
 const reference=withAdmission(w,payload,true);
 const actual=withAdmission(w,payload,false,(input,output)=>{
  expect(output.researchProjects[0]).toBe(input.researchProjects[0]);
  expect(output.researchProjects[1]).not.toBe(input.researchProjects[1]);
  expect(output.researchProjects[1].contributions).toHaveLength(1);
  expect(input.researchProjects[1].contributions).toHaveLength(0);
 });
 expect(actual).toEqual(reference);expect(canonicalJSON(w)).toBe(before);
 w=issue(actual.world,{type:'governance.set',cityId:cityIds[0],enabled:false,policy:'reserve',budget:0,reserve:0});
 for(const i of [1,2])w=issue(w,{...payload,cityId:cityIds[i],resources:parts[i]});
 const p=w.researchProjects[1];expect(p.phase).toBe('researching');
 if(p.phase!=='researching')throw Error('expected research event');
 const completed=advanceFormal(w,p.startedAt+p.durationSnapshot.durationMs).world;
 expect(completed.researchProjects.map(r=>r.phase)).toEqual(['completed','completed']);
 expect(completed.researchProjects[0]).toEqual(world.researchProjects[0]);
});

it('cancels a live project after extinction without dropping or rewriting completed rows',()=>{
 const w=basis().world,c=rich(w,w.cities[3]),owner=c.ownerFactionId;
 const faction=w.factions.find(f=>f.id===owner)!;faction.age=3;
 for(const key of ['academy','blacksmith','barracks'])build(c,key,10);
 let armed=issue(w,{type:'research.start',cityId:c.id,techId:'blacksmith.melee.1'},owner);
 armed=governed(armed);
 changeCityOwner(armed,armed.cities[3],armed.playerFactionId,'receive');setClockMode(armed,'offline');
 const payload={type:'city.rename' as const,cityId:armed.cities[0].id,name:'保留既有科研'};
 const a=withAdmission(armed,payload,false),b=withAdmission(armed,payload,true);
 expect(a).toEqual(b);
 expect(a.world.researchProjects).toHaveLength(1);
 expect(a.world.researchProjects[0]).toEqual(w.researchProjects[0]);
 expect(a.world.extinction?.cancelledResearch).toHaveLength(1);
});

it('never promotes a research row newly completed during the same replay into the initial alias proof',()=>{
 const initial=basis().world;
 let w=issue(initial,{type:'research.start',cityId:initial.cities[0].id,techId:'blacksmith.melee.2'});
 const live=w.researchProjects[1];
 if(live.phase!=='researching')throw Error('expected research event');
 const target=live.startedAt+live.durationSnapshot.durationMs+3600000;
 w=governed(w);setClockMode(w,'offline');
 const handler=governance.handleGovernance;let sawLive=false,sawNewlyCompleted=false;
 const hook=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>handler(draft,event,scheduler,(current,input)=>{
  const order={...(input as FormalOrder),payload:{type:'city.rename',cityId:current.cities[0].id,name:'科研同期排程'}};
  const t=submit(current,order);
  expect(t.ack?.status,t.ack?.reason).toBe('committed');
  expect(t.world.researchProjects[0]).toBe(current.researchProjects[0]);
  expect(t.world.researchProjects[1]).not.toBe(current.researchProjects[1]);
  if(current.researchProjects[1].phase==='researching')sawLive=true;
  if(current.researchProjects[1].phase==='completed')sawNewlyCompleted=true;
  return t;
 }));
 try{
  const result=advanceFormal(w,target);
  expect(result.world.researchProjects[1].phase).toBe('completed');
  expect(sawLive).toBe(true);expect(sawNewlyCompleted).toBe(true);
 }finally{hook.mockRestore();}
});
