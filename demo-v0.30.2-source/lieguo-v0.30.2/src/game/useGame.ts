import {withSaveLock} from './saveLock';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, Game } from './types';
import type {ReportPage} from './persistence';
import type {ReportTab} from './progress';
type Status='loading'|'ready'|'locked'|'error';
export function useGame(){
  const [game,setGame]=useState<Game|null>(null),[status,setStatus]=useState<Status>('loading'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
  const [notice,setNotice]=useState<{text:string;error?:boolean}|null>(null),[offline,setOffline]=useState<{elapsed:number;reports:number;items?:{title:string;text:string}[]}|null>(null);
  const [phase,setPhase]=useState('取得存檔控制權');
  const [backups,setBackups]=useState<{id:number;at:number;label:string;time:number}[]>([]);
  const [reportPage,setReportPage]=useState<{campaign:string;filter:ReportTab;page:number;data:ReportPage}|null>(null),[reportEpoch,setReportEpoch]=useState(0);
  const commandSerial=useRef(0),restart=useRef<((request:unknown)=>void)|null>(null),broken=useRef(false),watchdog=useRef<(()=>void)|null>(null);
  const activeCampaign=useRef(''),transition=useRef<string|null>(null);
  const worker=useRef<Worker|null>(null),syncResolve=useRef<(()=>void)|null>(null);
  const send=useCallback((r:unknown)=>{if(broken.current&&(r as {type:string}).type==='start'){setBusy(true);setStatus('loading');const id=crypto.randomUUID();transition.current=id;restart.current?.({...r as object,transitionId:id});return;}if(worker.current){const request=r as {type:string};if(request.type!=='reportPage')setBusy(true);if(['start','import','restore'].includes(request.type)){const id=crypto.randomUUID();transition.current=id;setOffline(null);setReportPage(null);setNotice(null);setProgress(0);setStatus('loading');watchdog.current?.();worker.current.postMessage({...request,transitionId:id});}else worker.current.postMessage(r);}},[]);
  const requestReports=useCallback((filter:ReportTab,page:number)=>send({type:'reportPage',filter,page}),[send]);
  const reportAction=useCallback((action:'read'|'clear',ids?:number[],filter?:ReportTab)=>send({type:'reportAction',action,ids,filter}),[send]);
  useEffect(()=>{
    let disposed=false,release:(()=>void)|undefined,pendingLockAbort:AbortController|undefined;
    async function start(){
      if(!navigator.locks){setStatus('error');setError('這個瀏覽器無法安全鎖定存檔。請使用新版 Chrome、Edge、Firefox 或 Safari，並透過 HTTPS 開啟。');return;}
      const lockAbort=new AbortController();pendingLockAbort=lockAbort;
      await withSaveLock(navigator.locks,lockAbort.signal,async()=>{
        if(disposed)return;
        let timer:ReturnType<typeof setTimeout>|undefined;
        const launch=(request:unknown)=>{
        worker.current?.terminate();clearTimeout(timer);broken.current=false;setPhase('啟動世界引擎');let stage='啟動世界引擎',lastProgress=-1;
        const w=new Worker(new URL('./runtime.worker.ts',import.meta.url),{type:'module'});worker.current=w;
        const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{w.terminate();broken.current=true;transition.current=null;setBusy(false);setStatus('error');setError(stage+'超過 10 秒沒有回應。已停止這次讀取，存檔與回復點保留；請重試。');},10000);};watchdog.current=arm;arm();
        w.onmessage=event=>{
          if(worker.current!==w||broken.current)return;
          const r=event.data;
          if(r.type==='phase'){stage=r.text;setPhase(stage);arm();return;}
          if(r.type==='progress'&&Number.isFinite(r.progress)&&r.progress>lastProgress){lastProgress=r.progress;arm();}
          if((!transition.current&&['state','error','resetDone'].includes(r.type))||(transition.current&&['switched','switchFailed'].includes(r.type)&&r.transitionId===transition.current))clearTimeout(timer);
          if(r.type==='resetDone'){setGame(null);activeCampaign.current='';setError('');setStatus('ready');setBusy(false);}

          if(transition.current){
            if(!['switched','switchFailed'].includes(r.type)||r.transitionId!==transition.current)return;
            transition.current=null;setOffline(null);setNotice(r.type==='switchFailed'?{text:r.text,error:true}:null);
            activeCampaign.current=r.game?.campaign??'';setGame(r.game);if(r.type==='switchFailed'&&!r.game){broken.current=true;setError(r.text);setStatus('error');}else setStatus('ready');setBusy(false);setProgress(0);return;
          }
          if(r.type==='state'){if(activeCampaign.current!==r.game?.campaign)setOffline(null);activeCampaign.current=r.game?.campaign??'';setGame(r.game);setStatus('ready');setBusy(false);setProgress(0);}
          if(r.type==='notice'){setNotice({text:r.text,error:r.error});setBusy(false);}
          if(r.type==='error'){broken.current=true;setError(r.text);setStatus('error');setBusy(false);}
          if(r.type==='progress')setProgress(r.progress);
          if(r.type==='loaded'&&r.recovered)setNotice({text:'已使用最近的有效回復點恢復戰役。'});
          if(r.type==='offline'&&r.campaign===activeCampaign.current&&(r.elapsed>300000||r.reports>0))setOffline({elapsed:r.elapsed,reports:r.reports,items:r.items});
          if(r.type==='backups'){setBackups(r.items);setBusy(false);}
          if(r.type==='reportPage')setReportPage(r);
          if(r.type==='reportsUpdated'){setReportEpoch(n=>n+1);setBusy(false);}
          if(r.type==='synced'){syncResolve.current?.();syncResolve.current=null;}
          if(r.type==='export'){
            const url=URL.createObjectURL(new Blob([r.text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='列國征途-河谷戰役-'+(r.mode==='full'?'完整備份':'快速存檔')+'-'+new Date().toISOString().slice(0,10)+'.realm-save';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setBusy(false);
          }
        };
        w.onerror=e=>{clearTimeout(timer);broken.current=true;transition.current=null;setBusy(false);setError(e.message||'世界引擎未能啟動。');setStatus('error');};
        w.postMessage(request);
        };restart.current=launch;launch({type:'load'});
        void navigator.storage?.persist?.().catch(()=>false);
        await new Promise<void>(resolve=>{release=resolve;});
        clearTimeout(timer);worker.current?.terminate();worker.current=null;restart.current=null;watchdog.current=null;
      },()=>{if(!disposed){setBusy(false);setError('取得本機存檔控制權逾時。請關閉其他列國征途分頁後重新整理；原存檔未變更。');setStatus('locked');}});

    }
    void start().catch(e=>{setStatus('error');setError(e instanceof Error?e.message:String(e));});
    const sync=()=>worker.current?.postMessage({type:'away'});
    window.addEventListener('pagehide',sync);const resume=()=>worker.current?.postMessage({type:'resume'});window.addEventListener('pageshow',resume);const visibility=()=>worker.current?.postMessage({type:document.hidden?'away':'resume'});document.addEventListener('visibilitychange',visibility);
    return()=>{disposed=true;pendingLockAbort?.abort();release?.();window.removeEventListener('pagehide',sync);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),6500);return()=>clearTimeout(timer);},[notice]);
  const importFile=async(file:File)=>{if(file.size>100*1024*1024){setNotice({text:'存檔不可超過 100 MiB。',error:true});return;}try{send({type:'import',text:await file.text()});}catch{setNotice({text:'讀取檔案失敗。',error:true});}};
  const sync=()=>new Promise<void>((resolve,reject)=>{syncResolve.current=resolve;send({type:'sync'});setTimeout(()=>{if(syncResolve.current===resolve){syncResolve.current=null;reject(new Error('存檔尚未完成，請稍後再試。'));}},10000);});
  return {game,status,error,phase,cancelLoad:()=>{if(!restart.current)return;worker.current?.terminate();broken.current=true;transition.current=null;setBusy(false);setStatus('error');setError('已停止讀取，存檔與回復點保留。可重新讀取或建立新戰役。');},retry:()=>{if(!restart.current){window.location.reload();return;}transition.current=null;setError('');setProgress(0);setStatus('loading');setBusy(false);restart.current({type:'load'});},reset:()=>{if(!restart.current){setError('目前無法取得存檔控制權，請關閉其他遊戲分頁並使用支援的瀏覽器重新開啟。');setStatus('error');return;}transition.current=null;setBusy(true);setStatus('loading');setError('');setGame(null);restart.current?.({type:'reset'});},busy,progress,notice,offline,backups,reportPage,reportEpoch,requestReports,reportAction,send,importFile,sync,clearOffline:()=>setOffline(null),issue:(payload:Command)=>{if(game)send({type:'command',order:{commandId:Date.now()+'-'+(++commandSerial.current),campaignId:game.campaign,issuerId:game.player,issuedWorldTime:game.time,expectedRevision:game.revision,payload}});}};
}
