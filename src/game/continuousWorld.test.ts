import {describe,expect,it} from 'vitest';
import {checkVictory} from './legacyEngine';
import {validate} from './legacyPersistence';
import {newGame} from './legacyWorld';
import {HOUR} from './legacyTypes';

describe('持續戰役',()=>{
  it('經過 48 世界小時不會自動結束',()=>{
    const game=newGame('civ_zhongguo',20260906,1,0);
    game.time=49*HOUR;
    checkVictory(game);
    expect(game.result).toBeNull();
  });

  it('既有的 48 小時結算存檔可接續世界事件',()=>{
    const game=newGame('civ_zhongguo',20260906,1,0);
    game.time=48*HOUR;
    game.events=[];
    game.result={kind:'defeat',winner:null,text:'48 小時戰役結束，尚未完成征服或霸權。你可以保留現況繼續經營，試驗下一步戰略。'};
    const resumed=validate(game);
    expect(resumed.result).toBeNull();
    expect(resumed.events.some(e=>e.type==='pulse'&&e.at>resumed.time)).toBe(true);
    expect(resumed.events.filter(e=>e.type==='ai').length).toBe(resumed.factions.length-1);
  });
});
