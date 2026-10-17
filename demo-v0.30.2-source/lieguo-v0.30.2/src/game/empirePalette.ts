import type {Game} from './types';

// The territory overlay and every empire name share the same stable hue.
export function empireHue(g:Game,id:string){return (g.factions.findIndex(f=>f.id===id)*137.508+20)%360;}
export function empireTerritoryColor(g:Game,id:string){return `hsl(${empireHue(g,id)} 65% 57%)`;}
export function empireNameColor(g:Game,id:string){return `hsl(${empireHue(g,id)} 82% 76%)`;}
export function empireUiColor(g:Game,id:string){return `hsl(${empireHue(g,id)} 82% var(--empire-name-lightness,76%))`;}
