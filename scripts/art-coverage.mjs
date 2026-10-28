import {createServer} from 'vite';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Read real catalogs and rendering adapters, never duplicate gameplay catalog data.
const output=resolve(process.argv[2]??'work/art-audit');mkdirSync(output,{recursive:true});
const server=await createServer({configFile:false,cacheDir:resolve('work/vite-art-audit'),appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const load=path=>server.ssrLoadModule('/src/game/'+path);
 const [{UNIT_CATALOG,ELITE_VARIANTS},{TECH_CATALOG},{BUILDING_CATALOG},a,r,assets]=await Promise.all([
  load('formal/unitCatalog.ts'),load('formal/techCatalog.ts'),load('formal/catalogB3.ts'),
  load('presentation/artMap.ts'),load('presentation/artRegistry.ts'),load('assets.tsx')]);
 const hash=path=>existsSync('public/'+path)?createHash('sha256').update(readFileSync('public/'+path)).digest('hex'):null;
 const inspect=spec=>({...spec,...(spec.sheet==='units'||spec.sheet==='guards'?{displayCrop:a.armyAtlasBounds(spec.sheet,spec.index??0)}:{}),exists:existsSync('public/'+spec.path),sha256:hash(spec.path)});
 const units=Object.values(UNIT_CATALOG).map(u=>({id:u.id,name:u.name,civilization:u.civilizationId,era:u.era??'traditional',...inspect(a.unitArt(u.id))}));
 const technologies=Object.values(TECH_CATALOG).map(t=>({id:t.id,name:t.name,scope:t.scope,...inspect(a.techArt(t.id))}));
 const buildings=[];
 for(const [civ,alias] of Object.entries(a.CIV_ART))for(const age of [0,1,2,3])for(const id of Object.keys(BUILDING_CATALOG)){
  const complete=r.buildingImagePath(id,alias,age),construction=r.buildingImagePath(id,alias,age,true);
  const legacy=a.BUILDING_ALIAS[id];
  const finishedPath=complete??(a.NEW_BUILDINGS.includes(id)?`art/formal/building-${id}.webp`:id==='wall'?assets.finishedWallSceneArt(age):id==='bunker'?'art/cellar.webp':id==='castle'?`art/castle-${alias}.webp`:assets.eraAtlas(age));
  const constructionPath=construction??(legacy?assets.constructionArtPath(legacy,age,alias,1):null);
  buildings.push({id,civ,age,finishedPath,constructionPath,detailPath:finishedPath,
   finishedExists:existsSync('public/'+finishedPath),constructionExists:!!constructionPath&&existsSync('public/'+constructionPath),
   sharedAcrossCivilizations:!['center','castle'].includes(id),sharedAcrossAges:age<3&&a.NEW_BUILDINGS.includes(id),
   status:existsSync('public/'+finishedPath)&&constructionPath&&existsSync('public/'+constructionPath)?'PATH_PASS':'FAIL'});
 }
 const cities=Object.keys(a.CIV_ART).flatMap(civ=>[0,1,2,3].map(age=>({civ,age,path:age===3?'art/unified/cities-imperial.webp':`art/cities-age-${age}.webp`,cell:a.civilizationIndex(civ),wall:age===3?'art/unified/wall-ring-imperial.webp':`art/wall-ring-${age}.webp`,visualAge:a.visualAge(age)})));
 const {FormalResourceSprite}=await load('presentation/Art.tsx');
 const fieldImage=(alias,level,age,constructing)=>{
  const html=renderToStaticMarkup(createElement(FormalResourceSprite,{building:alias,level,age,constructing,targetLevel:Math.max(1,level)}));
  return [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1].replace(/^\//,'')).find(p=>p.startsWith('art/'));
 };
 const fields=Object.entries(a.FIELD_ALIAS).flatMap(([id,alias])=>[0,1,2,3].flatMap(age=>[0,5,6,10,11,15].map(level=>({id,age,level,finished:fieldImage(alias,level,age,false),construction:fieldImage(alias,level,age,true)}))));
 const techLines=Object.keys(TECH_CATALOG).filter(id=>/\.1$/.test(id)).map(id=>{const prefix=id.slice(0,-1),ids=[1,2,3].map(n=>prefix+n).filter(x=>TECH_CATALOG[x]);const specs=ids.map(a.techArt);return {ids,paths:specs.map(s=>s.path),distinctImages:new Set(specs.map(s=>s.path+':'+(s.index??''))).size===ids.length};});
 const eliteLines=Object.entries(ELITE_VARIANTS).map(([base,elite])=>({base,elite,baseArt:a.unitArt(base),eliteArt:a.unitArt(elite),distinct:a.unitArt(base).path!==a.unitArt(elite).path||a.unitArt(base).index!==a.unitArt(elite).index}));
 const failures=[...units.filter(u=>!u.exists).map(u=>'unit:'+u.id),...technologies.filter(t=>!t.exists||t.path.endsWith('.svg')).map(t=>'technology:'+t.id),...buildings.filter(b=>b.status==='FAIL').map(b=>'building:'+b.id+':'+b.age+':'+b.civ),...cities.filter(c=>!existsSync('public/'+c.path)||!existsSync('public/'+c.wall)).map(c=>'city:'+c.civ+':'+c.age),...fields.filter(f=>!f.finished||!f.construction||!existsSync('public/'+f.finished)||!existsSync('public/'+f.construction)).map(f=>'field:'+f.id+':'+f.age+':'+f.level),...techLines.filter(l=>!l.distinctImages).map(l=>'tech tiers:'+l.ids.join(',')),...eliteLines.filter(l=>!l.distinct).map(l=>'unit tiers:'+l.base)];
 const report={base:'844a904e7527b79fd2cd7e2837e78b412aadf1c0',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),counts:{units:units.length,technologies:technologies.length,buildingTypes:Object.keys(BUILDING_CATALOG).length,buildingCivilizationAgeCombinations:buildings.length,cities:cities.length,fieldAgeCombinations:fields.length},units,technologies,buildings,cities,fields,techLines,eliteLines,failures,status:failures.length?'FAIL':'PATH_PASS',visualGate:'Separate human review and browser evidence required; PATH_PASS is not ART-GATE PASS.'};
 writeFileSync(output+'/coverage.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({counts:report.counts,status:report.status,failures:failures.slice(0,30),failureCount:failures.length}));
 if(failures.length)process.exitCode=1;
}finally{await server.close();}
process.exit(process.exitCode??0);
