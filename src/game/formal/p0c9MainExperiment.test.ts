import {describe,it,expect,vi} from 'vitest';
import type {FormalCity,FormalWorld,FormalCommand,Resources} from './model';
import type {Agent} from './autonomyModel';

const experiment=vi.hoisted(()=>({
  mode:'baseline' as 'baseline'|'candidate',
  cutoff:50,
  attempted:{wild:0,city:0,scout:0,joint:0},
  decisions:0
}));
vi.mock('./aiActions',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('./aiActions')>();
  return {...actual,militaryDecision:(w:FormalWorld,c:FormalCity,a:Agent)=>{
    const base=actual.militaryDecision(w,c,a);
    const next=experiment.mode==='baseline'?base:candidate(w,c,a,base,actual.portion);
    experiment.decisions++;
    for(const cmd of next){
      if(cmd.type==='joint.create')experiment.attempted.joint++;
      if(cmd.type==='army.dispatch'){
        if(cmd.mission==='scout')experiment.attempted.scout++;
        else if(cmd.target.kind==='wild')experiment.attempted.wild++;
        else experiment.attempted.city++;
      }
    }
    return next;
  }};
});
import {createFormalWorld} from './generator';
import {enableAutonomy} from './autonomy';
import {advanceFormal} from './reducer';
import {publicSituation,HOUR,incomingAlerts} from './aiKnowledge';
import {spatial} from './spatial';
import {resourceKeys} from './model';
import {aiRandom} from './autonomyModel';
import {effectiveUnit,marchSeconds} from './combatModifiers';
import {storageCapacity} from './catalogB3';
import {UNIT_CATALOG} from './unitCatalog';

const clamp=(x:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const pools=[800,1500,2800,5000,8500,14000,23000,38000,60000,95000];
const budgets=[60,120,210,350,570,900,1350,2000,2900,4200];
function candidate(w:FormalWorld,c:FormalCity,a:Agent,base:FormalCommand[],portion:(c:FormalCity,r:number)=>Record<string,number>):FormalCommand[]{
  const own=c.military?.units??{},total=Object.entries(own).reduce((s,[id,n])=>s+(effectiveUnit(id)?n:0),0);
  const threat=incomingAlerts(w,a.factionId).some(t=>t.ownerFactionId===a.factionId);
  if(!a.active||threat||w.time-a.lastWarAt<HOUR||w.armies.filter(t=>t.ownerFactionId===a.factionId&&t.originCityId===c.id).length>=3)return base;
  if(aiRandom(w.seed,a.factionId,a.decisions+311)>.15+a.traits.military*.55)return base;
  if(base.some(p=>p.type!=='army.dispatch'))return base;
  const weights=[30*(.75+.5*a.traits.economy),25*(.7+.4*a.traits.military+.2*a.traits.expansion),
    25*(1.25-.5*a.traits.risk),15*(1.15-.3*a.traits.activity),5*(.8+.4*a.traits.revenge)];
  const totalWeight=weights.reduce((x,y)=>x+y,0);
  const grade=(scores:number[],type:'wild'|'city')=>clamp(scores.reduce((sum,score,i)=>sum+score*weights[i]/totalWeight,0)+12*((type==='wild'?a.traits.raiding:a.traits.expansion)-.5),0,100);
  const faction=w.factions.find(f=>f.id===a.factionId)!;
  const travel=(p:{x:number,y:number},units:Record<string,number>)=>100/(1+(2*Math.hypot(c.x-p.x,c.y-p.y)*marchSeconds(units,faction)/60)/60);
  const capacity=storageCapacity(c);
  const resourceScore=(loot:Resources)=>{
    let sum=0;for(const r of resourceKeys){const need=.25+.75*clamp(1-c.stock[r]/Math.max(1,.7*capacity));sum+=need*loot[r]/Math.max(1000,.3*capacity);}
    return 100*(1-Math.exp(-sum));
  };
  const options:{score:number,command:FormalCommand}[]=[];
  if(total>=50){
    const units=portion(c,.3),force=Object.values(units).reduce((sum,v)=>sum+v,0);
    const carrying=Object.entries(units).reduce((sum,[id,n])=>sum+(UNIT_CATALOG[id]?.carry??0)*n,0);
    const sites=spatial(w).nearby(c.x,c.y,24).sites
      .filter(p=>p.level<=Math.max(1,Math.floor(total/100)))
      .sort((x,y)=>Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y)||String(x.id).localeCompare(String(y.id))).slice(0,8);
    for(const site of sites){
      const loss=clamp(.025+.36*(budgets[site.level-1]/11*(site.resource==='bandit'?1.2:1))/Math.max(1,force*.85),0,.7);
      const value=Math.min(pools[site.level-1]*(site.resource==='bandit'?1.5:1),carrying*(1-loss));
      const loot:Resources={food:0,wood:0,stone:0,gold:0};
      if(site.resource==='bandit'){for(const r of resourceKeys)loot[r]=value*.25;}
      else loot[site.resource]=value;
      options.push({score:grade([resourceScore(loot),20,100*clamp(1-loss/.3),travel(site,units),50],'wild'),
        command:{type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:site.id,generation:site.generation},units}});
    }
  }
  const cities=publicSituation(w,a,c).filter(t=>t.relation!=='friendly')
    .sort((x,y)=>(x.relation==='war'?0:1)-(y.relation==='war'?0:1)||Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y)).slice(0,8);
  for(const t of cities){
    const units=portion(c,.2+a.traits.risk*.2),force=Object.values(units).reduce((sum,v)=>sum+v,0);
    if(force<10||c.stock.food<200)continue;
    const info=t.intel,enemy=Object.entries(info?.units??{}).reduce((sum,[id,v])=>sum+(effectiveUnit(id)?v:0),0);
    if(info?.confidence&&force<enemy*(1.5-.5*a.traits.risk)/info.confidence)continue;
    if(faction.modernQualification!=='full'&&t.modern&&info?.confidence&&force<enemy*.75)continue;
    const strategy=clamp(40+(t.relation==='war'?30:0)+20*(t.memory?.threat??0),0,100);
    const relation=clamp(50+(t.relation==='war'?30:0)+20*(t.memory?.hatred??0),0,100);
    if(!info?.confidence){
      if(!(own.scout>0))continue;
      const sUnits={scout:Math.max(1,Math.min(15,Math.floor(own.scout*.8)))};
      options.push({score:grade([40,strategy,55,travel(t,units),relation],'city'),
        command:{type:'army.dispatch',cityId:c.id,mission:'scout',target:{kind:'city',cityId:t.id},units:sUnits}});
    }else{
      const predictedLoss=clamp(.04+enemy/Math.max(1,force)*.15,0,.7);
      const modern=faction.modernQualification==='full';
      const conquest=aiRandom(w.seed,a.factionId,a.decisions+313)<(.03+.12*a.traits.expansion)*(modern&&!t.modern?1.75:1);
      if(conquest)for(const id of ['ram','catapult'])if((own[id]??0)>0)units[id]=Math.max(1,Math.floor(own[id]*.4));
      options.push({score:grade([40,strategy,100*clamp(1-predictedLoss/.3),travel(t,units),relation],'city'),
        command:{type:'army.dispatch',cityId:c.id,mission:conquest?'conquest':'raid',target:{kind:'city',cityId:t.id},units}});
    }
  }
  options.sort((x,y)=>y.score-x.score||JSON.stringify(x.command).localeCompare(JSON.stringify(y.command),'en'));
  const selected=options[0];
  return selected&&selected.score>=experiment.cutoff?[selected.command]:[];
}
describe('P0-C-9 main HEAD isolated seed experiment',()=>{
  it('runs baseline and V1 candidates in the actual Formal world reducer',()=>{
    const results=[];
    const hours=Number(process.env.P0C9_HOURS||6);
    const natural=process.env.P0C9_NATURAL==='1';
    const seeds=natural?[90217]:(hours>=24?[90217]:[90217,104729]);
    const variants:[('baseline'|'candidate'),number][]=natural?[['baseline',0],['candidate',35],['candidate',40],['candidate',45],['candidate',50]]:[['baseline',0],['candidate',45],['candidate',50],['candidate',55]];
    for(const seed of seeds){
      for(const [mode,cutoff] of variants){
        experiment.mode=mode;experiment.cutoff=cutoff;experiment.attempted={wild:0,city:0,scout:0,joint:0};experiment.decisions=0;
        let w=createFormalWorld({campaign:'p0c9-experiment',seed,speed:1});
        if(!natural)for(let i=0;i<w.cities.length;i++){
          const c=w.cities[i];if(c.ownerFactionId===w.playerFactionId)continue;
          c.military!.units={militia:i%4===0?5:100,scout:10};
          c.stock={food:600,wood:100,stone:100,gold:100};
        }
        enableAutonomy(w);
        if(!natural)for(const agent of w.autonomy!.agents){
          const origin=w.cities.find(c=>c.ownerFactionId===agent.factionId)!;
          agent.intel=w.cities.filter(c=>c.ownerFactionId!==agent.factionId&&Math.hypot(c.x-origin.x,c.y-origin.y)<=48)
            .map(c=>({cityId:c.id,ownerFactionId:c.ownerFactionId,at:0,source:'scout' as const,units:{...c.military!.units},coarse:'personnel' as const}));
        }
        let completedHours=0;const began=Date.now();
        for(let h=1;h<=hours;h++){
          w=advanceFormal(w,h*3600000).world;completedHours=h;
          if(natural&&h%24===0)console.log('P0C9_NATURAL_CHECKPOINT',JSON.stringify({seed,mode,hours:h,elapsedMs:Date.now()-began,cities:w.cities.length,wildResolved:w.combat?.statistics.wild,raids:w.combat?.statistics.raids,conquests:w.combat?.statistics.conquests}));
          if(natural&&Date.now()-began>420000)break;
        }
        const receipts=w.combat?.receipts??[];
        results.push({seed,mode,cutoff,worldHours:completedHours,targetHours:hours,natural,completed:completedHours===hours,ai:w.autonomy?.agents.length,decisions:experiment.decisions,
          attempted:{...experiment.attempted},accepted:w.autonomy?.accepted,rejected:w.autonomy?.rejected,
          outcomes:Object.fromEntries([...new Set(receipts.map(r=>r.outcome))].map(outcome=>[outcome,receipts.filter(r=>r.outcome===outcome).length])),
          wildWins:receipts.filter(r=>r.outcome==='wild-cleared').length,
          cityConquests:receipts.filter(r=>r.outcome==='conquered').length,
          battleStatistics:w.combat?.statistics,
          cityCount:w.cities.length});
      }
    }
    console.log('P0C9_MAIN_ENGINE_RESULTS_BEGIN');
    console.log(JSON.stringify({method:'main HEAD GitHub CI Vitest, 99 AI, same seeds, TEST-ONLY militia/scout and legal preloaded city intel, actual world/reducer/combat, no Zod substitution',results}));
    console.log('P0C9_MAIN_ENGINE_RESULTS_END');
    expect(results).toHaveLength(seeds.length*variants.length);
    expect(results.every(r=>r.ai===99)).toBe(true);
  },900000);
});
