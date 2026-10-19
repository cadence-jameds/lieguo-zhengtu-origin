import {expect,it} from 'vitest';
import {createFormalWorld} from './generator';
import {enableAutonomy} from './autonomy';
import {militaryDecision} from './aiActions';
import {publicSituation,HOUR} from './aiKnowledge';

it('P0-C-9 permits ordinary wild targets 25–48 tiles away while enemy cities exist',()=>{
 const w=createFormalWorld({campaign:'p0c9-negative',seed:90217});enableAutonomy(w);w.time=2*HOUR;
 const a=w.autonomy!.agents.find(a=>publicSituation(w,a,w.cities.find(c=>c.ownerFactionId===a.factionId)!).length>0)!;
 const c=w.cities.find(c=>c.ownerFactionId===a.factionId)!;a.active=true;c.military!.units={militia:600};
 a.traits={...a.traits,military:.8,economy:1,raiding:1,risk:.5};
 w.worldLayer!.wildSites=w.worldLayer!.wildSites.filter(s=>Math.hypot(s.x-c.x,s.y-c.y)>24);
 const commands=Array.from({length:200},(_,i)=>{a.decisions=i+1;return militaryDecision(w,c,a);}).flat();
 expect(commands.some(p=>p.type==='army.dispatch'&&p.target.kind==='wild')).toBe(true);
});
