import {expect,it} from 'vitest';
import {V85,auditCatalogs,formulaCatalog,productionTrace} from './specAudit';
import {createTrialWorld,trialPreview,variantsFor} from './specTrials';
import {developerWorld} from './scenarios';
import {writeFileSync,mkdirSync} from 'node:fs';
const config={scenario:'new' as const,seed:90217,speed:25,civilizationId:'civ_zhongguo'};
it('independent v85 reference includes all catalogs and catches a changed expected value',()=>{
 expect(V85.buildings).toHaveLength(20);expect(V85.techs).toHaveLength(82);expect(V85.units).toHaveLength(28);expect(V85.sections).toHaveLength(364);
 const before=V85.buildings[0].baseCost.food;V85.buildings[0].baseCost.food=before+5;
 try{expect(auditCatalogs().find(r=>r.target==='center')!.dataMatches).toBe(false);}finally{V85.buildings[0].baseCost.food=before;}
 const rows=auditCatalogs(),curves=formulaCatalog();mkdirSync('docs/wall-delta-v03022',{recursive:true});writeFileSync('docs/wall-delta-v03022/spec-data-comparison.json',JSON.stringify({reference:V85.sha256,rows,curves},null,2));
 console.log('DATA DIFFERENCES',rows.filter(r=>!r.dataMatches).map(r=>r.name));
 expect(rows.every(r=>r.dataMatches)).toBe(true);expect(curves.every(c=>c.status==='match')).toBe(true);
});
it('every supported item has a native-world positive fixture and every declared counterexample executes against the real reducer',()=>{
 const base=developerWorld(config),results:unknown[]=[],failures:unknown[]=[];
 for(const row of auditCatalogs())for(const variant of variantsFor(row.kind,row.target)){
  const req={kind:row.kind,target:row.target,level:row.kind==='field'?11:1,variant:variant.id,config};
  try{const {world,info}=createTrialWorld(req,base),preview=trialPreview(world,info);results.push({name:row.name,variant:variant.id,expected:info.expectedAdmission,preview});if(preview?.status!=='match'||preview&&'comparisons' in preview&&preview.comparisons?.some(c=>!c.matches))failures.push({name:row.name,variant:variant.id,preview});}catch(e){failures.push({name:row.name,variant:variant.id,error:String(e)});}
 }
 mkdirSync('docs/wall-delta-v03022',{recursive:true});writeFileSync('docs/wall-delta-v03022/spec-scenario-comparison.json',JSON.stringify({reference:V85.sha256,results,failures},null,2));console.log('TRIAL FAILURES',failures.map(f=>(f as {name:string}).name));
 expect(results).toHaveLength(715);expect(failures).toEqual([]);
},60000);
it('production fixture exposes independent formula and real one-hour accumulated outputs',()=>{
 const {world}=createTrialWorld({kind:'production',target:'all',level:10,variant:'ready',config,production:{level:10,boost:6,tier:3}});const trace=productionTrace(world,world.cities[0]);expect(trace.every(c=>c.status==='match')).toBe(true);expect(trace[0].expected).toBeCloseTo(5040*1.24*1.09);
});

it('six civilizations use the independent v85 blacksmith limits and all five speeds preserve the same unit training world duration',()=>{
 const base=developerWorld(config),evidence:unknown[]=[];
 for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'])for(const d of V85.techs.filter(t=>t.id.startsWith('blacksmith.'))){const {world,info}=createTrialWorld({kind:'tech',target:d.id,level:1,variant:'ready',config:{...config,civilizationId:civ}},base);const p=trialPreview(world,info);expect(p?.status).toBe('match');evidence.push({civilization:civ,id:d.id,expected:info.expectedAdmission,actual:p?.actual});}
 for(const speed of [1,3,6,10,25])for(const lv of [1,5,10,15]){const {world,info}=createTrialWorld({kind:'unit',target:'swordsman',level:lv,variant:'ready',config:{...config,speed}},base);world.speed=speed;const p=trialPreview(world,info);expect(p?.status).toBe('match');if(p&&'comparisons' in p)expect(p.comparisons?.every(c=>c.matches)).toBe(true);evidence.push({speed,producerLevel:lv,worldMs:info.expectedDurationMs,realSeconds:info.expectedDurationMs!/speed/1000});}
 writeFileSync('docs/wall-delta-v03022/civilization-speed-comparison.json',JSON.stringify(evidence,null,2));
});
