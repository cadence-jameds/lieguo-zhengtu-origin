import {expect,it} from 'vitest';
import {build,make,rich,commit,reject,order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {enableAutonomy} from './autonomy';
import {expansionDecision} from './aiActions';
import {aiRandom} from './autonomyModel';
import {trainingSlotsUsed} from './trainingSlots';
import {recruitmentConditions} from '../presentation/cityActions';
import {EventScheduler} from './scheduler';
import {encodeScenario} from './ledgerTestSupport';
import {decodeSave} from './saveCodec';
import {HOUR} from './economy';

const fixture=()=>{const w=make(),c=rich(w);w.factions[0].age=2;build(c,'castle',1);build(c,'workshop',1);build(c,'barracks',1);return w;};
const prepare=(w:ReturnType<typeof fixture>)=>({type:'settlement.prepare',cityId:w.cities[0].id} as const);
const train=(w:ReturnType<typeof fixture>,unitId='baggage')=>({type:'military.recruit',cityId:w.cities[0].id,unitId,count:1} as const);
const enqueue=(w:ReturnType<typeof fixture>,n:number)=>{for(let i=0;i<n;i++)w=commit(w,train(w));return w;};
it('shares five slots with baggage in both directions; rejected commands charge no stock or population',()=>{
 let full=enqueue(fixture(),5);
 expect(reject(full,prepare(full)).ack?.reason).toContain('5 項上限');
 let w=enqueue(fixture(),4);w=commit(w,prepare(w));
 expect(w.cities[0].military!.queue).toHaveLength(4);
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(5);
 expect(w.settlements![0].prepDurationMs).toBe(4*HOUR);
 expect(recruitmentConditions(w,w.cities[0],'baggage',1).reasons).toContain('訓練佇列已滿');
 for(const unit of ['baggage','militia'])expect(reject(w,train(w,unit)).ack?.reason).toContain('5 項上限');
 expect(w.cities[0].military!.units).not.toHaveProperty('colonization');
 w=commit(w,{type:'settlement.cancel',cityId:w.cities[0].id});
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(4);
 w=commit(w,train(w));expect(trainingSlotsUsed(w,w.cities[0])).toBe(5);
});
it('completing preparation frees its slot but retains the city single-ready-team rule',()=>{
 let w=fixture();w=commit(w,prepare(w));
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(1);
 w=advanceFormal(w,w.time+4*HOUR).world;
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(0);
 expect(w.colonizationUnits).toHaveLength(1);
 expect(w.colonizationUnits![0].phase).toBe('ready');
 expect(reject(w,prepare(w)).ack?.reason).toContain('既存拓殖隊');
 w=enqueue(w,5);expect(trainingSlotsUsed(w,w.cities[0])).toBe(5);
});
it('pre-change valid saves with six shared jobs still reload, preserve schedules, and drain without delaying/refunding',async()=>{
 let w=enqueue(fixture(),4);w=commit(w,prepare(w));
 const proj=w.settlements![0],event=w.events.find(e=>e.id===proj.prepEventId)!;
 w.settlements=[];w.events=new EventScheduler(w.events.filter(e=>e.id!==event.id)).snapshot();
 w=enqueue(w,1);
 w.settlements=[proj];w.events=new EventScheduler([...w.events,event]).snapshot();
 const before=w.cities[0].military!.queue.map(j=>[j.eventId,j.startsAt,j.nextAt]);
 w=(await decodeSave(await encodeScenario(w))).world;
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(6);
 expect(w.cities[0].military!.queue.map(j=>[j.eventId,j.startsAt,j.nextAt])).toEqual(before);
 expect(w.events.find(e=>e.id===event.id)?.at).toBe(event.at);
 reject(w,train(w));
 w=advanceFormal(w,Number(before[0][2])).world;
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(5);
 reject(w,train(w));
 w=advanceFormal(w,Number(before[1][2])).world;
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(4);
 w=commit(w,train(w));expect(trainingSlotsUsed(w,w.cities[0])).toBe(5);
});
it('AI avoids proposing preparation at shared capacity and reducer rejects explicit AI orders without spending',()=>{
 let w=fixture();const ai=w.factions[1];ai.age=2;const c=rich(w,w.cities[1]);build(c,'castle',1);build(c,'workshop',1);
 for(let i=0;i<5;i++){const t=submitFormalOrder(w,order(w,{...train(w),cityId:c.id},undefined,ai.id));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;}
 enableAutonomy(w);const a=w.autonomy!.agents.find(p=>p.factionId===ai.id)!;a.active=true;
 for(let n=1;n<=1000;n++)if(aiRandom(w.seed,a.factionId,n+400)<=.08+a.traits.expansion*.3){a.decisions=n;break;}
 const city=w.cities.find(p=>p.id===c.id)!;
 expect(expansionDecision(w,city,a)).toBeUndefined();
 const t=submitFormalOrder(w,order(w,{...prepare(w),cityId:city.id},undefined,ai.id));
 expect(t.ack?.reason).toContain('5 項上限');expect(city.population).toBe(t.world.cities.find(p=>p.id===city.id)!.population);
 const probe={...city,military:{...city.military!,queue:city.military!.queue.slice(1)}};
 expect(expansionDecision(w,probe,a)?.type).toBe('settlement.prepare');
});
it('one military job plus preparing settlers still lets a military governor recruit proactively',()=>{
 let w=enqueue(fixture(),1);
 const city=w.cities[0];
 build(city,'townhall',1);
 city.military!.units={spearman:5000,pikeman:5000,scout:100};
 w=commit(w,prepare(w));
 expect(trainingSlotsUsed(w,w.cities[0])).toBe(2);
 w=commit(w,{type:'governance.set',cityId:city.id,enabled:true,policy:'military',budget:100000,reserve:0});
 const at=w.governors![0].nextAt;
 expect(at).toBeLessThan(w.cities[0].military!.queue[0].nextAt);
 const after=advanceFormal(w,at).world;
 expect(after.cities[0].military!.queue).toHaveLength(2);
 expect(after.cities[0].military!.queue[0].unitId).toBe('baggage');
 expect(after.settlements![0].phase).toBe('preparing');
 expect(trainingSlotsUsed(after,after.cities[0])).toBe(3);
});
