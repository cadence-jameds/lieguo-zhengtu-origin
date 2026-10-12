import {cultureId} from '../content/civilizations';
import {hash} from './legacyWorld';
import type {Game} from './legacyTypes';
const roots:Record<string,string[]>={civ_zhongguo:['大晟','天衡','雲漢','承熙','昭武','景明'],civ_byzantion:['紫穹','金角','聖輝','東冠','銀鷹','曙光'],civ_frankia:['白鹿','鐵冠','赤獅','聖橡','銀槍','金百合'],civ_britannia:['白薔薇','長弓','獅心','霜狼','白崖','紅龍'],civ_japan:['蒼月','武藏','白鶴','赤備','風林','朝日'],civ_mongol:['蒼狼','金帳','天馬','白隼','黑纛','逐日']};
export function organizationName(g:Game,id:string,kind:'empire'|'league'){const f=g.factions.find(f=>f.id===id);return (kind==='empire'?f?.empireName:f?.leagueName)||suggestOrganization(g,id,kind);}
export function suggestOrganization(g:Game,id:string,kind:'empire'|'league',salt=0){const list=roots[cultureId(id)]??roots.civ_zhongguo,start=hash(g.factions.findIndex(f=>f.id===id),salt+381,g.seed)%list.length,suffix=kind==='empire'?'帝國':'軍團';for(let k=0;k<1000;k++){const name=list[(start+k)%list.length]+(k>=list.length?String(Math.floor(k/list.length)+1):'')+suffix;if(!g.factions.some(f=>(kind==='empire'?f.empireName:f.leagueName)===name))return name;}return list[start]+suffix;}
export function nameReason(g:Game,id:string,kind:'empire'|'league',name:string){if(!name.trim()||name.trim().length>24||/[\u0000-\u001f]/.test(name))return '名稱須為 1～24 字。';return g.factions.some(f=>f.id!==id&&(kind==='empire'?f.empireName:f.leagueName)===name.trim())?'此名稱已被使用。':'';}
// The empire belongs to leagues. Only the league leader stores its empire id;
// ordinary members inherit it through their league.
export function empireFor(g:Game,id:string):string|null{
 const lord=g.factions.find(f=>f.id===id),league=g.factions.find(f=>f.id===lord?.league);
 const emperor=league?.empireId??(league?.empire?league.id:null);
 return emperor&&g.factions.some(f=>f.id===emperor&&!!f.empire)?emperor:null;
}
export function normalizeOrganizations(g:Game){for(const f of g.factions){
 if(f.empire){
  // Existing saves could have an emperor without a league. Give that ruler a
  // founding league, preserving cities and other league memberships.
  if(f.league!==f.id)f.league=f.id;
  f.empireId=f.id;
  if(!f.empireName)f.empireName=suggestOrganization(g,f.id,'empire');
 }
 if(f.league===f.id&&!f.leagueName)f.leagueName=suggestOrganization(g,f.id,'league');
}}
