/** Synthetic test/browser fixture only; production gameplay never imports this. */
import {createFormalWorld} from './generator';
import {changeCityOwner} from './economy';
import {researchQuote} from './buildingDetailData';
import {TECH_CATALOG} from './techCatalog';
import {resourceKeys,zeroResources,type Resources} from './model';

export function modernFundingFixture(campaign='modern-funding-abc',techId='modern.infantry-weapons'){
 const d=TECH_CATALOG[techId],world=createFormalWorld({campaign,seed:90217,speed:1,offlineHours:4,civilizationId:d.civilizationId??'civ_zhongguo'});
 const faction=world.factions[0];faction.age=3;faction.modernQualification='full';faction.researchCooperation=true;faction.techIds=['research.cooperation'];
 const cities=world.cities.slice(0,3),names=['科研甲城','科研乙城','科研丙城'];
 for(const [i,c] of cities.entries()){
  if(i)changeCityOwner(world,c,world.playerFactionId,'receive');c.integrationWorkHours=0;c.name=names[i];
 }
 const put=(key:string,level:number)=>{const c=cities[0];c.buildings[key]=level;if(key!=='center'&&c.economy!.slots[key]===undefined)c.economy!.slots[key]=Object.keys(c.economy!.slots).length;};
 for(const [key,level] of Object.entries(d.buildings))put(key==='warehouse'?'warehouse.0':key,level);
 const cost=researchQuote(world,cities[0],d).cost,parts:Resources[]=[zeroResources(),zeroResources(),zeroResources()];
 for(const r of resourceKeys){parts[0][r]=Math.floor(cost[r]/2);parts[1][r]=Math.floor(cost[r]/4);parts[2][r]=cost[r]-parts[0][r]-parts[1][r];}
 for(const [i,c] of cities.entries()){
  for(let n=0;n<Math.ceil(Math.max(...Object.values(parts[i]))/100000);n++){const key='warehouse.'+n;c.buildings[key]=15;if(c.economy!.slots[key]===undefined)c.economy!.slots[key]=Object.keys(c.economy!.slots).length;}
  c.stock={...parts[i]};
 }
 return {world,cityIds:cities.map(c=>c.id),parts,cost,techId};
}
