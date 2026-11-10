import {prepareAdmissionMap} from './admissionMap';
import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import type {FormalCommand,FormalWorld} from './formal/model';
import {createFormalWorld} from './formal/generator';
import {FormalPersistence} from './persistence';
import {WorldProjection} from './worldProjection';
import {captureIntent,revalidateInbox} from './durableCommands';
import {playerOrderBase,playerOrderWithBase} from './orderAdmission';
import {governanceBase} from './governanceAdmission';
import {order,build} from './formal/developmentTestSupport';
import {submitFormalOrder,advanceFormal} from './formal/reducer';
import {craftWorld} from './formal/gateDeltaTestSupport';
import {castleSource,producerUnits} from './formal/buildingDetailData';
import {sealProjectionScenario,projectionSyntheticWorld} from './formal/projectionBenchmarkSupport';
import {WorldStream} from './worldStream';
import {PresentationStore} from './presentationStore';
import * as ledger from './formal/commandLedger';
const dbs:FormalPersistence[]=[];afterEach(async()=>{vi.restoreAllMocks();await Promise.all(dbs.splice(0).map(p=>p.db.delete()));});
const identity=(w:FormalWorld,seq=1)=>({protocolVersion:2 as const,campaignId:w.campaignId,revision:w.revision,branch:w.ledger!.anchor.branch,writerEpoch:w.ledger!.anchor.writerEpoch,sessionId:'admission-test',projectionSequence:seq});
it('every semantic admission category matches the original world and keeps exact clicked payload/revision',async()=>{
 const w=await projectionSyntheticWorld(1000),reader=new WorldProjection(),view=reader.build(w,identity(w)),cityId=w.cities[0].id;
 const payloads:FormalCommand[]=[{type:'city.rename',cityId,name:'意圖'},{type:'field.upgrade',cityId,slot:0},{type:'building.upgrade',cityId,key:'center'},{type:'building.upgrade',cityId,key:'wall'},{type:'building.demolish',cityId,key:'center'},{type:'military.recruit',cityId,unitId:'militia',count:7},{type:'military.cancel',cityId,trainingCommandId:'command:none' as never},{type:'age.start',cityId},{type:'research.start',cityId,techId:'economy.food.1'},{type:'research.contribute',cityId,projectId:'research:none' as never,resources:{food:10,wood:0,stone:0,gold:0}},{type:'city.promote',cityId},{type:'logistics.auto.set',cityId,rules:[]},{type:'logistics.configure',cityId,rules:[],settings:{reserve:{food:0,wood:0,stone:0,gold:0},manualCaravans:0}},{type:'campaign.configure',cityId,speed:25,offlineHours:12},{type:'developer.configure',cityId,enabled:true,speed:100},{type:'army.dispatch',cityId,mission:'raid',target:{kind:'city',cityId:w.cities[1].id},units:{militia:9}},{type:'governance.set',cityId,enabled:true,policy:'reserve',budget:2400,reserve:180},{type:'player.rebirth',cityId,x:3,y:4,name:'復國'},{type:'player.end',cityId},{type:'wonder.start',cityId,hostCityId:cityId},{type:'breakthrough.start',cityId},{type:'tasks.claim',cityId,taskId:'growth-01',rewardVersion:2,expectedResources:{food:1,wood:1,stone:1,gold:1}}];
 for(const payload of payloads){const command=order(w,payload);expect(playerOrderBase(view,payload),payload.type).toEqual(playerOrderBase(w,payload,2));if(payload.type==='army.dispatch'){const base=playerOrderBase(view,payload)!;expect(base.fingerprint).toMatch(/^intent-v2:/);expect(base.fingerprint.length).toBeLessThan(2048);expect(base.fingerprint).not.toContain(w.worldLayer!.terrain);}else expect(captureIntent(view,command),payload.type).toEqual(captureIntent(w,command));const later={...w,time:w.time+1000,revision:w.revision+1};expect(playerOrderWithBase(later,command,playerOrderBase(view,payload),0,w.revision)).toEqual(playerOrderWithBase(later,command,playerOrderBase(w,payload),0,w.revision));expect(command.payload).toBe(payload);expect(command.expectedRevision).toBe(w.revision);}
});
it('governance ABA uses exact verified last-write evidence and cannot be bridged by a visually identical configuration',async()=>{
 const p=new FormalPersistence({suffix:'projection-aba-'+crypto.randomUUID()});dbs.push(p);const raw=createFormalWorld({campaign:'projection-aba',seed:90217});build(raw.cities[0],'townhall',1);let w=await p.start(raw);await prepareAdmissionMap(w);const reader=new WorldProjection(),payload={type:'governance.set' as const,cityId:w.cities[0].id,enabled:false,policy:'reserve' as const,budget:2400,reserve:180};
 const initial=reader.build(w,identity(w)),original=order(w,payload),intent=captureIntent(initial,original);
 for(let i=0;i<3;i++){const t=submitFormalOrder(w,order(w,{...payload,enabled:i===1}));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=await p.save(t.world,t.reports,w.revision);const view=reader.build(w,identity(w,i+2));expect(governanceBase(view,payload.cityId)).toEqual(governanceBase(w,payload.cityId));}
 expect(governanceBase(initial,payload.cityId).fingerprint).not.toBe(governanceBase(w,payload.cityId).fingerprint);
 const row={order:original,...intent} as Parameters<typeof revalidateInbox>[1];expect(revalidateInbox(w,row)).toBeUndefined();expect(reader.metrics.receiptsRead).toBe(3);expect(reader.metrics.rebuilds).toBe(1);
});
it('craftsman castle source, producer eligibility and permanent provenance agree before and after completion',async()=>{
 let raw=craftWorld();const source=raw.extinction!.craftsmen[0].civilizationId,payload={type:'craftsman.castle' as const,cityId:raw.cities[0].id,craftsmanId:raw.extinction!.craftsmen[0].id};const t=submitFormalOrder(raw,order(raw,payload));expect(t.ack?.status,t.ack?.reason).toBe('committed');let w=await sealProjectionScenario(t.world),reader=new WorldProjection(),view=reader.build(w,identity(w));expect(view.derived.castleSources[payload.cityId]).toBe(source);expect(castleSource(view,view.cities[0])).toBe(castleSource(w,w.cities[0]));expect(producerUnits(view,view.cities[0],'castle')).toEqual(producerUnits(w,w.cities[0],'castle'));
 const job=w.cities[0].economy!.construction[0];w=await sealProjectionScenario(advanceFormal(w,job.startsAt+job.durationMs).world);view=reader.build(w,identity(w,2));expect(view.cities[0].castleCivilizationId).toBe(source);expect(castleSource(view,view.cities[0])).toBe(source);
});
it.each([0,1000,10000,30000,60000])('%i history: normal projection/patch never reads, serializes or materializes the full ledger',async count=>{
 const w=await projectionSyntheticWorld(count),reader=new WorldProjection(),stream=new WorldStream('history-test',reader),store=new PresentationStore(),writer={branch:0,writerEpoch:0},snapshot=stream.publish(w,writer);expect(store.receive(structuredClone(snapshot)).accepted).toBe(true);expect(reader.metrics.receiptsRead).toBe(count);const before=store.getWorld()!,next=await sealProjectionScenario({...w,time:1000,revision:w.revision+1});
 const history=vi.spyOn(ledger,'commandHistory').mockImplementation(()=>{throw Error('Full history access on ordinary projection');}),serialization=vi.spyOn(JSON,'stringify');const patch=stream.publish(next,writer);expect(serialization).not.toHaveBeenCalled();expect(store.receive(structuredClone(patch)).accepted).toBe(true);expect(history).not.toHaveBeenCalled();expect(reader.metrics.receiptsRead).toBe(count);expect(reader.metrics.rebuilds).toBe(1);expect(store.getWorld()!.cities).toBe(before.cities);serialization.mockRestore();history.mockRestore();expect(JSON.stringify(patch).length).toBeLessThan(800);expect(JSON.stringify(snapshot)).not.toContain('projection-seed-');expect(store.getWorld()).not.toHaveProperty('commandReceipts');
},30000);
