import {commandId} from './ids';
import {fixtureIds} from './fixture';
import type {FormalCommand,FormalOrder,FormalWorld} from './model';
export function order(w:FormalWorld,key:string,payload:FormalCommand):FormalOrder {
 return{commandId:commandId(key),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload};
}
export const contribute=(w:FormalWorld,key:string,amount=100)=>order(w,key,{type:'research.contribute',projectId:fixtureIds.research,cityId:fixtureIds.home,resources:{food:amount,wood:amount,stone:amount,gold:amount}});
