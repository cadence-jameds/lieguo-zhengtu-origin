import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import FormalDevelopmentPanel from '../FormalDevelopmentPanel';
import {build,make,rich,commit} from '../formal/developmentTestSupport';
import {CityQueues} from './CityQueues';
import {CityScenes} from './CityScenes';
import {ArmyView} from './DevelopmentViews';

const no=()=>{};
it('city and army show settlement occupying a training slot and the full-queue button gives the reason',()=>{
 let w=make();const c=rich(w);w.factions[0].age=2;build(c,'castle',1);build(c,'workshop',1);
 for(let i=0;i<4;i++)w=commit(w,{type:'military.recruit',cityId:c.id,unitId:'baggage',count:1});
 w=commit(w,{type:'settlement.prepare',cityId:c.id});
 const city=w.cities[0],common={world:w,city,issue:no,busy:false};
 expect(renderToStaticMarkup(<CityQueues {...common}/>)).toMatch(/部隊訓練 5\/5.*拓殖隊 × 1 · 城堡整備中/);
 expect(renderToStaticMarkup(<ArmyView {...common} mobile/>)).toMatch(/訓練佇列 · 5\/5.*拓殖隊 × 1 · 城堡整備中/);
 expect(renderToStaticMarkup(<CityScenes world={w} city={city} onBuilding={no} onField={no} mobile/>)).toContain('訓練 5/5');
 w=commit(w,{type:'settlement.cancel',cityId:c.id});
 w=commit(w,{type:'military.recruit',cityId:c.id,unitId:'baggage',count:1});
 expect(renderToStaticMarkup(<FormalDevelopmentPanel {...common} world={w} city={w.cities[0]}/>)).toMatch(/<button disabled="">部隊訓練佇列已滿<\/button>/);
});
