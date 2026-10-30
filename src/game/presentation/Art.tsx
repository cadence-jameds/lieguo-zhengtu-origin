import {useState} from 'react';
import {BuildingSprite,ConstructionSprite} from '../assets';
import type {Building} from '../legacyTypes';
import type {FieldBuilding} from '../resourceFields';
import {ResourceSprite} from '../ResourceSprite';
import {assetURL,armyAtlasBounds,BUILDING_ALIAS,NEW_BUILDINGS,type ArtSpec,LABELS,civilizationIndex} from './artMap';
import {buildingImagePath,type VisualAge} from './artRegistry';
export function Icon({name,label}:{name:string;label?:string}){return <img className="formal-icon" src={assetURL(`art/formal/icon-${name}.svg`)} alt={label??''}/>;}
export function Badge({children}:{children:React.ReactNode}){return <span className="formal-badge">{children}</span>;}
export function FormalBuildingSprite({kind,civ,age,constructing=false,targetLevel}:{kind:string;civ:string;age:VisualAge;constructing?:boolean;targetLevel?:number}){
 const path=buildingImagePath(kind,civ,age,constructing);
 if(path)return <span className="formal-new-building"><img className={'building-sprite'+(constructing?' construction-sprite':'')} src={assetURL(path)} alt={LABELS[kind]+(constructing?'施工中':'')}/></span>;
 if(NEW_BUILDINGS.includes(kind as typeof NEW_BUILDINGS[number]))return <span className="formal-new-building"><img className="building-sprite" src={assetURL(`art/formal/building-${kind}.webp`)} alt={LABELS[kind]}/>{constructing&&<span className="formal-scaffold"><Icon name="construction"/></span>}</span>;
 const alias=BUILDING_ALIAS[kind] as Building;
 if(!alias)return <Icon name="slot"/>;
 return constructing?<ConstructionSprite building={alias} era={age} civ={civ} targetLevel={targetLevel}/>:<BuildingSprite building={alias} era={age} civ={civ}/>;
}
/** v95 resource art follows the field's own level, independently of faction era. */
export function FormalResourceSprite({building,level,age,constructing=false,targetLevel=level}:{building:FieldBuilding;level:number;age:VisualAge;constructing?:boolean;targetLevel?:number}){
 const stageLevel=constructing?targetLevel:level;
 const advanced=stageLevel>=11?buildingImagePath(building,undefined,3,constructing):undefined;
 if(advanced)return <img className={'building-sprite'+(constructing?' construction-sprite':'')} src={assetURL(advanced)} alt={LABELS[{farm:'food',lumber:'wood',quarry:'stone',mine:'gold'}[building]]+(constructing?'施工中':'高階產業')}/>;
 if(constructing){
  if(stageLevel>=6&&age>=1&&(building==='farm'||building==='lumber'))return <img className="building-sprite construction-sprite" src={assetURL(`art/construction-${building}-${age>=2?'castle':'feudal'}.webp`)} alt="資源田施工中"/>;
  return <ConstructionSprite building={building} era={Math.min(age,2)} targetLevel={targetLevel}/>;
 }
 return level>=6?<BuildingSprite building={building} era={Math.min(age,2)}/>:<ResourceSprite building={building} level={level} era={Math.min(age,2)}/>;
}
export function Art({spec,label}:{spec:ArtSpec;label:string}){
 const [failed,setFailed]=useState(false);
 const crop=spec.sheet==='units'||spec.sheet==='guards'?armyAtlasBounds(spec.sheet,spec.index??0):undefined;
 return <span className="formal-art" title={label}>{failed?<Icon name="research"/>:crop?<svg className="catalog-image" viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} role="img" aria-label={label} style={{overflow:'hidden',background:'#141513'}}><image href={assetURL(spec.path)} width={1536} height={1024}/></svg>:spec.sheet?<span className="catalog-image" role="img" aria-label={label} style={{backgroundImage:`url(${assetURL(spec.path)})`,backgroundPosition:`${(spec.index??0)%3*50}% ${Math.floor((spec.index??0)/3)*100}%`}}/>:<img className="formal-art-image" width={512} height={512} loading="lazy" decoding="async" src={assetURL(spec.path)} alt={label} onError={()=>setFailed(true)}/>} {spec.badge&&<Badge>{spec.badge}</Badge>}{spec.civ&&<span className="formal-art-civ" style={{backgroundImage:`url(${assetURL('art/civilization-emblems-023.webp')})`,backgroundPosition:`${civilizationIndex(spec.civ)%3*50}% ${Math.floor(civilizationIndex(spec.civ)/3)*100}%`}} role="img" aria-label={spec.civ}/>}</span>;
}
