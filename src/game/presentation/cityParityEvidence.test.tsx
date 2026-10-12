import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {CityScenes} from './CityScenes';
import {TownScene} from '../TownScene';
import {OutskirtsScene} from '../OutskirtsScene';
import {civilizationArt,CIV_ORDER,FIELD_ALIAS} from './artMap';
import type {Node,Building} from '../legacyTypes';
import {buildingIds,emptyTroops} from '../legacyTypes';

it('export same-viewport DEMO/Formal city A/B review harnesses without claiming browser screenshots',()=>{
 const out=process.env.CITY_PARITY_EVIDENCE;if(!out)return;mkdirSync(out,{recursive:true});
 const base=process.env.DEMO_BASELINE_ROOT!;expect(readFileSync(base+'/src/game/game.css','utf8')).toBe(readFileSync('src/game/game.css','utf8'));
 const css=readFileSync('src/game/game.css','utf8')+readFileSync('src/game/themes.css','utf8')+readFileSync('src/game/presentation/playable.css','utf8')+readFileSync('src/game/presentation/parity.css','utf8');
 const index:Record<string,unknown>[]=[],baseWorld=createFormalWorld({campaign:'city-ab',seed:90217});
 for(const mobile of [false,true])for(const district of ['town','outskirts'] as const)for(const civ of CIV_ORDER)for(const age of [0,1,2] as const)for(const wall of [0,5]){
  const w=structuredClone(baseWorld),c=w.cities[0];w.factions[0].civilizationId=civ;w.factions[0].age=age;c.wallLevel=wall;
  c.buildings.residence=3;c.buildings['warehouse.0']=4;c.buildings.barracks=2;c.economy!.slots={residence:0,'warehouse.0':3,barracks:10};for(const f of c.fields!)f.level=3;
  // Legacy Node exists only inside this evidence fixture; active UI never consumes it.
  const n:Node={id:'fixture',name:c.name,kind:'village',owner:civ,x:c.x,y:c.y,stock:{...c.stock},population:200,integration:0,stability:0,buildings:Object.fromEntries(buildingIds.map(k=>[k,0])) as Record<Building,number>,troops:emptyTroops(),build:[],train:[],policy:'balanced',plots:[{id:0,kind:'center',building:'hall'},...Array.from({length:15},(_,i)=>({id:i+1,kind:'urban' as const,building:i===0?'house' as const:i===3?'warehouse' as const:i===10?'barracks' as const:null})),{id:16,kind:'wall',building:'wall'},...c.fields!.map(f=>({id:17+f.slot,kind:'resource' as const,building:FIELD_ALIAS[f.resource],level:f.level}))],governor:{enabled:false,budget:0,reserve:0,spent:{food:0,wood:0,stone:0,gold:0},period:0,blocked:'',autoNew:false}};
  n.buildings.hall=1;n.buildings.house=3;n.buildings.warehouse=4;n.buildings.barracks=2;n.buildings.wall=wall;
  const baseline=district==='town'?<TownScene n={n} civ={civilizationArt(civ)} era={age} speed={1} time={0} mobile={mobile} labels={!mobile} closeView={mobile} onToggleView={()=>{}} onSelect={()=>{}}/>:<OutskirtsScene n={n} civ={civilizationArt(civ)} era={age} speed={1} time={0} mobile={mobile} labels={false} closeView={mobile} onToggleView={()=>{}} onSelect={()=>{}} onEnter={()=>{}}/>;
  const formal=<CityScenes initialDistrict={district} world={w} city={c} mobile={mobile} onBuilding={()=>{}} onField={()=>{}}/>;
  const name=`${district}-${mobile?'mobile':'desktop'}-${civ}-age${age}-wall${wall}.html`,width=mobile?390:1200;
  const body=renderToStaticMarkup(<><h1>{district} · {civ} · visual age {age} · wall {wall} · {mobile?'390px mobile':'1200px desktop'}</h1><p>Structural review harness. Browser A/B screenshots and pixel footprint measurements: BLOCKED / not captured.</p><div className="ab-row"><article><h2>v0.30.2 DEMO</h2><div className={'game-shell '+(mobile?'mobile-layout':'desktop-layout')}>{baseline}</div></article><article><h2>v0.30.12 Formal</h2><div className={'game-shell formal-shell '+(mobile?'mobile-layout':'desktop-layout')}>{formal}</div></article></div></>);
  const html='<!doctype html><html lang="zh-Hant" data-theme="classic"><meta charset="utf-8"><base href="assets/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'\nbody{padding:16px;background:#121914;color:#eee}h1{font-size:18px}.ab-row{display:flex;gap:20px;width:max-content}.ab-row article{width:'+width+'px}.ab-row .game-shell,.ab-row .formal-shell.game-shell{display:block;height:auto;overflow:visible;min-height:0}.ab-row .formal-scenes>.district-toolbar{display:none}.ab-row .outskirts-scene,.ab-row .town-scene{margin:0}</style>'+body+'</html>';
  writeFileSync(out+'/'+name,html.replaceAll('/art/','art/').replaceAll('/icons/','icons/'));
  index.push({file:name,mobile,district,civ,visualAge:age,wall,viewportWidth:width,status:'HARNESS_READY_BROWSER_BLOCKED'});
 }
 writeFileSync(out+'/index.json',JSON.stringify(index,null,2));
 writeFileSync(out+'/index.html','<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><h1>CityScene A/B review harness · Browser screenshots pending</h1>'+index.map(i=>'<p><a href="'+i.file+'">'+i.file+'</a></p>').join('')+'</html>');
 expect(index).toHaveLength(144);
},30000);
