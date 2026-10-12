/// <reference lib="webworker" />
import {offlineElapsed} from './realmSystems';
import { newGame } from './legacyWorld';
import {setReportClock} from './messages';
import { advance, submitOrder } from './legacyEngine';
import { clearSavedGames, save, loadSave, backupList, exportStoredSave, importSave, restore, discardFutureReports, replaceReportHistory, readReportPage, updateReports } from './legacyPersistence';
import { MINUTE, type Game, type CommandEnvelope } from './legacyTypes';
import type {ReportTab} from './progress';
type Request=({type:'reset'|'load'|'sync'|'backups'|'away'|'resume'}|{type:'export';mode?:'quick'|'full'}|{type:'reportPage';filter:ReportTab;page:number}|{type:'reportAction';action:'read'|'clear';ids?:number[];filter?:ReportTab}|{type:'start';player:string;seed:number;speed:number;name?:string;offlineLimit?:number}|{type:'command';order:CommandEnvelope}|{type:'import';text:string}|{type:'restore';id:number}) & {transitionId?:string};
const anchorWall=Date.now(),anchorMono=performance.now();
const worldWall=()=>Math.floor(anchorWall+performance.now()-anchorMono);
let g:Game|null=null,failed=false,lastSave=0,lastPost=0,queue=Promise.resolve();
const post=(value:unknown)=>self.postMessage(value);
const publicGame=()=>g?{...g,reports:[]}:null;
const state=()=>post({type:'state',game:publicGame()});
const phase=(text:string)=>post({type:'phase',text});
let loading=false,tickPending=false;
async function catchUp(){
  if(!g)return;
  const wall=worldWall(),elapsed=away?offlineElapsed(g,wall):Math.max(0,wall-g.savedAt),target=g.time+elapsed*g.speed,start=g.time;let lastYield=performance.now();
  setReportClock(g,{gameTime:start,realTime:g.savedAt,speed:g.speed});
  try{while(g.time<target&&!g.defeat&&(!g.result||g.sandbox)){
    const before=g.time;advance(g,Math.min(target,g.time+5*MINUTE));
    if(g.time<=before&&!g.defeat&&(!g.result||g.sandbox))throw new Error('離線追算未能推進；原回復點保留。');
    if(g.reports.length>300)await flush();
    if(performance.now()-lastYield>=50){lastYield=performance.now();post({type:'progress',progress:Math.min(1,(g.time-start)/(target-start))});await new Promise(r=>setTimeout(r,0));}
  }}finally{setReportClock(g,null);}
  g.savedAt=wall;
}
async function flush(force=false,label?:string){if(g){await save(g,force,label);lastSave=Date.now();}}
let away:{time:number;next:number;campaign:string}|null=null;
async function handle(r:Request){
  if(r.type==='reset'){g=null;away=null;failed=true;await clearSavedGames();failed=false;post({type:'resetDone'});state();return;}
  if(r.type==='away'){if(g&&!away){await catchUp();g.offlineSince=worldWall();away={time:g.time,next:g.next,campaign:g.campaign};}await flush();return;}
  if(r.type==='resume'){if(g&&away){const mark=away;await catchUp();away=null;delete g.offlineSince;await flush();state();if(mark.campaign===g.campaign){const rows=g.reports.filter(r=>r.id>=mark.next&&r.owner===g!.player);post({type:'offline',campaign:g.campaign,elapsed:g.time-mark.time,reports:rows.length,items:rows.slice(-12).reverse().map(r=>({title:r.title,text:r.text}))});}}return;}
  if(r.type==='load'){
    loading=true;phase('讀取與驗證本機存檔');
    try{const loaded=await loadSave();g=loaded.game;
    if(g){const before=g.time,reportId=g.next;
      if(loaded.recovered)await discardFutureReports(g);
      phase('保存離線追算前回復點');await save(g,true,'離線追算前');
      phase('推進離線期間的世界');
      g.offlineSince??=g.savedAt;away={time:g.time,next:g.next,campaign:g.campaign};await catchUp();away=null;delete g.offlineSince;phase('保存接續進度');await flush();
      post({type:'loaded',recovered:loaded.recovered});state();
      post({type:'offline',campaign:g.campaign,elapsed:g.time-before,reports:g.reports.filter(r=>r.id>=reportId&&r.owner===g!.player).length,items:g.reports.filter(r=>r.id>=reportId&&r.owner===g!.player).slice(-12).reverse().map(r=>({title:r.title,text:r.text}))});
    }else state();
    }finally{loading=false;}
    return;
  }
  if(r.type==='start'){
    const name=r.name?.trim();if(r.name!==undefined&&(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name)))throw new Error('請輸入 1～24 字的玩家名字。');
    if(!failed){await catchUp();await flush(true,'新戰役前');}
    phase('建立新戰役');const draft=newGame(r.player,r.seed,r.speed,worldWall());draft.offlineLimit=[0,3600000,21600000,86400000].includes(r.offlineLimit??86400000)?r.offlineLimit??86400000:86400000;if(name)draft.factions.find(f=>f.id===draft.player)!.name=name;await save(draft,true,'戰役開始');g=draft;away=null;failed=false;post({type:'switched',transitionId:r.transitionId,game:publicGame()});return;
  }
  if(r.type==='import'||r.type==='restore'){
    const draft=r.type==='import'?importSave(r.text):await restore(r.id);
    await catchUp();await flush(true,'回復前');
    if(r.type==='import')await replaceReportHistory(draft);else await discardFutureReports(draft);
    draft.savedAt=worldWall();delete draft.offlineSince;await save(draft,true,'手動回復');g=draft;away=null;failed=false;post({type:'switched',transitionId:r.transitionId,game:publicGame()});post({type:'notice',text:'已載入存檔，世界從此刻繼續。'});return;
  }
  if(!g)throw new Error('請先建立戰役。');
  if(r.type==='reportPage'){await flush();state();post({type:'reportPage',campaign:g.campaign,filter:r.filter,page:r.page,data:await readReportPage(g.campaign,g.player,r.filter,r.page,g.next,g.time)});return;}
  if(r.type==='reportAction'){
    if(r.ids&&(!Array.isArray(r.ids)||r.ids.length>50||r.ids.some(id=>!Number.isSafeInteger(id)||id<0)))throw new Error('無效的戰報選擇。');
    await flush();await updateReports(g,r.action,r.ids??null,r.filter??'all');await flush();state();post({type:'reportsUpdated'});return;
  }
  await catchUp();
  if(r.type==='command'){
    const draft=structuredClone(g);setReportClock(draft,{gameTime:draft.time,realTime:worldWall(),speed:draft.speed});
    let reason:string;try{reason=submitOrder(draft,r.order);}finally{setReportClock(draft,null);}
    if(reason){post({type:'notice',text:reason,error:true});state();return;}
    const protectionEnded=g.time<g.protectionUntil&&draft.protectionUntil<=draft.time;
    draft.savedAt=worldWall();await save(draft);g=draft;lastSave=Date.now();state();if(r.order.payload.type!=='reports')post({type:'notice',text:protectionEnded?'命令已下達，新手保護已解除。':'命令已下達。'});
  }else if(r.type==='export'){await flush();post({type:'export',mode:r.mode??'quick',text:await exportStoredSave(r.mode??'quick')});}
  else if(r.type==='backups'){post({type:'backups',items:await backupList()});}
  else {await flush();state();post({type:'synced'});}
}
// Every request and timer shares one authority queue; accepted orders persist before display.
self.onmessage=(event:MessageEvent<Request>)=>{
  const r=event.data;
  queue=queue.then(()=>handle(r)).catch((e:unknown)=>{
    const text=e instanceof Error?e.message:'存檔操作失敗。';
    if(r.transitionId)post({type:'switchFailed',transitionId:r.transitionId,game:g,text});else if(r.type==='load'||r.type==='reset'){failed=true;post({type:'error',text});}else{post({type:'notice',text,error:true});state();}
  });
};
setInterval(()=>{
  if(!g||failed||loading||tickPending)return;
  tickPending=true;queue=queue.then(async()=>{
    await catchUp();
    if(Date.now()-lastSave>=10000)await flush();
    if(Date.now()-lastPost>=700){state();lastPost=Date.now();}
  }).catch((e:unknown)=>{failed=true;post({type:'error',text:e instanceof Error?e.message:'自動存檔失敗；請保留此分頁。'});}).finally(()=>{tickPending=false;});
},250);
