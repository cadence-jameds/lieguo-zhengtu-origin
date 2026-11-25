import {useId,useState} from 'react';
import type {FormalCity} from '../formal/model';
import type {WorldRead} from '../presentationModel';
import {Garrison} from './Garrison';

export const MOBILE_GARRISON_KEY='lieguo:mobile-garrison-collapsed';

function readCollapsed(){
 try{return localStorage.getItem(MOBILE_GARRISON_KEY)==='1';}
 catch{return false;}
}

export function MobileGarrison({world,city}:{world:WorldRead;city:FormalCity}){
 const panelId=useId();
 const [collapsed,setCollapsed]=useState(readCollapsed);
 function toggle(){
  const next=!collapsed;
  setCollapsed(next);
  try{localStorage.setItem(MOBILE_GARRISON_KEY,next?'1':'0');}
  catch{/* The control still works in this session. */}
 }
 return <div className="mobile-garrison">
  <div id={panelId} hidden={collapsed}>{!collapsed&&<Garrison world={world} city={city}/>}</div>
  <button className="mobile-garrison-toggle" type="button" aria-expanded={!collapsed} aria-controls={panelId} onClick={toggle}>
   <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d={collapsed?'m3 6 5 5 5-5':'m3 10 5-5 5 5'}/></svg>
   {collapsed?'展開兵種':'收合兵種'}
  </button>
 </div>;
}
