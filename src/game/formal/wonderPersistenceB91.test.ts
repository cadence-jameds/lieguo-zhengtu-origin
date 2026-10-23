import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {FormalPersistence} from '../persistence';
import {wonderWorld,fundWonder} from './wonderTestSupport';
import {order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {WONDER_DURATION} from './wonder';
const stores:FormalPersistence[]=[];
afterEach(async()=>{for(const db of stores.splice(0))await db.db.delete();});
it('B9-1 durable transactions, full export/import and Recovery preserve in-transit payment, pools, clock and completion dedupe',async()=>{
 let failure=false;const db=new FormalPersistence({suffix:'wonder-'+crypto.randomUUID(),fault:p=>{if(failure&&p==='world-write')throw Error('wonder atomic fault');}});stores.push(db);
 let w=wonderWorld();w.cities[1].stock={food:100,wood:200,stone:300,gold:400};w=await db.start(w);
 const command=order(w,{type:'wonder.ship',cityId:w.cities[1].id,projectId:w.largeProjects[0].projectId,resources:{food:100,wood:200,stone:300,gold:400}}),draft=submitFormalOrder(w,command);
 expect(draft.ack?.status).toBe('committed');failure=true;await expect(db.save(draft.world,[],w.revision)).rejects.toThrow('wonder atomic fault');
 expect((await db.loadSave()).game!.largeProjects).toEqual(w.largeProjects);expect((await db.loadSave()).game!.cities[1].stock).toEqual(w.cities[1].stock);
 failure=false;w=await db.save(draft.world,[],w.revision);expect(submitFormalOrder(w,command).ack?.status).toBe('duplicate');
 const copy=new FormalPersistence({suffix:'wonder-copy-'+crypto.randomUUID()});stores.push(copy);const imported=await copy.importSave(await db.exportStoredSave('full'));expect(imported.largeProjects).toEqual(w.largeProjects);expect(imported.logistics).toEqual(w.logistics);
 const transitPoint=(await db.backupList())[0],arrival=w.logistics![0].arrivalAt;
 w=await db.save(advanceFormal(w,arrival).world,[],w.revision);expect(w.largeProjects[0].poolResources).toEqual({food:100,wood:200,stone:300,gold:400});
 const restored=await db.restore(transitPoint.id);expect(restored.largeProjects[0].poolResources).toEqual({food:0,wood:0,stone:0,gold:0});expect(restored.logistics![0].phase).toBe('outbound');expect(submitFormalOrder(restored,command).ack?.status).toBe('duplicate');
 const replay=advanceFormal(restored,arrival);expect(replay.world.largeProjects).toEqual(w.largeProjects);
 // A corrupt current save recovers the validated in-transit checkpoint with no second debit.
 await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovered=await db.loadSave();expect(recovered.recovered).toBe(true);expect(recovered.game!.largeProjects).toEqual(restored.largeProjects);expect(recovered.game!.cities[1].stock).toEqual(restored.cities[1].stock);
},30000);

it('B9-1 Recovery across completion retains the original completion identity and truncates the future event report',async()=>{
 const db=new FormalPersistence({suffix:'wonder-clock-'+crypto.randomUUID()});stores.push(db);
 let w=fundWonder(wonderWorld());const end=w.largeProjects[0].wonder!.startedAt!+WONDER_DURATION;w=await db.start(w);const checkpoint=(await db.backupList())[0];
 const complete=advanceFormal(w,end);w=await db.save(complete.world,complete.reports,w.revision);expect((await db.readReportPage(w,0,'all')).rows.filter(r=>r.title==='世界奇觀完成')).toHaveLength(1);
 const restored=await db.restore(checkpoint.id);expect(restored.largeProjects[0].wonder!.phase).toBe('building');expect((await db.readReportPage(restored,0,'all')).rows.filter(r=>r.title==='世界奇觀完成')).toHaveLength(0);
 const replay=advanceFormal(restored,end);expect(replay.world.largeProjects).toEqual(w.largeProjects);expect(replay.reports.filter(r=>r.title==='世界奇觀完成')).toHaveLength(1);
 const saved=await db.save(replay.world,replay.reports,restored.revision);expect((await db.loadSave()).game!.largeProjects).toEqual(saved.largeProjects);expect(advanceFormal(saved,end+1).reports.filter(r=>r.title==='世界奇觀完成')).toHaveLength(0);
},60000);
