import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {createFormalWorld} from './generator';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import {submitAutonomous} from './autonomy';
import {militaryDecision} from './aiActions';
import {ATTACK_STRATEGIES,strategyWeights,pickAttackStrategy,executeAttackStrategy,parallelFits,originalCityAttack} from './aiAttackStrategies';
import {aiRandom,type Agent} from './autonomyModel';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {HOUR,publicSituation} from './aiKnowledge';
import {invalidateSpatial} from './spatial';
import {route} from './routing';
import {EventScheduler} from './scheduler';
import {eventId} from './ids';
import {canonicalJSON} from './canonical';
import {decodeSave,encodeSave} from './saveCodec';
import {advanceOffline} from './offline';
import {FormalPersistence} from '../persistence';
import type {FormalCommand,FormalEvent,FormalWorld} from './model';
import {validateFormalWorld} from './schema';

let serial=0;
function setup(){
 let w=isolatedAutonomyFixture(createFormalWorld({campaign:'p0c9-controlled-'+(++serial),seed:90217,offlineHours:12}));
 w=advanceFormal(w,2*HOUR).world;
 const a=w.autonomy!.agents.find(a=>publicSituation(w,a,w.cities.find(c=>c.ownerFactionId===a.factionId)!).length)!;
 const c=w.cities.find(c=>c.ownerFactionId===a.factionId)!;
 a.active=true;c.military!.units={militia:600,archer:200,scout:10,ram:20};
 for(const f of w.factions)f.protectionUntil=0;
 return {w,a,c};
}
function siteAt(ctx:ReturnType<typeof setup>,distance:number){
 const {w,c,a}=ctx;a.traits={...a.traits,military:.8,economy:1,raiding:1,risk:.5};const site={...w.worldLayer!.wildSites[0],x:c.x+distance,y:c.y,level:1,phase:'active' as const};
 // Decision-only fixture: isolate one visible site; never save/submit this reduced world.
 c.x=100;c.y=100;site.x=100+distance;site.y=100;w.worldLayer!.wildSites=[site];invalidateSpatial(w);return site;
}
const normalization=(w:FormalWorld)=>{const copy=structuredClone(w);copy.revision=0;for(const r of copy.commandReceipts)r.committedRevision=0;return canonicalJSON(copy);};
function legalTargets(ctx:ReturnType<typeof setup>){
 const {w,c}=ctx;const reachable=(p:{x:number;y:number})=>{try{route(w,c,p);return true;}catch{return false;}};
 const city=w.cities.filter(t=>t.ownerFactionId!==c.ownerFactionId).sort((x,y)=>Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y)).find(reachable)!;
 const site=w.worldLayer!.wildSites.filter(s=>s.phase==='active').sort((x,y)=>Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y)).find(reachable)!;
 expect(city).toBeDefined();expect(site).toBeDefined();return{city,site};
}
function dispatches(ctx:ReturnType<typeof setup>){const {city,site}=legalTargets(ctx),id=ctx.c.id;return[
 {type:'army.dispatch',cityId:id,mission:'raid',target:{kind:'city',cityId:city.id},units:{militia:180}},
 {type:'army.dispatch',cityId:id,mission:'raid',target:{kind:'wild',siteId:site.id,generation:site.generation},units:{militia:180}}
] satisfies FormalCommand[];}
function submit(ctx:ReturnType<typeof setup>,commands:FormalCommand[],event:FormalEvent={id:eventId('p0c9-round-'+(++serial)),at:ctx.w.time,type:'fixture.marker',marker:'p0c9'}){
 const scheduler=new EventScheduler(ctx.w.events),acks:string[]=[];
 submitAutonomous(ctx.w,scheduler,event,ctx.a.factionId,commands,(w,o)=>{const t=submitFormalOrder(w,o);acks.push(t.ack!.status);return t;});
 ctx.w.events=scheduler.snapshot();return {event,acks};
}

it('uses the exact approved weights at trait endpoints and preserves all eleven traits',()=>{
 const {a}=setup(),keys=Object.keys(a.traits);for(const k of keys)a.traits[k as keyof Agent['traits']]=0;
 expect(Object.values(strategyWeights(a))).toEqual([.70,.70,.65,1.35,.70]);
 for(const k of keys)a.traits[k as keyof Agent['traits']]=1;
 const expected=[1.60,2.85,3.15,2.40,3.55];Object.values(strategyWeights(a)).forEach((n,i)=>expect(n).toBeCloseTo(expected[i]));expect(keys).toHaveLength(11);
});
it('reselects deterministically per decision and every strategy remains possible for one faction',()=>{
 const {w,a}=setup(),before=structuredClone(a),counts=new Map<string,number>();
 for(let i=0;i<1000;i++){a.decisions=i;const p=pickAttackStrategy(w,a);if(i%100===0)expect(pickAttackStrategy(structuredClone(w),structuredClone(a))).toBe(p);counts.set(p,(counts.get(p)??0)+1);}
 expect([...counts.keys()].sort()).toEqual([...ATTACK_STRATEGIES].sort());expect(Math.min(...counts.values())).toBeGreaterThan(50);
 expect(a.traits).toEqual(before.traits);
});
for(const mode of ATTACK_STRATEGIES)for(const distance of [25,48,49,60,61])it(`${mode} search boundary ${distance}, retaining the 24-tile score denominator`,()=>{
 const ctx=setup(),site=siteAt(ctx,distance),{w,c,a}=ctx;c.stock={food:0,wood:0,stone:0,gold:0};
 const radius=mode==='WildPriority60'?60:48,candidate={hasCity:mode!=='A48',commands:[]};
 const answers=Array.from({length:100},(_,i)=>{a.decisions=i;return executeAttackStrategy(w,c,a,mode,candidate);}).flat();
 expect(answers.some(p=>p.type==='army.dispatch'&&p.target.kind==='wild'&&p.target.siteId===site.id)).toBe(distance<=radius);
});
it('A48 preserves city priority while V2-B retains its capped scouting diversion',()=>{
 const ctx=setup();siteAt(ctx,30);const {w,c,a}=ctx,target=w.cities.find(t=>t.id!==c.id)!;
 const scout:FormalCommand={type:'army.dispatch',cityId:c.id,mission:'scout',target:{kind:'city',cityId:target.id},units:{scout:8}},candidate={hasCity:true,commands:[scout]};
 expect(executeAttackStrategy(w,c,a,'A48',candidate)).toEqual([scout]);
 a.decisions=Array.from({length:1000},(_,i)=>i).find(n=>aiRandom(w.seed,a.factionId,n+1511)>=.26)!;
 expect(executeAttackStrategy(w,c,a,'V2B48',candidate)).toEqual([scout]);expect(executeAttackStrategy(w,c,a,'WildPriority60',candidate)).toEqual([scout]);
});
it('selected policies use only public site metadata and acquired city intel',()=>{
 const {w,c,a}=setup(),before=originalCityAttack(w,c,a);for(const other of w.cities.filter(t=>t.ownerFactionId!==a.factionId)){other.military!.units={militia:100000};other.stock={food:99999,wood:99999,stone:99999,gold:99999};}
 expect(originalCityAttack(w,c,a)).toEqual(before);
});
for(const mode of ['V3Parallel48','WildParallel48'] as const)it(`${mode} actually allocates two distinct detachments and checks every troop key`,()=>{
 const ctx=setup();siteAt(ctx,25);const {w,c,a}=ctx;c.stock={food:0,wood:0,stone:0,gold:0};
 const target=w.cities.find(t=>t.id!==c.id)!;a.intel=[{cityId:target.id,ownerFactionId:target.ownerFactionId,at:w.time,source:'scout',units:{},coarse:'personnel'}];
 const city:FormalCommand={type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'city',cityId:target.id},units:{militia:180}};
 const answer=executeAttackStrategy(w,c,a,mode,{hasCity:true,commands:[city]});expect(answer).toHaveLength(2);
 expect(answer.map(p=>p.type==='army.dispatch'&&p.target.kind).sort()).toEqual(['city','wild']);
 expect(parallelFits(c,{militia:180},{militia:180,ram:21})).toBe(false);expect(parallelFits(c,{militia:180},{militia:180,scout:11})).toBe(false);
 expect(parallelFits(c,{militia:300},{militia:121})).toBe(false);
});
it('two real reducer admissions consume disjoint troops, preserve reserve, and dedupe the same event',()=>{
 const ctx=setup(),orders=dispatches(ctx),result=submit(ctx,orders);
 expect(result.acks).toEqual(['committed','committed']);expect(ctx.w.armies).toHaveLength(2);expect(ctx.w.cities.find(c=>c.id===ctx.c.id)!.military!.units.militia).toBe(240);
 const before=canonicalJSON(ctx.w);expect(submit(ctx,orders,result.event).acks).toEqual(['duplicate','duplicate']);expect(canonicalJSON(ctx.w)).toBe(before);validateFormalWorld(ctx.w);
});
for(const failure of ['stale-target','troop-shortage','reserve-shortage','first-rejected'] as const)it(`partial multiline ${failure} preserves successful work and rejects without phantom troops`,()=>{
 const ctx=setup(),orders=dispatches(ctx);
 if(failure==='stale-target'&&orders[1].target.kind==='wild')orders[1].target.generation++;
 if(failure==='first-rejected')orders[0].units={militia:601};
 if(failure==='troop-shortage'){orders[0].units={militia:400};orders[1].units={militia:300};}
 if(failure==='reserve-shortage'){orders[0].units={militia:350};orders[1].units={militia:100};}
 const before={...ctx.c.stock},result=submit(ctx,orders);expect(ctx.w.armies).toHaveLength(1);expect(ctx.w.autonomy!.rejected).toBe(1);
 expect(ctx.w.commandReceipts.filter(r=>r.issuerId===ctx.a.factionId)).toHaveLength(1);expect(ctx.w.cities.find(c=>c.id===ctx.c.id)!.stock).toEqual(before);
 if(failure==='stale-target')expect(result.acks).toEqual(['committed','rejected']);
 validateFormalWorld(ctx.w);
});
it('inactive and cooldown gates remain ahead of strategy evaluation',()=>{
 const {w,c,a}=setup();a.active=false;expect(militaryDecision(w,c,a)).toEqual([]);a.active=true;a.lastWarAt=w.time;expect(militaryDecision(w,c,a)).toEqual([]);
});
const stores:FormalPersistence[]=[];afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
for(const speed of [1,10,25])it(`${speed}X real military decisions preserve Save/Load, offline, cooperative and sliced replay`,async()=>{
 const ctx=setup(),{a}=ctx;let w=ctx.w;w.speed=speed;const e=w.events.find(e=>e.id===a.eventId)!;e.at=a.nextAt=w.time+1;a.decisions=Array.from({length:1000},(_,i)=>i+1).find(n=>aiRandom(w.seed,a.factionId,n+100)<.3+.65*a.traits.activity&&aiRandom(w.seed,a.factionId,n+311)<=.15+a.traits.military*.55)!-1;
 const end=w.time+2*HOUR,whole=advanceFormal(w,end).world;expect(whole.commandReceipts.some(r=>r.issuerId===a.factionId&&JSON.parse(r.fingerprint).payload.type==='army.dispatch')).toBe(true);const decoded=(await decodeSave(await encodeSave(w))).world;
 expect(advanceFormal(decoded,end).world).toEqual(whole);
 expect((await advanceFormalCooperative(w,end,undefined,{yieldIntervalMs:1})).world).toEqual(whole);
 const sliced=advanceFormal(advanceFormal(w,w.time+HOUR).world,end).world;expect(normalization(sliced)).toBe(normalization(whole));
 expect(advanceOffline(w,1000,1000+2*HOUR/speed).world).toEqual(whole);
});
it('Recovery rolls back both real departures atomically and CAS rejects a competing stale writer',async()=>{
 const ctx=setup(),{a,c}=ctx;
 a.intel=publicSituation(ctx.w,a,c).map(t=>({cityId:t.id,ownerFactionId:t.ownerFactionId,at:ctx.w.time,source:'scout' as const,units:{},coarse:'personnel' as const}));
 const chosen=Array.from({length:5000},(_,i)=>i+1).find(n=>{a.decisions=n;return aiRandom(ctx.w.seed,a.factionId,n+100)<.3+.65*a.traits.activity&&militaryDecision(ctx.w,c,a).filter(p=>p.type==='army.dispatch').length===2;});
 expect(chosen).toBeDefined();a.decisions=chosen!-1;const event=ctx.w.events.find(e=>e.id===a.eventId)!;event.at=a.nextAt=ctx.w.time+1;
 const s=new FormalPersistence({suffix:'p0c9-recovery-'+(++serial)});stores.push(s);ctx.w=await s.start(ctx.w);const checkpoint=(await s.backupList())[0].id;
 const baseline=structuredClone(ctx.w),transition=advanceFormal(ctx.w,ctx.w.time+1);expect(transition.world.armies).toHaveLength(2);
 const committed=await s.save(transition.world,transition.reports,baseline.revision);
 await expect(s.save({...baseline,revision:baseline.revision+1},[],baseline.revision)).rejects.toThrow('revision');
 const restored=await s.restore(checkpoint);expect(restored.armies).toEqual(baseline.armies);expect(restored.revision).toBeGreaterThan(committed.revision);
 expect(restored.commandReceipts.filter(r=>r.issuerId===a.factionId).every(r=>r.disposition==='rolled-back')).toBe(true);
 validateFormalWorld(restored);expect((await decodeSave(await encodeSave(restored))).world).toEqual(restored);
});
