import type {Game,Node} from './legacyTypes';
export const observed=(g:Game,n:Node)=>{const i=g.factions.find(f=>f.id===g.player)?.intel[n.id];return n.respawnAt||(i?.generation??0)!==(n.generation??0)?undefined:i;};
export const knownOwner=(_g:Game,n:Node)=>n.owner;

export const lordAccent=(id:string|undefined|null,fallback:string)=>id?.includes('~')?'hsl('+((Number(id.split('~')[1])*137.508)%360)+' 48% 64%)':fallback;
