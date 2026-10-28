import {createFormalWorld} from '../src/game/formal/generator';
import {BUILDING_CATALOG,HOUSING,storageCapacity} from '../src/game/formal/catalogB3';
import {TECH_CATALOG,BLACKSMITH_CAPS,BLACKSMITH_LINES} from '../src/game/formal/techCatalog';
import {submitFormalOrder} from '../src/game/formal/reducer';
import {validateFormalWorld} from '../src/game/formal/schema';
import {commandId} from '../src/game/formal/ids';
import type {FormalCommand} from '../src/game/formal/model';
import {CIV_NAMES} from '../src/game/presentation/artMap';

/** Synthetic review world; validation and real commands establish construction jobs. */
export function createArtPreviewWorld(civ:string,age:0|1|2|3,state:string){
 let world=createFormalWorld({campaign:'art-preview-'+civ+'-'+age+'-'+state,seed:90217,civilizationId:civ});
 const city=world.cities[0],faction=world.factions[0];faction.age=age;
 faction.techIds=state==='base'?[]:Object.values(TECH_CATALOG).filter(t=>!t.id.startsWith('modern.')&&(!t.civilizationId||t.civilizationId===civ)).filter(t=>{if(t.category!=='blacksmith')return true;const [,line,tier]=t.id.split('.');return Number(tier)<=BLACKSMITH_CAPS[civ][BLACKSMITH_LINES.indexOf(line as typeof BLACKSMITH_LINES[number])];}).map(t=>t.id);
 city.name=CIV_NAMES[civ]+'美術驗收城';city.castleCivilizationId=civ;city.population=30000;city.housing=400+HOUSING[15];city.cityPromotionCompleted=age>=2;city.wallLevel=5;
 const kinds=['residence','warehouse.0','bunker.0','market','townhall','monastery','mill','lumbermill','masonry','mint','barracks','archery','stable','blacksmith','castle'];
 city.economy!.slots={};city.economy!.milestones=[10000,15000,20000,22000,25000,30000];city.buildings={center:15};
 kinds.forEach((key,index)=>{const kind=key.split('.')[0] as keyof typeof BUILDING_CATALOG;city.buildings[key]=Math.min(key==='residence'||key==='warehouse.0'?15:10,BUILDING_CATALOG[kind].maxLevel);city.economy!.slots[key]=index;});
 const stock=Math.min(100000,storageCapacity(city));city.stock={food:stock,wood:stock,stone:stock,gold:stock};city.fields!.forEach((field,index)=>{field.level=[5,6,10,11,15][index%5];});
 if(state==='construction'||state==='queued')city.buildings.center=14;
 if(state==='field-construction')city.fields![0].level=10;
 world=validateFormalWorld(world);let serial=0;
 const submit=(payload:FormalCommand)=>{const result=submitFormalOrder(world,{commandId:commandId('art-preview-'+(++serial)),campaignId:world.campaignId,issuerId:world.playerFactionId,issuedWorldTime:world.time,expectedRevision:world.revision,payload});if(result.ack?.status!=='committed')throw Error('Art fixture command rejected: '+result.ack?.reason);world=result.world;};
 if(state==='queued')for(const key of ['market','blacksmith'])submit({type:'building.upgrade',cityId:city.id,key});
 if(state==='construction'||state==='queued')for(const key of ['center','monastery'])submit({type:'building.upgrade',cityId:city.id,key});
 if(state==='field-construction')submit({type:'field.upgrade',cityId:city.id,slot:0});
 return validateFormalWorld(world);
}
