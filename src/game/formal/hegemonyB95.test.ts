import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {make,researchCity,order} from './developmentTestSupport';
import {empireId} from './ids';
import {EventScheduler} from './scheduler';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {invalidateSpatial} from './spatial';
import {reconcileVictory,victoryConditions} from './victory';
import {militaryRanking,unitMilitaryPower,invalidateMilitaryPower} from './militaryPower';
import {makePools} from './combatResolver';
import {combatStats} from './combatModifiers';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence} from '../persistence';
import {enableAutonomy} from './autonomy';
import {HOUR} from './time';
import {validateFormalWorld} from './schema';
function world(lords=15,legions=3){const w=make(),id=empireId('hegemony'),members=w.factions.slice(0,lords).map(f=>f.id),stride=Math.ceil(lords/legions);w.politics={legions:[],empires:[{id,name:'霸權帝國',leader:members[0],legions:[],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};for(let i=0;i<legions;i++){const group=members.slice(i*stride,(i+1)*stride);if(group.length){const key='legion:hegemony-'+i;w.politics.legions.push({id:key,name:'軍團',description:'',leader:group[0],members:group,empireId:id});w.politics.empires[0].legions.push(key);}}for(const f of w.factions)f.empireId=members.includes(f.id)?id:null;for(let i=0;i<100;i++){w.cities[i].population=100;if(i<45)w.cities[i].ownerFactionId=members[i%members.length];}w.cities[0].military!.units={militia:100};invalidateSpatial(w);return w;}
const condition=(w:ReturnType<typeof world>)=>victoryConditions(w).find(c=>c.empire?.id===empireId('hegemony'))!;
function sync(w:ReturnType<typeof world>){invalidateMilitaryPower(w);const s=new EventScheduler(w.events);reconcileVictory(w,s);w.events=s.snapshot();return w;}
it.each([[14,3,false],[15,2,false],[15,3,true]])('B9-5 hegemony %s active lords/%s legions eligible=%s',(lords,legions,expected)=>{const w=world(lords,legions);expect(condition(w).activeLords).toBe(lords);expect(condition(w).hegemony).toBe(expected);});
it.each([0,99,100,101])('B9-5 military opponent militia=%s tests second/tied/unique positive first',enemy=>{
 const w=world();w.cities[45].military!.units={militia:enemy};const c=condition(w);expect(c.hegemony).toBe(enemy<100);expect(c.militaryRank).toBe(enemy>100?2:1);
 if(!enemy){w.cities[0].military!.units={};invalidateMilitaryPower(w);expect(condition(w).hegemony).toBe(false);}
});
it('B9-5 city/population 45 percent boundaries both apply',()=>{const w=world();w.cities[44].ownerFactionId=w.factions[45].id;invalidateSpatial(w);expect(condition(w).hegemony).toBe(false);const population=world();for(const c of population.cities.slice(0,45))c.population=99;expect(condition(population).hegemony).toBe(false);});
it('B9-5 active lords never depend on sampled AI activity; loss of last city and extinction exclude members',()=>{
 const w=world();enableAutonomy(w);for(const a of w.autonomy!.agents)a.active=false;expect(condition(w).activeLords).toBe(15);for(const a of w.autonomy!.agents)a.active=true;expect(condition(w).activeLords).toBe(15);
 const last=w.factions[14].id;for(const c of w.cities)if(c.ownerFactionId===last)c.ownerFactionId=w.factions[13].id;invalidateSpatial(w);invalidateMilitaryPower(w);expect(condition(w).activeLords).toBe(14);expect(condition(w).hegemony).toBe(false);
});
it('B9-5 unit military power uses real technology stats, ram K=.25 and excludes scout/supply/era/counter multipliers',()=>{
 const w=world(),f=w.factions[0];for(const id of ['militia','ram','modern.ram','modern.catapult','modern.guard.civ_britannia']){const s=combatStats(id,f);expect(unitMilitaryPower(id,f)).toBe(Math.round(100*s.hp*(s.attack/s.interval*(id.endsWith('ram')?.25:1)+(s.meleeDefense+s.rangedDefense)/20)));}
 for(const id of ['scout','modern.scout','baggage','modern.baggage'])expect(unitMilitaryPower(id,f)).toBe(0);const before=unitMilitaryPower('militia',f);f.modernQualification='full';expect(unitMilitaryPower('militia',f)).toBe(before);expect(makePools({militia:1},f.id,w.cities[0].id,null)).toHaveLength(1);
});
it('B9-5 real dispatch, stationary reinforcement, recall and return conserve power under the original owner exactly once',async()=>{
 let w=world(),initial=militaryRanking(w).factions.get(w.playerFactionId),send=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'reinforce',target:{kind:'city',cityId:w.cities[1].id},units:{militia:40}}));expect(send.ack?.status).toBe('committed');w=send.world;expect(militaryRanking(w).factions.get(w.playerFactionId)).toBe(initial);const army=w.armies.find(a=>a.status==='outbound')!;
 w=advanceFormal(w,army.arrivalAt!).world;expect(w.armies.find(a=>a.id===army.id)!.status).toBe('stationed');expect(militaryRanking(w).factions.get(w.playerFactionId)).toBe(initial);const loaded=(await decodeSave(await encodeSave(w))).world;expect(militaryRanking(loaded).factions.get(w.playerFactionId)).toBe(initial);
 const recall=submitFormalOrder(w,order(w,{type:'army.recall',cityId:w.cities[0].id,armyId:army.id}));expect(recall.ack?.status).toBe('committed');w=recall.world;expect(militaryRanking(w).factions.get(w.playerFactionId)).toBe(initial);w=advanceFormal(w,w.armies.find(a=>a.id===army.id)!.arrivalAt!).world;expect(w.cities[0].military!.units.militia).toBe(100);expect(militaryRanking(w).factions.get(w.playerFactionId)).toBe(initial);
});
it('B9-5 a real research completion recalculates military rank and starts the 24h clock only after gaining unique first',()=>{
 let w=world();researchCity(w);w.cities[45].military!.units={militia:101};sync(w);expect(condition(w).hegemony).toBe(false);const t=submitFormalOrder(w,order(w,{type:'research.start',cityId:w.cities[0].id,techId:'blacksmith.melee.1'}));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;const p=w.researchProjects.at(-1)!;expect(p.phase).toBe('researching');if(p.phase!=='researching')throw Error('Research missing');w=advanceFormal(w,p.startedAt+p.durationSnapshot.durationMs).world;expect(condition(w).hegemony).toBe(true);expect(w.victory!.candidates.find(c=>c.kind==='hegemony')!.startedAt).toBe(w.time);
});
it('B9-5 an exact tie interrupts 24h, fresh unique leadership starts anew, and offline/save replay complete only once',async()=>{
 let w=sync(world());w=advanceFormal(w,12*HOUR).world;w.cities[45].military!.units={militia:100};sync(w);expect(w.victory!.candidates).toEqual([]);w=advanceFormal(w,13*HOUR).world;w.cities[45].military!.units={};sync(w);const deadline=37*HOUR;
 expect(advanceFormal(w,deadline-1).world.victory!.result).toBeNull();const loaded=(await decodeSave(await encodeSave(w))).world,complete=advanceFormal(w,deadline);expect(await advanceFormalCooperative(loaded,deadline)).toEqual(complete);expect(complete.world.victory!.result!.kind).toBe('hegemony');expect(complete.reports.filter(r=>r.title==='正式帝國霸權勝利')).toHaveLength(1);expect(advanceFormal(complete.world,deadline+HOUR).reports.filter(r=>r.title==='正式帝國霸權勝利')).toHaveLength(0);validateFormalWorld(complete.world);
});
const databases:FormalPersistence[]=[];afterEach(async()=>{for(const d of databases.splice(0))await d.db.delete();});
it('B9-5 Recovery and formal Load retain hegemony time and unique result without caching private military data in saves',async()=>{
 const db=new FormalPersistence({suffix:'b95-hegemony-'+crypto.randomUUID()});databases.push(db);let w=await db.start(sync(world())),result=advanceFormal(w,24*HOUR);w=await db.save(result.world,result.reports,w.revision);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const restored=await db.loadSave();expect(restored.recovered).toBe(true);expect(restored.game!.victory).toEqual(w.victory);expect(JSON.stringify(restored.game)).not.toContain('uniqueFirst');expect(advanceFormal(restored.game!,25*HOUR).reports.filter(r=>r.title==='正式帝國霸權勝利')).toHaveLength(0);
});
it('B9-5 real combat losses invalidate cached military totals; battle/dispatch snapshots never replenish lost power',()=>{
 let w=world();w.cities[0].military!.units={militia:110};w.cities[45].military!.units={militia:100};const original=militaryRanking(w),issuer=w.cities[45].ownerFactionId;
 const sent=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[45].id,mission:'raid',target:{kind:'city',cityId:w.cities[0].id},units:{militia:70}},undefined,issuer));expect(sent.ack?.status).toBe('committed');w=sent.world;expect(militaryRanking(w).factions.get(issuer)).toBe(original.factions.get(issuer));const arrival=w.armies.find(a=>a.status==='outbound')!.arrivalAt!;w=advanceFormal(w,arrival).world;
 const after=militaryRanking(w);expect(after.factions.get(w.playerFactionId)!).toBeLessThan(original.factions.get(w.playerFactionId)!);for(const owner of [issuer,w.playerFactionId]){const count=w.cities.filter(c=>c.ownerFactionId===owner).reduce((n,c)=>n+(c.military!.units.militia??0),0)+w.armies.filter(a=>a.ownerFactionId===owner).reduce((n,a)=>n+(a.units?.militia??0),0);expect(after.factions.get(owner)??0n).toBe(BigInt(count)*BigInt(unitMilitaryPower('militia',w.factions.find(f=>f.id===owner))));}
});
it('B9-5 queued training contributes no power, while the real training completion invalidates the derived cache',()=>{
 let w=world();researchCity(w);const before=militaryRanking(w).factions.get(w.playerFactionId);const t=submitFormalOrder(w,order(w,{type:'military.recruit',cityId:w.cities[0].id,unitId:'militia',count:1}));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;expect(militaryRanking(w).factions.get(w.playerFactionId)).toBe(before);w=advanceFormal(w,w.cities[0].military!.queue[0].nextAt).world;expect(militaryRanking(w).factions.get(w.playerFactionId)).toBe(before!+BigInt(unitMilitaryPower('militia',w.factions[0])));
});
