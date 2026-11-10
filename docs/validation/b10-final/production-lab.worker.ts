// Synthetic data only; bundled separately and never shipped with the product.
import {FormalPersistence} from '../../../src/game/persistence';
import {projectionSyntheticWorld} from '../../../src/game/formal/projectionBenchmarkSupport';
import {commandHistory,worldLedger} from '../../../src/game/formal/commandLedger';
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage=async event=>{
 const p=new FormalPersistence();
 try{
  const data=event.data;
  let w;
  if(data.action==='seed'){
   await p.acquireWriter();w=await p.start(await projectionSyntheticWorld(data.count));
  }else w=(await p.loadSave()).game;
  if(!w)throw Error('No synthetic campaign');
  const statuses=[];
  for(const id of data.ids??[])statuses.push(await p.commandStatus(w.campaignId,id));
  const proof=worldLedger(w);
  scope.postMessage({campaignId:w.campaignId,revision:w.revision,time:w.time,
   root:proof.manifest.checksum,history:proof.count,identities:await p.db.table('LedgerIdentity').count(),
   schema:p.db.verno,metadata:w.metadata,name:w.cities[0].name,
   statuses,effects:Object.fromEntries((data.ids??[]).map((id:string)=>[id,commandHistory(w).filter(r=>r.commandId===id).length])),
   storage:await navigator.storage.estimate()});
 }catch(error){scope.postMessage({error:String(error)});}
 finally{p.db.close();}
};
scope.postMessage({booted:true});
