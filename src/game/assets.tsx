import {assetURL} from './presentation/artMap';
import {useId} from 'react';
import { cultureId,civilizations } from '../content/civilizations';
import {buildings} from './content';
import { buildingIds,type Building } from './legacyTypes';
const rows=[0,282,547,805,1122];
const cols=[[0,282,572,847,1121,1402],[0,282,572,847,1121,1402],[0,288,572,855,1127,1402],[0,296,567,858,1147,1402]];
export const art={terrain:'art/terrain-base.webp',atlas:'art/building-atlas.webp',report:'art/siege-report.webp'};
export function spriteBounds(index:number){const row=Math.floor(index/5),col=index%5;return {x:cols[row][col],y:rows[row],w:cols[row][col+1]-cols[row][col],h:rows[row+1]-rows[row]};}
export const eraAtlas=(era:number)=>era===0?'art/buildings-dark.webp':era===1?'art/buildings-feudal.webp':art.atlas;
// The wall detail is a crop of the exact finished scene shown inside the town.
export const finishedWallSceneArt=(era:number)=>era===0?'art/city-scene-dark-wood.webp':era===1?'art/city-scene-feudal-stone.webp':'art/city-scene-stone.webp';
export const constructionWallSceneArt=(era:number)=>'art/city-scene-'+(era===0?'dark':era===1?'feudal':'castle')+'-construction-v2.webp';
export function eraBounds(index:number,era:number){
 if(era>=2)return spriteBounds(index);
 const col=index%5,row=Math.floor(index/5),boundary=(era===1?[724,728,728,738,750]:[740,738,746,744,750])[col];
 // The feudal Byzantine dome begins above the old 768px row line; the
 // academy and market also shared pixels with the next row's rooftops.
 return {x:col*1536/5,y:row===3?boundary:row*256,w:1536/5,h:row===2?boundary-512:row===3?1024-boundary:256};
}
const feudalConstruction=new Set<Building>(['warehouse','barracks','workshop','academy']);
const castleConstruction=new Set<Building>(['house','warehouse','barracks','range','stable','workshop','academy','market']);
export function constructionArtPath(building:Building,era=0,civ?:string,targetLevel=1){
 if(building==='wall')return constructionWallSceneArt(era);
 const culture=cultureId(civ);
 if(building==='hall'&&civilizations.some(c=>c.id===culture))return 'art/construction-hall-'+culture+(era===0?'-dark':era===1?'-feudal':'')+'.webp';
 if(building==='castle'&&civilizations.some(c=>c.id===culture))return 'art/construction-castle-'+culture+'.webp';
 if(targetLevel>=10&&era>=1&&(building==='farm'||building==='lumber'))return 'art/construction-'+building+(era>=2?'-castle':'-feudal')+'.webp';
 if(era>=2&&castleConstruction.has(building))return 'art/construction-'+building+'-castle.webp';
 if(era===1&&building==='warehouse')return 'art/construction-warehouse-feudal-v2.webp';
 if(era===0&&building==='warehouse')return 'art/construction-warehouse-dark-v2.webp';
 if(era===1&&feudalConstruction.has(building))return 'art/construction-'+building+'-feudal.webp';
 return 'art/construction-'+building+'.webp';
}
// Scale differences come from transparent margins in the source art, not its layout slot.
// In particular the castle-age hall illustrations fill far more of their files.
export function constructionScale(building:Building,era=0,civ?:string){
 if(building==='hall'&&era>=2)return ({civ_zhongguo:.88,civ_byzantion:.84,civ_frankia:.79,civ_britannia:.72,civ_japan:.83,civ_mongol:.62} as Record<string,number>)[cultureId(civ)]??1;
 if(building==='house'&&era<2)return 1.08;
 if(building==='academy'&&era===0)return 1.12;
 if(building==='market'&&era<2)return 1.1;
 if(building==='workshop'&&era<2)return 1.06;
 if(building==='stable'&&era===1)return 1.06;
 return 1;
}
export function ConstructionSprite({building,era=0,civ,targetLevel=1}:{building:Building;era?:number;civ?:string;targetLevel?:number}){if(building==='wall')return <svg className="building-sprite construction-sprite wall-detail-art" viewBox="650 94 236 122" role="img" aria-label={['木牆','石牆','垛牆'][era]+'施工至一半的外觀'}><image href={assetURL(constructionWallSceneArt(era))} width={1536} height={1024}/></svg>;return <img className="building-sprite construction-sprite" src={assetURL(constructionArtPath(building,era,civ,targetLevel))} alt={buildings[building].name+'施工至一半的外觀'} style={{transform:`scale(${constructionScale(building,era,civ)})`,transformOrigin:'center bottom'}} draggable={false}/>;}
export function BuildingSprite({building,civ,era=2}:{building:Building;civ?:string;era?:number}){const clip=useId();if(building==='wall')return <svg className="building-sprite wall-detail-art" viewBox="650 94 236 122" role="img" aria-label={['木牆','石牆','垛牆'][era]+'，與城內場景相同的城門和防線'}><image href={assetURL(finishedWallSceneArt(era))} width={1536} height={1024}/></svg>;if(building==='cellar'||building==='castle')return <img className="building-sprite" src={assetURL('art/'+(building==='cellar'?'cellar':('castle-'+cultureId(civ??'civ_zhongguo')))+'.webp')} alt={building==='cellar'?'地庫':'城堡'}/>;const index=building==='hall'&&civ?14+Math.max(0,civilizations.findIndex(c=>c.id===cultureId(civ))):buildingIds.indexOf(building),b=eraBounds(index,era);return <svg className="building-sprite" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} aria-hidden="true"><defs><clipPath id={clip}><rect x={b.x} y={b.y} width={b.w} height={b.h}/></clipPath></defs><image clipPath={`url(#${clip})`} href={assetURL(eraAtlas(era))} width={era<2?1536:1402} height={era<2?1024:1122}/></svg>;}
