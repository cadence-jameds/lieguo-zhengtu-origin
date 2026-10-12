import {civilizations,cultureId} from '../content/civilizations';
export function emblemIndex(civ:string){return Math.max(0,civilizations.findIndex(c=>c.id===cultureId(civ)));}
export function CivilizationEmblem({civ}:{civ:string}){const i=emblemIndex(civ);return <span role="img" aria-label={civilizations[i].name+'文明徽記'} className="civilization-emblem" style={{backgroundImage:`url(${import.meta.env.BASE_URL}art/civilization-emblems-023.webp)`,backgroundPosition:`${i%3*50}% ${Math.floor(i/3)*100}%`}}/>;}
