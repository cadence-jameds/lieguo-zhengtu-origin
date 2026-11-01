import {beforeEach,expect,it,vi} from 'vitest';
import {breakthroughWorld} from './breakthroughTestSupport';
import {order} from './developmentTestSupport';
import type {FormalWorld} from './model';
const storage=vi.hoisted(()=>({hasLegacyCampaign:vi.fn().mockResolvedValue(false),exportLegacyCampaign:vi.fn(),loadWithOffline:vi.fn(),save:vi.fn(),startCampaign:vi.fn(),restore:vi.fn(),importSave:vi.fn(),backupList:vi.fn(),clearSavedGames:vi.fn(),exportStoredSave:vi.fn(),readReportPage:vi.fn(),reportStatus:vi.fn().mockResolvedValue({unread:0,alerts:0,counts:{all:0,battle:0,chronicle:0}}),reportAction:vi.fn()}));
vi.mock('../persistence',async()=>{const {durableWorkerStorage}=await import('./durableWorkerTestSupport');return durableWorkerStorage(storage);});
let messages:Record<string,any>[],port:{postMessage:(r:Record<string,any>)=>void;onmessage:((e:{data:unknown})=>void)|null},initial:FormalWorld;
const send=(data:unknown)=>port.onmessage!({data});
async function until(test:()=>boolean){await vi.waitFor(()=>expect(test()).toBe(true));}
beforeEach(async()=>{
 vi.restoreAllMocks();vi.spyOn(performance,'now').mockReturnValue(0);vi.resetModules();vi.clearAllMocks();messages=[];initial=breakthroughWorld();initial.cities[1].stock={food:100,wood:200,stone:300,gold:400};
 port={postMessage:r=>messages.push(structuredClone(r)),onmessage:null};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',vi.fn());storage.loadWithOffline.mockResolvedValue({game:initial,recovered:false});storage.save.mockImplementation(async(w:FormalWorld)=>w);
 await import('../runtime.worker');send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
},60000);
it('B9-2 Worker exposes cargo and stock only after the atomic save resolves, then restart dedupes the same command',async()=>{
 let finish!:(w:FormalWorld)=>void,draft!:FormalWorld;storage.save.mockImplementation((w:FormalWorld)=>{draft=w;return new Promise<FormalWorld>(resolve=>finish=resolve);});
 const command=order(initial,{type:'breakthrough.ship',cityId:initial.cities[1].id,projectId:initial.largeProjects[1].projectId,resources:{food:100,wood:200,stone:300,gold:400}});send({type:'command',order:command});await until(()=>storage.save.mock.calls.length===1);
 expect(messages.some(r=>r.type==='state'||r.type==='commandAck')).toBe(false);expect(initial.cities[1].stock.gold).toBe(400);expect(draft.cities[1].stock.gold).toBe(0);expect(draft.largeProjects[1].poolResources.gold).toBe(0);
 finish(draft);await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');
 storage.loadWithOffline.mockResolvedValue({game:draft,recovered:false});messages=[];vi.resetModules();await import('../runtime.worker');send({type:'load'});await until(()=>messages.some(r=>r.type==='state'));messages=[];
 send({type:'command',order:command});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('duplicate');expect(storage.save).toHaveBeenCalledTimes(1);
});
it('B9-2 failed Worker save preserves the live pool, city stock and transport; retry spends once',async()=>{
 const command=order(initial,{type:'breakthrough.ship',cityId:initial.cities[1].id,projectId:initial.largeProjects[1].projectId,resources:{food:100,wood:200,stone:300,gold:400}});
 storage.save.mockRejectedValueOnce(new Error('wonder transaction fault'));send({type:'command',order:command});await until(()=>messages.some(r=>r.type==='commandAck'));expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('rejected');expect(messages.find(r=>r.type==='state')!.world).toEqual(initial);
 messages=[];send({type:'command',order:command});await until(()=>messages.some(r=>r.type==='commandAck'));const saved=messages.find(r=>r.type==='state')!.world as FormalWorld;expect(messages.find(r=>r.type==='commandAck')!.ack.status).toBe('committed');expect(saved.logistics).toHaveLength(1);expect(saved.cities[1].stock).toEqual({food:0,wood:0,stone:0,gold:0});expect(saved.largeProjects[1].poolResources).toEqual({food:0,wood:0,stone:0,gold:0});
});
