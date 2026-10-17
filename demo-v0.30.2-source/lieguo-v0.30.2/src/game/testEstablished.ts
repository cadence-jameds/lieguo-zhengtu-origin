import {legacyGame as newGame} from './world';
import {makePlots} from './city';
export function establishedGame(...args:Parameters<typeof newGame>){const g=newGame(...args),n=g.nodes.find(n=>n.owner===g.player&&n.kind==='capital')!;for(const b of ['farm','lumber','quarry','mine','house','warehouse','barracks'] as const)n.buildings[b]=1;n.plots=makePlots(n.buildings);for(const target of g.nodes)g.factions.find(f=>f.id===g.player)!.intel[target.id]={at:0,owner:target.owner,wall:target.buildings.wall,troops:{...target.troops}};return g;}
