import {forwardRef,useImperativeHandle,useState,type ReactNode} from 'react';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {recruitmentConditions,recruitmentPreview} from './cityActions';
import {Art} from './Art';
import {unitArt,LABELS} from './artMap';
import {Cost,fmt,realTime} from './UI';
import {Countdown} from './LiveValues';
export function parseRecruitCount(raw:string){if(!/^\d+$/.test(raw))return undefined;const n=Number(raw);return Number.isSafeInteger(n)&&n>=1&&n<=100000?n:undefined;}
export type RecruitAmountHandle={raw:string;setRaw:(raw:string)=>void};
/** Keyboard edits stay inside this subtree, including empty/zero-prefixed drafts. */
export const RecruitAmount=forwardRef<RecruitAmountHandle,{label:string;initial?:string;onRawChange?:(raw:string)=>void;children?:(raw:string,validate:()=>number|undefined,input:ReactNode)=>ReactNode}>(function RecruitAmount({label,initial='1',onRawChange,children},ref){
 const [raw,setRaw]=useState(initial),[error,setError]=useState(false);
 useImperativeHandle(ref,()=>({raw,setRaw}),[raw]);
 const validate=()=>{const n=parseRecruitCount(raw);setError(n===undefined);return n;};
 const input=<><label className="recruit-amount">{label==='每批招募人數'?'每批人數':label}<input aria-label={label} type="text" inputMode="numeric" autoComplete="off" value={raw} onChange={e=>{setRaw(e.target.value);setError(false);onRawChange?.(e.target.value);}}/></label>{error&&<p role="alert">請輸入1～100000名的整數。</p>}</>;return children?children(raw,validate,input):input;
});
export function RecruitmentForm({world,city,unitId,busy,issue,initial='1',onRawChange,onRecruited,description}:{world:FormalWorld;city:FormalCity;unitId:string;busy:boolean;issue:(p:FormalCommand)=>void;initial?:string;onRawChange?:(raw:string)=>void;onRecruited:()=>void;description?:string}){
 return <RecruitAmount label="招募數量" initial={initial} onRawChange={onRawChange}>{(raw,validate,input)=>{
  const count=parseRecruitCount(raw),info=recruitmentConditions(world,city,unitId,count??1),preview=count===undefined?undefined:recruitmentPreview(world,city,unitId,count),d=info.d;
  return <div className="catalog-detail"><Art spec={unitArt(d.id)} label={d.name}/>{description&&<p>{description}</p>}<div className="unit-stats">攻 {d.attack} · 近防 {d.meleeDefense} · 遠防 {d.rangedDefense} · 速 {d.secondsPerTile}秒／格</div><p>本城駐軍 {fmt((city.military?.units[unitId]??0)+(d.id!==unitId?city.military?.units[d.id]??0:0))} · 每名軍糧 {d.upkeepPerHour}/世界時</p>{d.id!==unitId&&<p>本城已符合精銳資格，將招募 {d.name}。</p>}{input}<details className="unit-cost-detail"><summary>每名花費</summary><Cost cost={info.unitCost}/></details>{count===undefined?<p>輸入數量後顯示本批費用與預估時間。</p>:<><p>本批人口 {info.population} · 徵兵後居民 {fmt(Math.max(0,city.population-info.population))}</p><Cost cost={info.cost} stock={city.stock}/><p>訓練 {realTime(info.durationMs*count,world)} · 生產建築 {LABELS[d.producer]}{preview&&<> · 預估開始 {<Countdown at={preview.startsAt} world={world}/>} · 含排隊完成 {<Countdown at={preview.nextAt+(preview.remaining-1)*preview.durationMs} world={world}/>}</>}</p><p>{info.reasons.join('、')}</p></>}<div className="dialog-actions"><button className="primary" disabled={busy||(count!==undefined&&(info.reasons.length>0||!preview))} onClick={()=>{const n=validate();if(n===undefined)return;issue({type:'military.recruit',cityId:city.id,unitId,count:n});onRecruited();}}>招募 {count??''} 名</button></div></div>;
 }}</RecruitAmount>;
}
