import type {ComponentProps} from 'react';
import FormalDevelopmentPanel from '../FormalDevelopmentPanel';
import {Art} from './Art';
import settlerPortrait from './media/unit-settler-team.webp';
import './specialUnitPortrait.css';

function SettlerPortrait({detail=false}:{detail?:boolean}){
 const size=detail?128:72;
 return <img className={detail?'settler-detail-portrait':'settler-card-portrait'} src={settlerPortrait}
  width={size} height={size} loading={detail?'eager':'lazy'} decoding="async" alt="拓殖隊與移民篷車"/>;
}
export function ArmyUnitArt({spec,label}:ComponentProps<typeof Art>){
 // In the army catalog, only the established settlement-card icon gets a portrait.
 return spec.path==='art/formal/icon-settlement.svg'?<SettlerPortrait/>:<Art spec={spec} label={label}/>;
}
export function SettlerDetail(props:ComponentProps<typeof FormalDevelopmentPanel>){
 return <>{(props.mode??'settlement')==='settlement'&&<SettlerPortrait detail/>}<FormalDevelopmentPanel {...props}/></>;
}
