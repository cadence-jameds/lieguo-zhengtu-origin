import {expect} from 'vitest';
import {battlefield,dispatch,issue} from './combatTestSupport';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import {order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {setClockMode} from './campaignTime';
import {effectiveSpeed} from './playtest';
import {isMissionArmy} from './combatModel';
import {marchSeconds} from './combatModifiers';
import {buildable,terrainAt} from './terrain';
import {spatial,invalidateSpatial} from './spatial';
import {EventScheduler} from './scheduler';
import {eventId,sequenceKey} from './ids';
import {rebirthCandidates} from './extinction';
import {validateFormalWorld} from './schema';
import type {FormalWorld} from './model';
export const CLOCK_DELTA_CASES=[{name:'normal-1',speed:1},{name:'normal-25',speed:25},{name:'developer-50',speed:1,developer:50},{name:'developer-100',speed:25,developer:100}] as const;
export type ClockDeltaCase={name:string;speed:1|25;developer?:50|100};
/** Native terrain/entities and real accepted orders: no forged battle receipts or combat deadlines. */
export function clockBoundaryWorld(config:ClockDeltaCase){
 let w=battlefield(),point:{x:number;y:number}|undefined;
 for(let y=0;y<384&&!point;y++)for(let x=0;x<375&&!point;x++)if(Array.from({length:9},(_,i)=>x+i).every(xx=>buildable(terrainAt(w,xx,y))&&!spatial(w).at(xx,y).city&&!spatial(w).at(xx,y).site))point={x,y};
 if(!point)throw Error('No native nine-cell clearing');
 for(let i=0;i<9;i++){w.cities[i].x=point.x+i;w.cities[i].y=point.y;w.cities[i].military!.units={};}
 invalidateSpatial(w);w.speed=config.speed;w.offlineHours=12;
 if(config.developer)w=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:config.developer,shield:false}).world;
 w=isolatedAutonomyFixture(w);setClockMode(w,'offline');
 for(const i of [2,3,4,5]){w.cities[i].military!.units={militia:100};w.cities[i].wallLevel=15;}
 w.cities[1].military!.units={militia:1000};w.cities[6].military!.units={militia:10};w.cities[7].military!.units={militia:100};
 w=dispatch(w,'conquest',{militia:100},2,3).world;w=advanceFormal(w,w.armies.find(a=>a.status==='outbound')!.arrivalAt!).world;
 const sameBattleId=w.combat!.battles[0].id;
 w=dispatch(w,'conquest',{militia:100},4,5).world;w=advanceFormal(w,w.armies.find(a=>a.status==='outbound')!.arrivalAt!).world;
 const futureBattleId=w.combat!.battles.find(b=>b.id!==sameBattleId)!.id,freezeAt=w.combat!.battles.find(b=>b.id===sameBattleId)!.nextRoundAt;
 const march=Math.ceil(marchSeconds({militia:1000},w.factions[1])*1000);expect(freezeAt-march).toBeGreaterThanOrEqual(w.time);w=advanceFormal(w,freezeAt-march).world;
 w=dispatch(w,'conquest',{militia:1000},1,0).world;const terminalArmy=w.armies.filter(isMissionArmy).find(a=>a.status==='outbound')!;expect(terminalArmy.arrivalAt).toBe(freezeAt);
 w=dispatch(w,'raid',{militia:10},6,7).world;const pendingMarch=w.armies.filter(isMissionArmy).find(a=>a.status==='outbound'&&a.id!==terminalArmy.id)!;expect(pendingMarch.arrivalAt).toBe(freezeAt);
 const aiEvents=w.autonomy!.agents.filter(a=>[w.factions[9].id,w.factions[10].id].includes(a.factionId)).map(a=>{a.nextAt=freezeAt;w.events.find(e=>e.id===a.eventId)!.at=freezeAt;return a.eventId!;});
 const markers=[freezeAt,freezeAt+1].map((at,i)=>({id:eventId(sequenceKey(w.sequences.event++)),at,type:'fixture.marker' as const,marker:'clock-delta-'+i}));w.events.push(...markers);w.events=new EventScheduler(w.events).snapshot();
 // The saved input is a foreground world; actual offline entry must restore these natural offline deadlines.
 setClockMode(w,'foreground');validateFormalWorld(w);
 expect(w.factions).toHaveLength(100);expect(w.worldLayer!.wildSites).toHaveLength(432);expect(w.cities.filter(c=>c.ownerFactionId===w.playerFactionId)).toHaveLength(1);
 return{world:w,freezeAt,target:freezeAt+3600000,terminalArmyId:terminalArmy.id,pendingMarchId:pendingMarch.id,sameBattleId,futureBattleId,aiEvents,markers};
}
export function frozenReference(w:FormalWorld,target:number){const copy=structuredClone(w);setClockMode(copy,'offline');return advanceFormal(copy,target);}
export function eventRows(w:FormalWorld){return w.events.map(({id,at,type})=>({id,at,type}));}
export function clockRows(w:FormalWorld){return{time:w.time,clockMode:w.clockMode,speed:effectiveSpeed(w),paused:!!w.extinction?.defeat,events:eventRows(w),battles:w.combat!.battles.map(b=>({id:b.id,round:b.round,nextRoundAt:b.nextRoundAt,roundEventId:b.roundEventId})),finals:w.combat!.receipts.filter(r=>r.kind==='final')};}
export function rebirthOrder(w:FormalWorld,key='clock-delta-rebirth'){return order(w,{type:'player.rebirth',cityId:w.cities[0].id,...rebirthCandidates(w)[0],name:'離線復國'},key);}
export function confirmedRebirth(w:FormalWorld,key='clock-delta-rebirth'){const o=rebirthOrder(w,key),t=submitFormalOrder(w,o);expect(t.ack?.status,t.ack?.reason).toBe('committed');return t;}
