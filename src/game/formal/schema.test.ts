import {describe,expect,it} from 'vitest';
import {createFormalFixture,fixtureIds} from './fixture';
import {armyId,cityId,commandId,empireId,eventId,factionId,projectId,researchProjectId,shipmentId} from './ids';
import {canonicalJSON} from './canonical';
import {encodeSave,decodeSave} from './saveCodec';
import {validateFormalWorld,largeProjectSchema} from './schema';
import {advanceFormal,completeResearch,submitFormalOrder} from './reducer';
import {contribute,order} from './testSupport';
import type {LargeProject} from './model';
it('all typed ID constructors validate their wire prefixes',()=>{
 expect([factionId('x'),cityId('x'),armyId('x'),eventId('x'),commandId('x'),projectId('x'),researchProjectId('x')]).toEqual(['faction:x','city:x','army:x','event:x','command:x','project:x','research:x']);
 expect(()=>cityId('../x')).toThrow();
});
it('minimal formal fixture validates without changing a byte and has no DEMO metadata or capital',()=>{
 const w=createFormalFixture(),before=canonicalJSON(w);expect(validateFormalWorld(w)).toEqual(w);expect(canonicalJSON(w)).toBe(before);
 expect(w.metadata.schemaVersion).toBe(1);expect(w.metadata.contentVersion).not.toBe('river-valley-0.27.0');expect(w.factions[0]).not.toHaveProperty('capital');
});
it('strict validator rejects raw IDs, unknown fields, negative resources, and performs no repairs',()=>{
 const w=createFormalFixture();const variants=[{...w,schema:6},{...w,playerFactionId:w.cities[0].id},{...w,cities:[{...w.cities[0],ownerFactionId:'faction:missing'}]},{...w,cities:[{...w.cities[0],stock:{...w.cities[0].stock,food:-1}}]}];
 for(const value of variants){const before=JSON.stringify(value);expect(()=>validateFormalWorld(value)).toThrow();expect(JSON.stringify(value)).toBe(before);}
});
for(const phase of ['funding','researching','completed'] as const)it(`${phase} project roundtrip preserves snapshots and exact phase`,async()=>{
 let w=createFormalFixture({research:true});if(phase!=='funding')w=submitFormalOrder(w,contribute(w,'fund')).world;if(phase==='completed')w=advanceFormal(w,47400).world;
 const input=canonicalJSON(w),decoded=await decodeSave(await encodeSave(w));expect(canonicalJSON(decoded.world)).toBe(input);expect(decoded.world.researchProjects[0].phase).toBe(phase);
 if(phase==='funding')expect(decoded.world.researchProjects[0]).not.toHaveProperty('startedAt');
});
it('funding cannot have fake start or completed timestamps, and funded ledgers cannot remain funding',()=>{
 const w=createFormalFixture({research:true});for(const patch of [{startedAt:0},{completedAt:0},{fundingTransitionCommandId:commandId('x')}])expect(()=>validateFormalWorld({...w,researchProjects:[{...w.researchProjects[0],...patch}]})).toThrow();
});
it('qualification/duration snapshots stay with original Faction after city loss and building downgrade',()=>{
 let w=createFormalFixture({research:true});const snapshot=structuredClone(w.researchProjects[0].qualificationSnapshot),duration=structuredClone(w.researchProjects[0].durationSnapshot);
 w.cities[0].ownerFactionId=fixtureIds.other;w.cities[0].buildings.academy=0;w.cities[0].population=1;
 const cmd=contribute(w,'support');cmd.payload={...cmd.payload,cityId:fixtureIds.support};w=submitFormalOrder(w,cmd).world;w=advanceFormal(w,47400).world;
 expect(w.researchProjects[0].ownerFactionId).toBe(fixtureIds.player);expect(w.researchProjects[0].qualificationSnapshot).toEqual(snapshot);expect(w.researchProjects[0].durationSnapshot).toEqual(duration);
 expect(w.factions[0].techIds).toContain('fixture.modern-research');expect(w.factions[1].techIds).not.toContain('fixture.modern-research');
});
it('other Faction and same empire do not allow direct research contributions',()=>{
 const w=createFormalFixture({research:true});w.factions[0].empireId=w.factions[1].empireId=empireId('shared');
 const cmd=contribute(w,'enemy');cmd.issuerId=fixtureIds.other;cmd.payload={...cmd.payload,cityId:fixtureIds.foreign};
 expect(submitFormalOrder(w,cmd).ack?.status).toBe('rejected');expect(w.cities[2].stock.food).toBe(600);
});
it('single city research cannot be funded by a supporting city and traditional cannot use direct multi-city mode',()=>{
 const w=createFormalFixture({research:true});w.researchProjects[0].paymentMode='single-city';const cmd=contribute(w,'wrong');cmd.payload={...cmd.payload,cityId:fixtureIds.support};expect(submitFormalOrder(w,cmd).ack?.status).toBe('rejected');
 w.researchProjects[0].paymentMode='same-faction-direct';w.researchProjects[0].technologyScope='traditional';expect(()=>validateFormalWorld(w)).toThrow();
});
it('partial funding remains funding and one full transition schedules one completion',()=>{
 const w=createFormalFixture({research:true}),first=submitFormalOrder(w,contribute(w,'half',50)).world;
 expect(first.researchProjects[0].phase).toBe('funding');expect(first.researchProjects[0]).not.toHaveProperty('startedAt');
 const running=submitFormalOrder(first,contribute(first,'rest',50)).world;expect(running.researchProjects[0].phase).toBe('researching');expect(running.events).toHaveLength(1);
 expect(submitFormalOrder(running,contribute(running,'extra',1)).ack?.status).toBe('rejected');
});
it('completion replay after save/load cannot award technology or reports twice',async()=>{
 const running=submitFormalOrder(createFormalFixture({research:true}),contribute(createFormalFixture({research:true}),'fund')).world,e=running.events[0];
 const done=(await decodeSave(await encodeSave(advanceFormal(running,47400).world))).world;
 if(e.type!=='research.complete')throw new Error('Expected research');const before=canonicalJSON(done);expect(completeResearch(done,e)).toEqual([]);expect(canonicalJSON(done)).toBe(before);
 expect(done.factions[0].techIds.filter(t=>t==='fixture.modern-research')).toHaveLength(1);expect(done.completionReceipts).toHaveLength(1);
});
describe('physical project contracts',()=>{
 function large():LargeProject{return{projectId:projectId('emergency'),kind:'emergency-modernization',owner:{kind:'empire',empireId:empireId('e')},legalContributors:{kind:'current-empire-members',empireId:empireId('e')},paymentMode:'physical-shipment',initiatingCityId:fixtureIds.home,requiredResources:{food:8100000,wood:9400000,stone:8100000,gold:10400000},poolResources:{food:0,wood:0,stone:0,gold:0},shipments:[{shipmentId:shipmentId('s'),projectId:projectId('emergency'),sourceFactionId:fixtureIds.other,sourceCityId:fixtureIds.foreign,destinationCityId:fixtureIds.home,resources:{food:100,wood:0,stone:0,gold:0},dispatchedAt:0,authorizationSnapshot:{sourceCityOwnerFactionId:fixtureIds.other,contributorEmpireId:empireId('e'),checkedAt:0},phase:'in-transit'}],createdAt:0,durationMs:86400000};}
 it('in-transit resource is not included in pool; arrived resource is',async()=>{
  const w=createFormalFixture();w.largeProjects=[large()];expect((await decodeSave(await encodeSave(w))).world.largeProjects).toEqual(w.largeProjects);
  w.largeProjects[0].poolResources.food=100;expect(()=>validateFormalWorld(w)).toThrow();
  const s=w.largeProjects[0].shipments[0];w.largeProjects[0].shipments=[{...s,phase:'arrived',arrivedAt:0,arrivalEventId:eventId('arrival')}];expect(()=>validateFormalWorld(w)).not.toThrow();
 });
 it('technology transfer is Faction-only and cannot accept empire payment or foreign contribution',()=>{
  const p=large();p.kind='technology-transfer';expect(()=>largeProjectSchema.parse(p)).toThrow();p.owner={kind:'faction',factionId:fixtureIds.player};p.legalContributors={kind:'same-faction',factionId:fixtureIds.player};expect(()=>largeProjectSchema.parse(p)).toThrow();
  p.shipments[0].sourceFactionId=fixtureIds.player;p.shipments[0].authorizationSnapshot.sourceCityOwnerFactionId=fixtureIds.player;p.requiredResources={food:5700000,wood:6600000,stone:5700000,gold:7200000};p.durationMs=72*3600000;expect(()=>largeProjectSchema.parse(p)).not.toThrow();
 });
});
it('duplicate command same ID/payload is a no-op and different payload is a conflict',()=>{
 const w=createFormalFixture({research:true}),cmd=contribute(w,'once',50),next=submitFormalOrder(w,cmd).world;
 expect(submitFormalOrder(next,cmd)).toMatchObject({world:next,reports:[],ack:{status:'duplicate',originalRevision:1}});expect(next.cities[0].stock.food).toBe(550);
 const changed={...cmd,payload:{...cmd.payload,resources:{food:1,wood:1,stone:1,gold:1}}};expect(submitFormalOrder(next,changed).ack?.status).toBe('rejected');
});
it('stale revision cannot apply a new command to newer state',()=>{
 const w=createFormalFixture(),a=order(w,'first',{type:'city.rename',cityId:fixtureIds.home,name:'甲'}),next=submitFormalOrder(w,a).world;
 expect(submitFormalOrder(next,order(w,'stale',{type:'city.rename',cityId:fixtureIds.home,name:'乙'})).ack?.status).toBe('rejected');expect(next.cities[0].name).toBe('甲');
});
it('dedupe is durable after 300 commands and a codec roundtrip, without the old 256 eviction',async()=>{
 let w=createFormalFixture();const first=order(w,'command-0',{type:'city.rename',cityId:fixtureIds.home,name:'0'});
 for(let i=0;i<300;i++)w=submitFormalOrder(w,order(w,'command-'+i,{type:'city.rename',cityId:fixtureIds.home,name:String(i)})).world;
 w=(await decodeSave(await encodeSave(w))).world;expect(submitFormalOrder(w,first).ack?.status).toBe('duplicate');expect(w.commandReceipts).toHaveLength(300);
});
it('schema rejects orphan completion receipts, rewound event sequences, and contributions without durable command receipts',()=>{
 const started=submitFormalOrder(createFormalFixture({research:true}),contribute(createFormalFixture({research:true}),'fund')).world;
 expect(()=>validateFormalWorld({...started,commandReceipts:[]})).toThrow();expect(()=>validateFormalWorld({...started,sequences:{...started.sequences,event:1}})).toThrow();
 const fresh=createFormalFixture({research:true});fresh.completionReceipts=[{eventId:eventId('orphan'),projectId:fixtureIds.research,at:0}];expect(()=>validateFormalWorld(fresh)).toThrow();
});
