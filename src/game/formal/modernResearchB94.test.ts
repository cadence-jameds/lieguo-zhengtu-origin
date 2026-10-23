import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {make,researchCity,rich,build,order,reject} from './developmentTestSupport';
import {issue} from './combatTestSupport';
import {TECH_CATALOG} from './techCatalog';
import {resourceKeys,zeroResources,type FormalWorld} from './model';
import {advanceFormal,submitFormalOrder,completeResearch} from './reducer';
import {changeCityOwner} from './economy';
import {researchQuote} from './buildingDetailData';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {enableAutonomy,economicChoices} from './autonomy';
const H=3600000;
const rows=[
 ['modern.infantry-weapons','barracks',4,180000,160000,140000,420000],
 ['modern.personal-protection','barracks',4,200000,180000,260000,260000],
 ['modern.composite-armor','stable',6,200000,150000,500000,550000],
 ['modern.digital-fire-control','archery',5,120000,250000,230000,600000],
 ['modern.mechanized-logistics','market',4,250000,300000,150000,300000],
 ['modern.supply-system','warehouse',5,400000,200000,150000,250000],
 ['modern.mobilization','barracks',6,400000,250000,150000,400000],
 ['modern.siege-engineering','workshop',7,150000,350000,550000,550000],
 ['modern.data-link','embassy',4,100000,200000,150000,350000],
 ['modern.civ_zhongguo.exclusive','castle',10,300000,600000,450000,1650000],
 ['modern.civ_byzantium.exclusive','castle',10,350000,250000,1100000,1300000],
 ['modern.civ_frankia.exclusive','castle',10,750000,250000,650000,1350000],
 ['modern.civ_britannia.exclusive','castle',10,250000,600000,300000,1850000],
 ['modern.civ_japan.exclusive','castle',10,650000,350000,450000,1550000],
 ['modern.civ_mongolia.exclusive','castle',10,850000,350000,450000,1350000],
] as const;
function ready(id=rows[0][0] as string){const w=make();researchCity(w,true);const civ=TECH_CATALOG[id].civilizationId;if(civ)w.factions[0].civilizationId=civ;return w;}
function fundingCities(w:FormalWorld){for(const c of w.cities.slice(1,6)){changeCityOwner(w,c,w.playerFactionId,'receive');rich(w,c,500000);}return w;}
function fund(w:FormalWorld){for(const c of w.cities.filter(c=>c.ownerFactionId===w.playerFactionId)){const p=w.researchProjects.at(-1)!;if(p.phase!=='funding')break;const resources=zeroResources();for(const r of resourceKeys)resources[r]=Math.min(c.stock[r],p.requiredResources[r]-p.contributedResources[r]);if(resourceKeys.some(r=>resources[r]>0))w=issue(w,{type:'research.contribute',cityId:c.id,projectId:p.projectId,resources}).world;}expect(w.researchProjects.at(-1)!.phase).toBe('researching');return w;}
it('B9-4D cooperation is full-only, Academy15, single-city 60/80/70/90k and 4h×.79; no early multi-city funding',()=>{
 let w=make();const c=researchCity(w),id='research.cooperation';w.factions[0].reverseEngineering=['modern.militia'];reject(w,{type:'research.start',cityId:c.id,techId:id});w.factions[0].modernQualification='full';c.buildings.academy=14;reject(w,{type:'research.start',cityId:c.id,techId:id});c.buildings.academy=15;c.stock.gold=89999;reject(w,{type:'research.start',cityId:c.id,techId:id});c.stock.gold=100000;reject(w,{type:'research.start',cityId:c.id,techId:rows[0][0]});
 const cmd=order(w,{type:'research.start',cityId:c.id,techId:id},'cooperation-paid');w=submitFormalOrder(w,cmd).world;expect(w.cities[0].stock).toEqual({food:40000,wood:20000,stone:30000,gold:10000});const p=w.researchProjects.at(-1)!;expect(p.paymentMode).toBe('single-city');expect(p.durationSnapshot).toEqual({baseDurationMs:4*H,academyMultiplier:.79,durationMs:Math.round(4*H*.79)});expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');reject(w,{type:'research.contribute',cityId:w.cities[1].id,projectId:p.projectId,resources:{food:1,wood:0,stone:0,gold:0}});const end=p.startedAt!+p.durationSnapshot.durationMs;expect(advanceFormal(w,end-1).world.factions[0].researchCooperation).toBe(false);w=advanceFormal(w,end).world;expect(w.factions[0].researchCooperation).toBe(true);expect(w.factions[0].techIds).toContain(id);
});
for(const [id,building,hours,food,wood,stone,gold] of rows)it(`B9-4D ${id}: exact prerequisites/cost/time, real multi-city ledger, unique queue and completion`,async()=>{
 let w=ready(id);const c=w.cities[0],d=TECH_CATALOG[id];expect(d.cost).toEqual({food,wood,stone,gold});expect(d.baseDurationMs).toBe(hours*H);expect(d.buildings).toEqual({academy:15,[building]:15});expect(d.prerequisites).toEqual(['research.cooperation']);expect(d.effect).not.toContain('deferred');
 c.buildings.academy=14;reject(w,{type:'research.start',cityId:c.id,techId:id});c.buildings.academy=15;const key=building==='warehouse'?'warehouse.0':building;c.buildings[key]=14;reject(w,{type:'research.start',cityId:c.id,techId:id});c.buildings[key]=15;
 w.factions[0].researchCooperation=false;reject(w,{type:'research.start',cityId:c.id,techId:id});w.factions[0].researchCooperation=true;if(d.civilizationId){const original=w.factions[0].civilizationId;w.factions[0].civilizationId=original==='civ_japan'?'civ_zhongguo':'civ_japan';reject(w,{type:'research.start',cityId:c.id,techId:id});w.factions[0].civilizationId=original;}
 fundingCities(w);const before=w.cities.map(c=>({...c.stock}));w=issue(w,{type:'research.start',cityId:c.id,techId:id}).world;let p=w.researchProjects.at(-1)!;expect(w.cities.map(c=>c.stock)).toEqual(before);expect(p.phase).toBe('funding');expect(p.contributedResources).toEqual(zeroResources());expect(w.factions[0].researchQueue).toBe(p.projectId);expect(w.events.some(e=>e.type==='research.complete')).toBe(false);reject(w,{type:'research.start',cityId:c.id,techId:'research.cooperation'});
 const resources={food:1,wood:2,stone:3,gold:4},cmd=order(w,{type:'research.contribute',cityId:c.id,projectId:p.projectId,resources},'real-contribution');w=submitFormalOrder(w,cmd).world;expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(before[0][r]-resources[r]);
 w=fund(w);p=w.researchProjects.at(-1)!;expect(p.contributions.length).toBeGreaterThan(1);expect(p.contributedResources).toEqual({food,wood,stone,gold});for(const r of resourceKeys)expect(before.reduce((n,c)=>n+c[r],0)-w.cities.reduce((n,c)=>n+c.stock[r],0)).toBe(d.cost[r]);expect(w.logistics??[]).toHaveLength(0);
 const end=p.startedAt!+Math.round(hours*H*.79);expect(advanceFormal(w,end-1).world.factions[0].techIds).not.toContain(id);const loaded=(await decodeSave(await encodeSave(w))).world,t=advanceFormal(w,end);expect(advanceFormal(loaded,end)).toEqual(t);w=t.world;expect(w.factions[0].techIds.filter(t=>t===id)).toHaveLength(1);expect(w.factions[0].researchQueue).toBeNull();expect(completeResearch(w,{type:'research.complete',id:p.completionEventId!,projectId:p.projectId,at:end})).toEqual([]);
});
it('B9-4D all 15 modern technologies stay locked for partial qualification; other faction or empire member cannot contribute',()=>{
 let w=ready(),c=w.cities[0];w.factions[0].modernQualification='none';w.factions[0].reverseEngineering=['modern.militia','modern.knight'];for(const [id] of rows)reject(w,{type:'research.start',cityId:c.id,techId:id});w.factions[0].modernQualification='full';w=issue(w,{type:'research.start',cityId:c.id,techId:rows[0][0]}).world;const p=w.researchProjects[0],cmd=order(w,{type:'research.contribute',cityId:w.cities[1].id,projectId:p.projectId,resources:{food:1,wood:0,stone:0,gold:0}},'foreign-research',w.factions[1].id);expect(submitFormalOrder(w,cmd).ack?.status).toBe('rejected');
});
it('B9-4D loss of initiating city/Academy never cancels snapshot: other owned cities finish funding and research',()=>{
 let w=ready();fundingCities(w);const c=w.cities[0];w=issue(w,{type:'research.start',cityId:c.id,techId:rows[0][0]}).world;const snapshot=structuredClone(w.researchProjects[0].qualificationSnapshot);changeCityOwner(w,w.cities[0],w.factions[7].id,'conquest');w.cities[0].buildings.academy=0;w=fund(w);expect(w.researchProjects[0].qualificationSnapshot).toEqual(snapshot);w=advanceFormal(w,w.researchProjects[0].startedAt!+w.researchProjects[0].durationSnapshot.durationMs).world;expect(w.factions[0].techIds).toContain(rows[0][0]);expect(w.factions[7].techIds).not.toContain(rows[0][0]);
});
it('B9-4D Chinese kaogong discounts general modern research and cooperation, never civ exclusives or project logistics',()=>{
 const w=ready(),c=w.cities[0];w.factions[0].techIds.push('civilization.kaogong');for(const id of ['research.cooperation',...rows.slice(0,9).map(r=>r[0])]){const d=TECH_CATALOG[id],q=researchQuote(w,c,d);for(const r of resourceKeys)expect(q.cost[r]).toBe(Math.round(d.cost[r]*.85));expect(q.durationMs).toBe(Math.round(d.baseDurationMs*.79));}const exclusive=TECH_CATALOG['modern.civ_zhongguo.exclusive'];expect(researchQuote(w,c,exclusive).cost).toEqual(exclusive.cost);
});
it('B9-4D research ledger, effects and queue survive atomic failures, Recovery and equivalent offline completion',async()=>{
 const {FormalPersistence}=await import('../persistence');let fail=false;const db=new FormalPersistence({suffix:'modern-research-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('research write fault');}});
 try{let w=ready('modern.mechanized-logistics');fundingCities(w);w=issue(w,{type:'research.start',cityId:w.cities[0].id,techId:'modern.mechanized-logistics'}).world;w=await db.start(w);const first=issue(w,{type:'research.contribute',cityId:w.cities[0].id,projectId:w.researchProjects[0].projectId,resources:{food:100000,wood:100000,stone:100000,gold:100000}}).world;fail=true;await expect(db.save(first,[],w.revision)).rejects.toThrow('research write fault');expect((await db.loadSave()).game!.researchProjects[0].phase).toBe('funding');fail=false;w=await db.save(first,[],w.revision);for(const sourceId of w.cities.filter(c=>c.ownerFactionId===w.playerFactionId).map(c=>c.id)){const c=w.cities.find(c=>c.id===sourceId)!,p=w.researchProjects[0];if(p.phase!=='funding')break;const resources=zeroResources();for(const r of resourceKeys)resources[r]=Math.min(c.stock[r],p.requiredResources[r]-p.contributedResources[r]);if(resourceKeys.some(r=>resources[r]>0)){const t=issue(w,{type:'research.contribute',cityId:c.id,projectId:p.projectId,resources});w=await db.save(t.world,t.reports,w.revision);}}const end=w.researchProjects[0].startedAt!+w.researchProjects[0].durationSnapshot.durationMs,t=advanceFormal(w,end),offline=await advanceOfflineCooperative(w,0,(end-w.time)/w.speed);expect(offline.world.researchProjects).toEqual(t.world.researchProjects);expect(offline.world.factions[0].techIds).toEqual(t.world.factions[0].techIds);w=await db.save(t.world,t.reports,w.revision);const backup=(await db.backupList())[0];await db.restore(backup.id);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const r=await db.loadSave();expect(r.recovered).toBe(true);expect(r.game!.researchProjects[0].phase).toBe('completed');expect(r.game!.factions[0].techIds).toContain('modern.mechanized-logistics');}finally{await db.db.delete();}
});
it('B9-4D 99 AI reserve the same unique funding queue and spend their real city stocks through official contributions',()=>{
 let w=make();enableAutonomy(w);for(const id of w.factions.filter(f=>f.role==='ai').map(f=>f.id)){const f=w.factions.find(f=>f.id===id)!,c=rich(w,w.cities.find(c=>c.ownerFactionId===id)!,1000);build(c,'academy',15);build(c,'barracks',15);f.modernQualification='full';f.researchCooperation=true;f.techIds.push('research.cooperation');const cmd=order(w,{type:'research.start',cityId:c.id,techId:rows[0][0]},'ai-modern-research-'+id.slice(8),id);w=submitFormalOrder(w,cmd).world;const p=w.researchProjects.at(-1)!;expect(p.phase).toBe('funding');expect(p.contributedResources).toEqual(zeroResources());expect(w.factions.find(f=>f.id===id)!.techIds).not.toContain(rows[0][0]);const city=w.cities.find(x=>x.id===c.id)!,agent=w.autonomy!.agents.find(a=>a.factionId===id)!,choice=economicChoices(w,city,agent).find(x=>x.command.type==='research.contribute')!;expect(choice).toBeDefined();const t=submitFormalOrder(w,order(w,choice.command,'ai-modern-fund-'+id.slice(8),id));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;expect(w.researchProjects.at(-1)!.contributedResources.food).toBe(180);expect(w.cities.find(x=>x.id===c.id)!.stock.food).toBe(820);}expect(w.researchProjects).toHaveLength(99);
},30000);
