import {afterEach,expect,it,vi} from 'vitest';
import {recruitmentConditions,recruitmentPreview} from './cityActions';
import * as reducer from '../formal/reducer';
import {createFormalFixture} from '../formal/fixture';
import {initializeEconomy} from '../formal/economy';
import {initialMilitary,unitRecruitCost} from '../formal/military';
import {researchCity,order} from '../formal/developmentTestSupport';
import {UNIT_CATALOG,UNIT_LINES} from '../formal/unitCatalog';
import {TECH_CATALOG} from '../formal/techCatalog';
import {resourceKeys,type FormalWorld} from '../formal/model';
afterEach(()=>vi.restoreAllMocks());
function fixture(civ='civ_zhongguo',elite=true){const w=createFormalFixture({civilizationId:civ});w.armies=[];initializeEconomy(w);for(const c of w.cities)c.military=initialMilitary();const c=researchCity(w,true);c.economy!.milestones=elite?[10000,15000,20000,22000,25000,30000]:[];w.factions[0].techIds=elite?Object.values(TECH_CATALOG).filter(t=>!t.civilizationId||t.civilizationId===civ).map(t=>t.id):[];return w;}
function compare(w:FormalWorld,id:string,count:number){const c=w.cities[0],before=structuredClone(w),info=recruitmentConditions(w,c,id,count),preview=recruitmentPreview(w,c,id,count);expect(w).toEqual(before);const o=order(w,{type:'military.recruit',cityId:c.id,unitId:id,count}),result=reducer.submitFormalOrder(w,o);
 expect(result.ack?.status==='committed',`${id} x${count}: ${result.ack?.reason}`).toBe(!!preview);if(!preview)return;
 const city=result.world.cities[0],job=city.military!.queue.find(j=>j.commandId===o.commandId)!;expect({lane:job.lane,startsAt:job.startsAt,nextAt:job.nextAt,remaining:job.remaining,durationMs:job.durationMs}).toEqual(preview);expect(job.unitId).toBe(info.d.id);expect(job.unitCost).toEqual(info.unitCost);expect(c.population-city.population).toBe(info.population);for(const r of resourceKeys)expect(c.stock[r]-city.stock[r]).toBe(info.cost[r]);
}
for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'])for(const elite of [false,true])it(`${civ} ${elite?'elite/discounted':'base'} previews match formal costs, population, qualification and schedule`,()=>{
 const w=fixture(civ,elite),guard=Object.values(UNIT_CATALOG).find(u=>u.civilizationId===civ&&!u.eliteTech&&u.era!=='modern')!;
 for(const modern of [false,true])for(const line of UNIT_LINES){const id=(modern?'modern.':'')+(line==='guard'?guard.id:line);for(const count of [1,5,50,500,1000])compare(w,id,count);}
});
for(const dual of [false,true])for(const size of [0,1,2,3,4,5])it(`${dual?'dual':'single'} channel with ${size} queued jobs uses the same lane, tie-break and completion`,()=>{
 let w=fixture('civ_zhongguo',dual);for(let i=0;i<size;i++){const t=reducer.submitFormalOrder(w,order(w,{type:'military.recruit',cityId:w.cities[0].id,unitId:'scout',count:i+1}));expect(t.ack?.status).toBe('committed');w=t.world;}compare(w,'scout',37);
});
it('rejects insufficient resources, population, housing, producer, era, modern and foreign-castle eligibility just like the Worker',()=>{
 for(const kind of ['resources','population','housing','producer','age','modern','foreign','explicit-elite']){const w=fixture(),c=w.cities[0];let id='militia';
  if(kind==='resources')c.stock.food=0;if(kind==='population')c.population=0;if(kind==='housing')c.population=c.housing+1;if(kind==='producer')delete c.buildings.barracks;if(kind==='age'){w.factions[0].age=0;w.factions[0].techIds=[];id='knight';}if(kind==='modern'){w.factions[0].modernQualification='none';w.factions[0].techIds=[];id='modern.militia';}if(kind==='foreign'){c.castleCivilizationId='civ_japan';id='guard.civ_zhongguo';}if(kind==='explicit-elite'){c.economy!.milestones=[];id='swordsman';}compare(w,id,1);
 }
});
it('partial modern reverse-engineering and the Frankish modern cavalry discount use the original formal formulas',()=>{
 const foreign=fixture();foreign.cities[0].castleCivilizationId='civ_japan';compare(foreign,'guard.civ_japan',5);
 const w=fixture('civ_frankia'),f=w.factions[0],c=w.cities[0];for(const id of ['modern.light-cavalry','modern.knight']){expect(recruitmentConditions(w,c,id,5).unitCost).toEqual(unitRecruitCost(w,c,UNIT_CATALOG[id]));compare(w,id,5);}f.modernQualification='none';f.techIds=[];compare(w,'modern.militia',1);f.reverseEngineering=['modern.militia'];compare(w,'modern.militia',1);
});
it('the preview and conditions never submit a command or clone/validate world data',()=>{
 const w=fixture(),submit=vi.spyOn(reducer,'submitFormalOrder'),clone=vi.spyOn(globalThis,'structuredClone');for(const count of [1,5,50,500,1000,100000]){recruitmentConditions(w,w.cities[0],'scout',count);recruitmentPreview(w,w.cities[0],'scout',count);}expect(submit).not.toHaveBeenCalled();expect(clone).not.toHaveBeenCalled();
});
