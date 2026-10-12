import {it,expect} from 'vitest';
import {civilizations} from '../content/civilizations';
import {newGame} from '../game/legacyWorld';
import {advance,command} from '../game/legacyEngine';
import {stateHash,exportSave,validate} from '../game/legacyPersistence';
import {HOUR} from '../game/legacyTypes';

for(const civ of civilizations)it(`${civ.name}：八小時追算與逐時推進一致且存檔有效`,()=>{
 const g=newGame(civ.id,90217,1,0);
 const capital=g.factions.find(f=>f.id===g.player)!.capital;
 expect(command(g,{type:'governor',cities:[capital],enabled:true,policy:'balanced',budget:2000,reserve:200})).toBe('');
 const one=structuredClone(g),sliced=structuredClone(g);
 advance(one,8*HOUR);
 for(let t=HOUR;t<=8*HOUR;t+=HOUR)advance(sliced,t);
 expect(stateHash(one)).toBe(stateHash(sliced));
 validate(one);
 expect(new TextEncoder().encode(exportSave(one)).length).toBeLessThan(5*1024*1024);
},60000);
