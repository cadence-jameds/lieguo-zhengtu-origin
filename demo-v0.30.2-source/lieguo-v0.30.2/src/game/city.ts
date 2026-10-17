import {REPEATABLE_CIVIC} from '../config/realm';
import { buildingIds, emptyStock, type Building, type Node, type Plot, type Policy } from './types';
export const policyNames: Record<Policy,string> = { balanced:'均衡發展', food:'糧食供應', industry:'資材生產', military:'軍事重鎮', research:'學術中心' };
export const policies = Object.keys(policyNames) as Policy[];
export const resourceBuildings:Building[]=['farm','lumber','quarry','mine'];
export const defaultGovernor = () => ({enabled:false,budget:2400,reserve:180,spent:emptyStock(),period:0,blocked:'尚未委任總督',autoNew:false});
export function makePlots(levels: Node['buildings'],fields:readonly Building[]=['farm','farm','farm','farm','farm','farm','lumber','lumber','lumber','lumber','quarry','quarry','quarry','quarry','mine','mine','mine','mine']): Plot[] {
 const plots:Plot[]=[{id:0,kind:'center',building:'hall',level:levels.hall},...Array.from({length:15},(_,i)=>({id:i+1,kind:'urban' as const,building:null})),{id:16,kind:'wall',building:levels.wall?'wall':null,level:levels.wall},...fields.map((b,i)=>({id:i+17,kind:'resource' as const,building:b,level:levels[b]}))];
 for(const b of buildingIds)if(!['hall','wall',...resourceBuildings].includes(b)&&levels[b]>0){const plot=plots.find(p=>p.kind==='urban'&&!p.building)!;plot.building=b;plot.level=levels[b];}return plots;
}
export function plotAccepts(p:Plot,b:Building){return p.kind==='center'?b==='hall':p.kind==='wall'?b==='wall':p.kind==='resource'?p.building===b&&resourceBuildings.includes(b):!['hall','wall',...resourceBuildings].includes(b);}
export const plotLevel=(n:Node,b:Building,id?:number)=>{const p=id===undefined?n.plots.find(p=>p.building===b):n.plots.find(p=>p.id===id);return p?.building===b?(p.level??n.buildings[b]):0;};
export const resourceLevel=(n:Node,b:Building)=>n.plots.filter(p=>p.building===b).reduce((s,p)=>s+(p.level??n.buildings[b]),0);
export function constructionPlot(n:Node,b:Building,id?:number){if(id!==undefined)return n.plots.find(p=>p.id===id);return n.plots.filter(p=>p.building===b&&!n.build.some(j=>j.plot===p.id)&&plotLevel(n,b,p.id)<5).sort((a,c)=>plotLevel(n,b,a.id)-plotLevel(n,b,c.id))[0]??n.plots.find(p=>!p.building&&plotAccepts(p,b)&&!n.build.some(j=>j.plot===p.id));}
export const plannedBuilding=(n:Node,b:Building)=>n.buildings[b]>0||n.build.some(j=>j.item===b&&j.action!=='demolish');
// No forced resource/house build order. Era and building prerequisites still apply.
export function foundationReason(_n:Node,_b?:Building):string{return '';}

export const repeatableBuilding=(b:Building)=>resourceBuildings.includes(b)||(REPEATABLE_CIVIC as readonly string[]).includes(b);
export const buildingLevels=(n:Node,b:Building)=>n.plots.filter(p=>p.building===b).map(p=>p.level??n.buildings[b]);
export const totalBuildingLevel=(n:Node,b:Building)=>buildingLevels(n,b).reduce((s,l)=>s+l,0);
export function refreshBuildingLevel(n:Node,b:Building){n.buildings[b]=Math.max(0,...buildingLevels(n,b));}
