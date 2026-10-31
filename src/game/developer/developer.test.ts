import {NATIVE_RULESET_VERSION} from '../formal/versions';
import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {developerWorld,developerOrder,SCENARIOS} from './scenarios';
import {runDeveloperChecks,type CheckResult} from './checks';
import {DeveloperSession} from './session';
import {createFormalWorld,CIVILIZATIONS} from '../formal/generator';
import {FormalPersistence} from '../persistence';
import {canonicalJSON} from '../formal/canonical';
import {writeFileSync} from 'node:fs';

it('all presets/six civilizations use valid native v85 worlds and keep full entity counts',()=>{
 for(const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[])for(const civilizationId of CIVILIZATIONS){const w=developerWorld({scenario,civilizationId,seed:90217,speed:25});expect(w.metadata.rulesetVersion).toBe(NATIVE_RULESET_VERSION);expect(w.factions).toHaveLength(100);expect(w.cities).toHaveLength(100);expect(w.worldLayer?.wildSites).toHaveLength(432);expect(w.cities[0].economy!.slots&&Object.keys(w.cities[0].economy!.slots).length).toBeLessThanOrEqual(15);}
},30000);
it('browser-available diagnostic cases actually execute and none is a hardcoded PASS',async()=>{
 const rows:CheckResult[]=[];const results=await runDeveloperChecks(r=>rows.push(r),{scenario:'new',seed:90217,speed:25,civilizationId:'civ_zhongguo'});
 expect(JSON.parse(results.find(r=>r.title==='66 傳統科技／28 傳統兵種資料')!.evidence)).toMatchObject({traditionalTech:66,traditionalUnits:28,modernUnits:16});
 expect(rows).toEqual(results);expect(results.length).toBeGreaterThanOrEqual(50);expect(results.filter(r=>r.status==='fail').map(r=>({title:r.title,evidence:r.evidence}))).toEqual([]);
 expect(new Set(results.map(r=>r.stage))).toEqual(new Set(['B2','B3','B4','存檔']));for(const speed of [1,3,6,10,25])expect(results.some(r=>r.title.startsWith(speed+'X '))).toBe(true);
 if(process.env.DEVELOPER_EVIDENCE)writeFileSync(process.env.DEVELOPER_EVIDENCE,JSON.stringify(results,null,2));
},60000);
it('developer commands/advance/reload/Recovery stay in a separate store and leave normal authority untouched',async()=>{
 const production=new FormalPersistence({suffix:'production-isolation-'+crypto.randomUUID()}),dev=new DeveloperSession('developer-isolation-'+crypto.randomUUID());
 try{const normal=await production.start(createFormalWorld({campaign:'normal-isolation',seed:90217})),before=canonicalJSON((await production.loadSave()).game);
  await dev.start({scenario:'economy',seed:90217,speed:25,civilizationId:'civ_zhongguo'});const home=dev.world!.cities[0].id;await dev.command({type:'field.upgrade',cityId:home,slot:0});const job=dev.world!.cities[0].economy!.construction[0];
  await dev.advance((job.startsAt+job.durationMs-dev.world!.time)/25);expect(dev.world!.cities[0].fields![0].level).toBe(1);const saved=canonicalJSON(dev.world);await dev.reload();expect(canonicalJSON(dev.world)).toBe(saved);await dev.restore();expect(dev.world!.cities[0].fields![0].level).toBe(0);
  expect(dev.logs.some(r=>r.action==='field.upgrade'&&r.result==='committed')).toBe(true);expect(canonicalJSON((await production.loadSave()).game)).toBe(before);expect((await production.loadSave()).game!.campaignId).toBe(normal.campaignId);await dev.dispose();expect(canonicalJSON((await production.loadSave()).game)).toBe(before);
 }finally{await production.db.delete();await dev.persistence.db.delete();}
},30000);
it('rejected diagnostics commands do not change the persisted world or bypass formal qualifications',async()=>{
 const dev=new DeveloperSession('developer-rejected-'+crypto.randomUUID());
 try{await dev.start({scenario:'new',seed:90217,speed:1,civilizationId:'civ_zhongguo'});const before=canonicalJSON(dev.world),p={type:'settlement.prepare' as const,cityId:dev.world!.cities[0].id};const ack=await dev.command(p);expect(ack?.status).toBe('rejected');expect(canonicalJSON(dev.world)).toBe(before);expect(canonicalJSON((await dev.persistence.loadSave()).game)).toBe(before);expect(dev.logs.at(-1)?.result).toContain('拓殖');expect(()=>new DeveloperSession('')).toThrow();expect(()=>new DeveloperSession('production')).toThrow();expect(developerOrder(dev.world!,p).expectedRevision).toBe(dev.world!.revision);
 }finally{await dev.dispose();}
});
