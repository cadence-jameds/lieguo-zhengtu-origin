import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {FormalPersistence} from '../persistence';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {advanceFormal} from './reducer';
import {isMissionArmy} from './combatModel';
import {reportId} from './ids';
import {reportTime} from '../presentation/reportClock';
const stores:FormalPersistence[]=[];
const store=()=>{const s=new FormalPersistence({suffix:'report26-'+crypto.randomUUID()});stores.push(s);return s;};
afterEach(async()=>{vi.restoreAllMocks();for(const s of stores.splice(0))await s.db.delete();});
it('scout observation real time survives a 1X to 100X change before delivery and full export/reimport',async()=>{
 let real=1791446400000;vi.spyOn(Date,'now').mockImplementation(()=>real);const s=store(),draft=battlefield();draft.cities[0].military!.units={scout:3};let w=await s.start(draft),t=dispatch(w,'scout',{scout:3});w=await s.save(t.world,t.reports,w.revision);t=arrive(w);real+=t.world.time-w.time;w=await s.save(t.world,t.reports,w.revision);const a=w.armies.filter(isMissionArmy)[0];expect(a.pendingIntel?.observedRealAt).toBe(real);expect(a.pendingReport?.realResolvedAt).toBe(real);const observationReal=real;
 t=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:100});w=await s.save(t.world,t.reports,w.revision);const returnAt=w.armies.filter(isMissionArmy)[0].arrivalAt;real+=Math.ceil((returnAt-w.time)/100);t=advanceFormal(w,returnAt);w=await s.save(t.world,t.reports,w.revision);const r=(await s.readReportPage(w,0,'battle')).rows[0];expect(r.realAt).toBe(real);expect(r.battle?.intel?.observedRealAt).toBe(observationReal);expect(r.battle?.realResolvedAt).toBe(observationReal);expect(r.clockSpeed).toBe(100);
 const q=store(),imported=await q.importSave(await s.exportStoredSave('full'));expect((await q.readReportPage(imported)).rows[0]).toEqual(r);expect(reportTime()).toBe('時間未記錄');
});
it('unread alerts, read/clear and tabs stay campaign/cursor bounded in the independent BattleReports store',async()=>{
 const s=store(),draft=battlefield();draft.cities[0].military!.units={militia:20};let w=await s.start(draft),t=dispatch(w,'raid',{militia:20});w=await s.save(t.world,t.reports,w.revision);t=arrive(w);w=await s.save(t.world,t.reports,w.revision);const row=(await s.readReportPage(w)).rows[0];expect((await s.reportStatus(w)).alerts).toBe(1);expect(row.realAt).toBeGreaterThan(0);expect(row.read).toBe(false);
 const future={...row,id:reportId('future'),sequence:w.sequences.report,key:'future'};await s.db.BattleReports.put(future);const before=(await s.loadSave()).game;await s.reportAction(w,'read',[row.id]);expect((await s.reportStatus(w)).unread).toBe(0);expect((await s.readReportPage(w,0,'chronicle')).rows).toHaveLength(0);await s.reportAction(w,'clear',undefined,'battle');expect((await s.readReportPage(w)).rows).toHaveLength(0);expect(await s.db.BattleReports.get('future')).toEqual(future);expect((await s.loadSave()).game).toEqual(before);
});
