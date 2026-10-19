import {expect,it} from 'vitest';
import {createFormalWorld} from './generator';
import {enableAutonomy} from './autonomy';
import {militaryDecision} from './aiActions';
import {publicSituation,HOUR} from './aiKnowledge';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import {advanceFormal} from './reducer';
import {EventScheduler} from './scheduler';
import {clearWild} from './wildLifecycle';
import {validateFormalWorld} from './schema';

it('P0-C-9 permits ordinary wild targets 25–48 tiles away while enemy cities exist',()=>{
 const w=advanceFormal(isolatedAutonomyFixture(createFormalWorld({campaign:'p0c9-negative',seed:90217})),2*HOUR).world;enableAutonomy(w);
 const a=w.autonomy!.agents.find(a=>publicSituation(w,a,w.cities.find(c=>c.ownerFactionId===a.factionId)!).length>0)!;
 const c=w.cities.find(c=>c.ownerFactionId===a.factionId)!;a.active=true;c.military!.units={militia:600};
 const scheduler=new EventScheduler(w.events);
 for(const site of w.worldLayer!.wildSites)if(Math.hypot(site.x-c.x,site.y-c.y)<=24)clearWild(w,site,scheduler);
 w.events=scheduler.snapshot();validateFormalWorld(w);
 const commands=Array.from({length:200},(_,i)=>{a.decisions=i+1;return militaryDecision(w,c,a);}).flat();
 expect(commands.some(p=>{if(p.type!=='army.dispatch'||p.target.kind!=='wild')return false;const id=p.target.siteId,site=w.worldLayer!.wildSites.find(s=>s.id===id)!;return Math.hypot(site.x-c.x,site.y-c.y)<=48;})).toBe(true);
});
