import {invalidateSpatial} from './spatial';
import {expect,it} from 'vitest';
import {endgameWorld,nativeEndgameWorld,act} from './endgameTestSupport';
import {publicWonderStage,publicWonderThreats,knownEnemyMix,modernDoctrine,militaryBudgetScore,modernResearchPriority,reverseLine,conquestAxes,endgameFriendlyEnd,repairDecision,invalidateEndgameIntel,ownCombatPower,modernPressure,wonderDefense} from './endgameAI';
import {traitsFor,type Agent} from './autonomyModel';
import {militaryDecision,wonderDecision} from './aiActions';
import {enableAutonomy} from './autonomy';
import {originalCityAttack,ATTACK_STRATEGIES,executeAttackStrategy,autonomousDispatchReason} from './aiAttackStrategies';
import {advanceFormal,submitFormalOrder} from './reducer';
import {order} from './developmentTestSupport';
import {isMissionArmy} from './combatModel';
import {EventScheduler} from './scheduler';
import {applyWonderDamage} from './wonderCondition';
import {eventId,resolutionId} from './ids';
import {encodeSave,decodeSave} from './saveCodec';
import {unitRecruitCost} from './military';
import {UNIT_CATALOG} from './unitCatalog';
import {invalidateMilitaryPower} from './militaryPower';
import {addIntel,publicSituation} from './aiKnowledge';
import {HOUR} from './time';
import type {FormalWorld} from './model';
function agent(w:FormalWorld,owner=w.playerFactionId):Agent{return{factionId:owner,traits:traitsFor(w.seed,owner),decisions:0,nextAt:w.time,eventId:null,active:true,budgetPercent:50,lastWarAt:w.time-2*HOUR,memory:[],intel:[]};}
function knowledge(w:FormalWorld,a:Agent,units:Record<string,number>,city=w.cities[2]){addIntel(w,a,{cityId:city.id,ownerFactionId:city.ownerFactionId,at:w.time,source:'battle',units,coarse:'armor'});}
it.each([[0,20],[20,30],[40,45],[60,60],[80,75]])('B9-5 public wonder %s percent has base threat %s without exposing a resource pool',(percent,expected)=>{
 const w=endgameWorld();w.largeProjects=w.largeProjects.filter(p=>p.wonder);const p=w.largeProjects[0];p.wonder!.phase='building';p.wonder!.clock={workMs:p.durationMs*percent/100,activeSince:null};expect(publicWonderStage(w,p)).toEqual({threat:expected,stage:'wonder',progress:percent});
});
it.each([[0,80],[25,86],[50,92],[75,97]])('B9-5 public breakthrough %s percent has base threat %s',(percent,expected)=>{
 const w=endgameWorld(true),p=w.largeProjects[1];p.breakthrough!.activeSince=w.time-p.durationMs*percent/100;expect(publicWonderStage(w,w.largeProjects[0])).toEqual({threat:expected,stage:'breakthrough',progress:percent});
});
it('B9-5 threat modifiers use public control/rank/relations/actual route and never reveal precise engineering resources',()=>{
 const w=endgameWorld(true),a=agent(w);w.cities[2].military!.units={militia:10};invalidateMilitaryPower(w);const first=publicWonderThreats(w,w.cities[0],a)[0];expect(first.threat).toBe(90);expect(Object.keys(first).sort()).toEqual(['cityId','leader','ownerFactionId','progress','projectId','relation','stage','threat'].sort());
 w.politics!.relations=[{a:w.playerFactionId,b:w.politics!.empires[0].id,state:'war'}];invalidateEndgameIntel(w);expect(publicWonderThreats(w,w.cities[0],a)[0].threat).toBe(96);w.politics!.relations[0].state='friendly';invalidateEndgameIntel(w);expect(publicWonderThreats(w,w.cities[0],a)[0].threat).toBe(80);
});
it('B9-5 completed modernization changes strategy rather than promising that destruction can cancel permanent technology',()=>{
 const w=endgameWorld(),a=agent(w);w.cities[0].military!.units={militia:1000,catapult:100,scout:10};knowledge(w,a,{});expect(publicWonderThreats(w,w.cities[0],a)[0].stage).toBe('modernized');const commands=originalCityAttack(w,w.cities[0],a).commands;expect(commands.some(c=>c.type==='army.dispatch'&&c.mission==='wonder-destruction')).toBe(false);expect(w.factions[1].modernQualification).toBe('full');
});
it('B9-5 genuine unknown garrisons produce scouting; hidden enemy troop changes cannot manufacture intel or awareness',()=>{
 const w=endgameWorld(true),a=agent(w);w.cities[0].military!.units={militia:1000,catapult:100,scout:10};const before=knownEnemyMix(w,a);w.cities[2].military!.units={'modern.knight':100000};expect(knownEnemyMix(w,a)).toEqual(before);expect(originalCityAttack(w,w.cities[0],a).commands[0]).toMatchObject({type:'army.dispatch',mission:'scout'});expect(w.modernAwareness).toBeUndefined();
});
it('B9-5 lawful intel loses confidence after 12h and precise ratios after 24h',()=>{
 const w=endgameWorld(),a=agent(w);knowledge(w,a,{'modern.knight':100});const fresh=knownEnemyMix(w,a);w.time+=13*HOUR;expect(knownEnemyMix(w,a).total).toBe(fresh.total*.5);w.time+=12*HOUR;expect(knownEnemyMix(w,a).total).toBe(0);expect(knownEnemyMix(w,a).targets).toEqual({});expect(knownEnemyMix(w,a).direction).toBe('anti-armor');
});
it('B9-5 doctrine holds 6h, responds early only after real defeat state, and transfers at most 20 percent budget',()=>{
 const w=endgameWorld(),a=agent(w);w.factions[0].modernQualification='full';const first=modernDoctrine(w,a);knowledge(w,a,{'modern.guard.civ_britannia':100});w.time++;expect(modernDoctrine(w,a)).toEqual(first);a.lastMajorDefeatAt=w.time;const next=modernDoctrine(w,a);expect(next.direction).toBe('anti-sniper');const moved=Object.keys(first.budgets).reduce((n,k)=>n+Math.abs(next.budgets[k]-first.budgets[k]),0)/2;expect(moved).toBeLessThanOrEqual(.2000001);expect(next.budgets['modern.knight']).toBeGreaterThan(first.budgets['modern.knight']);
});
it('B9-5 all six civilizations retain distinct modern resource budgets; Britain has 25–35 percent guards and 15–20 against armor',()=>{
 const w=endgameWorld(),plans=[];for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia']){w.factions[0].civilizationId=civ;const a=agent(w);plans.push(JSON.stringify(modernDoctrine(w,a).budgets));if(civ==='civ_britannia'){expect(a.modernDoctrine!.budgets.guard).toBeGreaterThanOrEqual(.25);expect(a.modernDoctrine!.budgets.guard).toBeLessThanOrEqual(.35);knowledge(w,a,{'modern.knight':100});w.time+=6*HOUR;const next=modernDoctrine(w,a);expect(next.budgets.guard).toBeGreaterThanOrEqual(.2);w.time+=6*HOUR;const settled=modernDoctrine(w,a);expect(settled.budgets.guard).toBeGreaterThanOrEqual(.15);expect(settled.budgets.guard).toBeLessThanOrEqual(.200001);}}
 expect(new Set(plans).size).toBe(6);
});
it('B9-5 production scores compare actual resource investment, including the legal Frankish new-build discount',()=>{
 const w=endgameWorld(),a=agent(w),c=w.cities[0];w.factions[0].civilizationId='civ_frankia';w.factions[0].modernQualification='full';w.factions[0].techIds.push('modern.civ_frankia.exclusive');c.military!.units={'modern.knight':10,'modern.militia':10};const b=modernDoctrine(w,a).budgets,cost=(id:string)=>Object.values(unitRecruitCost(w,c,UNIT_CATALOG[id])).reduce((a,b)=>a+b,0),share=cost('modern.knight')/(cost('modern.knight')+cost('modern.militia'));
 expect(militaryBudgetScore(w,c,a,'modern.knight')).toBeCloseTo(1+6*(b['modern.knight']-share));expect(militaryBudgetScore(w,c,a,'modern.spearman')).toBeGreaterThan(militaryBudgetScore(w,c,a,'modern.knight'));
});
it('B9-5 reverse-engineering chooses only encountered lines and actual armor/sniper threats',()=>{
 const w=endgameWorld(),a=agent(w);w.modernAwareness={pools:{[w.playerFactionId]:{value:80,significantEncounter:true,encountered:['modern.spearman','modern.light-cavalry','modern.knight']}},battles:[]};knowledge(w,a,{'modern.knight':100});expect(reverseLine(w,a)).toBe('modern.spearman');knowledge(w,a,{'modern.guard.civ_britannia':100});expect(reverseLine(w,a)).toBe('modern.light-cavalry');w.factions[0].reverseEngineering=['modern.light-cavalry'];expect(reverseLine(w,a)).not.toBe('modern.light-cavalry');
});
it('B9-5 modern common research priorities react to actual incoming attacks',()=>{
 let w=endgameWorld(),a=agent(w);w.largeProjects=[];w.cities[2].military!.units={militia:10};const before=modernResearchPriority(w,w.cities[0],a,'modern.mobilization');w=act(w,{type:'army.dispatch',cityId:w.cities[2].id,mission:'raid',target:{kind:'city',cityId:w.cities[0].id},units:{militia:10}},w.factions[1].id);
 expect(modernResearchPriority(w,w.cities[0],a,'modern.personal-protection')).toBeGreaterThan(modernResearchPriority(w,w.cities[0],a,'modern.mobilization'));expect(before).toBeGreaterThan(0);
});
it('B9-5 high-threat plans submit a real destruction mission while preserving effective combat reserves',()=>{
 let w=endgameWorld(true),a=agent(w);w.cities[0].military!.units={militia:1000,catapult:3000};knowledge(w,a,{});const p=originalCityAttack(w,w.cities[0],a).commands[0];expect(p.type).toBe('army.dispatch');if(p.type!=='army.dispatch')throw Error('Dispatch missing');expect(p.mission).toBe('wonder-destruction');expect(p.units.militia).toBeLessThanOrEqual(600);expect(autonomousDispatchReason(w,a.factionId,p,new Map())).toBeUndefined();w=act(w,p);const result=advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt);expect(result.world.combat!.battles.length+result.reports.filter(r=>r.battle?.outcome==='wonder-destroyed').length).toBeGreaterThan(0);
});
it('B9-5 five approved attack strategies remain available and consume the same endgame city candidate',()=>{
 const w=endgameWorld(true),a=agent(w);w.cities[0].military!.units={militia:1000,catapult:3000};knowledge(w,a,{});expect(ATTACK_STRATEGIES).toEqual(['A48','V2B48','V3Parallel48','WildPriority60','WildParallel48']);for(const strategy of ATTACK_STRATEGIES){const commands=executeAttackStrategy(w,w.cities[0],a,strategy);expect(commands.some(c=>c.type==='army.dispatch'&&c.mission==='wonder-destruction')).toBe(true);}
});
it('B9-5 pressure requires legal traditional intel and exits for modern opposition or a real home alert',()=>{
 let w=endgameWorld(),a=agent(w);w.largeProjects=[];w.factions[0].modernQualification='full';knowledge(w,a,{militia:10});let target=publicSituation(w,a,w.cities[0]).find(c=>c.id===w.cities[2].id)!;w.factions[1].modernQualification='none';target={...target,modern:false};expect(modernPressure(w,w.cities[0],a,target)).toBe(true);expect(modernPressure(w,w.cities[0],a,{...target,modern:true})).toBe(false);
 w.cities[2].military!.units={militia:10};w=act(w,{type:'army.dispatch',cityId:w.cities[2].id,mission:'raid',target:{kind:'city',cityId:w.cities[0].id},units:{militia:10}},w.factions[1].id);expect(modernPressure(w,w.cities[0],a,target)).toBe(false);
});
it('B9-5 native imperial axes follow the actual legion count and reject reserve exhaustion',()=>{
 let w=nativeEndgameWorld(),a=agent(w);w.factions[0].modernQualification='full';w.cities[0].military!.units={militia:1000};for(let i=0;i<3;i++)w=act(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'conquest',target:{kind:'city',cityId:w.cities[30+i].id},units:{militia:100}});
 expect(conquestAxes(w,w.playerFactionId)).toEqual({count:3,limit:3});const p={type:'army.dispatch' as const,cityId:w.cities[0].id,mission:'conquest' as const,target:{kind:'city' as const,cityId:w.cities[33].id},units:{militia:100}};expect(autonomousDispatchReason(w,w.playerFactionId,p,new Map())).toContain('axes');expect(ownCombatPower(w,a.factionId,{militia:100})).toBeGreaterThan(0);
});
it('B9-5 native AI defenders stage legal reserve-backed reinforcement instead of teleporting troops',()=>{
 let w=nativeEndgameWorld(),owner=w.factions[1].id,a=agent(w,owner),c=w.cities[1];c.military!.units={militia:100};const plan=wonderDefense(w,c,a)!;expect(plan.map(p=>p.type)).toEqual(['defense.set','defense.dispatch']);for(const p of plan)w=act(w,p,owner);expect(w.cities[1].military!.units.militia).toBe(80);expect(w.armies.at(-1)!.status).toBe('outbound');expect(w.armies.at(-1)!.arrivalAt).toBeGreaterThan(w.time);
});
it('B9-5 no new wonder attack bypasses the existing activity/cooldown gates',()=>{
 const w=endgameWorld(true),a=agent(w);w.cities[0].military!.units={militia:1000,catapult:3000};knowledge(w,a,{});a.active=false;expect(militaryDecision(w,w.cities[0],a)).toEqual([]);a.active=true;a.lastWarAt=w.time;expect(militaryDecision(w,w.cities[0],a)).toEqual([]);
});
it('B9-5 native 99 AI and player repair with identical real stock, caravans, arrival pools and save receipts',async()=>{
 let w=nativeEndgameWorld();enableAutonomy(w);for(const a of w.autonomy!.agents){a.active=true;a.nextAt=w.time+100*HOUR;w.events.find(e=>e.id===a.eventId)!.at=a.nextAt;}
 let s=new EventScheduler(w.events);for(const p of w.largeProjects.filter(p=>p.wonder))applyWonderDamage(w,p.projectId,{type:'fixture.marker',marker:p.projectId,id:eventId('damage-'+p.projectId.slice(8)),at:w.time},resolutionId('damage-'+p.projectId.slice(8)),4500,s);w.events=s.snapshot();
 for(let i=0;i<100;i++){const c=w.cities[i],a=w.autonomy!.agents.find(a=>a.factionId===c.ownerFactionId)??agent(w),before={...c.stock};let command=wonderDecision(w,c,a);if(command?.type==='wonder.repair.start'){w=act(w,command,c.ownerFactionId);command=repairDecision(w,w.cities[i],a);}expect(command?.type).toBe('wonder.repair.ship');if(!command||command.type!=='wonder.repair.ship')throw Error('Repair contribution missing');w=act(w,command,c.ownerFactionId);for(const k of ['food','wood','stone','gold'] as const)expect(before[k]-w.cities[i].stock[k]).toBe(command.resources[k]);}
 expect(w.logistics!.filter(t=>t.sourceFactionId!==w.playerFactionId)).toHaveLength(99);const expected=new Map(w.largeProjects.filter(p=>p.repair).map(p=>[p.projectId,p.shipments.reduce((n,t)=>n+t.resources.food,0)]));w=advanceFormal(w,Math.max(...w.logistics!.map(t=>t.arrivalAt))).world;for(const p of w.largeProjects.filter(p=>p.repair))expect(p.poolResources.food).toBe(expected.get(p.projectId));expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
},30000);
it('B9-5 imperial endgame diplomacy observes the actual six-hour friendly termination before hostile missions',()=>{
 let w=nativeEndgameWorld(),owner=w.factions[30].id;for(let i=25;i<30;i++){w.cities[i].ownerFactionId=owner;w.factions[i].empireId=null;for(const l of w.politics!.legions)l.members=l.members.filter(id=>id!==w.factions[i].id);}invalidateSpatial(w);w.cities[30].military!.units={militia:1};invalidateMilitaryPower(w);w=act(w,{type:'politics',cityId:w.cities[0].id,action:'friendly-propose',target:owner});w=act(w,{type:'politics',cityId:w.cities[30].id,action:'request-accept',requestId:w.politics!.requests[0].id},owner);
 const a=agent(w);a.traits={...a.traits,military:1,risk:1};const plan=endgameFriendlyEnd(w,w.cities[0],a);expect(plan?.type).toBe('politics');expect(plan).toMatchObject({action:'friendly-end'});w=act(w,plan!);const end=w.politics!.relations[0].endsAt!;expect(end-w.time).toBe(6*HOUR);w.cities[0].military!.units={militia:100,catapult:1};const mission={type:'army.dispatch' as const,cityId:w.cities[0].id,mission:'wonder-destruction' as const,target:{kind:'city' as const,cityId:w.cities[30].id},units:{militia:50,catapult:1}};
 expect(submitFormalOrder(w,order(w,mission)).ack?.status).toBe('rejected');w=advanceFormal(w,end-1).world;expect(submitFormalOrder(w,order(w,mission)).ack?.status).toBe('rejected');w=advanceFormal(w,end).world;expect(submitFormalOrder(w,order(w,mission)).ack?.status).toBe('committed');
});
it('B9-5 native doctrine and legal intel persist through native Save/Load without hidden troop ledgers',async()=>{
 let w=nativeEndgameWorld();enableAutonomy(w);const a=w.autonomy!.agents[0];knowledge(w,a,{'modern.knight':100},w.cities[30]);const doctrine=modernDoctrine(w,a),loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded.autonomy!.agents[0].modernDoctrine).toEqual(doctrine);expect(modernDoctrine(loaded,loaded.autonomy!.agents[0])).toEqual(doctrine);expect(loaded.autonomy!.agents[0].intel).toEqual(a.intel);
});
it('B9-5 successive modern sorties account for already deployed power and cannot drain the original reserve',()=>{
 let w=endgameWorld(),a=agent(w);w.largeProjects=[];w.factions[0].modernQualification='full';w.factions[1].modernQualification='none';w.cities[0].military!.units={militia:1000};knowledge(w,a,{});w=act(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'conquest',target:{kind:'city',cityId:w.cities[2].id},units:{militia:550}});
 const p=originalCityAttack(w,w.cities[0],a).commands[0];expect(p?.type).toBe('army.dispatch');if(p?.type!=='army.dispatch')throw Error('Bounded second sortie missing');expect(p.units.militia).toBeLessThanOrEqual(50);expect(autonomousDispatchReason(w,w.playerFactionId,{...p,units:{militia:400}},new Map())).toContain('reserve');w=act(w,p);expect(originalCityAttack(w,w.cities[0],a).commands).toEqual([]);expect(w.cities[0].military!.units.militia).toBeGreaterThanOrEqual(300);
});
