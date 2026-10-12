import {useState} from 'react';
import type {FormalCity,FormalWorld} from '../formal/model';
import {unitLine} from '../formal/unitCatalog';
import {UnitIcon} from './UnitIcon';

import {Dialog,fmt} from './UI';
const GARRISON_LINE_ORDER=['scout','militia','spearman','archer','skirmisher','light-cavalry','knight','guard','ram','catapult','baggage'] as const;
export function garrisonLines(world:FormalWorld,city:FormalCity){
 const f=world.factions.find(f=>f.id===city.ownerFactionId)!;
 return GARRISON_LINE_ORDER.map(id=>{const line=unitLine(id,f.civilizationId),count=(ids:string[])=>ids.length?ids.reduce((n,id)=>n+(city.military?.units[id]??0),0):null,ordinary=count(line.ordinary),elite=count(line.elite),modern=count(line.modern);return{...line,ordinaryCount:ordinary,eliteCount:elite,modernCount:modern,total:(ordinary??0)+(elite??0)+(modern??0)};});
}
export function Garrison({world,city}:{world:FormalWorld;city:FormalCity}){
 const compact=new Intl.NumberFormat('zh-TW',{notation:'compact',maximumFractionDigits:1});
 const [selected,setSelected]=useState<string|null>(null),lines=garrisonLines(world,city),line=lines.find(l=>l.id===selected);
 return <><div className="garrison-lines" aria-label="本城己方駐軍・11兵種線">{lines.map(l=><button className="garrison-cell" key={l.id} aria-label={l.name+'駐軍 '+l.total} title={l.name+' '+fmt(l.total)} onClick={()=>setSelected(l.id)}><UnitIcon line={l.id} label={l.name}/><strong>{l.total>=10000?compact.format(l.total):fmt(l.total)}</strong></button>)}</div>{line&&<Dialog title={line.name+' · 本城己方駐軍'} onClose={()=>setSelected(null)}><table className="hud-table"><tbody>{[['普通',line.ordinaryCount],['精銳',line.eliteCount],['現代',line.modernCount],['合計',line.total]].map(([label,count])=><tr key={label}><th>{label}</th><td>{count===null?'—':fmt(count as number)}</td></tr>)}</tbody></table><p>{city.name}內的己方實際駐軍。</p></Dialog>}</>;
}
