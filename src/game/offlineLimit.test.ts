import {expect,it} from 'vitest';
import {newGame} from './legacyWorld';
import {offlineElapsed,MAX_OFFLINE_MS} from './realmSystems';

it('舊版無上限與新遊戲設定均最多補算現實一天，且不在存檔時重置起點',()=>{
 const g=newGame('civ_zhongguo',42,1,1000);
 for(const limit of [-1,undefined,MAX_OFFLINE_MS]){
  g.offlineLimit=limit;g.offlineSince=1000;g.savedAt=1000;
  expect(offlineElapsed(g,1000+3*MAX_OFFLINE_MS)).toBe(MAX_OFFLINE_MS);
  g.savedAt=1000+MAX_OFFLINE_MS/2;
  expect(offlineElapsed(g,1000+3*MAX_OFFLINE_MS)).toBe(MAX_OFFLINE_MS/2);
 }
 g.offlineLimit=0;expect(offlineElapsed(g,1000+3*MAX_OFFLINE_MS)).toBe(0);
});
