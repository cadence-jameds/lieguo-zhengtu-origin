import {runtimeFixtureIdentity} from './durableIdentityTestSupport';
import * as projectionMaps from '../admissionMap';
import * as ledger from './commandLedger';
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FormalPersistence} from '../persistence';
import {empireId,eventId,factionId} from './ids';
import {createFormalFixture} from './fixture';
import {order} from './testSupport';
import {captureIntent,revalidateInbox,type InboxCommand} from '../durableCommands';
import {EventScheduler} from './scheduler';
import {submitFormalOrder} from './reducer';
import type {FormalCommand,FormalOrder,FormalWorld} from './model';
import {diplomaticRelation,initialPolitics,legionOf,politicalScope} from './politics';
// Observe committed domain state separately from the real v2 UI wire/store.
let projectionBridge:import('./projectionTestSupport').ProjectionTestBridge;
vi.mock('../worldStream',async(importOriginal)=>{const real=await importOriginal<typeof import('../worldStream')>(),{ProjectionTestBridge}=await import('./projectionTestSupport');return {...real,WorldStream:class extends real.WorldStream{constructor(){const bridge=new ProjectionTestBridge(true);projectionBridge=bridge;super(crypto.randomUUID(),bridge.reader);}}};});
let store:FormalPersistence,now=0;
let messages:any[],port:{onmessage:((e:{data:unknown})=>void)|null;postMessage:(v:any)=>void};
const send=(data:unknown)=>port.onmessage!({data:runtimeFixtureIdentity(data,messages)});
const until=async(fn:()=>boolean)=>vi.waitFor(()=>expect(fn()).toBe(true),{timeout:15000});
const done=(id:string)=>messages.some(m=>m.type==='requestDone'&&m.requestId===id);
const latest=()=>messages.filter(m=>m.type==='state').at(-1)?.world as FormalWorld;
const ack=(o:FormalOrder)=>messages.filter(m=>m.type==='commandAck'&&m.ack.commandId===o.commandId).at(-1)?.ack;
async function boot(){
 vi.resetModules();vi.doMock('../admissionMap',()=>projectionMaps);vi.doMock('./commandLedger',()=>ledger);vi.doMock('../persistence',()=>({
  hasLegacyCampaign:async()=>false,exportLegacyCampaign:async()=>'',
  ...Object.fromEntries(['acquireWriter','writerContext','receiveCommand','commandStatus','queryCommandStatus','pendingCommands','commandPage','finishCommand','noteCommandFailure','loadWithOffline','save','restore','importSave','backupList','clearSavedGames','exportStoredSave','readReportPage','readCityIntel','reportStatus','reportAction'].map(name=>[name,(...args:any[])=>(store[name as keyof FormalPersistence] as Function).apply(store,args)])),
  loadWithOffline:(progress:Parameters<FormalPersistence['loadWithOffline']>[1])=>store.loadWithOffline(Date.now(),progress),
  startCampaign:(w:FormalWorld)=>store.start(w)
 }));
 messages=[];port={onmessage:null,postMessage:v=>{messages.push(structuredClone(projectionBridge.receive(v)));}};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',()=>1);await import('../runtime.worker');send({type:'load',requestId:'load'});await until(()=>done('load'));expect(messages.filter(m=>m.type==='error')).toEqual([]);
}
beforeEach(()=>{now=0;vi.spyOn(Date,'now').mockReturnValue(1800000000000);vi.spyOn(performance,'now').mockImplementation(()=>now);store=new FormalPersistence({suffix:'runtime-durable-'+crypto.randomUUID()});});
afterEach(async()=>{await store.db.delete();vi.doUnmock('../persistence');vi.doUnmock('./commandLedger');vi.restoreAllMocks();vi.unstubAllGlobals();});

it('commits a guild declaration after private catch-up, persists the original click and never duplicates it',async()=>{
 const w=createFormalFixture({speed:25});
 w.factions[0].age=1;
 w.cities[0].buildings.embassy=1;
 const create=order(w,'form-legion',{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'備戰軍團'});
 const created=submitFormalOrder(w,create);
 expect(created.ack?.status,created.ack?.reason).toBe('committed');
 const start=created.world;const town=start.cities[0];
 const marker=eventId(String(start.sequences.event++).padStart(16,'0'));
 start.events=new EventScheduler([...start.events,{id:marker,type:'fixture.marker',at:10000,marker:'unrelated-world-event'}]).snapshot();
 await store.start(start);await boot();
 const before=latest(),view=projectionBridge.store.getWorld()!;
 expect(legionOf(before,before.playerFactionId)?.name).toBe('備戰軍團');
 expect(before.events.some(e=>e.id===marker)).toBe(true);
 now=1000;
 const target=before.cities[2].ownerFactionId;
 const o=order(before,'guild-war',{type:'politics',cityId:town.id,action:'war',target});
 const intent=captureIntent(view,o);
 send({type:'command',order:o,...intent,branch:view.projection.branch,projection:view.projection,requestId:'guild-war'});
 await until(()=>done('guild-war'));
 const row=await store.commandStatus(o.campaignId,o.commandId);
 expect(row!.state,row?.ack?.reason).toBe('committed');
 expect(row!.order).toEqual(o);
 expect(row!.playerBase).toEqual(intent.playerBase);
 expect(ack(o)).toEqual(row!.ack);
 const after=(await store.loadSave()).game!;
 expect(after.events.some(e=>e.id===marker)).toBe(false);
 expect(diplomaticRelation(after,after.playerFactionId,target)).toBe('war');
 expect(after.commandReceipts.filter(r=>r.commandId===o.commandId)).toHaveLength(1);
 send({type:'commandQuery',campaignId:o.campaignId,commandId:o.commandId,requestId:'guild-war-query'});
 await until(()=>done('guild-war-query'));expect(ack(o)).toEqual(row!.ack);
});

function pending(w:FormalWorld,p:FormalCommand):InboxCommand {
 const o=order(w,'waiting',p);
 return {...captureIntent(w,o),order:o,campaignId:o.campaignId,commandId:o.commandId,issuerId:o.issuerId,
  fingerprint:'test-placeholder',originalRevision:o.expectedRevision,writerEpoch:1,branch:0,state:'pending',createdAt:0,deadline:120000,attempts:0,nextAttemptAt:0};
}

it('revalidates unchanged politics but does not rebase a war when relation or political scope changed',()=>{
 const w=createFormalFixture(),me=w.playerFactionId,enemy=w.cities[2].ownerFactionId;
 const p={type:'politics',cityId:w.cities[0].id,action:'war',target:enemy} as const,row=pending(w,p);
 const later=structuredClone(w);later.revision++;later.time=1;later.cities[2].stock.food++;
 expect(revalidateInbox(later,row)).toEqual({...row.order,expectedRevision:later.revision,issuedWorldTime:later.time});
 const friendly=structuredClone(later);friendly.politics=initialPolitics();friendly.politics.relations=[{a:me,b:enemy,state:'friendly'}];
 expect(revalidateInbox(friendly,row)).toBeUndefined();
 const aligned=structuredClone(later);aligned.politics=initialPolitics();aligned.politics.legions.push({id:'legion:one',name:'新軍團',description:'',leader:enemy,members:[enemy],empireId:null});
 expect(politicalScope(aligned,enemy)).toBe('legion:one');expect(revalidateInbox(aligned,row)).toBeUndefined();
 const noTown=structuredClone(later);noTown.cities[0].ownerFactionId=enemy;
 expect(revalidateInbox(noTown,row)).toBeUndefined();
 const oldRow={...row,playerBase:undefined};
 expect(revalidateInbox(later,oldRow)).toBeUndefined();
});

it('revalidates an unchanged guild invitation but fences recipient join or embassy-capacity changes',()=>{
 const w=createFormalFixture();w.factions[0].age=1;w.cities[0].buildings.embassy=2;
 const formed=submitFormalOrder(w,order(w,'create-for-invite',{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'團'}));
 expect(formed.ack?.status,formed.ack?.reason).toBe('committed');
 const me=formed.world.playerFactionId,enemy=formed.world.cities[2].ownerFactionId;
 const p={type:'politics',cityId:formed.world.cities[0].id,action:'legion-invite',target:enemy} as const,row=pending(formed.world,p);
 const later=structuredClone(formed.world);later.revision++;later.time++;
 expect(revalidateInbox(later,row)).toBeDefined();
 const changed=structuredClone(later);changed.cities[0].buildings.embassy=1;
 expect(revalidateInbox(changed,row)).toBeUndefined();
 const joined=structuredClone(later);legionOf(joined,me)!.members.push(enemy);
 expect(revalidateInbox(joined,row)).toBeUndefined();
});

it('does not broaden a war to newly joined members of a subsidiary legion',()=>{
 const w=createFormalFixture(),enemy=w.cities[2].ownerFactionId;
 const subject=factionId('subject'),enrolled=factionId('new-member'),empire=empireId('other');
 w.politics=initialPolitics();w.politics.legions=[
  {id:'legion:lead',name:'對方主團',description:'',leader:enemy,members:[enemy],empireId:empire},
  {id:'legion:subject',name:'對方參加盟團',description:'',leader:subject,members:[subject],empireId:empire},
 ];w.politics.empires=[{id:empire,name:'帝國',leader:enemy,legions:w.politics.legions.map(l=>l.id),color:'#000'}];
 const row=pending(w,{type:'politics',cityId:w.cities[0].id,action:'war',target:enemy});
 const later=structuredClone(w);later.revision++;
 expect(revalidateInbox(later,row)).toBeDefined();
 later.politics!.legions[1].members.push(enrolled);
 expect(revalidateInbox(later,row)).toBeUndefined();
});
