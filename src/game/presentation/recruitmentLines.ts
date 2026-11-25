import type {WorldRead} from '../presentationModel';
import type {FormalCity} from '../formal/model';
import {castleSource} from '../formal/buildingDetailData';
import {UNIT_CATALOG,UNIT_LINES,unitLine,type UnitDefinition} from '../formal/unitCatalog';
import {recruitmentUnit,recruitmentUnlockReasons} from './cityActions';

type LineId=(typeof UNIT_LINES)[number];
const lines=UNIT_LINES.map(id=>unitLine(id,'civ_zhongguo'));
const unitLines=new Map(lines.flatMap(l=>[...l.ordinary,...l.elite,...l.modern].map(id=>[id,l.id] as const)));
export const countLine=(city:FormalCity,id:LineId)=>{
 const line=lines.find(l=>l.id===id)!;
 const count=(ids:string[])=>ids.reduce((n,k)=>n+(city.military?.units[k]??0),0);
 const ordinary=count(line.ordinary),elite=count(line.elite),modern=count(line.modern);
 return {ordinary,elite:line.elite.length?elite:null,modern,total:ordinary+elite+modern};
};
export function recruitUnitTiers(city:FormalCity,unitId:string){
 const line=lines.find(l=>l.id===unitLines.get(unitId));
 if(!line)return [];
 return ([['一般',line.ordinary],['精銳',line.elite],['現代',line.modern]] as const).flatMap(([tier,ids])=>
  ids.flatMap(id=>UNIT_CATALOG[id]?[{tier,definition:UNIT_CATALOG[id],count:city.military?.units[id]??0}]:[]));
}
export type RecruitmentLine={id:LineId;commandId:string;definition:UnitDefinition;unlocks:string[];counts:ReturnType<typeof countLine>};
/** Requests still use normal line ID for automatic elite substitution, and exact modern ID for modern production. */
export function recruitmentLines(w:WorldRead,c:FormalCity,previewModern=false):RecruitmentLine[]{
 const f=w.factions.find(f=>f.id===c.ownerFactionId)!,guard=castleSource(w,c);
 return UNIT_LINES.map(id=>{
  const base=id==='guard'?'guard.'+guard:id,modern=UNIT_CATALOG['modern.'+base];
  const modernUnlocks=modern?recruitmentUnlockReasons(f,c,modern):[];
  const isModern=!!modern&&(previewModern||!modernUnlocks.length),commandId=isModern?modern.id:base;
  const definition=isModern?modern:recruitmentUnit(f,c,base);
  return {id,commandId,definition,unlocks:isModern?modernUnlocks:recruitmentUnlockReasons(f,c,definition),counts:countLine(c,id)};
 });
}
