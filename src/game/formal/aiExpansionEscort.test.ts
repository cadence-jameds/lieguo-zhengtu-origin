import {it,expect} from 'vitest';
import {make,rich,build,order} from './developmentTestSupport';
import {enableAutonomy} from './autonomy';
import {expansionDecision} from './aiActions';
import {submitFormalOrder,advanceFormal} from './reducer';
import {aiRandom} from './autonomyModel';
import {EventScheduler} from './scheduler';
import {effectiveUnit} from './combatModifiers';

function prepare(counts:Record<string,number>){
 let w=make();const ai=w.factions[1];ai.age=2;
 const c=rich(w,w.cities[1]);build(c,'castle',1);c.military!.units={...counts};w.clockMode='foreground';
 const result=submitFormalOrder(w,order(w,{type:'settlement.prepare',cityId:c.id},'prepare-escorted',ai.id));
 expect(result.ack?.status,result.ack?.reason).toBe('committed');w=result.world;
 const p=w.settlements![0],ready=w.events.find(e=>e.id===p.prepEventId)!;
 w=advanceFormal(w,ready.at).world;expect(w.settlements![0].phase).toBe('ready');
 enableAutonomy(w);const a=w.autonomy!.agents.find(t=>t.factionId===ai.id)!;
 a.active=true;
 for(let n=1;n<=1000;n++)if(aiRandom(w.seed,a.factionId,n+400)<=.08+a.traits.expansion*.3){a.decisions=n;break;}
 expect(a.decisions).toBeGreaterThan(0);return {w,a,city:w.cities.find(t=>t.id===c.id)!};
}
function combat(w:Readonly<Record<string,number>>){return Object.entries(w).reduce((n,[id,v])=>n+(effectiveUnit(id)?v:0),0);}
it('uses the same half-garrison cap across odd combat lines; formally settles with 20 guards and leaves 20',()=>{
 const {w,a,city}=prepare({militia:19,spearman:21,scout:3,ram:2}),before=w.cities.length;
 const cmd=expansionDecision(w,city,a);
 expect(cmd?.type).toBe('settlement.dispatch');if(cmd?.type!=='settlement.dispatch')throw Error('拓殖未出發');
 expect(combat(cmd.escort)).toBe(20);expect(Object.keys(cmd.escort).every(effectiveUnit)).toBe(true);
 const dispatched=submitFormalOrder(w,order(w,cmd,'odd-lines',a.factionId));
 expect(dispatched.ack?.status,dispatched.ack?.reason).toBe('committed');
 const travelling=dispatched.world.settlements![0];expect(travelling.phase).toBe('travelling');
 // Suppress unrelated AI decisions in this focused arrival check without altering legal settlement evidence.
 const march=dispatched.world;march.autonomy=undefined;march.events=new EventScheduler(march.events.filter(e=>e.type!=='ai.decide')).snapshot();
 const final=advanceFormal(march,travelling.arrivalAt!).world;
 expect(final.cities).toHaveLength(before+1);
 expect(combat(final.cities.find(c=>c.id===city.id)!.military!.units)).toBe(20);
 expect(combat(final.cities.at(-1)!.military!.units)).toBe(20);
 expect(final.cities.at(-1)!.ownerFactionId).toBe(a.factionId);
 expect(final.settlements).toHaveLength(0);expect(final.colonizationUnits).toHaveLength(0);
});
it('never fills the other half with scouts, siege or insufficient combat troops',()=>{
 const {w,a,city}=prepare({militia:19,spearman:20,scout:100,ram:300});
 expect(expansionDecision(w,city,a)).toBeUndefined();
});
