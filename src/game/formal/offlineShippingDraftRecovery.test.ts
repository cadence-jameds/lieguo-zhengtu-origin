import {afterEach,expect,it,vi} from 'vitest';
import * as autonomy from './autonomy';
import * as economy from './economy';
import * as wonder from './wonder';
import {eventId} from './ids';
import {advanceFormal} from './reducer';
import {wonderAct,wonderWorld} from './wonderTestSupport';
import {order} from './developmentTestSupport';
import type {FormalCommand,FormalWorld} from './model';

afterEach(()=>vi.restoreAllMocks());
const resources={food:25,wood:0,stone:0,gold:0};
function payload(w:FormalWorld,kind:'wonder.ship'|'logistics.dispatch'):FormalCommand{
 return kind==='wonder.ship'
 ?{type:kind,cityId:w.cities[1].id,projectId:w.largeProjects[0].projectId,resources}
 :{type:kind,cityId:w.cities[1].id,destinationCityId:w.cities[0].id,resources};
}
function fixture(){
 let w=wonderWorld();
 w=wonderAct(w,payload(w,'wonder.ship'));
 w.clockMode='offline';
 w.events.push({type:'fixture.marker',marker:'dual-shipping',at:1,id:eventId(String(w.sequences.event++).padStart(16,'0'))});
 return w;
}
function install(callback:(...args:Parameters<typeof autonomy.handleAutonomy>)=>ReturnType<typeof autonomy.handleAutonomy>){
 const original=autonomy.handleAutonomy;
 vi.spyOn(autonomy,'handleAutonomy').mockImplementation((...args)=>{
  if(args[1].type!=='fixture.marker')return original(...args);
  const state=args[0];
  // The tiny existing wonder fixture has no 99-faction registry.
  state.autonomy={version:1,agents:[],accepted:0,rejected:0};
  try{return callback(...args);}finally{delete state.autonomy;}
 });
}
function hits(){
 const spy=vi.spyOn(globalThis,'structuredClone');
 return ()=>spy.mock.calls.filter(([x])=>x&&typeof x==='object'&&Object.hasOwn(x,'source')&&Object.hasOwn(x,'destination')&&Object.hasOwn(x,'largeProjects')).length;
}
it('routes both eligible commands through private drafts, retaining existing in-transit shipment and reservations',()=>{
 const w=fixture(),before=structuredClone(w),count=hits();
 install((state,e,s,submit)=>autonomy.submitAutonomous(state,s,e,state.playerFactionId,[payload(state,'wonder.ship'),payload(state,'logistics.dispatch')],submit));
 const launched=advanceFormal(w,1).world;
 expect(count()).toBe(2);
 expect(w).toEqual(before);
 expect(launched.logistics).toHaveLength(3);
 expect(launched.logistics![0]).toEqual(before.logistics![0]);
 expect(launched.largeProjects[0].shipments).toHaveLength(2);
 expect(launched.cities[0].economy!.reservedIncoming).toEqual(resources);
 const returned=advanceFormal(launched,Math.max(...launched.logistics!.map(t=>t.returnAt))).world;
 expect(returned.logistics).toHaveLength(0);
 expect(returned.largeProjects[0].poolResources.food).toBe(50);
 expect(returned.cities[0].economy!.reservedIncoming.food).toBe(0);
});
it.each(['wonder.ship','logistics.dispatch'] as const)('keeps source, host, prefix and history intact after %s rejects after dispatch',kind=>{
 const w=fixture(),before=structuredClone(w),count=hits();
 const wa=wonder.applyWonderCommand,ea=economy.applyEconomyCommand;
 if(kind==='wonder.ship')vi.spyOn(wonder,'applyWonderCommand').mockImplementation((...args)=>{wa(...args);throw new economy.RuleViolation('after private writes');});
 else vi.spyOn(economy,'applyEconomyCommand').mockImplementation((...args)=>{ea(...args);throw new economy.RuleViolation('after private writes');});
 install((state,_e,s,submit)=>{
  state.events=s.snapshot();
  const shot=structuredClone(state),r=submit(state,order(state,payload(state,kind),'shipping-reject'));
  expect(r.ack?.reason).toBe('after private writes');expect(state).toEqual(shot);
  return [];
 });
 const result=advanceFormal(w,1).world;
 expect(count()).toBe(1);expect(w).toEqual(before);expect(result.logistics).toEqual(w.logistics);
});
it.each(['foreground','alias'] as const)('continues to use generic admission for %s',mode=>{
 const w=fixture(),count=hits();
 if(mode==='foreground')w.clockMode='foreground';
 install((state,_e,s,submit)=>{
  state.events=s.snapshot();
  if(mode==='alias')state.cities[0].stock=state.cities[1].stock;
  const t=submit(state,order(state,payload(state,'logistics.dispatch'),'shipping-fallback'));
  expect(t.ack?.status).toBe('committed');
  if(mode==='alias')expect(t.world.cities[0].stock).toBe(t.world.cities[1].stock);
  return [];
 });
 advanceFormal(w,1);expect(count()).toBe(0);
});
