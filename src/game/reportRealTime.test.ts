import {expect,it} from 'vitest';
import {appendMessage,setReportClock} from './messages';
import {newGame} from './legacyWorld';
import {checksum,decode,envelope} from './legacyPersistence';
import {reportTime} from './ReportsView';
import {MINUTE} from './legacyTypes';

it('preserves real event times through speed changes, grouped reports and complete backups',()=>{
 const wall=Date.UTC(2026,8,29,0,0),g=newGame('civ_zhongguo',919,50,wall),capital=g.factions.find(f=>f.id===g.player)!.capital;
 g.events=[];g.sandbox=true;
 setReportClock(g,{gameTime:0,realTime:wall,speed:50});
 g.time=10*MINUTE;
 appendMessage(g,{owner:g.player,kind:'economy',node:capital,title:'商隊抵達 首都',text:'第一批商隊抵達。'});
 setReportClock(g,null);
 const grouped=g.reports.find(r=>r.groupHour===0)!;
 expect(grouped.realAt).toBe(wall+12_000);
 expect(grouped.entries?.[0].realAt).toBe(wall+12_000);

 setReportClock(g,{gameTime:g.time,realTime:wall+12_000,speed:10});
 g.time=20*MINUTE;
 appendMessage(g,{owner:g.player,kind:'economy',node:capital,title:'商隊抵達 首都',text:'第二批商隊抵達。'});
 setReportClock(g,null);
 expect(grouped.realAt).toBe(wall+72_000);
 expect(grouped.entries?.[1].realAt).toBe(wall+72_000);

 const saved=decode({...envelope(g),reports:g.reports,reportChecksum:checksum(g.reports)});
 expect(saved.reports.find(r=>r.groupHour===0)?.entries?.[1].realAt).toBe(wall+72_000);
 const legacy={...saved.reports[0]};delete legacy.realAt;
 expect(reportTime(legacy.realAt,legacy.at)).toBe('世界 0時 00分');
 expect(reportTime(grouped.realAt,grouped.at)).not.toContain('世界');
});
