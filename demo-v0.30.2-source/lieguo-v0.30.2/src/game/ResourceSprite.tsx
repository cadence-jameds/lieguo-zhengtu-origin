import {BuildingSprite} from './assets';
import type {FieldBuilding} from './resourceFields';
export function ResourceSprite({building,level,era=2}:{building:FieldBuilding;level:number;era?:number}){
 return level>=4?<BuildingSprite building={building} era={era}/>:<img className="resource-field-art" src={import.meta.env.BASE_URL+'art/field-'+building+'.webp'} alt="" draggable={false}/>;
}
