// Synthetic native-IDB setup/readback only. Never bundled into the game.
import {FormalPersistence} from '../../src/game/persistence';
import {createFormalWorld} from '../../src/game/world';
import {encodeSave} from '../../src/game/formal/saveCodec';
import {digest} from '../../src/game/formal/canonical';
import {FORMAL_WRITER_LOCK} from '../../src/game/formal/versions';
const raw=(p:FormalPersistence)=>Promise.all(p.db.tables.map(async t=>[t.name,await t.toArray()]));
self.onmessage=async e=>{
 const {action}=e.data;
 try{
  if(action==='read'){const p=new FormalPersistence();try{self.postMessage({result:{hash:await digest(await raw(p)),current:await p.db.saves.get('current'),sourceHash:await digest(await p.db.saves.get('current')??null)}});}finally{p.db.close();}return;}
  const result=await navigator.locks.request(FORMAL_WRITER_LOCK,{ifAvailable:true},async lock=>{
   if(!lock)throw Error('writer lock unavailable');let fail=false;const p=new FormalPersistence({fault:point=>{if(fail&&point==='world-write')throw new DOMException('injected native quota','QuotaExceededError');}});
   try{
    if(action==='read')return{hash:await digest(await raw(p)),current:(await p.db.saves.get('current'))};
    const world=createFormalWorld({campaign:crypto.randomUUID(),seed:90217,speed:1,name:'合成舊領主',civilizationId:'civ_zhongguo',offlineHours:0});
    if(action==='legacy'){
     const row={id:'current',kind:'world',at:Date.now(),data:await encodeSave(world)};
     const name='lieguo-formal-ledger-v1',request=indexedDB.open(name,1);
     await new Promise<void>((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('saves',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({...row,data:{...row.data,format:'lieguo-formal-ledger-save-v1'}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
     return{campaign:world.campaignId};
    }
    await p.acquireWriter();const w=await p.start(world);
    const row=await p.db.saves.get('current');if(row?.kind!=='world')throw Error('seed did not commit');
    if(action==='incompatible'||action==='corrupt'||action==='atomic-failure'){
     Object.assign(row.data.snapshot.metadata,{contentVersion:'older-synthetic-content'});row.data.metadata={...row.data.snapshot.metadata};row.data.checksum=await digest(row.data.snapshot);
     const authority=await p.db.saves.get('authority') as any;authority.worldChecksum=row.data.checksum;const {checksum:_,...body}=authority;authority.checksum=await digest(body);
     if(action==='corrupt')row.data.snapshot.cities[0].stock.food++;
     await p.db.transaction('rw',p.db.saves,()=>p.db.saves.bulkPut([row,authority]));
    }
    if(action==='atomic-failure'){
     const token=await p.incompatibleStartToken(),before=await digest(await raw(p));fail=true;let rejected=false;
     try{await p.start(createFormalWorld({campaign:crypto.randomUUID(),seed:884422,speed:25,name:'故障新局',offlineHours:0}),token);}catch{rejected=true;}
     const after=await digest(await raw(p));if(!rejected||before!==after)throw Error('native start did not roll back');return{rejected,unchanged:before===after};
    }
    return{campaign:w.campaignId,hash:await digest(await raw(p)),sourceHash:await digest(await p.db.saves.get('current'))};
   }finally{p.db.close();}
  });
  self.postMessage({result});
 }catch(error){self.postMessage({error:String(error)});}
};
