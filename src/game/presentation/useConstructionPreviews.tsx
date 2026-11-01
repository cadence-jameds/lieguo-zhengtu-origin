import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {FormalWorld} from '../formal/model';
import type {CityId} from '../formal/ids';
import {constructionPreviewContext} from '../constructionPreviewContext';
import {constructionPreviews} from '../constructionPreviewController';
import {PREVIEW_PROTOCOL,type PreviewTarget,type PreviewResponse} from '../constructionPreviewProtocol';
export const PreviewBranchContext=createContext('standalone');
let channels=0,requests=0;
/** No quote, clone, settlement or canonical world serialization during render. */
export function useConstructionPreviews(world:FormalWorld,cityId:CityId|undefined,targets:PreviewTarget[]){
 const branch=useContext(PreviewBranchContext),[channel]=useState(()=>++channels),generation=useRef(0),coalesceAt=useRef(0),[attempt,retry]=useState(0);
 const targetKey=JSON.stringify(targets),identity=JSON.stringify([world.campaignId,branch,world.revision,cityId,targetKey,attempt]);
 const [state,setState]=useState<{identity:string;response?:PreviewResponse;error?:string}>();
 useEffect(()=>{
  const gen=++generation.current;let live=true;
  if(!cityId||!targets.length)return;
  // Coalesce revision bursts and all candidates of the current panel.
  coalesceAt.current ||= Date.now();
  const delay=Math.max(0,Math.min(80,250-(Date.now()-coalesceAt.current)));
  const timer=setTimeout(()=>{
   coalesceAt.current=0;
   try{
    const request={protocolVersion:PREVIEW_PROTOCOL,campaignId:world.campaignId,branch,revision:world.revision,cityId,requestId:++requests,generation:gen,context:constructionPreviewContext(world,cityId),targets};
    constructionPreviews.request(channel,request,response=>{if(live&&generation.current===gen)setState({identity,response});},error=>{if(live&&generation.current===gen)setState({identity,error:error.message});});
   }catch(e){if(live)setState({identity,error:e instanceof Error?e.message:'無法提供最新預估。'});}
  },delay);
  return()=>{live=false;clearTimeout(timer);constructionPreviews.cancel(channel);};
 // targetKey describes the bounded list; authoritative revision/branch identify the snapshot.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[world,cityId,targetKey,branch,channel,attempt,identity]);
 const current=state?.identity===identity?state:undefined;
 const unavailable=current?.response?.results.find(r=>r.status==='unavailable');
 const error=current?.error??(unavailable&&unavailable.status!=='ready'?unavailable.reason:undefined);
 const status=!cityId||!targets.length?'idle':error?'unavailable':current?.response?'ready':state?'stale':'loading';
 return {status,results:current?.response?.results??[],error,retry:()=>retry(n=>n+1)};
}
export function PreviewStatus({preview}:{preview:ReturnType<typeof useConstructionPreviews>}){
 if(preview.status==='idle')return null;
 return <p role="status" className="construction-preview-status">{preview.status==='ready'?'預覽已更新；正式提交時仍會重新驗證。':preview.status==='loading'?'預覽計算中…':preview.status==='stale'?'預覽已過期，重新計算中…':`暫時無法預估。${preview.error??''}`}{preview.status==='unavailable'&&<button onClick={preview.retry}>重新查詢預覽</button>}</p>;
}
