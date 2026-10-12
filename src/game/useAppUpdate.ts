import {useCallback,useEffect,useRef,useState} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {RELEASE} from './release';

const newer=(value:unknown):value is string=>{
 if(typeof value!=='string'||!/^\d+\.\d+\.\d+$/.test(value))return false;
 const a=value.split('.').map(Number),b=RELEASE.version.split('.').map(Number);
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];
 return false;
};
/** Wait for the new cache to finish installing; a normal reload can still use the old cache. */
export function waitForWaiting(registration:ServiceWorkerRegistration):Promise<ServiceWorker>{
 return new Promise((resolve,reject)=>{
  let watched:ServiceWorker|null=null;
  const finish=(worker?:ServiceWorker)=>{clearTimeout(timer);registration.removeEventListener('updatefound',inspect);watched?.removeEventListener('statechange',inspect);worker?resolve(worker):reject(new Error('新版下載尚未完成，請稍後再試。'));};
  const inspect=()=>{if(registration.waiting){finish(registration.waiting);return;}const worker=registration.installing;if(worker!==watched){watched?.removeEventListener('statechange',inspect);watched=worker;watched?.addEventListener('statechange',inspect);}if(watched?.state==='redundant')finish();};
  const timer=setTimeout(()=>finish(),30000);registration.addEventListener('updatefound',inspect);inspect();
 });
}
export function activateWaiting(worker:ServiceWorker,container:ServiceWorkerContainer):Promise<void>{
 return new Promise((resolve,reject)=>{
  const finish=(error?:Error)=>{clearTimeout(timer);container.removeEventListener('controllerchange',changed);error?reject(error):resolve();};
  const changed=()=>finish();
  const timer=setTimeout(()=>finish(new Error('新版啟用等待逾時，請稍後再試。')),15000);
  container.addEventListener('controllerchange',changed);
  try{worker.postMessage({type:'SKIP_WAITING'});}catch(error){finish(error instanceof Error?error:new Error('新版無法啟用。'));}
 });
}
export function useAppUpdate(save:()=>Promise<void>){
 const [text,setText]=useState(''),[version,setVersion]=useState(''),[ready,setReady]=useState(false),[updating,setUpdating]=useState(false);
 const registration=useRef<ServiceWorkerRegistration|undefined>(undefined),checking=useRef(false),loading=useRef(false),latest=useRef(''),waiting=useRef(false);
 const embedded=!!window.__FORMAL_EMBEDDED_ASSETS;
 const check=useCallback(async()=>{
  if(embedded){setText('目前為離線試玩包 v'+RELEASE.version+'。新版請使用新的試玩檔案。');return;}
  if(checking.current||loading.current)return;checking.current=true;
  try{
   const url=new URL(import.meta.env.BASE_URL+'version.json',window.location.href);url.searchParams.set('_check',String(Date.now()));
   const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();const data=await r.json();
   if(typeof data.version!=='string'||!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error();
   if(newer(data.version)){latest.current=data.version;setVersion(data.version);setText('可用新版 v'+data.version+'；可保存進度並更新。');}
   else if(!latest.current&&!waiting.current)setText('目前已載入 v'+RELEASE.version+'，已確認為最新版本。');
   await registration.current?.update();
  }catch{if(!latest.current&&!waiting.current)setText('目前無法確認更新；本機戰役仍可繼續。');}
  finally{checking.current=false;}
 },[embedded]);
 useEffect(()=>{
  if(embedded){void check();return;}
  let disposed=false;
  registerSW({immediate:true,onNeedReload(){/* Activation never reloads before the explicit save below. */},onNeedRefresh(){if(!disposed){waiting.current=true;setReady(true);setText('新版已下載完成，可保存進度並更新。');}},onRegisteredSW(_url,r){if(!disposed){registration.current=r;void r?.update().catch(()=>{});}}});
  void check();const visible=()=>{if(!document.hidden)void check();};const timer=setInterval(visible,60000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);window.addEventListener('online',visible);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);};
 },[check,embedded]);
 const update=async()=>{
  if(embedded||loading.current)return;loading.current=true;setUpdating(true);setText('正在準備新版…');
  try{
   let worker:ServiceWorker|undefined;
   if('serviceWorker' in navigator){
    const r=registration.current??await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
    if(!r)throw new Error('新版尚未備妥，請稍後再試。');
    if(!r.waiting)await r.update();worker=await waitForWaiting(r);
   }
   setText('正在保存進度…');await save();
   if(worker)await activateWaiting(worker,navigator.serviceWorker);
   const url=new URL(window.location.href);url.searchParams.set('_appUpdate',latest.current||String(Date.now()));window.location.replace(url.href);
  }catch(error){setText((error instanceof Error?error.message:'更新尚未完成。')+' 目前頁面與已保存進度保留。');}
  finally{loading.current=false;setUpdating(false);}
 };
 return{text,available:ready||!!version,updating,check,update};
}
