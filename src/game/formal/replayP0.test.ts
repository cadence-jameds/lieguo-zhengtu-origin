import {afterEach,expect,it,vi} from 'vitest';
import * as autonomy from './autonomy';
import * as governance from './governance';
import * as economy from './economy';
import * as military from './military';
import * as routing from './routing';
import * as schema from './schema';
import {createFormalWorld} from './generator';
import {createFormalFixture,fixtureIds} from './fixture';
import {build,order} from './developmentTestSupport';
import {contribute} from './testSupport';
import {commandId,eventId} from './ids';
import {armyId,battleId} from './ids';
import {canonicalJSON} from './canonical';
import {advanceFormal,advanceFormalCooperative,orderFingerprint,submitFormalOrder} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {EventScheduler} from './scheduler';
import {initialPolitics,reconcilePoliticalEvents} from './politics';
import {initialCombat} from './combatModel';
import type {FormalCommand,FormalEvent,FormalOrder,FormalTransition,FormalWorld} from './model';

afterEach(()=>vi.restoreAllMocks());
const HOUR=3600000;
function governed(){
 const w=createFormalWorld({campaign:'p0-replay-governor',seed:12012});build(w.cities[0],'townhall',1);
 return submitFormalOrder(w,order(w,{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'economy',budget:2400,reserve:0},'governor')).world;
}
/** Reference control retains the pre-optimization full clone and global validation on every admission. */
function referenceAdvance(w:FormalWorld,target:number):FormalTransition {
 const ai=autonomy.handleAutonomy,governor=governance.handleGovernance;
 const aiSpy=vi.spyOn(autonomy,'handleAutonomy').mockImplementation((draft,event,scheduler)=>ai(draft,event,scheduler,submitFormalOrder));
 const governorSpy=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler)=>governor(draft,event,scheduler,submitFormalOrder));
 try{return advanceFormal(w,target);}finally{aiSpy.mockRestore();governorSpy.mockRestore();}
}
function normalized(w:FormalWorld){
 const copy=structuredClone(w);copy.revision=0;for(const r of copy.commandReceipts)r.committedRevision=0;return canonicalJSON(copy);
}
function issues(w:FormalWorld){
 try{schema.validateFormalWorld(w);throw new Error('Expected invalid world');}
 catch(error){if(error instanceof Error&&'issues' in error)return(error as {issues:{message:string}[]}).issues.map(issue=>issue.message);throw error;}
}
const scopedTypes=['field.upgrade','building.upgrade','military.recruit'] as const;
function scopedCommand(w:FormalWorld,type:typeof scopedTypes[number]):FormalCommand {
 const cityId=w.cities[0].id;
 return type==='field.upgrade'?{type,cityId,slot:0}:type==='building.upgrade'?{type,cityId,key:'warehouse.0'}:{type,cityId,unitId:'militia',count:1};
}
/** Run the real governor event, replacing its selected payload while keeping admission and replay intact. */
function governedCommand(w:FormalWorld,payload:FormalCommand,reference:boolean,target=0,status='committed'){
 const governor=governance.handleGovernance;let admissions=0;
 const spy=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current,value)=>{
  const before=canonicalJSON(current),events=scheduler.snapshot();
  const t=(reference?submitFormalOrder:submit)(current,{...(value as FormalOrder),payload});
  expect(t.ack?.status,t.ack?.reason).toBe(status);expect(canonicalJSON(current)).toBe(before);expect(scheduler.snapshot()).toEqual(events);
  if(status==='rejected')expect(t.world).toBe(current);admissions++;return t;
 }));
 try{const t=advanceFormal(w,target);expect(admissions).toBe(1);return t;}finally{spy.mockRestore();}
}

for(const type of scopedTypes)it(`scoped ${type} matches full-clone admission and keeps unrelated command input private`,()=>{
 const w=governed();build(w.cities[0],'barracks',1);autonomy.enableAutonomy(w);w.politics=initialPolitics();
 w.politics.joints.push({id:'joint:empty',initiator:w.playerFactionId,targetCityId:w.cities[1].id,arrivalAt:1,armyIds:[],scope:w.playerFactionId});
 const payload=scopedCommand(w,type),before=canonicalJSON(w),reference=governedCommand(w,payload,true);
 const clones=vi.spyOn(globalThis,'structuredClone'),actual=governedCommand(w,payload,false);
 // Observe native clone work so this reference comparison also exercises the scoped path rather than a fallback.
 const cityDrafts=clones.mock.calls.map(([value])=>value&&typeof value==='object'&&'city' in value&&'sequences' in value?(value.city as {id:string}).id:undefined).filter(Boolean);
 expect(cityDrafts).toEqual([w.cities[0].id]);expect(actual).toEqual(reference);expect(actual.world.politics!.joints).toEqual([]);
 expect(actual.world.commandReceipts).toHaveLength(w.commandReceipts.length+1);expect(canonicalJSON(w)).toBe(before);
 expect(type==='military.recruit'?actual.world.cities[0].military!.queue:actual.world.cities[0].economy!.construction).toHaveLength(1);
});

for(const type of scopedTypes)it(`scoped ${type} discards real handler mutations after RuleViolation`,()=>{
 const w=governed();build(w.cities[0],'barracks',1);autonomy.enableAutonomy(w);
 const before=canonicalJSON(w),payload=scopedCommand(w,type);let mutations=0;
 if(type==='military.recruit'){
  const apply=military.applyMilitaryCommand;vi.spyOn(military,'applyMilitaryCommand').mockImplementation((...args)=>{
   const prior=canonicalJSON(args[0]);apply(...args);expect(canonicalJSON(args[0])).not.toBe(prior);mutations++;throw new economy.RuleViolation('after scoped handler mutation');
  });
 }else{
  const apply=economy.applyEconomyCommand;vi.spyOn(economy,'applyEconomyCommand').mockImplementation((...args)=>{
   const prior=canonicalJSON(args[0]);apply(...args);expect(canonicalJSON(args[0])).not.toBe(prior);mutations++;throw new economy.RuleViolation('after scoped handler mutation');
  });
 }
 const reference=governedCommand(w,payload,true,0,'rejected'),actual=governedCommand(w,payload,false,0,'rejected');
 expect(mutations).toBe(2);expect(actual).toEqual(reference);expect(actual.world.commandReceipts).toEqual(w.commandReceipts);expect(canonicalJSON(w)).toBe(before);
});

for(const type of scopedTypes)it(`scoped ${type} retains exact future completion events and state`,()=>{
 const w=governed();build(w.cities[0],'barracks',1);const before=canonicalJSON(w),payload=scopedCommand(w,type);
 const probe=submitFormalOrder(w,order(w,payload,'completion-probe'));expect(probe.ack?.status,probe.ack?.reason).toBe('committed');
 const event=probe.world.events.find(e=>(e.type==='construction.complete'||e.type==='military.train')&&e.cityId===w.cities[0].id)!;
 const reference=governedCommand(w,payload,true,event.at+1),actual=governedCommand(w,payload,false,event.at+1);
 expect(actual).toEqual(reference);expect(canonicalJSON(w)).toBe(before);
 const city=actual.world.cities[0];expect(city.economy!.construction).toEqual([]);expect(city.military!.queue).toEqual([]);
 if(type==='field.upgrade')expect(city.fields![0].level).toBe(w.cities[0].fields![0].level+1);
 else if(type==='building.upgrade')expect(city.buildings['warehouse.0']).toBe(1);
 else expect(city.military!.units.militia).toBe(1);
});

it('a cross-city stock alias preserves full-clone payment and rejection semantics',()=>{
 const w=governed();w.cities[1].stock=w.cities[0].stock;schema.validateFormalWorld(w);
 const before=canonicalJSON(w),payload=scopedCommand(w,'field.upgrade'),reference=governedCommand(w,payload,true),actual=governedCommand(w,payload,false);
 expect(actual).toEqual(reference);expect(actual.world.cities[0].stock).toBe(actual.world.cities[1].stock);
 expect(actual.world.cities[1].stock).not.toEqual(w.cities[1].stock);expect(canonicalJSON(w)).toBe(before);
 const apply=economy.applyEconomyCommand;vi.spyOn(economy,'applyEconomyCommand').mockImplementation((...args)=>{apply(...args);throw new economy.RuleViolation('after cross-city payment');});
 const rejectedReference=governedCommand(w,payload,true,0,'rejected'),rejected=governedCommand(w,payload,false,0,'rejected');
 expect(rejected).toEqual(rejectedReference);expect(rejected.world.cities[0].stock).toBe(rejected.world.cities[1].stock);expect(canonicalJSON(w)).toBe(before);
});

it('an unselected city autonomy alias survives another city admission and later lazy settlement',()=>{
 const w=governed();autonomy.enableAutonomy(w);const other=w.cities[1],at=HOUR/2;
 other.stock={food:300,wood:300,stone:300,gold:300};w.events.find(e=>e.id===other.economy!.settlementEventId)!.at=at;
 for(const agent of w.autonomy!.agents){agent.nextAt+=2*HOUR;w.events.find(e=>e.id===agent.eventId)!.at=agent.nextAt;}
 w.autonomy!.agents[0].intel.push({cityId:other.id,ownerFactionId:other.ownerFactionId,at:0,source:'scout',coarse:'personnel',units:other.stock});
 schema.validateFormalWorld(w);const before=canonicalJSON(w),payload=scopedCommand(w,'field.upgrade');
 const reference=governedCommand(w,payload,true,at+1),actual=governedCommand(w,payload,false,at+1);
 expect(actual).toEqual(reference);expect(actual.world.autonomy!.agents[0].intel[0].units).toBe(actual.world.cities[1].stock);
 expect(actual.world.cities[1].stock.food).toBeGreaterThan(other.stock.food);expect(canonicalJSON(w)).toBe(before);
});

it('an unselected city political reserve alias survives admission and a future training completion',()=>{
 let w=governed();build(w.cities[1],'barracks',1);const other=w.cities[1];other.military!.units={militia:1};
 const queued=submitFormalOrder(w,order(w,{type:'military.recruit',cityId:other.id,unitId:'militia',count:1},'other-city-training',other.ownerFactionId));
 expect(queued.ack?.status,queued.ack?.reason).toBe('committed');w=queued.world;w.politics=initialPolitics();
 w.politics.reserves.push({cityId:other.id,units:w.cities[1].military!.units,keep:0,enabled:true});schema.validateFormalWorld(w);
 const before=canonicalJSON(w),payload=scopedCommand(w,'field.upgrade'),at=w.cities[1].military!.queue[0].nextAt;
 const reference=governedCommand(w,payload,true,at+1),actual=governedCommand(w,payload,false,at+1);
 expect(actual).toEqual(reference);expect(actual.world.politics!.reserves[0].units).toBe(actual.world.cities[1].military!.units);
 expect(actual.world.politics!.reserves[0].units.militia).toBe(2);expect(canonicalJSON(w)).toBe(before);
});

it('aliases wholly inside a selected city retain their native clone graph',()=>{
 const w=governed();w.cities[0].economy!.productionRemainder=w.cities[0].economy!.reservedIncoming;schema.validateFormalWorld(w);
 const before=canonicalJSON(w),payload=scopedCommand(w,'field.upgrade'),reference=governedCommand(w,payload,true),actual=governedCommand(w,payload,false);
 expect(actual).toEqual(reference);expect(actual.world.cities[0].economy!.productionRemainder).toBe(actual.world.cities[0].economy!.reservedIncoming);expect(canonicalJSON(w)).toBe(before);
});

it('99 AI and governors match full-validation reference admission with a growing command history',()=>{
 const w=governed();autonomy.enableAutonomy(w);
 for(let i=0;i<1200;i++)w.commandReceipts.push({commandId:commandId('history-'+i),issuerId:w.playerFactionId,fingerprint:'synthetic-history',committedRevision:0,disposition:i%7?'applied':'rolled-back'});
 const before=canonicalJSON(w),reference=referenceAdvance(w,2*HOUR),actual=advanceFormal(w,2*HOUR);
 expect(actual).toEqual(reference);expect(actual.world.autonomy!.agents).toHaveLength(99);expect(actual.world.autonomy!.accepted).toBeGreaterThan(0);
 expect(canonicalJSON(w)).toBe(before);expect(actual.world.commandReceipts).toHaveLength(reference.world.commandReceipts.length);
},20000);

it('direct, sliced, cooperative and save/load replay preserve the same state and reports',async()=>{
 const w=governed();autonomy.enableAutonomy(w);const before=canonicalJSON(w),target=HOUR;
 const direct=advanceFormal(w,target),cooperative=await advanceFormalCooperative(w,target,undefined,{yieldIntervalMs:8});
 expect(cooperative).toEqual(direct);
 let sliced=(await decodeSave(await encodeSave(w))).world;const reports:FormalTransition['reports']=[];
 for(const at of [300000,900000,1800000,target]){const t=advanceFormal(sliced,at);sliced=t.world;reports.push(...t.reports);}
 expect(normalized(sliced)).toBe(normalized(direct.world));expect(reports).toEqual(direct.reports);expect(canonicalJSON(w)).toBe(before);
},20000);

it('receipt revision clamping never mutates the input history',()=>{
 const w=governed();autonomy.enableAutonomy(w);for(const r of w.commandReceipts)Object.freeze(r);
 const before=canonicalJSON(w),prior=w.commandReceipts.length,t=advanceFormal(w,HOUR);
 expect(t.world.commandReceipts.length).toBeGreaterThan(prior);expect(t.world.revision).toBe(w.revision+1);
 expect(t.world.commandReceipts.every(r=>r.committedRevision<=t.world.revision)).toBe(true);
 expect(t.world.commandReceipts[0]).not.toBe(w.commandReceipts[0]);expect(canonicalJSON(w)).toBe(before);
});

it('private AI admissions validate once at the complete replay boundary',()=>{
 const w=governed();autonomy.enableAutonomy(w);const validate=vi.spyOn(schema,'validateFormalWorld');
 const t=advanceFormal(w,HOUR);expect(t.world.autonomy!.accepted).toBeGreaterThan(1);expect(validate).toHaveBeenCalledTimes(1);
});

it('public submission retains global validation and rejects malformed order shapes',()=>{
 const w=createFormalFixture();w.cities[2].stock.food=-1;const before=canonicalJSON(w);
 expect(()=>submitFormalOrder(w,order(w,{type:'city.rename',cityId:w.cities[0].id,name:'valid-target'},'rename'))).toThrow();
 expect(()=>submitFormalOrder(w,{...order(w,{type:'city.rename',cityId:w.cities[0].id,name:'rename'},'bad-shape'),extra:true})).toThrow('命令格式無效');
 expect(canonicalJSON(w)).toBe(before);
});

it('the replay boundary still rejects malformed unrelated state without exposing a draft',async()=>{
 const w=createFormalFixture();w.cities[2].stock.food=-1;const before=canonicalJSON(w);
 expect(()=>advanceFormal(w,1)).toThrow();await expect(advanceFormalCooperative(w,1)).rejects.toThrow();expect(canonicalJSON(w)).toBe(before);
});

for(const kind of ['building','politics','army','governance'] as const)it(`private ${kind} rejection rolls back mutations before RuleViolation`,()=>{
 const w=governed();autonomy.enableAutonomy(w);
 if(kind==='building')w.cities[0].stock={food:100,wood:100,stone:100,gold:100};
 if(kind==='army'){
  w.cities[0].military!.units={militia:1};vi.spyOn(routing,'route').mockImplementation(()=>{throw new Error('No traversable route');});
 }
 if(kind==='governance'){
  const apply=governance.applyGovernance;vi.spyOn(governance,'applyGovernance').mockImplementation((...args)=>{apply(...args);throw new economy.RuleViolation('injected after governance changes');});
 }
 const before=canonicalJSON(w),governor=governance.handleGovernance;let rejected=0;
 vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current,value)=>{
  const cityId=current.cities[0].id,payload:FormalCommand=kind==='building'?{type:'building.upgrade',cityId,key:'warehouse.0'}:
   kind==='politics'?{type:'politics',cityId,action:'friendly-end',target:current.factions[1].id}:
   kind==='army'?{type:'army.dispatch',cityId,mission:'raid',target:{kind:'city',cityId:current.cities[1].id},units:{militia:1}}:
   {type:'governance.set',cityId,enabled:true,policy:'military',budget:2400,reserve:0};
  const input=canonicalJSON(current),events=scheduler.snapshot(),t=submit(current,{...(value as FormalOrder),payload});
  expect(t.ack?.status).toBe('rejected');expect(t.world).toBe(current);expect(canonicalJSON(current)).toBe(input);expect(scheduler.snapshot()).toEqual(events);rejected++;return t;
 }));
 const t=advanceFormal(w,0);expect(rejected).toBe(1);expect(t.world.commandReceipts).toEqual(w.commandReceipts);
 expect(t.world.governors![0].spent).toEqual({food:0,wood:0,stone:0,gold:0});expect(canonicalJSON(w)).toBe(before);
});

it('an unexpected command failure after resource and scheduler changes leaves the original world intact',()=>{
 const w=governed(),before=canonicalJSON(w),apply=economy.applyEconomyCommand;
 const fault=vi.spyOn(economy,'applyEconomyCommand').mockImplementation((...args)=>{apply(...args);throw new Error('injected unexpected command failure');});
 expect(()=>advanceFormal(w,0)).toThrow('injected unexpected command failure');expect(fault).toHaveBeenCalledTimes(1);expect(canonicalJSON(w)).toBe(before);
});

it('a progress failure after an actual yield leaves accepted commands private and permits identical retry',async()=>{
 const w=governed();for(let i=1;i<=3;i++)w.events.push({id:eventId(String(w.sequences.event++).padStart(16,'0')),at:i,type:'fixture.marker',marker:'yield'});
 const before=canonicalJSON(w),progress:number[]=[];
 await expect(advanceFormalCooperative(w,3,(_time,_target,processed)=>{progress.push(processed);if(processed===2)throw new Error('injected progress failure');},{yieldIntervalMs:0})).rejects.toThrow('injected progress failure');
 expect(progress).toEqual([1,2]);expect(canonicalJSON(w)).toBe(before);
 const expected=advanceFormal(w,3);expect(expected.world.commandReceipts.length).toBeGreaterThan(w.commandReceipts.length);
 expect(await advanceFormalCooperative(w,3,undefined,{yieldIntervalMs:0})).toEqual(expected);expect(canonicalJSON(w)).toBe(before);
});

for(const disposition of ['applied','rolled-back'] as const)it(`replay history index preserves ${disposition} CommandId acknowledgement`,()=>{
 const w=governed(),payload:FormalCommand={type:'city.rename',cityId:w.cities[0].id,name:'historical'},historical=order(w,payload,'historical');
 w.commandReceipts.push({commandId:historical.commandId,issuerId:historical.issuerId,fingerprint:orderFingerprint(historical),committedRevision:0,disposition});
 const before=canonicalJSON(w),governor=governance.handleGovernance;let status:string|undefined;
 vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current)=>{
  const t=submit(current,{...historical,expectedRevision:current.revision});status=t.ack?.status;expect(t.world).toBe(current);return t;
 }));
 const t=advanceFormal(w,0);expect(status).toBe(disposition==='applied'?'duplicate':'rolled-back');expect(t.world.commandReceipts).toEqual(w.commandReceipts);expect(canonicalJSON(w)).toBe(before);
});

it('receipt index observes new admissions after copied array replacement and keeps payload conflicts',()=>{
 const w=governed(),governor=governance.handleGovernance;let checked=false;
 vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current,value)=>{
  const admitted=submit(current,value);expect(admitted.ack?.status).toBe('committed');
  const before=canonicalJSON(admitted.world),duplicate=submit(admitted.world,value);
  expect(duplicate.ack?.status).toBe('duplicate');expect(duplicate.world).toBe(admitted.world);
  const changed={...(value as FormalOrder),payload:{type:'city.rename',cityId:current.cities[0].id,name:'different'}};
  expect(submit(admitted.world,changed).ack?.reason).toBe('CommandId 已用於不同命令。');expect(canonicalJSON(admitted.world)).toBe(before);checked=true;return admitted;
 }));
 const t=advanceFormal(w,0);expect(checked).toBe(true);expect(t.world.commandReceipts).toHaveLength(w.commandReceipts.length+1);
});

it('receipt indexes preserve any applied duplicate match and the original duplicate diagnostics',()=>{
 const w=submitFormalOrder(createFormalFixture({research:true}),contribute(createFormalFixture({research:true}),'fund')).world;
 const row=w.commandReceipts[0];w.commandReceipts.push({...row,issuerId:fixtureIds.other,disposition:'rolled-back'});
 const messages=issues(w);expect(messages).toContain('Duplicate typed identity');expect(messages).not.toContain('Contribution command receipt missing');
 const native=createFormalWorld({campaign:'p0-duplicate-army',seed:12012});for(const f of native.factions)f.protectionUntil=0;native.cities[0].military!.units={militia:2};
 const dispatched=submitFormalOrder(native,order(native,{type:'army.dispatch',cityId:native.cities[0].id,mission:'raid',target:{kind:'city',cityId:native.cities[1].id},units:{militia:1}},'dispatch')).world;
 dispatched.commandReceipts.push({...dispatched.commandReceipts[0],issuerId:dispatched.factions[1].id});
 const armyMessages=issues(dispatched);expect(armyMessages).toContain('Duplicate typed identity');expect(armyMessages).not.toContain('Army dispatch receipt missing');
});

it('rolled-back receipts still cannot authorize construction and invalid yield options never mutate input',async()=>{
 const w=createFormalWorld({campaign:'p0-rolled-back-job',seed:12012});const t=submitFormalOrder(w,order(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0},'field'));
 t.world.commandReceipts[0].disposition='rolled-back';expect(issues(t.world)).toContain('Construction contract mismatch');
 const before=canonicalJSON(w);for(const yieldIntervalMs of [-1,NaN,Infinity])await expect(advanceFormalCooperative(w,1,undefined,{yieldIntervalMs})).rejects.toThrow('讓出間隔無效');
 expect(canonicalJSON(w)).toBe(before);
});

for(const domain of ['autonomy','worldLayer'] as const)it(`${domain} aliases with mutable city data retain full-clone replay semantics`,()=>{
 const w=governed();autonomy.enableAutonomy(w);
 if(domain==='autonomy')w.autonomy!.agents[0].intel.push({cityId:w.cities[0].id,ownerFactionId:w.playerFactionId,at:0,source:'scout',coarse:'personnel',units:w.cities[0].stock});
 else w.worldLayer!.wildSites[0].loot=w.cities[0].stock;
 expect(()=>schema.validateFormalWorld(w)).not.toThrow();
 const before=canonicalJSON(w),reference=referenceAdvance(w,0),actual=advanceFormal(w,0);
 expect(actual).toEqual(reference);expect(actual.world.commandReceipts.length).toBeGreaterThan(w.commandReceipts.length);
 const alias=domain==='autonomy'?actual.world.autonomy!.agents[0].intel[0].units:actual.world.worldLayer!.wildSites[0].loot;
 expect(alias).toBe(actual.world.cities[0].stock);expect(canonicalJSON(w)).toBe(before);
});

for(const domain of ['autonomy','worldLayer'] as const)it(`${domain} aliases cannot leak a rejected resource mutation`,()=>{
 const w=governed();autonomy.enableAutonomy(w);
 if(domain==='autonomy')w.autonomy!.agents[0].intel.push({cityId:w.cities[0].id,ownerFactionId:w.playerFactionId,at:0,source:'scout',coarse:'personnel',units:w.cities[0].stock});
 else w.worldLayer!.wildSites[0].loot=w.cities[0].stock;
 const before=canonicalJSON(w),apply=economy.applyEconomyCommand;
 vi.spyOn(economy,'applyEconomyCommand').mockImplementation((...args)=>{apply(...args);throw new economy.RuleViolation('after aliased resource mutation');});
 const reference=referenceAdvance(w,0),actual=advanceFormal(w,0);
 expect(actual).toEqual(reference);expect(actual.world.commandReceipts).toEqual(w.commandReceipts);expect(actual.world.cities[0].stock).toEqual(w.cities[0].stock);
 expect(canonicalJSON(w)).toBe(before);
});

it('private political memory commits match full-validation control without changing the command input',()=>{
 let w=createFormalWorld({campaign:'p0-politics-memory',seed:12012});autonomy.enableAutonomy(w);const city=w.cities[1];build(city,'townhall',1);
 w=submitFormalOrder(w,order(w,{type:'governance.set',cityId:city.id,enabled:true,policy:'economy',budget:2400,reserve:0},'ai-governor',city.ownerFactionId)).world;
 const before=canonicalJSON(w);
 const run=(reference:boolean)=>{
  const governor=governance.handleGovernance;
  const spy=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>governor(draft,event,scheduler,(current,value)=>{
   const prior=canonicalJSON(current),payload:FormalCommand={type:'politics',cityId:city.id,action:'friendly-propose',target:current.playerFactionId};
   const t=(reference?submitFormalOrder:submit)(current,{...(value as FormalOrder),payload});
   expect(t.ack?.status).toBe('committed');expect(canonicalJSON(current)).toBe(prior);
   expect(t.world.autonomy!.agents[0].memory.find(m=>m.factionId===current.playerFactionId)?.trust).toBe(.05);return t;
  }));
  try{return advanceFormal(w,0);}finally{spy.mockRestore();}
 };
 expect(run(false)).toEqual(run(true));expect(canonicalJSON(w)).toBe(before);
});

/** Pre-optimization control: retained events were drained and reinserted after joint cleanup. */
function previousPoliticalReconcile(w:FormalWorld,s:EventScheduler){
 const p=w.politics;if(!p)return;
 const ids=new Set(w.armies.map(a=>a.id));for(const j of p.joints)j.armyIds=j.armyIds.filter(id=>ids.has(id));
 p.joints=p.joints.filter(j=>j.armyIds.length||w.combat?.battles.some(b=>b.jointId===j.id));
 const events=s.snapshot().filter(e=>e.type!=='politics.end-friendly'||p.relations.some(r=>r.eventId===e.id));
 while(s.pop()){};for(const e of events)s.push(e);
}
for(const scenario of ['no-stale','mixed-same-time','joint-cleanup'] as const)it(`political event cancellation matches the prior scheduler algorithm for ${scenario}`,()=>{
 const w=createFormalFixture();w.politics=initialPolitics();const keep=eventId('friendly-keep');
 w.politics.relations.push({a:fixtureIds.player,b:fixtureIds.other,state:'friendly',endsAt:50,eventId:keep});
 const events:FormalEvent[]=[{id:keep,at:50,type:'politics.end-friendly',a:fixtureIds.player,b:fixtureIds.other},
  {id:eventId('marker-z'),at:50,type:'fixture.marker',marker:'z'},
  {id:eventId('economy'),at:50,type:'economy.settle',cityId:fixtureIds.home},
  {id:eventId('marker-a'),at:50,type:'fixture.marker',marker:'a'}];
 if(scenario!=='no-stale')events.push({id:eventId('friendly-stale-a'),at:50,type:'politics.end-friendly',a:fixtureIds.player,b:fixtureIds.other},
  {id:eventId('friendly-stale-z'),at:50,type:'politics.end-friendly',a:fixtureIds.other,b:fixtureIds.player});
 if(scenario==='joint-cleanup'){
  const base={initiator:fixtureIds.player,targetCityId:fixtureIds.foreign,arrivalAt:100,scope:fixtureIds.player};
  w.politics.joints=[{...base,id:'joint:active',armyIds:[w.armies[0].id,armyId('missing')]},
   {...base,id:'joint:battle',armyIds:[armyId('missing')]},{...base,id:'joint:empty',armyIds:[]}];
  w.combat=initialCombat();w.combat.battles.push({id:battleId('live'),jointId:'joint:battle',cityId:fixtureIds.home,attackerFactionId:fixtureIds.other,startedAt:0,round:0,nextRoundAt:100,roundEventId:eventId('round'),attackers:[],defenders:[],participants:[],wallBefore:0,populationBefore:200,ownerBefore:fixtureIds.player,developmentBefore:1});
 }
 const control=structuredClone(w),oldScheduler=new EventScheduler(events);previousPoliticalReconcile(control,oldScheduler);
 const expected=oldScheduler.snapshot();
 for(const make of [(input:FormalEvent[])=>new EventScheduler(input),EventScheduler.forReplay]){
  const actual=structuredClone(w),scheduler=make([...events].reverse());reconcilePoliticalEvents(actual,scheduler);
  expect(actual).toEqual(control);expect(scheduler.snapshot()).toEqual(expected);
  const drained:FormalEvent[]=[];while(scheduler.size)drained.push(scheduler.pop()!);expect(drained).toEqual(expected);
 }
 if(scenario==='joint-cleanup')expect(control.politics!.joints.map(j=>[j.id,j.armyIds])).toEqual([['joint:active',[w.armies[0].id]],['joint:battle',[]]]);
});
