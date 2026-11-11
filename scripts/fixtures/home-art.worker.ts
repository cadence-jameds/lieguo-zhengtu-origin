// Synthetic browser validation only; never imported by the playable app.
import {createFormalWorld} from '../../src/game/world';
import {encodeSave} from '../../src/game/formal/saveCodec';
import {firstScreenArt} from '../../src/game/presentation/artInventory';
self.onmessage=async e=>{
 try{
  if(e.data.action==='required'){const w=e.data.world;self.postMessage({result:firstScreenArt(w,w.cities.find((c:{ownerFactionId:string})=>c.ownerFactionId===w.playerFactionId))});return;}
  const w=createFormalWorld({campaign:crypto.randomUUID(),seed:884422,speed:3,name:'盾牌驗證領主',civilizationId:'civ_zhongguo',offlineHours:0}),f=w.factions.find(f=>f.id===w.playerFactionId)!;
  if(e.data.action==='short')f.protectionUntil=w.time+60000;
  if(e.data.action==='rebirth')f.protectionKind='rebirth';
  if(e.data.action==='expired')f.protectionUntil=w.time;
  if(e.data.action==='early'){f.protectionUntil=w.time;f.protectionEnded={at:w.time,reason:'偵察其他領主城市'};}
  self.postMessage({result:await encodeSave(w)});
 }catch(e){self.postMessage({error:String(e)});}
};
