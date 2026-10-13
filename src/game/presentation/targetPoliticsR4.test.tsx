import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FormalTargetPanel} from './FormalTargetPanel';
import {battlefield,issue} from '../formal/combatTestSupport';
import {build} from '../formal/developmentTestSupport';
import type {FormalWorld,FormalCommand} from '../formal/model';
const noop=()=>{};
function political(w:FormalWorld,i:number,action:Extract<FormalCommand,{type:'politics'}>['action'],extra:object={}){
 return issue(w,{type:'politics',cityId:w.cities[i].id,action,...extra},w.factions[i].id).world;
}
function render(w:FormalWorld,i:number){return renderToStaticMarkup(<FormalTargetPanel world={w} home={w.cities[0]} city={w.cities[i]} onMission={noop} onCity={noop}/>);}
function founded(){let w=battlefield();for(const i of [0,1]){w.factions[i].age=2;build(w.cities[i],'embassy',i===0?11:1);w=political(w,i,'legion-create',{name:i===0?'甲軍團':'乙軍團'});}w=political(w,0,'empire-propose',{target:w.factions[1].id,name:'R4帝國'});return political(w,1,'request-accept',{requestId:w.politics!.requests.at(-1)!.id});}
it('map city ownership shows actual B6 legion/empire and friendly reinforcement without leaking hidden units/stock',()=>{
 const w=founded();w.cities[1].stock.gold=13337;w.cities[1].military!.units={militia:777,scout:111};const before=JSON.stringify(w),html=render(w,1);
 expect(html).toContain('乙軍團');expect(html).toContain('R4帝國');expect(html).toContain('<dd>友好</dd>');expect(html).toContain('派遣援軍');
 expect(html).toContain('尚未偵察');expect(html).not.toContain('尚未開放');expect(html).not.toContain('777');expect(html).not.toContain('13337');expect(JSON.stringify(w)).toBe(before);
 expect(render(w,0)).toContain('<dd>己方</dd>');
});
it('empire dissolution and war/peace immediately update public map relation instead of showing all enemies neutral',()=>{
 let w=founded();w=political(w,0,'empire-dissolve');w=political(w,0,'war',{target:w.factions[1].id});let html=render(w,1);
 expect(html).toContain('乙軍團');expect(html).toContain('<dd>無</dd>');expect(html).toContain('<dd>戰爭</dd>');expect(html).toContain('掠奪物資');expect(html).not.toContain('派遣援軍');
 w=political(w,0,'peace',{target:w.factions[1].id});html=render(w,1);expect(html).toContain('<dd>中立</dd>');expect(html).not.toContain('R4帝國');
});
