import {expect,it,vi} from 'vitest';
import {wonderWorld} from './wonderTestSupport';
import {build,order} from './developmentTestSupport';
import {dispatchLogistics,handleEconomyEvent} from './economy';
import {EventScheduler} from './scheduler';
import {logisticsAllocation,logisticsAvailable,type LogisticsPurpose} from './logisticsAllocation';
import {logisticsRoute} from './logisticsRoute';
import * as routing from './routing';
const {route}=routing;
import {generateTerrain} from './terrain';
import {cityId} from './ids';
import {zeroResources,type FormalWorld,type LogisticsShipment} from './model';

const grid=(w:FormalWorld,width:number,height:number,terrain:string|undefined):FormalWorld=>({
 ...w,dimensions:{width,height},worldLayer:terrain===undefined?undefined:{regionSize:32,terrain,wildSites:[]}
});

it('reuses only directed terrain geometry; warm paths remain owned and invalid terrain does not reuse a stale result',()=>{
 const fixture=wonderWorld(false),w=grid(fixture,3,1,'LWL');
 const left={x:0,y:0},middle={x:1,y:0},right={x:2,y:0};
 expect(logisticsRoute(w,left,middle).distance).toBe(2);
 expect(logisticsRoute(w,middle,left).distance).toBe(1);
 const cold=logisticsRoute(w,left,right);
 cold.path[1].x=200;cold.path.pop();
 const warm=logisticsRoute(w,left,right),exact=route(w,left,right);
 expect(warm).toEqual(exact);expect(warm.path).not.toBe(exact.path);
 warm.path[1].y=50;
 expect(logisticsRoute(w,left,right)).toEqual(exact);
 expect(logisticsRoute(grid(fixture,3,1,'LLL'),left,right).distance).toBe(2);
 expect(()=>logisticsRoute(grid(fixture,3,1,'LML'),left,right)).toThrow('No traversable route');
 expect(logisticsRoute(grid(fixture,1,3,'LLL'),left,{x:0,y:2})).toEqual({path:[left,{x:0,y:1},{x:0,y:2}],distance:2});
 expect(logisticsRoute(grid(fixture,3,1,undefined),left,right).distance).toBe(2);
});

it('evicts old routes as the recurring-pair set grows, still returning the exact original geometry',()=>{
 const w=grid(wonderWorld(false),132,1,'L'.repeat(132)),start={x:0,y:0};
 const spy=vi.spyOn(routing,'route');
 try {
  for(let x=1;x<=130;x++)expect(logisticsRoute(w,start,{x,y:0}).distance).toBe(x);
  expect(spy).toHaveBeenCalledTimes(130);
  expect(logisticsRoute(w,start,{x:130,y:0}).distance).toBe(130);
  expect(spy).toHaveBeenCalledTimes(130);
  expect(logisticsRoute(w,start,{x:1,y:0})).toEqual({path:[start,{x:1,y:0}],distance:1});
  expect(spy).toHaveBeenCalledTimes(131);
 } finally {spy.mockRestore();}
});

it('a recurring haul recomputes every trip reservation, event and new faction tech speed even with warm geometry',()=>{
 const w=wonderWorld(false),[c,d]=w.cities;
 const scheduler=new EventScheduler(w.events),resources={...zeroResources(),food:2000};
 c.fields=[];d.fields=[];c.stock={...resources,food:12000};d.stock=zeroResources();
 for(let i=0;i<2;i++){
  const o=order(w,{type:'logistics.dispatch',cityId:c.id,destinationCityId:d.id,resources});
  dispatchLogistics(w,c,o,d.id,resources,scheduler);
 }
 const [first,second]=w.logistics!;
 expect(first.path).toEqual(second.path);expect(first.path).not.toBe(second.path);expect(first.path[0]).not.toBe(second.path[0]);
 expect(first.arrivalEventId).not.toBe(second.arrivalEventId);expect(d.economy!.reservedIncoming.food).toBe(4000);
 w.factions[0].techIds.push('logistics.dispatch');
 const o=order(w,{type:'logistics.dispatch',cityId:c.id,destinationCityId:d.id,resources});
 dispatchLogistics(w,c,o,d.id,resources,scheduler);
 const third=w.logistics!.at(-1)!;
 expect(third.arrivalAt-w.time).toBe(Math.max(1,Math.ceil(first.distance*60000*.9)));
 expect(third.arrivalAt).toBeLessThan(first.arrivalAt);expect(d.economy!.reservedIncoming.food).toBe(6000);
 for(const e of scheduler.snapshot().filter(e=>e.type==='logistics.arrive'||e.type==='logistics.return')){w.time=e.at;expect(handleEconomyEvent(w,e,scheduler)).toBe(true);}
 expect(w.logistics).toHaveLength(0);expect(d.economy!.reservedIncoming.food).toBe(0);expect(d.stock.food).toBeGreaterThanOrEqual(6000);
});

function oldAvailable(w:FormalWorld,c:FormalWorld['cities'][number],purpose:LogisticsPurpose,destination?:string){
 const a=logisticsAllocation(c),trips=(w.logistics??[]).filter(t=>t.sourceCityId===c.id);
 const busy=trips.reduce((n,t)=>n+t.caravans,0),purposeUsed=trips.filter(t=>(t.purpose??'manual')===purpose).reduce((n,t)=>n+t.caravans,0);
 const used=trips.filter(t=>(t.purpose??'manual')===purpose&&(purpose!=='general-auto'||t.destinationCityId===destination)).reduce((n,t)=>n+t.caravans,0);
 const quota=purpose==='general-auto'?(c.autoLogistics??[]).find(r=>r.destinationCityId===destination)?.maxCaravans??0:purpose==='wonder-auto'?a.wonder:a.manual;
 return a.allocated>a.total?0:Math.max(0,Math.min(quota-used,a.total-busy,purpose==='general-auto'?a.general-purposeUsed:Infinity));
}

it('one-pass caravan allocation preserves quotas, legacy trips and stale route allocations under many in-flight trips',()=>{
 const w=wonderWorld(),[c,d,e]=w.cities,other=cityId('foreign-route'),retired=cityId('retired-route');
 const setTrip=(sourceCityId:typeof c.id,destinationCityId:typeof d.id,purpose:LogisticsPurpose|undefined,caravans:number)=>({sourceCityId,destinationCityId,purpose,caravans}) as LogisticsShipment;
 build(c,'market',15);
 c.autoLogistics=[{destinationCityId:d.id,maxCaravans:4,reserve:zeroResources()},{destinationCityId:e.id,maxCaravans:3,reserve:zeroResources()}];
 c.logisticsSettings={reserve:zeroResources(),manualCaravans:4,wonder:{projectId:w.largeProjects[0].projectId,maxCaravans:4,enabled:true}};
 w.logistics=[...Array.from({length:900},(_,i)=>setTrip(cityId('other-'+i),d.id,'manual',1)),
  setTrip(c.id,d.id,undefined,1),setTrip(c.id,d.id,'general-auto',2),setTrip(c.id,retired,'general-auto',2),
  setTrip(c.id,other,'wonder-auto',1)];
 for(const market of [15,8]){build(c,'market',market);
  for(const purpose of ['manual','general-auto','wonder-auto'] as const)
   for(const dest of [d.id,e.id,retired,undefined])expect(logisticsAvailable(w,c,purpose,dest)).toBe(oldAvailable(w,c,purpose,dest));
 }
});

it.skipIf(process.env.LOGISTICS_ROUTE_BENCH!=='1')('measures same ordered repeated routes, cold engine vs bounded route cache',()=>{
 const w=grid(wonderWorld(false),384,384,generateTerrain(90217));
 const points=Array.from({length:32},(_,i)=>[{x:19+(i%8)*6,y:34+Math.floor(i/8)*14},{x:95+(i%8)*7,y:72+Math.floor(i/8)*13}] as const);
 const repeat=40,runs=points.length*repeat;
 function work(fn:typeof route){let checksum=0;
  for(let i=0;i<repeat;i++)for(const [a,b]of points){const value=fn(w,a,b);checksum+=value.distance*13+value.path.length;}
  return checksum;
 }
 const times=(fn:typeof route)=>{const start=performance.now(),checksum=work(fn);return{ms:performance.now()-start,checksum};};
 const uncached=times(route),cached=times(logisticsRoute);
 expect(cached.checksum).toBe(uncached.checksum);
 console.log(JSON.stringify({runs,distinctDirectedRoutes:points.length,uncachedMs:uncached.ms,cachedMs:cached.ms,checksum:cached.checksum}));
},30000);
