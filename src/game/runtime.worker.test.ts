import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { newGame } from './legacyWorld';
import type { Game } from './legacyTypes';
const storage=vi.hoisted(()=>({clearSavedGames:vi.fn(),loadSave:vi.fn(),save:vi.fn(),restore:vi.fn(),importSave:vi.fn(),backupList:vi.fn(),exportStoredSave:vi.fn(),discardFutureReports:vi.fn(),replaceReportHistory:vi.fn(),readReportPage:vi.fn(),updateReports:vi.fn()}));
vi.mock('./legacyPersistence',()=>storage);
let messages:any[],worker:{postMessage:(v:unknown)=>void;onmessage:((v:{data:unknown})=>void)|null};
const until=async(test:()=>boolean)=>{for(let i=0;i<300&&!test();i++)await Promise.resolve();expect(test()).toBe(true);};
const send=(data:unknown)=>worker.onmessage!({data});
let old:Game;
beforeEach(async()=>{
  vi.resetModules();vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-10T00:00:00Z'));vi.spyOn(performance,'now').mockReturnValue(0);
  old=newGame('civ_zhongguo',1,1,Date.now()-600_000);old.events=[];
  storage.loadSave.mockResolvedValue({game:old,recovered:false});storage.save.mockResolvedValue(undefined);
  storage.discardFutureReports.mockResolvedValue(undefined);
  storage.replaceReportHistory.mockResolvedValue(undefined);
  messages=[];worker={postMessage:v=>messages.push(structuredClone(v)),onmessage:null};vi.stubGlobal('self',worker);
  await import('./legacyRuntime.worker');send({type:'load'});await until(()=>messages.some(m=>m.type==='offline'));messages=[];
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('載入摘要帶戰役識別；開始新局清除舊 away 標記，回前景不播舊消息',async()=>{
  send({type:'away'});send({type:'start',player:'civ_japan',seed:2,speed:1,name:'新領主',transitionId:'new-1'});
  await until(()=>messages.some(m=>m.type==='switched'));
  const ack=messages.find(m=>m.type==='switched');expect(ack.transitionId).toBe('new-1');expect(ack.game.campaign).not.toBe(old.campaign);expect(ack.game.time).toBe(0);
  messages=[];send({type:'resume'});send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));
  expect(messages.some(m=>m.type==='offline')).toBe(false);expect(messages.find(m=>m.type==='state').game.campaign).toBe(ack.game.campaign);
});
it.each(['import','restore'] as const)('%s 切換完成才送出確認，摘要與背景標記不跨戰役',async type=>{
  const imported=newGame('civ_frankia',3,1,0);storage.importSave.mockReturnValue(imported);storage.restore.mockResolvedValue(imported);
  send({type:'away'});send({type,text:'save',id:1,transitionId:'replace-1'});await until(()=>messages.some(m=>m.type==='switched'));
  expect(messages.find(m=>m.type==='switched').game.campaign).toBe(imported.campaign);messages=[];
  send({type:'resume'});send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));expect(messages.some(m=>m.type==='offline')).toBe(false);
});
it('建立失敗回報相同切換識別且保留原戰役',async()=>{
  storage.save.mockImplementation(async(g:Game)=>{if(g.seed===4)throw new Error('Storage unavailable');});
  send({type:'start',player:'civ_japan',seed:4,speed:1,transitionId:'failed-1'});await until(()=>messages.some(m=>m.type==='switchFailed'));
  const failure=messages.find(m=>m.type==='switchFailed');expect(failure.transitionId).toBe('failed-1');expect(failure.game.campaign).toBe(old.campaign);expect(failure.text).toContain('Storage unavailable');expect(messages.some(m=>m.type==='switched')).toBe(false);
});

it.each([0,3600000,21600000,-1])('worker keeps offline cap %s across background saves and resumes without backlog',async limit=>{
 old.offlineLimit=limit;const before=old.time;send({type:'away'});send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));messages=[];
 vi.mocked(performance.now).mockReturnValue(12*3600000);send({type:'sync'});await vi.advanceTimersByTimeAsync(10);await until(()=>messages.some(m=>m.type==='synced'));const first=messages.find(m=>m.type==='state').game;expect(first.time-before).toBe(limit<0?12*3600000:limit);messages=[];
 vi.mocked(performance.now).mockReturnValue(24*3600000);send({type:'resume'});send({type:'sync'});await vi.advanceTimersByTimeAsync(10);await until(()=>messages.some(m=>m.type==='synced'));expect(messages.filter(m=>m.type==='state').at(-1).game.time-before).toBe(limit<0?24*3600000:limit);messages=[];
 vi.mocked(performance.now).mockReturnValue(24*3600000+60000);send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));expect(messages.find(m=>m.type==='state').game.time-before).toBe((limit<0?24*3600000:limit)+60000);
});

it.each([1,3,6,10,50,100])('new campaign speed %s advances real elapsed time at the selected multiplier',async speed=>{
 send({type:'start',player:'civ_japan',seed:7,speed,transitionId:'speed-test'});await until(()=>messages.some(m=>m.type==='switched'));messages=[];
 vi.mocked(performance.now).mockReturnValue(60000);send({type:'sync'});await until(()=>messages.some(m=>m.type==='synced'));
 expect(messages.find(m=>m.type==='state').game.time).toBe(60000*speed);
});
it('reset clears game and backups before allowing a new campaign',async()=>{
 storage.clearSavedGames.mockResolvedValue(undefined);send({type:'reset'});await until(()=>messages.some(m=>m.type==='resetDone'));
 expect(storage.clearSavedGames).toHaveBeenCalledTimes(1);expect(messages.find(m=>m.type==='state').game).toBeNull();messages=[];
 send({type:'start',player:'civ_japan',seed:8,speed:1,transitionId:'after-reset'});await until(()=>messages.some(m=>m.type==='switched'));expect(messages.find(m=>m.type==='switched').game.speed).toBe(1);
});
it('load error is explicit and does not prevent starting a fresh campaign',async()=>{
 storage.loadSave.mockRejectedValue(new Error('舊存檔無法讀取'));send({type:'load'});await until(()=>messages.some(m=>m.type==='error'));messages=[];
 send({type:'start',player:'civ_japan',seed:9,speed:10,transitionId:'after-error'});await until(()=>messages.some(m=>m.type==='switched'));expect(messages.find(m=>m.type==='switched').game.seed).toBe(9);
});
it('reset failure stays visible instead of reporting a successful new start',async()=>{
 storage.clearSavedGames.mockRejectedValue(new Error('清除存檔逾時'));send({type:'reset'});await until(()=>messages.some(m=>m.type==='error'));expect(messages.some(m=>m.type==='resetDone')).toBe(false);
});
