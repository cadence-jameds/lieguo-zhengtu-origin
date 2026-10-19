// Observe exact expressions in a disposable compiled copy; no formula recomputation or balance edit.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [compiledArg,outArg]=process.argv.slice(2),compiled=path.resolve(compiledArg),out=path.resolve(outArg),copy=path.join(out,'compiled');
fs.mkdirSync(out,{recursive:true});fs.cpSync(compiled,copy,{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});fs.symlinkSync(path.join(compiled,'node_modules'),path.join(copy,'node_modules'),'dir');
const file=path.join(copy,'src/game/formal/aiAttackStrategies.js');let code=fs.readFileSync(file,'utf8');
const edits=[
 ['const value = 0.45 * need(site) + .3 * (1 - distance / 24) + .2 * safety + .05 * clamp(site.level / 10);',"const value = __scoreTap('V2B48', site, distance, 0.45 * need(site) + .3 * (1 - distance / 24) + .2 * safety + .05 * clamp(site.level / 10));"],
 ['score: 100 * (.30 * e + .25 * g + .25 * p + .15 * distance + .05 * .5)',"score: __scoreTap('V3Parallel48', site, d, 100 * (.30 * e + .25 * g + .25 * p + .15 * distance + .05 * .5))"],
 ['const score = 100 * (.40 * need + .25 * safety + .20 * distance + .15 * (.45 * a.traits.economy + .55 * a.traits.raiding));',"const score = __scoreTap('WildPriority', site, dist, 100 * (.40 * need + .25 * safety + .20 * distance + .15 * (.45 * a.traits.economy + .55 * a.traits.raiding)));"],
];
for(const [before,after] of edits){assert.equal(code.split(before).length,2);code=code.replace(before,after);}code+='\nfunction __scoreTap(mode,site,distance,score){globalThis.__scoreSamples.push({mode,siteId:site.id,distance,score});return score;}\n';fs.writeFileSync(file,code);
const load=async name=>import(pathToFileURL(path.join(copy,'src/game/formal',name+'.js')).href);
const {createFormalWorld}=await load('generator'),{enableAutonomy}=await load('autonomy'),{executeAttackStrategy}=await load('aiAttackStrategies'),{invalidateSpatial}=await load('spatial');
const metadata=JSON.parse(fs.readFileSync(path.join(compiled,'source-metadata.json'),'utf8')),rows=[];
for(const mode of ['A48','V2B48','V3Parallel48','WildPriority60','WildParallel48'])for(const distance of [1,24,25,48,49,60,61]){
 const w=createFormalWorld({campaign:'p0c9-score-audit',seed:90217});enableAutonomy(w);const a=w.autonomy.agents[0],c=w.cities.find(c=>c.ownerFactionId===a.factionId);
 c.x=100;c.y=100;c.military.units={militia:1000};c.stock={food:0,wood:0,stone:0,gold:0};const site={...w.worldLayer.wildSites[0],x:100+distance,y:100,level:1,phase:'active'};w.worldLayer.wildSites=[site];invalidateSpatial(w);
 globalThis.__scoreSamples=[];let selected=false;
 for(let n=0;n<100;n++){a.decisions=n;selected||=executeAttackStrategy(w,c,a,mode,{hasCity:mode!=='A48',commands:[]}).some(p=>p.type==='army.dispatch'&&p.target.kind==='wild');}
 const scores=globalThis.__scoreSamples.map(r=>r.score);rows.push({mode,distance,eligible:mode==='A48'?distance<=48:scores.length>0,selected,scores:scores.length?{min:Math.min(...scores),max:Math.max(...scores)}:null});
}
const result={head:metadata.sha,sourceTreeHash:metadata.sourceTreeHash,scope:'CONTROLLED expression audit: one level-1 site, 1000 militia, zero stocks, original seeded traits; reduced decision-only world, never submitted or saved. These are observed probe ranges, not natural-world score distributions.',distanceDenominators:{V2B48:24,V3Parallel48:24,WildPriority60:24,WildParallel48:24,city:48},edits:edits.map(([expression])=>expression),rows};
for(const r of rows)assert.equal(r.eligible,r.distance<=(r.mode==='WildPriority60'?60:48));
fs.writeFileSync(path.join(out,'score-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
