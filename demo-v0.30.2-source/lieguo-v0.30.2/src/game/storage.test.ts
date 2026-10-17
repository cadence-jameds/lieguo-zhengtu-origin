import {beforeEach,describe,it,expect,vi} from 'vitest';
const storage=vi.hoisted(()=>({current:undefined as unknown,backups:[] as unknown[],reports:[] as Record<string,unknown>[],fail:false,next:1}));
vi.mock('dexie',()=>{
 const cmp=(a:unknown,b:unknown):number=>{if(Array.isArray(a)&&Array.isArray(b)){for(let i=0;i<Math.min(a.length,b.length);i++){const c=cmp(a[i],b[i]);if(c)return c;}return a.length-b.length;}if(a===b)return 0;return (a as number|string)<(b as number|string)?-1:1;};
 const index=(row:Record<string,unknown>,key:string)=>key.startsWith('[')?key.slice(1,-1).split('+').map(k=>row[k]):row[key];
 const query=(key:string,low?:unknown,high?:unknown,lowOpen=false,highOpen=false)=>{
  let reverse=false,offset=0,limit=Infinity;
  const q={reverse:()=>{reverse=true;return q;},offset:(n:number)=>{offset=n;return q;},limit:(n:number)=>{limit=n;return q;},toArray:async()=>{const values=storage.reports.filter(r=>{const v=index(r,key);return(low===undefined||cmp(v,low)>(lowOpen?0:-1))&&(high===undefined||cmp(v,high)<(highOpen?0:1));}).sort((a,b)=>cmp(index(a,key),index(b,key)));return structuredClone((reverse?values.reverse():values).slice(offset,offset+limit));},count:async()=> (await q.toArray()).length};return q;
 };
 const ordered=()=>({last:async()=>structuredClone(storage.backups.at(-1)),toArray:async()=>structuredClone(storage.backups),reverse:()=>({toArray:async()=>structuredClone(storage.backups).reverse()})});
 class Dexie{
  static minKey=-Infinity;
  currentTable={get:async()=>structuredClone(storage.current),put:async(row:unknown)=>{if(storage.fail)throw new Error('Injected transaction failure');storage.current=structuredClone(row);}};
  backupTable={orderBy:ordered,clear:async()=>{storage.backups=[];},add:async(row:Record<string,unknown>)=>{const id=storage.next++;storage.backups.push({...structuredClone(row),id});return id;},bulkDelete:async(ids:number[])=>{storage.backups=storage.backups.filter(r=>!ids.includes((r as {id:number}).id));},get:async(id:number)=>structuredClone(storage.backups.find(r=>(r as {id:number}).id===id))};
  reportsTable={where:(key:string)=>({between:(low:unknown,high:unknown,lowOpen?:boolean,highOpen?:boolean)=>query(key,low,high,lowOpen,highOpen),equals:(val:unknown)=>query(key,val,val)}),clear:async()=>{storage.reports=[];},bulkPut:async(rows:Record<string,unknown>[])=>{for(const row of rows){const idx=storage.reports.findIndex(x=>x.key===row.key);if(idx>=0)storage.reports[idx]=structuredClone(row);else storage.reports.push(structuredClone(row));}},bulkDelete:async(keys:string[])=>{storage.reports=storage.reports.filter(r=>!keys.includes(r.key as string));},bulkGet:async(keys:string[])=>keys.map(k=>structuredClone(storage.reports.find(r=>r.key===k)))};
  version(){return{stores:()=>{Object.assign(this,{saves:this.currentTable,backups:this.backupTable,BattleReports:this.reportsTable});}};}
  async transaction(...args:unknown[]){const fn=args.at(-1) as ()=>Promise<unknown>,old=structuredClone({current:storage.current,backups:storage.backups,reports:storage.reports,next:storage.next});try{return await fn();}catch(e){Object.assign(storage,old);throw e;}}
 }
 return{default:Dexie};
});
import {newGame} from './world';
import {save,loadSave,checksum,exportStoredSave,readReportPage,discardFutureReports,updateReports,backupList,importSave,replaceReportHistory} from './persistence';
import {command} from './engine';
const game=()=>newGame('civ_zhongguo',17,1,0);
beforeEach(()=>Object.assign(storage,{current:undefined,backups:[],reports:[],fail:false,next:1}));
describe('存檔應用層故障復原',()=>{
 it('中途提交失敗保留前一存檔、備份與記憶體版本',async()=>{const g=game();await save(g,true,'initial');const before=structuredClone(storage.current),backups=checksum(storage.backups),revision=g.revision;command(g,{type:'build',city:g.factions[0].capital,building:'farm'});storage.fail=true;await expect(save(g,true,'failed')).rejects.toThrow('Injected');expect(storage.current).toEqual(before);expect(checksum(storage.backups)).toBe(backups);expect(g.revision).toBe(revision);storage.fail=false;const loaded=await loadSave();expect(loaded.game!.nodes[0].build).toHaveLength(0);});
 it('損毀的目前存檔回退到有效備份，不覆寫損毀原件',async()=>{const g=game();await save(g,true,'valid');const row=storage.current as {data:{checksum:string}};row.data.checksum='damaged';const original=structuredClone(storage.current);const loaded=await loadSave();expect(loaded.recovered).toBe(true);expect(loaded.game?.seed).toBe(17);expect(storage.current).toEqual(original);});
 it('沒有有效回復點時停止載入並保留所有資料',async()=>{await save(game(),true);(storage.current as {data:{checksum:string}}).data.checksum='bad';for(const row of storage.backups)(row as {data:{checksum:string}}).data.checksum='bad';const before=checksum(storage);await expect(loadSave()).rejects.toThrow('資料已保留');expect(checksum(storage)).toBe(before);});
 it('首頁匯出讀取最後已保存的進度，損毀時回退到回復點，且只保留兩份',async()=>{const g=game();await save(g,true,'first');g.time=1000;await save(g,true,'second');g.time=2000;await save(g,true,'third');expect(storage.backups).toHaveLength(2);expect(JSON.parse(await exportStoredSave()).snapshot.time).toBe(2000);(storage.current as {data:{checksum:string}}).data.checksum='damaged';expect(JSON.parse(await exportStoredSave()).snapshot.time).toBe(2000);});
});
describe('戰報獨立存放',()=>{
 it('世界快照不包含歷史戰報，完整備份與 50 筆分頁仍能取回全部',async()=>{
  const g=game(),first=g.next;
  for(let i=0;i<1100;i++)g.reports.push({id:g.next++,at:i,owner:g.player,kind:'battle',title:'戰役 '+i,text:'攻擊與兵力記錄 '+i,read:false});
  const narrative='守方戰報。甲 攻擊 乙。地形：森林；城牆 2 級；攻方補給 充足；鍛鋼 已採用 +12%；士氣：攻 80 / 守 70（補給／城市穩定）。攻方損失 3 套編制裝備，守方損失 4 套，已隨傷亡扣除。尚存部隊依戰果駐防或返城。';
  g.reports.at(-1)!.text=narrative;
  g.time=1100;g.reportUnread=1100;g.reportAlerts=1100;g.battleStatistics={[g.player]:{wins:900,losses:200,casualties:1300,conquests:12}};
  await save(g,true);const quick=await exportStoredSave('quick'),full=await exportStoredSave('full');
  expect(JSON.parse(quick).snapshot.reports).toBeUndefined();expect(quick.length).toBeLessThan(full.length);
  expect(JSON.parse(full).reports.filter((r:{kind:string})=>r.kind==='battle')).toHaveLength(1100);expect(importSave(full).reports.filter(r=>r.kind==='battle')).toHaveLength(1100);
  const tampered=JSON.parse(full);tampered.reports[0].title='改寫';expect(()=>importSave(JSON.stringify(tampered))).toThrow('戰報檢查碼');
  const loaded=(await loadSave()).game!;expect(loaded.reports).toEqual([]);expect(loaded.battleStatistics?.[g.player].conquests).toBe(12);
  const firstPage=await readReportPage(g.campaign,g.player,'battle',0,g.next,g.time),second=await readReportPage(g.campaign,g.player,'battle',1,g.next,g.time);
  expect(firstPage.rows).toHaveLength(50);expect(firstPage.count).toBe(1100);expect(firstPage.rows[0].id).toBe(g.next-1);expect(second.rows[0].id).toBe(g.next-51);
  expect(firstPage.rows[0].text).toBe(narrative);expect((storage.reports.at(-1)!.report as {text:string}).text.length).toBeLessThan(narrative.length);
  expect(firstPage.rows.at(-1)!.id).toBeGreaterThan(first);
 });
 it('兩份回復點記錄戰役時間和游標，回復較舊時清除未來戰報',async()=>{
  const g=game();g.reports.push({id:g.next++,at:100,owner:g.player,kind:'battle',title:'過去',text:'完整',read:false});g.time=100;await save(g,true,'第一點');const previous=structuredClone(g),cursor=g.next;
  g.reports.push({id:g.next++,at:200,owner:g.player,kind:'battle',title:'未來',text:'不應看見',read:false});g.time=200;await save(g,true,'第二點');
  expect((await backupList()).map(b=>[b.time,b.reportCursor])).toEqual([[200,g.next],[100,cursor]]);
  await discardFutureReports(previous);expect((await backupList())).toHaveLength(1);
  const page=await readReportPage(g.campaign,g.player,'all',0,previous.next,previous.time);expect(page.rows.map(r=>r.title)).toContain('過去');expect(page.rows.map(r=>r.title)).not.toContain('未來');
 });
 it('分類已讀和清除會更新世界計數，不必載入整段歷史',async()=>{
  const g=game();for(const kind of ['battle','diplomacy','system'] as const){g.reports.push({id:g.next++,at:0,owner:g.player,kind,title:kind,text:kind,read:false});}
  g.reportUnread=3;g.reportAlerts=2;await save(g,true);await updateReports(g,'read',null,'battle');expect(g.reportUnread).toBe(2);expect(g.reportAlerts).toBe(1);
  await updateReports(g,'clear',null,'all');expect(g.reportUnread).toBe(0);expect(g.reportAlerts).toBe(0);expect((await readReportPage(g.campaign,g.player,'all',0,g.next,g.time)).count).toBe(0);
  await replaceReportHistory(g);expect(storage.reports).toHaveLength(0);
 });
});
