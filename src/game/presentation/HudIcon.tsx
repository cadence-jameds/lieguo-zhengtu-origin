import type {View} from './Shell';

const icons=import.meta.glob<string>('./hud-icons/*.svg',{eager:true,query:'?url',import:'default'});
type HudIconName=View|'food'|'wood'|'stone'|'gold'|'more';

/** Icon-only art. Keep the corresponding button label and badge separate. */
export function HudIcon({name}:{name:HudIconName}){
 return <img className="hud-pictogram" src={icons[`./hud-icons/${name}.svg`]} alt="" aria-hidden="true" draggable={false}/>;
}
