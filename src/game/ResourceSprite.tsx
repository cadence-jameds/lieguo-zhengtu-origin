import {assetURL} from './presentation/artMap';
import {BuildingSprite} from './assets';
import type {FieldBuilding} from './resourceFields';
export function ResourceSprite({building,level,era=2}:{building:FieldBuilding;level:number;era?:number}){
 return level>=10?<BuildingSprite building={building} era={era}/>:<img className="resource-field-art" src={assetURL('art/field-'+building+'.webp')} alt="" draggable={false}/>;
}
