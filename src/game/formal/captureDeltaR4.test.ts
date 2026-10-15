import {it,expect} from 'vitest';
import {craftWorld,captureCraftCity} from './gateDeltaTestSupport';
import {issue,dispatch} from './combatTestSupport';
import {changeCityOwner,HOUR,settleCity} from './economy';
import {EventScheduler} from './scheduler';
import {advanceFormal} from './reducer';
import {isMissionArmy} from './combatModel';
import {build} from './developmentTestSupport';
import {validateFormalWorld} from './schema';
import {encodeSave,decodeSave} from './saveCodec';
import type {FormalWorld} from './model';
import {spatial} from './spatial';
import {buildable,terrainAt} from './terrain';

function prepare(w:FormalWorld){build(w.cities[0],'castle',1);w=issue(w,{type:'settlement.prepare',cityId:w.cities[0].id}).world;return w;}
it('D1 AI city uses the same capture cleanup and does not create a player-only report',()=>{
 let w=craftWorld();w.factions[0].role='ai';w.factions[3].role='player';w.playerFactionId=w.factions[3].id;
 w.cities[0].military!.units={scout:3,baggage:2};const t=captureCraftCity(w);w=t.world;
 expect(w.extinction!.craftsmen).toHaveLength(0);expect(w.cities[0].military!.units).toEqual({});expect(t.reports).toEqual([]);validateFormalWorld(w);
});
it('D1 stationed mixed reinforcement loses only its resident noncombatants, without future baggage resurrection',()=>{
 let w=craftWorld();w.cities[0].military!.units={militia:2,scout:3,baggage:4};w=dispatch(w,'reinforce',{militia:2,scout:3,baggage:4},0,1).world;
 const a=w.armies.filter(isMissionArmy)[0];w=advanceFormal(w,a.arrivalAt).world;const s=new EventScheduler(w.events);
 changeCityOwner(w,w.cities[1],w.factions[2].id,'conquest',s);w.events=s.snapshot();
 expect(w.armies.filter(isMissionArmy)[0]).toMatchObject({units:{militia:2},initialUnits:{militia:2},status:'stationed'});validateFormalWorld(w);
});
it.each([true,false])('D1 idle craftsman is destroyed at conquest, second own city=%s',async second=>{
 let w=craftWorld(second);const craft=w.extinction!.craftsmen[0];
 const t=captureCraftCity((await decodeSave(await encodeSave(w))).world);w=t.world;
 expect(w.extinction!.craftsmen.some(c=>c.id===craft.id)).toBe(false);
 expect(w.events.some(e=>e.type==='craftsman.arrive')).toBe(false);
 expect(w.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);
 expect(advanceFormal(w,w.time)).toMatchObject({world:w,reports:[]});
 expect((await decodeSave(await encodeSave(w,t.reports))).world).toEqual(w);
});
it('D1 capture never searches for an automatic craftsman evacuation route',()=>{
 const w=craftWorld(),c=w.cities[1],terrain=w.worldLayer!.terrain.split('');
 // Enclose the surviving own city without changing any existing march.
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)terrain[(c.y+dy)*384+c.x+dx]='M';
 w.worldLayer!.terrain=terrain.join('');
 expect(()=>changeCityOwner(w,w.cities[0],w.factions[2].id,'conquest')).not.toThrow();
 expect(w.extinction!.craftsmen).toEqual([]);
});
it.each(['preparing','ready'] as const)('D1 %s colonization is destroyed without refund or dangling events',phase=>{
 let w=prepare(craftWorld());if(phase==='ready')w=advanceFormal(w,w.settlements![0].startedAt+w.settlements![0].prepDurationMs).world;
 settleCity(w,w.cities[0]);const p=w.settlements![0],stock={...w.cities[0].stock},s=new EventScheduler(w.events);
 changeCityOwner(w,w.cities[0],w.factions[2].id,'conquest',s);w.events=s.snapshot();
 expect(w.settlements).toEqual([]);expect(w.colonizationUnits).toEqual([]);
 expect(w.events.some(e=>e.id===p.prepEventId)).toBe(false);expect(w.cities[0].stock).toEqual(stock);
 validateFormalWorld(w);
});
it('D1 stationed scouts and baggage die; legal outbound scouts and craftsman survive mother-city loss',async()=>{
 let w=craftWorld();w.cities[0].military!.units={scout:7,baggage:5};
 w=dispatch(w,'scout',{scout:3},0,2).world;const a=w.armies.filter(isMissionArmy)[0];
 const craft=w.extinction!.craftsmen[0];w=issue(w,{type:'craftsman.move',cityId:w.cities[0].id,craftsmanId:craft.id,destinationCityId:w.cities[1].id}).world;
 const before=structuredClone(w),s=new EventScheduler(w.events);
 changeCityOwner(w,w.cities[0],w.factions[2].id,'conquest',s);w.events=s.snapshot();
 expect(w.cities[0].military!.units).toEqual({});
 expect(w.armies.find(x=>x.id===a.id)).toEqual(before.armies.find(x=>x.id===a.id));
 expect(w.extinction!.craftsmen).toEqual(before.extinction!.craftsmen);
 expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
});
it('D1 successful combat reports zero surviving city scouts and no noncombat evacuation',()=>{
 let w=craftWorld();w.cities[0].military!.units={scout:5,baggage:3};const t=captureCraftCity(w);w=t.world;
 expect(w.cities[0].military!.units).toEqual({});
 expect(w.armies.filter(isMissionArmy).some(a=>a.creationKind==='evacuation')).toBe(false);
 const final=t.reports.find(r=>r.battle?.outcome==='conquered')!.battle!;
 expect(final.defenders.find(p=>p.cityId===w.cities[0].id&&p.armyId===null)!.after).toEqual({});
 expect(final.attackers.some(p=>(p.after.militia??0)>0)).toBe(true);
});
it('D1 direct versus sliced capture preserves exact state, reports, IDs and once-only cleanup',()=>{
 let w=craftWorld();w.cities[0].military!.units={scout:2};w=dispatch(w,'conquest',{militia:1000},2,0).world;
 const end=w.armies.filter(isMissionArmy)[0].arrivalAt,direct=advanceFormal(w,end),first=advanceFormal(w,end-1),last=advanceFormal(first.world,end);
 const normalize=(v:FormalWorld)=>{const c=structuredClone(v);c.revision=0;for(const r of c.commandReceipts)r.committedRevision=0;return c;};
 expect(normalize(last.world)).toEqual(normalize(direct.world));expect([...first.reports,...last.reports]).toEqual(direct.reports);
 const s=new EventScheduler(direct.world.events),c=direct.world.cities[0],before=structuredClone(direct.world);
 changeCityOwner(direct.world,c,c.ownerFactionId,'conquest',s);direct.world.events=s.snapshot();
 expect(direct.world.extinction).toEqual(before.extinction);expect(direct.world.sequences).toEqual(before.sequences);
 expect(advanceFormal(direct.world,end+HOUR).world.extinction!.craftsmen).toEqual([]);
});
it('D1 legally departed colonization retains its reservation, event and destination after source loss',()=>{
 let w=prepare(craftWorld());w=advanceFormal(w,w.settlements![0].startedAt+w.settlements![0].prepDurationMs).world;
 const home=w.cities[0];let target:{x:number;y:number}|undefined;
 for(let dy=-5;dy<=5&&!target;dy++)for(let dx=-5;dx<=5&&!target;dx++){const x=home.x+dx,y=home.y+dy,cell=spatial(w).at(x,y);if(buildable(terrainAt(w,x,y))&&!cell.city&&!cell.site)target={x,y};}
 w.cities[0].military!.units={militia:20};w=issue(w,{type:'settlement.dispatch',cityId:home.id,...target!,name:'合法在途',escort:{militia:20}}).world;
 const before=structuredClone(w.settlements![0]),unit=structuredClone(w.colonizationUnits![0]),s=new EventScheduler(w.events);
 changeCityOwner(w,w.cities[0],w.factions[2].id,'conquest',s);w.events=s.snapshot();
 expect(w.settlements![0]).toEqual(before);expect(w.colonizationUnits![0]).toEqual(unit);expect(spatial(w).at(target!.x,target!.y).reservation).toBe(before.projectId);
 w=advanceFormal(w,before.arrivalAt!).world;expect(w.cities.at(-1)).toMatchObject({ownerFactionId:w.playerFactionId,...target!});expect(w.cities.at(-1)!.military!.units).toEqual({militia:20});
});
it.each(['before','same','after'] as const)('D1 craftsman arrival %s conquest follows existing scheduler priority',when=>{
 let w=craftWorld();const craft=w.extinction!.craftsmen[0];
 w=issue(w,{type:'craftsman.move',cityId:w.cities[0].id,craftsmanId:craft.id,destinationCityId:w.cities[1].id}).world;
 const moving=w.extinction!.craftsmen[0],arrival=moving.arrivalAt!;
 // At an equal timestamp, craftsman.arrive (39) runs before army.arrive (40).
 w=advanceFormal(w,arrival+(when==='before'?-1:when==='after'?1:0)).world;
 const scheduler=new EventScheduler(w.events);changeCityOwner(w,w.cities[1],w.factions[2].id,'conquest',scheduler);w.events=scheduler.snapshot();
 expect(w.extinction!.craftsmen).toHaveLength(when==='before'?1:0);
 if(when==='before')expect(w.extinction!.craftsmen[0]).toMatchObject({cityId:null,eventId:moving.eventId});
});
