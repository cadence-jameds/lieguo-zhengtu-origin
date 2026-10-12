import {useState} from 'react';
import {BuildingSprite,ConstructionSprite} from '../assets';
import type {Building} from '../legacyTypes';
import {assetURL,BUILDING_ALIAS,NEW_BUILDINGS,type ArtSpec,LABELS,civilizationIndex} from './artMap';
export function Icon({name,label}:{name:string;label?:string}){return <img className="formal-icon" src={assetURL(`art/formal/icon-${name}.svg`)} alt={label??''}/>;}
export function Badge({children}:{children:React.ReactNode}){return <span className="formal-badge">{children}</span>;}
export function FormalBuildingSprite({kind,civ,age,constructing=false,targetLevel}:{kind:string;civ:string;age:0|1|2;constructing?:boolean;targetLevel?:number}){
 if(NEW_BUILDINGS.includes(kind as typeof NEW_BUILDINGS[number]))return <span className="formal-new-building"><img className="building-sprite" src={assetURL(`art/formal/building-${kind}.webp`)} alt={LABELS[kind]}/>{constructing&&<span className="formal-scaffold"><Icon name="construction"/></span>}</span>;
 const alias=BUILDING_ALIAS[kind] as Building;
 if(!alias)return <Icon name="slot"/>;
 return constructing?<ConstructionSprite building={alias} era={age} civ={civ} targetLevel={targetLevel}/>:<BuildingSprite building={alias} era={age} civ={civ}/>;
}
export function Art({spec,label}:{spec:ArtSpec;label:string}){
 const [failed,setFailed]=useState(false);
 return <span className="formal-art" title={label}>{failed?<Icon name="research"/>:spec.sheet?<span className="catalog-image" role="img" aria-label={label} style={{backgroundImage:`url(${assetURL(spec.path)})`,backgroundPosition:`${(spec.index??0)%3*50}% ${Math.floor((spec.index??0)/3)*100}%`}}/>:<img className="formal-art-image" src={assetURL(spec.path)} alt={label} onError={()=>setFailed(true)}/>} {spec.badge&&<Badge>{spec.badge}</Badge>}{spec.civ&&<span className="formal-art-civ" style={{backgroundImage:`url(${assetURL('art/civilization-emblems-023.webp')})`,backgroundPosition:`${civilizationIndex(spec.civ)%3*50}% ${Math.floor(civilizationIndex(spec.civ)/3)*100}%`}} role="img" aria-label={spec.civ}/>}</span>;
}
