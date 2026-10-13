import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {FormalPersistence} from '../persistence';
import {battlefield,issue} from './combatTestSupport';
import {build,order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {decodeSave,encodeSave} from './saveCodec';
import {validateFormalWorld,reportSchema} from './schema';
import {HOUR} from './economy';
import {advanceOffline} from './offline';
import {canonicalJSON} from './canonical';
import {diplomacyChanges,diplomacySnapshot} from './diplomacyReports';
import type {FormalCommand,FormalWorld} from './model';
const stores:FormalPersistence[]=[];afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
function fixture(){const w=battlefield();w.offlineHours=6;for(const c of w.cities.slice(0,5)){build(c,'embassy',15);w.factions.find(f=>f.id===c.ownerFactionId)!.age=2;}return w;}
const political=(w:FormalWorld,i:number,action:Extract<FormalCommand,{type:'politics'}>['action'],extra:object={})=>issue(w,{type:'politics',cityId:w.cities[i].id,action,...extra},w.cities[i].ownerFactionId);
it('real create, invitation, acceptance, edit, succession and dissolution emit player notices once',()=>{
 let w=fixture();const t=political(w,0,'legion-create',{name:'玩家軍團'});expect(t.reports).toHaveLength(1);expect(reportSchema.parse(t.reports[0]).category).toBe('diplomacy');w=t.world;
 const invite=political(w,0,'legion-invite',{target:w.factions[1].id});expect(invite.reports[0].text).toContain('軍團邀請已送達');w=invite.world;
 const cmd=order(w,{type:'politics',cityId:w.cities[1].id,action:'request-accept',requestId:w.politics!.requests[0].id},undefined,w.factions[1].id),join=submitFormalOrder(w,cmd);expect(join.reports[0].text).toContain('加入軍團');expect(submitFormalOrder(join.world,cmd).reports).toEqual([]);w=join.world;
 const rejected=submitFormalOrder(w,order(w,{type:'politics',cityId:w.cities[1].id,action:'legion-dissolve'},undefined,w.factions[1].id));expect(rejected.ack!.status).toBe('rejected');expect(rejected.reports).toEqual([]);expect(rejected.world).toBe(w);
 const edit=political(w,0,'legion-edit',{name:'新名',description:'新簡介'});expect(edit.reports[0].text).toContain('資料更新');w=edit.world;
 const transfer=political(w,0,'legion-transfer',{target:w.factions[1].id});expect(transfer.reports[0].text).toContain('軍團長變更');w=transfer.world;
 const end=political(w,1,'legion-dissolve');expect(end.reports[0].text).toContain('解散軍團');expect(end.world.politics!.legions).toHaveLength(0);
});
it('unrelated AI politics and secret military changes do not leak into diplomacy',()=>{
 let w=fixture();const ai=political(w,2,'legion-create',{name:'敵方秘密軍團'});expect(ai.reports).toEqual([]);w=ai.world;const snapshot=diplomacySnapshot(w);w.cities[2].military!.units={militia:91827};w.cities[2].stock.gold=45678;w.factions[2].techIds.push('irrelevant-secret');expect(diplomacyChanges(w,snapshot)).toEqual([]);
});
it('friendly notice, six-hour expiry, war and peace follow actual scopes and replay is empty',()=>{
 let w=fixture(),t=political(w,0,'friendly-propose',{target:w.factions[1].id});w=t.world;expect(t.reports[0].text).toContain('友好提議');t=political(w,1,'request-accept',{requestId:w.politics!.requests[0].id});w=t.world;expect(t.reports[0].text).toContain('友好成立');t=political(w,0,'friendly-end',{target:w.factions[1].id});w=t.world;expect(t.reports[0].text).toContain('六世界小時');const at=w.politics!.relations[0].endsAt!,expiry=advanceFormal(w,at);expect(expiry.reports.filter(r=>r.category==='diplomacy')).toHaveLength(1);expect(advanceFormal(expiry.world,at).reports).toEqual([]);w=expiry.world;t=political(w,0,'war',{target:w.factions[1].id});expect(t.reports[0].text).toContain('宣戰');t=political(t.world,0,'peace',{target:w.factions[1].id});expect(t.reports[0].text).toContain('停戰');
});
it('empire founding and leader loss reconciliation are real player-visible events',()=>{
 let w=fixture();w=political(w,0,'legion-create',{name:'甲'}).world;w=political(w,1,'legion-create',{name:'乙'}).world;w=political(w,0,'empire-propose',{target:w.factions[1].id,name:'真帝國'}).world;const t=political(w,1,'request-accept',{requestId:w.politics!.requests[0].id});expect(t.reports[0].text).toContain('成立帝國');w=t.world;const leave=political(w,1,'empire-leave');expect(leave.reports[0].text).toContain('所屬軍團變更');
});
it('capacity includes the leader; pending acceptance rechecks capacity atomically',()=>{
 let w=fixture();w.cities[0].buildings.embassy=1;w=political(w,0,'legion-create',{name:'一人軍團'}).world;w=political(w,1,'legion-apply',{target:w.factions[0].id}).world;const t=submitFormalOrder(w,order(w,{type:'politics',cityId:w.cities[0].id,action:'request-accept',requestId:w.politics!.requests[0].id}));expect(t.ack!.status).toBe('rejected');expect(t.reports).toEqual([]);expect(t.world).toBe(w);expect(w.politics!.legions[0].members).toHaveLength(1);
});
it('transaction rollback, four filters, 50-row pagination, quick/full, old saves and Recovery retain notification boundaries',async()=>{
 let fail=false;const s=new FormalPersistence({suffix:'v94-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('v94 injected rollback');}});stores.push(s);let w=await s.start(fixture());const create=order(w,{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'持久軍團'}),t=submitFormalOrder(w,create);fail=true;await expect(s.save(t.world,t.reports,w.revision)).rejects.toThrow('v94 injected rollback');expect((await s.reportStatus(w)).counts.diplomacy).toBe(0);fail=false;w=await s.save(t.world,t.reports,w.revision);
 for(let i=0;i<52;i++){const t=political(w,0,'legion-edit',{name:'持久軍團'+i});w=await s.save(t.world,t.reports,w.revision);}
 expect((await s.reportStatus(w)).counts).toEqual({all:53,battle:0,diplomacy:53,chronicle:0});expect((await s.readReportPage(w,0,'diplomacy')).rows).toHaveLength(50);expect((await s.readReportPage(w,1,'diplomacy')).rows).toHaveLength(3);for(const page of [0,1])expect((await s.readReportPage(w,page,'diplomacy')).count).toBe(53);
 const row=(await s.readReportPage(w,0,'diplomacy')).rows[0];await s.reportAction(w,'read',[row.id],'diplomacy');expect((await s.reportStatus(w)).unread).toBe(52);expect((await decodeSave(JSON.parse(await s.exportStoredSave('quick')))).reports).toBeUndefined();
 const copy=new FormalPersistence({suffix:'v94-copy-'+crypto.randomUUID()});stores.push(copy);const full=await s.exportStoredSave('full'),imported=await copy.importSave(full);expect((await copy.reportStatus(imported)).counts.diplomacy).toBe(53);expect((await copy.readReportPage(imported,0,'diplomacy')).rows[0].read).toBe(true);
 const checkpoint=(await s.backupList())[0];let next=political(w,0,'legion-edit',{name:'回復前'});w=await s.save(next.world,next.reports,w.revision);const restored=await s.restore(checkpoint.id);expect((await s.reportStatus(restored)).counts.diplomacy).toBe(53);expect(submitFormalOrder(restored,create).reports).toEqual([]);expect(advanceFormal(restored,restored.time).reports).toEqual([]);
 await copy.reportAction(imported,'clear',[row.id],'diplomacy');expect((await copy.reportStatus(imported)).counts.diplomacy).toBe(52);await copy.reportAction(imported,'clear',undefined,'diplomacy');expect((await copy.reportStatus(imported)).counts.all).toBe(0);
 const old=fixture();const oldText=await encodeSave(old);expect((await decodeSave(oldText)).world.politics).toBeUndefined();validateFormalWorld((await decodeSave(oldText)).world);
});
it('chunked online and offline political expiry give identical state and reports at 1/10/50X',()=>{
 for(const speed of [1,10,50]){let w=fixture();w.speed=speed;w=political(w,0,'friendly-propose',{target:w.factions[1].id}).world;w=political(w,1,'request-accept',{requestId:w.politics!.requests[0].id}).world;w=political(w,0,'friendly-end',{target:w.factions[1].id}).world;const end=w.time+6*HOUR,one=advanceFormal(w,end),offline=advanceOffline(w,1000,1000+6*HOUR/speed);expect(offline.world.politics).toEqual(one.world.politics);expect(offline.reports).toEqual(one.reports);let chunk=w;const reports=[];for(let i=0;i<6;i++){const t=advanceFormal(chunk,w.time+(i+1)*HOUR);chunk=t.world;reports.push(...t.reports);}expect(reports).toEqual(one.reports);const normalize=(x:FormalWorld)=>{x=structuredClone(x);x.revision=0;for(const r of x.commandReceipts)r.committedRevision=0;return canonicalJSON(x);};expect(normalize(chunk)).toBe(normalize(one.world));}
});
