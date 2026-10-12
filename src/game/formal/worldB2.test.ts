import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {createFormalWorld} from './generator';
import {buildable,passable,terrainAt,fieldDistribution} from './terrain';
import {SpatialIndex,spatial} from './spatial';
import {decodeSave,encodeSave} from './saveCodec';
import {validateFormalWorld} from './schema';
import {FormalPersistence} from '../persistence';
import {submitFormalOrder} from './reducer';
import {commandId} from './ids';
const make=(campaign='b2',seed=90217)=>createFormalWorld({campaign,seed});
const geometry=(w:ReturnType<typeof make>)=>({terrain:w.worldLayer!.terrain,cities:w.cities.map(c=>[c.id,c.ownerFactionId,c.x,c.y,c.fields]),sites:w.worldLayer!.wildSites,factions:w.factions.map(f=>[f.id,f.role,f.civilizationId])});
it('384×384 native world has 144 indexed regions, 100 factions, 1 player and 99 AI',()=>{
 const w=make();expect(w.fixture).toBe(false);expect(w.dimensions).toEqual({width:384,height:384});expect(w.worldLayer!.terrain).toHaveLength(147456);expect(spatial(w).regions.size).toBe(144);expect(w.factions).toHaveLength(100);expect(w.factions.filter(f=>f.role==='player')).toHaveLength(1);expect(w.factions.filter(f=>f.role==='ai')).toHaveLength(99);
});
it('all 100 factions have exactly one owned D7 city with every opening field and no hidden bonuses',()=>{
 const w=make();expect(w.cities).toHaveLength(100);expect(w.armies).toEqual([]);expect(w.researchProjects).toEqual([]);
 for(const f of w.factions){const [c,...rest]=spatial(w).owned(f.id);expect(rest).toEqual([]);expect(c).toMatchObject({population:200,housing:400,stock:{food:600,wood:600,stone:600,gold:600},buildings:{center:1},wallLevel:0,cityPromotionCompleted:false,integrationWorkHours:0,startingCity:true});expect(c.fields!.every(p=>p.level===0)).toBe(true);expect(['food','wood','stone','gold'].map(r=>c.fields!.filter(p=>p.resource===r).length)).toEqual([6,5,4,3]);expect(f).toMatchObject({age:0,techIds:[],researchQueue:null,modernQualification:'none',researchCooperation:false});expect(f).not.toHaveProperty('capital');}
});
it('432 identified wild sites follow quota 3 per region with level 1–10 and only legal nonoverlapping terrain',()=>{
 const w=make(),index=spatial(w),occupied=new Set<string>();expect(w.worldLayer!.wildSites).toHaveLength(432);
 for(const region of index.regions.values())expect(region.sites.size).toBe(3);
 for(const p of [...w.cities,...w.worldLayer!.wildSites]){const k=`${p.x},${p.y}`;expect(occupied.has(k)).toBe(false);occupied.add(k);expect(buildable(terrainAt(w,p.x,p.y))).toBe(true);}
 expect(new Set(w.worldLayer!.wildSites.map(s=>s.id)).size).toBe(432);expect(new Set(w.worldLayer!.wildSites.map(s=>s.spawnSlot)).size).toBe(432);expect(w.worldLayer!.wildSites.every(s=>s.level>=1&&s.level<=10)).toBe(true);
});
it('river traverses but never builds; water and mountains never build; mountains never traverse',()=>{
 expect(passable('river')).toBe(true);for(const t of ['river','water','mountain'] as const)expect(buildable(t)).toBe(false);expect(passable('mountain')).toBe(false);expect(passable('water')).toBe(false);const codes=new Set(make().worldLayer!.terrain);expect([...codes].sort()).toEqual(['F','L','M','R','W']);
});
it('same inputs reproduce geometry; campaign identity changes no geometry; changed seed changes geometry',()=>{
 expect(geometry(make())).toEqual(geometry(make('different-campaign')));expect(geometry(make())).toEqual(geometry(make()));expect(geometry(make())).not.toEqual(geometry(make('b2',90218)));
 expect(()=>createFormalWorld({campaign:'b2',seed:1,terrainVersion:999})).toThrow();expect(()=>createFormalWorld({campaign:'b2',seed:1,worldGeneratorVersion:'demo'})).toThrow();
});
it('coordinate/ownership/nearby/visible-region queries agree with independent filtered records',()=>{
 const w=make(),i=spatial(w),c=w.cities[0];expect(i.at(c.x,c.y).city).toBe(c);const q=i.nearby(c.x,c.y,70);expect(q.cities.map(c=>c.id).sort()).toEqual(w.cities.filter(p=>Math.hypot(p.x-c.x,p.y-c.y)<=70).map(c=>c.id).sort());expect(i.visibleRegions({minX:31,minY:31,maxX:32,maxY:32})).toEqual([0,1,12,13]);expect(i.visibleRegions({minX:-3,minY:-3,maxX:999,maxY:999})).toHaveLength(144);
 const idx=new SpatialIndex(384,384);for(const c of w.cities)idx.addCity(structuredClone(c));const n=idx.cities.get(c.id)!;idx.transfer(n,w.factions[1].id);expect(idx.owned(w.playerFactionId)).toHaveLength(0);expect(idx.owned(w.factions[1].id)).toHaveLength(2);
});
it('strict save validator rejects illegal terrain, overlap, broken field identity, dimensions and missing layer without repair',()=>{
 const w=make();for(const change of [(n:typeof w)=>{n.dimensions.width=256;},(n:typeof w)=>{n.worldLayer!.terrain='L';},(n:typeof w)=>{n.cities[1].x=n.cities[0].x;n.cities[1].y=n.cities[0].y;},(n:typeof w)=>{n.cities[0].fields![1].slot=0;},(n:typeof w)=>{n.worldLayer!.wildSites.pop();}]){const n=structuredClone(w);change(n);const before=JSON.stringify(n);expect(()=>validateFormalWorld(n)).toThrow();expect(JSON.stringify(n)).toBe(before);}
});
it('native save/load retains all geometry and rebuilds ephemeral indexes without renderer data',async()=>{
 const w=make(),e=await encodeSave(w),loaded=(await decodeSave(e)).world;expect(loaded).toEqual(w);expect(spatial(loaded).cities.size).toBe(100);expect(spatial(loaded).sites.size).toBe(432);expect(e.snapshot).not.toHaveProperty('spatialIndex');expect(e.snapshot).not.toHaveProperty('renderer');
});
it('native IndexedDB Recovery skips valid-envelope mismatched row and restores old world geometry',async()=>{
 const p=new FormalPersistence({suffix:'b2-'+crypto.randomUUID()});try{let w=await p.start(make());const a=w;const result=submitFormalOrder(w,{commandId:commandId('b2-rename'),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'city.rename',cityId:w.cities[0].id,name:'新名'}});w=await p.save(result.world,result.reports,w.revision);const rows=await p.db.backups.toArray();await p.db.backups.update(rows.at(-1)!.id!,{reportCursor:999});const current=await p.db.saves.get('current');if(current?.kind!=='world')throw new Error('missing');await p.db.saves.put({...current,data:{...current.data,checksum:'0'.repeat(64)}});const recovered=await p.loadSave();expect(recovered.recovered).toBe(true);expect(geometry(recovered.game!)).toEqual(geometry(a));expect(recovered.game!.cities[0].name).toBe(a.cities[0].name);expect(recovered.game!.revision).toBeGreaterThan(w.revision);}finally{await p.db.delete();}
});
describe('seed sweep',()=>{for(const seed of [0,1,4294967295,122,20261004])it(`seed ${seed} respects geometry and quota`,()=>{const w=make('sweep',seed);expect(w.cities).toHaveLength(100);expect(w.worldLayer!.wildSites).toHaveLength(432);expect(spatial(w).regions.size).toBe(144);});});
it('coordinate distribution is deterministic, 18 fields, and every basic resource exists',()=>{for(let x=0;x<384;x++){const d=fieldDistribution(90217,x,250);expect(d).toEqual(fieldDistribution(90217,x,250));expect(d.reduce((a,b)=>a+b,0)).toBe(18);expect(Math.min(...d)).toBeGreaterThanOrEqual(1);}});
