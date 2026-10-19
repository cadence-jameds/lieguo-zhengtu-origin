import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [compiledArg,outArg]=process.argv.slice(2),compiled=path.resolve(compiledArg),out=path.resolve(outArg);
fs.mkdirSync(out,{recursive:true});const load=async n=>import(pathToFileURL(path.join(compiled,'src/game/formal',n+'.js')).href);
const {createFormalWorld}=await load('generator'),{enableAutonomy,retireAutonomy}=await load('autonomy'),{advanceFormal,submitFormalOrder}=await load('reducer'),{militaryDecision}=await load('aiActions'),{originalCityAttack}=await load('aiAttackStrategies'),{publicSituation,HOUR}=await load('aiKnowledge'),{spatial,invalidateSpatial}=await load('spatial'),{EventScheduler}=await load('scheduler'),{populateWild}=await load('wildLifecycle'),{buildable,terrainAt}=await load('terrain'),{changeCityOwner}=await load('economy'),{validateFormalWorld}=await load('schema');
const metadata=JSON.parse(fs.readFileSync(path.join(compiled,'source-metadata.json'),'utf8')),cases=[];
function setup(){let w=createFormalWorld({campaign:'p0c9-controlled-scenarios',seed:90217});enableAutonomy(w);w=advanceFormal(w,2*HOUR).world;const a=w.autonomy.agents.find(a=>a.lastWarAt<=w.time-HOUR&&publicSituation(w,a,w.cities.find(c=>c.ownerFactionId===a.factionId)).length),c=w.cities.find(c=>c.ownerFactionId===a.factionId);a.active=true;c.military.units={militia:600};return{w,a,c};}
const attempts=({w,a,c})=>Array.from({length:200},(_,i)=>{a.decisions=i+1;return militaryDecision(w,c,a);}).flat();
{
 const ctx=setup();assert.ok(originalCityAttack(ctx.w,ctx.c,ctx.a).hasCity);const answers=attempts(ctx);assert.ok(answers.some(p=>p.type==='army.dispatch'&&p.target.kind==='wild'));cases.push({case:'nearby enemy city and ordinary wild candidates coexist',status:'PASS'});
}
{
 const ctx=setup(),{w,a,c}=ctx;const point=Array.from({length:2304},(_,n)=>({x:(n%48)*8,y:Math.floor(n/48)*8})).find(p=>buildable(terrainAt(w,p.x,p.y))&&!spatial(w).at(p.x,p.y).site&&w.cities.filter(t=>t!==c).every(t=>Math.hypot(t.x-p.x,t.y-p.y)>48));assert.ok(point,'Need an isolated legal controlled city location');c.x=point.x;c.y=point.y;invalidateSpatial(w);validateFormalWorld(w);assert.equal(originalCityAttack(w,c,a).hasCity,false);assert.ok(attempts(ctx).some(p=>p.type==='army.dispatch'&&p.target.kind==='wild'));cases.push({case:'no nearby enemy city',controlledLocation:point,status:'PASS'});
}
{
 const ctx=setup(),{w,a,c}=ctx;c.stock.food=0;a.intel=publicSituation(w,a,c).map(t=>({cityId:t.id,ownerFactionId:t.ownerFactionId,at:w.time,source:'scout',units:{},coarse:'personnel'}));assert.deepEqual(originalCityAttack(w,c,a).commands,[]);const answers=attempts(ctx);assert.ok(answers.some(p=>p.type==='army.dispatch'&&p.target.kind==='wild'));assert.ok(!answers.some(p=>p.type==='army.dispatch'&&p.target.kind==='city'));cases.push({case:'food shortage keeps original city gate; approved wild resource opportunity remains possible',status:'PASS'});
}
{
 const ctx=setup(),{w,c}=ctx;for(const site of w.worldLayer.wildSites){if(Math.hypot(site.x-c.x,site.y-c.y)<=60){site.level=10;populateWild(w,site);}}invalidateSpatial(w);validateFormalWorld(w);assert.ok(!attempts(ctx).some(p=>p.type==='army.dispatch'&&p.target.kind==='wild'));cases.push({case:'site levels exceed legal public force heuristic',status:'PASS'});
}
{
 const ctx=setup(),{w,a,c}=ctx,source=w.cities.find(t=>t.ownerFactionId!==a.factionId);source.military.units={militia:100};for(const f of w.factions)f.protectionUntil=0;
 const t=submitFormalOrder(w,{campaignId:w.campaignId,issuerId:source.ownerFactionId,commandId:'command:p0c9-controlled-threat',issuedWorldTime:w.time,expectedRevision:w.revision,payload:{type:'army.dispatch',cityId:source.id,mission:'raid',target:{kind:'city',cityId:c.id},units:{militia:50}}});assert.equal(t.ack.status,'committed');ctx.w=t.world;assert.deepEqual(attempts(ctx),[]);cases.push({case:'own city threatened; all offensive strategy choices deferred',status:'PASS'});
}
{
 const ctx=setup(),{w,a,c}=ctx,second=w.cities.find(t=>t.ownerFactionId!==a.factionId),scheduler=new EventScheduler(w.events);changeCityOwner(w,second,a.factionId,'receive',scheduler);retireAutonomy(w,scheduler);w.events=scheduler.snapshot();second.military.units={militia:300};validateFormalWorld(w);
 for(const city of [c,second]){const commands=attempts({...ctx,c:city});assert.ok(commands.every(p=>p.cityId===city.id));}assert.equal(c.military.units.militia,600);assert.equal(second.military.units.militia,300);cases.push({case:'multiple owned cities retain distinct source ledgers',status:'PASS'});
}
const result={head:metadata.sha,sourceTreeHash:metadata.sourceTreeHash,scope:'CONTROLLED integration states, never natural-world balance evidence; explicit troop/stock/intel/ownership/location/threat prerequisites. Original seeded traits and real militaryDecision/Reducer/Schema retained; no Vitest mocks.',cases};fs.writeFileSync(path.join(out,'scenarios.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
