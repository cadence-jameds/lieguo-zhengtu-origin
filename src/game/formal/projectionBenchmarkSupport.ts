import {prepareAdmissionMap} from '../admissionMap';
/** Legal synthetic read fixtures only. RAM binding is not a DB T2 and no player
 * save is loaded. Native Runtime acceptance seeds these through FormalPersistence. */
import {createFormalWorld} from './generator';
import {bindLedger,emptyVerifiedLedger,prepareVerifiedLedger,pendingHistory,worldLedger} from './commandLedger';
import type {FormalWorld,CommandReceipt} from './model';
import {canonicalJSON} from './canonical';
import {cloneWorldDraft} from './worldDraft';
export async function sealProjectionScenario(world:FormalWorld){
 const base=world.ledger?worldLedger(world):await emptyVerifiedLedger(world.campaignId),rows=world.ledger?pendingHistory(world):world.commandReceipts;
 const original=rows.filter(r=>!base.result(r.commandId)).map(r=>({commandId:r.commandId,issuerId:r.issuerId,fingerprint:r.fingerprint,state:'committed' as const,ack:{commandId:r.commandId,status:'committed' as const,revision:r.committedRevision}}));
 const proof=await prepareVerifiedLedger(base,rows,[...(world.ledger?.outcomes??[]),...original],world.revision,base.manifest.branch,base.manifest.writerEpoch);const result=bindLedger(cloneWorldDraft(world),proof);await prepareAdmissionMap(result);return result;
}
export async function projectionSyntheticWorld(count:number){
 const world=createFormalWorld({campaign:'projection-benchmark-'+count,seed:90217,speed:25}),cities=new Map(world.cities.map(c=>[c.ownerFactionId,c]));world.revision=2;
 world.commandReceipts=Array.from({length:count},(_,i):CommandReceipt=>{const issuer=world.factions[i%world.factions.length].id;return {commandId:('command:projection-seed-'+String(i).padStart(6,'0')) as CommandReceipt['commandId'],issuerId:issuer,committedRevision:1,disposition:'rolled-back',fingerprint:canonicalJSON({campaignId:world.campaignId,issuerId:issuer,payload:{type:'city.rename',cityId:cities.get(issuer)!.id,name:'合成'+i}})};});
 return sealProjectionScenario(world);
}
