import {FIELD_COUNT} from '../config/economy';
import type {Building,Game,Node,Point} from './legacyTypes';
import {hash} from './legacyWorld';
export const fieldBuildings=['farm','lumber','quarry','mine'] as const;
export type FieldBuilding=typeof fieldBuildings[number];
export const fieldResources={farm:'food',lumber:'wood',quarry:'stone',mine:'gold'} as const;
export const fieldNames={farm:'農田',lumber:'林地',quarry:'石場',mine:'金礦'};
// Capitals share fixed counts; other land keeps positive random compositions.
export function resourceLayout(seed:number,p:Point,initial=false):FieldBuilding[]{
 const total=initial?FIELD_COUNT-8:FIELD_COUNT,offset=initial?2:0,salt=hash(p.x,p.y,seed^0x51a86);
 const cuts=Array.from({length:total-1},(_,i)=>i+1).sort((a,b)=>hash(a,19,salt)-hash(b,19,salt)).slice(0,3).sort((a,b)=>a-b);
 const marks=[0,...cuts,total],counts=initial?[6,5,4,3]:marks.slice(1).map((x,i)=>x-marks[i]+offset),result=fieldBuildings.flatMap((b,i)=>Array<FieldBuilding>(counts[i]).fill(b));
 for(let i=result.length-1;i>0;i--){const j=hash(i,41,salt)%(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;
}
export function fieldsAt(g:Game,p:Point):FieldBuilding[]{const existing=g.nodes.find(n=>n.x===p.x&&n.y===p.y);return existing?.plots.filter(p=>p.kind==='resource').map(p=>p.building as FieldBuilding)??resourceLayout(g.seed,p);}
export function fieldCounts(fields:readonly Building[]){return Object.fromEntries(fieldBuildings.map(b=>[b,fields.filter(x=>x===b).length])) as Record<FieldBuilding,number>;}
export function cityFieldCounts(n:Node){return fieldCounts(n.plots.filter(p=>p.kind==='resource').map(p=>p.building!));}
