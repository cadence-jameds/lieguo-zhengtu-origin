import { describe, expect, it } from 'vitest';
import { battlefield, dispatch } from './combatTestSupport';
import { build } from './developmentTestSupport';
import { isMissionArmy } from './combatModel';
import { armyId } from './ids';
import { initialPolitics } from './politics';
import { playerIncoming, projectPlayerIncoming } from '../incomingIntelligence';
import { fixtureProjection } from './projectionTestSupport';
import { WorldStream } from '../worldStream';
import { PresentationStore } from '../presentationStore';
import { incomingHintText, ownedIncoming } from '../presentation/IncomingArmyAlert';

const techs=['intel.watch','intel.patrol','intel.analysis','intel.network'];
function scenario(units:Record<string,number>={archer:30,knight:12,catapult:2}, target=0) {
 let w=battlefield();
 w.cities[1].military!.units={...units};
 w=dispatch(w,'raid',units,1,target).world;
 return {w,a:w.armies.find(isMissionArmy)!};
}
describe('traditional intelligence: committed and scoped low-resolution alerts',()=>{
 it.each([
  ['intel.watch', {size:'small'}],
  ['intel.patrol', {tendency:'cavalry'}],
  ['intel.analysis', {possibleSiege:true}],
  ['intel.network', {}],
 ])('only emits the independent lawful hint for %s',(tech,extra)=>{
  const {w,a}=scenario();
  const minimal={armyId:a.id,cityId:w.cities[0].id,ownerFactionId:w.playerFactionId,arrivalAt:a.arrivalAt};
  expect(projectPlayerIncoming(w)).toEqual([minimal]);
  w.factions[0].techIds=[tech];
  expect(projectPlayerIncoming(w)).toEqual([{...minimal,...extra}]);
 });
 it.each([[99,'small'],[100,'medium'],[499,'medium'],[500,'large'],[1999,'large'],[2000,'very-large']] as const)('bins population %i without exposing it', (count,size)=>{
  const {w}=scenario({militia:count,scout:900,baggage:600});
  w.factions[0].techIds=[...techs];
  expect(projectPlayerIncoming(w)[0]).toMatchObject({size,tendency:'infantry'});
  expect(incomingHintText(projectPlayerIncoming(w)[0])).not.toMatch(/\d/);
 });
 it('does not claim a primary class on an exact mix tie',()=>{
  const {w}=scenario({archer:10,militia:10,scout:99,baggage:55});
  w.factions[0].techIds=[...techs];
  expect(projectPlayerIncoming(w)[0]).not.toHaveProperty('tendency');
 });
 it('only hints joint ops for corroborated committed outbound members, not matching militia or waiting members',()=>{
  const {w,a}=scenario();
  w.factions[0].techIds=[...techs];
  const b={...structuredClone(a),id:armyId('joining-member'),ownerFactionId:w.factions[2].id};
  w.armies.push(b);
  expect(projectPlayerIncoming(w).every(row=>!row.possibleJoint)).toBe(true);
  w.politics??=initialPolitics();
  w.politics.joints.push({id:'joint:test',initiator:a.ownerFactionId,targetCityId:w.cities[0].id,arrivalAt:a.arrivalAt,armyIds:[a.id,b.id],scope:'joint:test'});
  a.jointId=b.jointId='joint:test';
  b.status='waiting';
  expect(projectPlayerIncoming(w)).toHaveLength(1);
  expect(projectPlayerIncoming(w)[0].possibleJoint).toBeUndefined();
  b.status='outbound';
  expect(projectPlayerIncoming(w).every(row=>row.possibleJoint)).toBe(true);
  b.ownerFactionId=a.ownerFactionId;
  expect(projectPlayerIncoming(w).every(row=>!row.possibleJoint)).toBe(true);
 });
 it('shares only already-unlocked hints with a recipient who is likewise eligible, and retains own-only modern composition',()=>{
  const {w}=scenario(undefined,2);
  w.factions[0].techIds=[...techs,'modern.data-link'];
  const ally=w.factions[2];
  w.politics??=initialPolitics();
  w.politics.legions.push({id:'legion:test',name:'shared alerts',description:'',leader:w.playerFactionId,members:[w.playerFactionId,ally.id],empireId:null});
  build(w.cities[0],'embassy',11);
  expect(projectPlayerIncoming(w)).toEqual([]);
  build(w.cities[0],'embassy',12);
  expect(projectPlayerIncoming(w)).toHaveLength(1);
  expect(projectPlayerIncoming(w)[0]).not.toHaveProperty('size');
  ally.techIds=['intel.watch','intel.analysis'];
  expect(projectPlayerIncoming(w)[0]).toMatchObject({size:'small',possibleSiege:true});
  expect(projectPlayerIncoming(w)[0]).not.toHaveProperty('tendency');
  expect(projectPlayerIncoming(w)[0]).not.toHaveProperty('composition');
  expect(ownedIncoming(w)).toEqual([]);
  w.factions[0].techIds=[];
  expect(projectPlayerIncoming(w)[0]).not.toHaveProperty('size');
 });
 it('streams a strict observer alert section and preserves typed IDs across snapshots and patches',()=>{
  const {w,a}=scenario();
  const stream=new WorldStream('intel-wire',{build:fixtureProjection,reset:()=>{}});
  const store=new PresentationStore();
  const base=stream.publish(w,{branch:0,writerEpoch:1});
  expect(base.kind).toBe('snapshot');
  if(base.kind!=='snapshot'||!base.world) throw new Error('expected snapshot');
  expect(store.receive(base).accepted).toBe(true);
  expect(playerIncoming(store.getWorld()!)[0].armyId).toBe(a.id);
  w.factions[0].techIds=[...techs];
  w.revision++;
  expect(store.receive(stream.publish(w,{branch:0,writerEpoch:1})).accepted).toBe(true);
  expect(playerIncoming(store.getWorld()!)[0]).toMatchObject({armyId:a.id,size:'small'});
  const corrupted=structuredClone(base);
  Object.assign(corrupted.world!.derived.incomingAlerts![0],{units:{archer:30}});
  expect(new PresentationStore().receive(corrupted).accepted).toBe(false);
 });
 it('has no source faction, counts, route or exact identities in traditional fields and views do not infer from raw projection armies',()=>{
  const {w,a}=scenario();
  w.factions[0].techIds=[...techs];
  const id={protocolVersion:2 as const,campaignId:w.campaignId,branch:0,writerEpoch:1,sessionId:'traditional-intel',projectionSequence:1,revision:w.revision};
  const display=fixtureProjection(w,id);
  expect(display.derived.incomingAlerts).toEqual(projectPlayerIncoming(w));
  expect(Object.keys(playerIncoming(display)[0]).sort()).toEqual(['armyId','arrivalAt','cityId','ownerFactionId','possibleSiege','size','tendency'].sort());
  expect(incomingHintText(playerIncoming(display)[0])).toBe('小型、偏向騎兵、疑似攜帶攻城器');
  display.armies=[];
  expect(ownedIncoming(display)[0].details).toHaveLength(1);
  delete display.derived.incomingAlerts;
  expect(playerIncoming(display)).toEqual([]);
  a.mission='scout';
  expect(projectPlayerIncoming(w)).toEqual([]);
 });
});
