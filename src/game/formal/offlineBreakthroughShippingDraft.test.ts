import {afterEach,expect,it,vi} from 'vitest';
import * as autonomy from './autonomy';
import * as breakthrough from './breakthrough';
import {RuleViolation,changeCityOwner} from './economy';
import {eventId,sequenceKey} from './ids';
import {advanceFormal,advanceFormalCooperative} from './reducer';
import {order} from './developmentTestSupport';
import {breakthroughWorld} from './breakthroughTestSupport';
import {wonderAct} from './wonderTestSupport';
import {wonderRemaining} from './wonder';
import {zeroResources,type FormalWorld,type FormalCommand} from './model';

afterEach(()=>vi.restoreAllMocks());
const cargo={food:0,wood:0,stone:0,gold:25};
function payload(w:FormalWorld,from=1):Extract<FormalCommand,{type:'breakthrough.ship'}>{
 return {type:'breakthrough.ship',cityId:w.cities[from].id,projectId:w.largeProjects[1].projectId,resources:cargo};
}
function fixture(){
 const w=breakthroughWorld();w.cities[1].stock.gold=500;w.cities[0].stock.gold=500;
 w.clockMode='offline';
 w.events.push({type:'fixture.marker',marker:'breakthrough-draft',at:w.time+1,id:eventId(sequenceKey(w.sequences.event++))});
 return w;
}
function install(callback:(...args:Parameters<typeof autonomy.handleAutonomy>)=>ReturnType<typeof autonomy.handleAutonomy>,hasAdmission:()=>boolean=()=>true){
 const original=autonomy.handleAutonomy;
 vi.spyOn(autonomy,'handleAutonomy').mockImplementation((...args)=>{
  if(args[1].type!=='fixture.marker')return original(...args);
  const w=args[0];if(hasAdmission())w.autonomy={version:1,agents:[],accepted:0,rejected:0};
  try{return callback(...args);}finally{delete w.autonomy;}
 });
}
function hits(){
 const spy=vi.spyOn(globalThis,'structuredClone');
 return ()=>spy.mock.calls.filter(([x])=>x&&typeof x==='object'&&Object.hasOwn(x,'source')&&Object.hasOwn(x,'destination')&&Object.hasOwn(x,'largeProjects')).length;
}
it('matches generic reducer with an existing reservation, replays ordered events and credits only actual arrival',async()=>{
 const original=fixture(),seed=wonderAct({...original,clockMode:'foreground'},payload(original));
 seed.clockMode='offline';const pristine=structuredClone(seed),count=hits();
 let optimized=true;
 install((w,e,s,submit)=>autonomy.submitAutonomous(w,s,e,w.playerFactionId,[payload(w)],submit),()=>optimized);
 const target=seed.time+1,remaining=wonderRemaining(seed.largeProjects[1]);
 const typed=await advanceFormalCooperative(seed,target);expect(count()).toBe(1);
 optimized=false;
 const generic=await advanceFormalCooperative(seed,target);expect(count()).toBe(1);
 expect(typed).toEqual(generic);expect(seed).toEqual(pristine);
 expect(typed.world.largeProjects[1].poolResources).toEqual(zeroResources());
 expect(wonderRemaining(typed.world.largeProjects[1]).gold).toBe(remaining.gold-25);
 expect(typed.world.logistics?.[0]).toEqual(pristine.logistics?.[0]);
 const returnAt=Math.max(...typed.world.logistics!.map(t=>t.returnAt));
 const matured=advanceFormal(typed.world,returnAt);
 expect(matured).toEqual(advanceFormal(generic.world,returnAt));
 expect(matured.world.largeProjects[1].poolResources.gold).toBe(50);
 expect(matured.world.logistics).toHaveLength(0);
},60_000); // Existing completed-wonder fixture uses 800 legal paid trips.
it('preserves self-host graph ownership in the same two-city admission',()=>{
 const w=fixture(),count=hits();
 install((state,e,s,submit)=>autonomy.submitAutonomous(state,s,e,state.playerFactionId,[payload(state,0)],submit));
 const result=advanceFormal(w,w.time+1).world;
 expect(count()).toBe(1);expect(result.logistics).toHaveLength(1);
 expect(result.logistics![0].sourceCityId).toBe(result.logistics![0].destinationCityId);
 expect(result.largeProjects[1].poolResources.gold).toBe(0);
 expect(advanceFormal(result,result.logistics![0].returnAt).world.largeProjects[1].poolResources.gold).toBe(25);
});
it('keeps source, destination, scheduler and project unchanged on a post-dispatch rejection',()=>{
 const seed=fixture(),before=structuredClone(seed),count=hits(),run=breakthrough.applyBreakthroughCommand;
 vi.spyOn(breakthrough,'applyBreakthroughCommand').mockImplementation((...args)=>{run(...args);throw new RuleViolation('after private writes');});
 install((w,_e,s,submit)=>{
  w.events=s.snapshot();const shot=structuredClone(w);
  const t=submit(w,order(w,payload(w),'offline-s3-rollback'));
  expect(t.ack?.reason).toBe('after private writes');expect(t.world).toBe(w);expect(w).toEqual(shot);return [];
 });
 const result=advanceFormal(seed,seed.time+1);
 expect(count()).toBe(1);expect(seed).toEqual(before);expect(result.world.logistics).toEqual(seed.logistics);
});
it('leaves paused/historically captured hosts on the original rejection path; a launched cargo is returned once',()=>{
 const w=fixture(),count=hits();
 install((state,e,s,submit)=>autonomy.submitAutonomous(state,s,e,state.playerFactionId,[payload(state)],submit));
 let launched=advanceFormal(w,w.time+1).world;
 const t=structuredClone(launched.logistics![0]);expect(count()).toBe(1);
 launched=wonderAct(launched,{type:'politics',cityId:launched.cities[2].id,action:'empire-leave'},launched.factions[1].id);
 changeCityOwner(launched,launched.cities[0],launched.factions[1].id,'conquest');
 expect(launched.largeProjects[1].breakthrough?.phase).toBe('paused');
 const lost=advanceFormal(launched,t.arrivalAt).world;
 expect(lost.largeProjects[1].poolResources.gold).toBe(0);expect(lost.logistics![0].returnCargo).toEqual(cargo);
 const restored=advanceFormal(lost,t.returnAt).world;
 expect(restored.logistics).toHaveLength(0);
 expect(restored.largeProjects[1].shipments[0].phase).toBe('returned');
 expect(restored.cities[1].stock.gold-lost.cities[1].stock.gold).toBeGreaterThanOrEqual(25);
 const at=restored.time+1;restored.events.push({type:'fixture.marker',marker:'lost-host',at,id:eventId(sequenceKey(restored.sequences.event++))});
 advanceFormal(restored,at);expect(count()).toBe(1);
});
it('runs the same scheduler political-expiry reconciliation on typed and generic drafts',()=>{
 const w=fixture(),count=hits();let optimized=true;
 install((state,e,s,submit)=>{
  const id=eventId(sequenceKey(state.sequences.event++));
  s.push({type:'politics.end-friendly',id,at:state.time+1000,a:state.factions[0].id,b:state.factions[1].id});
  const result=autonomy.submitAutonomous(state,s,e,state.playerFactionId,[payload(state)],submit);
  expect(s.snapshot().some(x=>x.id===id)).toBe(false);return result;
 },()=>optimized);
 const a=advanceFormal(w,w.time+1);expect(count()).toBe(1);optimized=false;
 const b=advanceFormal(w,w.time+1);expect(count()).toBe(1);expect(a).toEqual(b);
});
it('does not copy or launch another cart for the same command identity or a stale revision',()=>{
 const w=fixture(),count=hits();
 install((state,e,s,submit)=>{
  const q=payload(state),result=autonomy.submitAutonomous(state,s,e,state.playerFactionId,[q],submit);
  const before=structuredClone(state);
  const repeat=submit(state,order(state,q,'ai-'+e.id.slice(6)+'-0'));
  expect(repeat.ack?.status).toBe('duplicate');expect(repeat.world).toBe(state);
  const expired=submit(state,{...order(state,q,'s3-stale-revision'),expectedRevision:state.revision-1});
  expect(expired.ack?.status).toBe('rejected');expect(expired.world).toBe(state);expect(state).toEqual(before);
  return result;
 });
 const result=advanceFormal(w,w.time+1).world;
 expect(result.logistics).toHaveLength(1);expect(count()).toBe(1);
});
it('does not specialize a larger project mix even if the original ship handler is reached',()=>{
 const w=fixture(),count=hits(),original=breakthrough.applyBreakthroughCommand;
 const invoke=vi.spyOn(breakthrough,'applyBreakthroughCommand').mockImplementation((...args)=>{
  original(...args);throw new RuleViolation('unsupported mix fallback sentinel');
 });
 install((state,_e,s,submit)=>{
  state.events=s.snapshot();
  const extra=structuredClone(state.largeProjects[0]);
  state.largeProjects.push(extra); // Test-only transient admission; never publish the invalid fixture.
  try{const t=submit(state,order(state,payload(state),'s3-unsupported-mix'));expect(t.ack?.reason).toBe('unsupported mix fallback sentinel');}
  finally{state.largeProjects.pop();}
  return [];
 });
 const result=advanceFormal(w,w.time+1).world;
 expect(invoke).toHaveBeenCalledOnce();expect(result.logistics).toEqual(w.logistics);expect(count()).toBe(0);
});
