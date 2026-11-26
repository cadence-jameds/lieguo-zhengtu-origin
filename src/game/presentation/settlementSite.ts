import type {WorldRead} from '../presentationModel';
import {spatial} from '../formal/spatial';
import {buildable,terrainAt} from '../formal/terrain';
import type {Point} from './mapGeometry';

/** Read-only preview. The formal dispatch still revalidates the site and route. */
export function settlementSiteReason(world:WorldRead,point:Point):string|undefined{
 if(!Number.isInteger(point.x)||!Number.isInteger(point.y)||point.x<0||point.y<0||point.x>=world.dimensions.width||point.y>=world.dimensions.height)return '超出世界地圖範圍';
 const cell=spatial(world).at(point.x,point.y);
 if(cell.city||cell.site)return '此地格已有城市或據點';
 if(cell.reservation)return '此地格已被其他拓殖隊預約';
 if(!buildable(terrainAt(world,point.x,point.y)))return '此地形不可建城';
}
