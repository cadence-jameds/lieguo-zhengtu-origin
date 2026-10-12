import {expect,it} from 'vitest';
import {PendingRequests,ClockConflictRetry,reconcileWorld} from './interaction';
import {createFormalFixture,fixtureIds} from './formal/fixture';
import {order} from './formal/testSupport';
import {eventId} from './formal/ids';
import {DisplayClock,economyDisplayTime} from './presentation/liveClock';
import {mapEntityKey} from './presentation/mapSemantics';
import {battlefield,dispatch,arrive} from './formal/combatTestSupport';

it('unrelated/background acknowledgements cannot unlock another pending request',()=>{
 const p=new PendingRequests();p.add('build');p.add('reports');p.finish('background');expect(p.busy).toBe(true);p.finish('reports');expect(p.busy).toBe(true);p.finish('build');expect(p.busy).toBe(false);
});
it('clock conflict retries are bounded and never cross commands, events, or campaign switches',()=>{
 const w=createFormalFixture(),o=order(w,'safe',{type:'city.rename',cityId:fixtureIds.home,name:'安全'});
 const ack={commandId:o.commandId,status:'rejected' as const,revision:1,reason:'世界版本已更新，請重新確認狀態。'};
 for(const kind of ['event','command','campaign','missing-base']){const r=new ClockConflictRetry();r.track(o);r.acknowledge(ack);const next={...w,revision:1,time:1000};if(kind==='campaign')next.campaignId=createFormalFixture({campaign:'different'}).campaignId;expect(r.refresh(next,kind==='missing-base'?NaN:1)).toEqual([]);}
 const r=new ClockConflictRetry();r.track(o);r.acknowledge(ack);const latest={...w,revision:1,time:1000},retry=r.refresh(latest,0);expect(retry).toHaveLength(1);r.acknowledge({...ack,revision:2});expect(r.refresh({...latest,revision:2},0)).toEqual([]);
});
it('unchanged world branches and map drawing keys survive passive snapshots, while changed entities invalidate',()=>{
 const w=createFormalFixture(),next=structuredClone(w);next.time=1000;next.revision++;const merged=reconcileWorld(w,next)!;
 expect(merged).not.toBe(w);expect(merged.cities).toBe(w.cities);expect(merged.factions).toBe(w.factions);expect(merged.events).toBe(w.events);expect(mapEntityKey(merged)).toBe(mapEntityKey(w));
 const changed=structuredClone(next);changed.revision++;changed.cities[0].wallLevel=1;expect(reconcileWorld(merged,changed)!.cities).not.toBe(w.cities);expect(mapEntityKey(changed)).not.toBe(mapEntityKey(w));expect(reconcileWorld(merged,structuredClone(merged))).toBe(merged);
});
it('moving armies of all factions invalidate entity imagery while stationary battles preserve its cache',()=>{
 let w=battlefield();w.cities[0].military!.units={militia:100};w.cities[1].military!.units={militia:100};w=dispatch(w,'conquest',{militia:100}).world;
 expect(mapEntityKey({...w,time:w.time+1000})).not.toBe(mapEntityKey(w));w=arrive(w).world;expect(w.armies[0].status).toBe('engaged');expect(mapEntityKey({...w,time:w.time+1000})).toBe(mapEntityKey(w));
 let enemy=battlefield();enemy.cities[1].military!.units={militia:1};enemy=dispatch(enemy,'raid',{militia:1},1,0).world;expect(mapEntityKey({...enemy,time:enemy.time+1000})).not.toBe(mapEntityKey(enemy));
});
for(const speed of [1,3,6,10,50])it(`${speed}X independent display clock follows monotonic elapsed time, stops, and reanchors on resume`,()=>{
 let now=500;const c=new DisplayClock(()=>now);c.adopt({campaignId:'one',time:12345,speed,running:true});now+=1234;c.sample();expect(c.time('one',0)).toBe(12345+1234*speed);expect(c.time('other',17)).toBe(17);c.stop();now+=86400000;c.sample();expect(c.time('one',0)).toBe(12345+1234*speed);
 c.adopt({campaignId:'one',time:20000,speed,running:true});now+=1000;c.sample();expect(c.time('one',0)).toBe(20000+1000*speed);now-=5000;c.sample();expect(c.time('one',20000)).toBe(20000);
});
it('economic display is bounded by the next uncommitted event so old rates never predict past completion',()=>{
 const w=createFormalFixture();w.events=[{type:'fixture.marker',id:eventId('marker'),at:2000,marker:'boundary'}];expect(economyDisplayTime(w,1000)).toBe(1000);expect(economyDisplayTime(w,3000)).toBe(2000);w.time=2500;expect(economyDisplayTime(w,3000)).toBe(2500);
});
