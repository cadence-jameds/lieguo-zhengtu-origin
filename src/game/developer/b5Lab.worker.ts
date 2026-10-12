/// <reference lib="webworker" />
import {B5LabSession,type LabConfig} from './B5Lab';
import type {FormalCommand} from '../formal/model';
import type {RuntimeRequest} from '../runtime.worker';
export type LabRequest=({type:'open'|'reset';config:LabConfig}|{type:'order';payload:FormalCommand}|{type:'incoming';targetCityId:string;mission:'raid'|'conquest';units:Record<string,number>}|{type:'advance';worldMs?:number}|{type:'reload'|'export'}|{type:'import';text:string}|Extract<RuntimeRequest,{type:'reportPage'|'reportAction'|'cityIntel'}>)&{requestId:string};
const session=new B5LabSession();let queue:Promise<unknown>=Promise.resolve();
async function handle(r:LabRequest){
 if(r.type==='open'||r.type==='reset')await session[r.type](r.config);
 else if(r.type==='order')await session.order(r.payload);
 else if(r.type==='incoming')await session.incoming(r.targetCityId,r.mission,r.units);
 else if(r.type==='advance')await session.advance(r.worldMs);
 else if(r.type==='reload')await session.reload();
 else if(r.type==='import')await session.import(r.text);
 else if(r.type==='export'){self.postMessage({type:'export',text:await session.export()});return;}
 else if(r.type==='cityIntel'){if(!session.world||r.campaignId!==session.world.campaignId)throw Error('測試戰役已變更。');const w=session.world;self.postMessage({type:'cityIntel',queryId:r.queryId,data:await session.store.readCityIntel({...w,time:Math.min(w.time,r.time),sequences:{...w.sequences,report:Math.min(w.sequences.report,r.reportCursor)}},r.cityId,r.generation)});return;}
 else if(r.type==='reportPage'){if(!session.world)throw Error('尚未建立測試情境。');self.postMessage({type:'reportPage',data:await session.store.readReportPage(session.world,r.page,r.filter)});return;}
 else if(r.type==='reportAction'){if(!session.world)throw Error('尚未建立測試情境。');self.postMessage({type:'reportStatus',data:await session.store.reportAction(session.world,r.action,r.ids,r.filter)});return;}
 else throw Error('測試台不支援此操作。');
 self.postMessage({type:'state',world:session.world});self.postMessage({type:'reportStatus',data:await session.store.reportStatus(session.world!)});
}
self.onmessage=(e:MessageEvent<LabRequest>)=>{const r=e.data;queue=queue.then(()=>handle(r)).catch(error=>self.postMessage({type:'error',text:error instanceof Error?error.message:'測試操作失敗。',queryId:r.type==='cityIntel'?r.queryId:undefined})).finally(()=>self.postMessage({type:'done',requestId:r.requestId}));};
