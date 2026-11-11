import {PresentationStoreContext} from '../usePresentation';
import type {WorldRead} from '../presentationModel';
import {createContext,useContext,useEffect,useRef,useState,useCallback,useSyncExternalStore} from 'react';
import type {CityId} from '../formal/ids';
import {constructionPreviewContext} from '../constructionPreviewContext';
import {constructionDependencyKey,translatePreviewResults} from '../constructionPreviewDependencies';
import {constructionPreviews} from '../constructionPreviewController';
import {PREVIEW_PROTOCOL,type PreviewTarget,type PreviewContext,type PreviewResult} from '../constructionPreviewProtocol';
export const PreviewBranchContext=createContext('standalone');
let channels=0,requests=0;
type Checked={scope:string;key:string;world:WorldRead;context:PreviewContext;generation:number;timer?:ReturnType<typeof setTimeout>;results?:PreviewResult[]};
type State={scope:string;key:string;world:WorldRead;results?:PreviewResult[];displayResults:PreviewResult[];error?:string};
/** No quote, clone, settlement or canonical world serialization during render. */
export function useConstructionPreviews(renderedWorld:WorldRead,cityId:CityId|undefined,targets:PreviewTarget[]){
 const store=useContext(PresentationStoreContext),active=!!cityId&&targets.length>0,get=useCallback(()=>active?store?.getWorld()??renderedWorld:renderedWorld,[active,store,renderedWorld]),world=useSyncExternalStore(store?.subscribe??(()=>()=>{}),get,get);
 const branch=useContext(PreviewBranchContext),[channel]=useState(()=>++channels),generation=useRef(0),coalesceAt=useRef(0),[attempt,retry]=useState(0);
 const targetKey=JSON.stringify(targets),scope=JSON.stringify([world.campaignId,branch,cityId,targetKey,attempt]);
 const checked=useRef<Checked|undefined>(undefined),failure=useRef<{scope:string;error:string}|undefined>(undefined);
 const [state,setState]=useState<State>();
 // Scope changes/unmount cancel ownership. Revision updates do not cancel useful work.
 useEffect(()=>()=>{if(checked.current?.timer)clearTimeout(checked.current.timer);checked.current=undefined;constructionPreviews.cancel(channel);},[scope,channel]);
 useEffect(()=>{
  if(!cityId||!targets.length||failure.current?.scope===scope)return;
  const fail=(error:string)=>{failure.current={scope,error};setState(s=>({scope,key:checked.current?.key??'',world,displayResults:s?.scope===scope?s.displayResults:[],error}));};
  try{
   // Settle only this city outside render. Compare actual integer stock and every
   // admission/scheduling dependency, not the revision or lazy-settlement metadata.
   const context=constructionPreviewContext(world,cityId),key=constructionDependencyKey(context,targets,true),prior=checked.current;
   if(prior?.scope===scope&&prior.key===key){
    if(prior.results)prior.results=translatePreviewResults(prior.results,prior.context.time,context);
    prior.world=world;prior.context=context;
    if(prior.results)setState({scope,key,world,results:prior.results,displayResults:prior.results});
    return;
   }
   if(prior?.timer)clearTimeout(prior.timer);
   constructionPreviews.cancel(channel);
   const current:Checked={scope,key,world,context,generation:++generation.current};checked.current=current;
   setState(s=>({scope,key,world,displayResults:s?.scope===scope?s.displayResults:[]}));
   coalesceAt.current ||= Date.now();
   const delay=Math.max(0,Math.min(80,250-(Date.now()-coalesceAt.current)));
   current.timer=setTimeout(()=>{
    current.timer=undefined;coalesceAt.current=0;
    if(checked.current!==current)return;
    const sent=current.context;
    const request={protocolVersion:PREVIEW_PROTOCOL,campaignId:current.world.campaignId,branch,revision:current.world.revision,cityId,requestId:++requests,generation:current.generation,context:sent,targets};
    constructionPreviews.request(channel,request,response=>{
     if(checked.current!==current)return;
     const unavailable=response.results.find(r=>r.status==='unavailable');
     if(unavailable&&unavailable.status!=='ready'){fail(unavailable.reason);return;}
     current.results=translatePreviewResults(response.results,sent.time,current.context);
     setState({scope,key,world:current.world,results:current.results,displayResults:current.results});
    },error=>{if(checked.current===current)fail(error.message);});
   },delay);
  }catch(e){fail(e instanceof Error?e.message:'無法提供最新預估。');}
 // targetKey describes the bounded list. New world snapshots are checked outside render.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[world,cityId,targetKey,branch,channel,scope]);
 const scoped=state?.scope===scope?state:undefined,current=scoped?.world===world?scoped:undefined;
 const error=(failure.current?.scope===scope?failure.current.error:undefined)??scoped?.error;
 const status=!active?'idle':error?'unavailable':current?.results?'ready':scoped?.displayResults.length?'stale':'loading';
 // A retained estimate is display-only. A new unchecked world never exposes an old
 // Ready Quote as a current result; all commands still go through Runtime admission.
 return {status,results:current?.results??[],displayResults:scoped?.displayResults??[],error,retry:()=>retry(n=>n+1)};
}
export function PreviewStatus({preview}:{preview:ReturnType<typeof useConstructionPreviews>}){
 if(preview.status==='unavailable')return <p role="alert" className="construction-preview-status">暫時無法預估。{preview.error??''}<button onClick={preview.retry}>重新查詢預覽</button></p>;
 if(preview.status==='loading'&&!preview.displayResults.length)return <p role="status" className="construction-preview-status">正在取得施工時間…</p>;
 // Costs, missing resources and qualifications already have dedicated live UI.
 // Routine recalculation has no player action and must not announce internal states.
 return null;
}
