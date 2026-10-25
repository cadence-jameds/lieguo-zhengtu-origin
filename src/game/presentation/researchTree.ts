import type {FormalCity,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {researchRequirements,researchQuote} from '../formal/buildingDetailData';
import {TECH_CATALOG,type TechDefinition} from '../formal/techCatalog';

export type ResearchScope='traditional'|'modern';
export const RESEARCH_GROUPS=[
 ['blacksmith','鐵匠科技'],['economy','經濟科技'],['military','軍事與情報'],
 ['logistics','物流與內政'],['engineering','攻城工程'],['elite','精銳科技'],['civilization','文明專屬'],
] as const;
export function researchGroup(d:TechDefinition):string{
 if(d.category!=='general')return d.category;
 const prefix=d.id.split('.')[0];
 return ({intel:'military',administration:'logistics',siege:'engineering'} as Record<string,string>)[prefix]??prefix;
}
export function visibleResearch(civilizationId:string){return Object.values(TECH_CATALOG).filter(d=>!d.civilizationId||d.civilizationId===civilizationId);}
/** Stable topological order; names never imply a dependency. */
export function researchOrder(techs:readonly TechDefinition[]):TechDefinition[]{
 const ids=new Set(techs.map(d=>d.id)),seen=new Set<string>(),visiting=new Set<string>(),out:TechDefinition[]=[];
 const visit=(d:TechDefinition)=>{
  if(seen.has(d.id))return;
  if(visiting.has(d.id))throw Error('科技前置循環：'+d.id);
  visiting.add(d.id);for(const id of d.prerequisites)if(ids.has(id))visit(TECH_CATALOG[id]);
  visiting.delete(d.id);seen.add(d.id);out.push(d);
 };
 techs.forEach(visit);return out;
}
export function researchFacts(world:FormalWorld,city:FormalCity,techs:readonly TechDefinition[]){
 return Object.fromEntries(techs.map(d=>[d.id,{requirements:researchRequirements(world,city,d),quote:researchQuote(world,city,d)}]));
}
export type ResearchFact=ReturnType<typeof researchFacts>[string];
export function researchState(world:FormalWorld,city:FormalCity,d:TechDefinition,fact:ResearchFact){
 const f=world.factions.find(f=>f.id===city.ownerFactionId)!;
 const project=world.researchProjects.find(p=>p.projectId===f.researchQueue&&p.techId===d.id);
 const done=f.techIds.includes(d.id),funding=d.scope==='modern-common'||d.scope==='modern-civilization';
 const affordable=resourceKeys.every(r=>city.stock[r]>=fact.quote.cost[r]);
 const qualified=!done&&!f.researchQueue&&fact.requirements.every(r=>r.met);
 const available=qualified&&affordable,canStart=qualified&&(funding||affordable);
 return {done,project,available,canStart,affordable,state:done?'done':project?'active':available?'available':'locked'} as const;
}
export const TREE_NODE_WIDTH=196,TREE_NODE_HEIGHT=94,TREE_COLUMN=266;
/** Geometry depends only on the catalog and civilization, never on a display tick. */
export function researchLayout(techs:readonly TechDefinition[],scope:ResearchScope){
 const selected=researchOrder(techs.filter(d=>scope==='traditional'?d.scope==='traditional':d.scope!=='traditional'));
 const groups=scope==='traditional'?RESEARCH_GROUPS.map(([id,label])=>({id,label,techs:selected.filter(d=>researchGroup(d)===id)})):[{id:'modern',label:'科研協同體系 → 現代共通科技／文明專屬科技',techs:selected}];
 const nodes:{tech:TechDefinition;x:number;y:number}[]=[],labels:{label:string;y:number}[]=[];
 let y=54;
 for(const group of groups){
  if(!group.techs.length)continue;
  labels.push({label:group.label,y});y+=34;
  const counts=[0,0,0];
  for(const tech of group.techs){const col=scope==='traditional'?tech.age-1:tech.scope==='research-cooperation'?0:tech.scope==='modern-common'?1:2;nodes.push({tech,x:col*TREE_COLUMN+16,y:y+counts[col]++*(TREE_NODE_HEIGHT+14)});}
  y+=Math.max(...counts)*(TREE_NODE_HEIGHT+14)+24;
 }
 const byId=new Map(nodes.map(n=>[n.tech.id,n]));
 const edges=nodes.flatMap(to=>to.tech.prerequisites.flatMap(id=>{const from=byId.get(id);return from?[{from,to}]:[];}));
 return {nodes,labels,edges,width:TREE_COLUMN*3-36,height:y};
}
