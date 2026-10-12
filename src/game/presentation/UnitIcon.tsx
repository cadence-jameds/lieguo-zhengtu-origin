import {UNIT_LINES} from '../formal/unitCatalog';
import {assetURL} from './artMap';
/** Generated military classifications are deliberately restricted to the HUD garrison row. */
export function UnitIcon({line,label}:{line:string;label:string}){
 const id=line.startsWith('guard')?'guard':line,index=Math.max(0,UNIT_LINES.indexOf(id as typeof UNIT_LINES[number]));
 return <span className="hud-unit-icon" role="img" aria-label={label} style={{backgroundImage:`url(${assetURL('art/formal/hud-unit-icons-v03015.png')})`,backgroundPosition:`${index%4*100/3}% ${Math.floor(index/4)*50}%`}}/>;
}
