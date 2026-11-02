import type {WorldRead} from './presentationModel';
import {equalData} from './projectionProtocol';
import {digest} from './formal/canonical';
/** A deterministic reference to the static map intent inputs, not authority.
 * Prepared once at load/branch changes; normal T1 never waits for this crypto.
 * Pending v2 intents reconstruct the same reference after a Worker restart. */
export const mapIntentData=(world:Pick<WorldRead,'worldLayer'>)=>[1,world.worldLayer?.terrain??null,world.worldLayer?.mountains??null] as const;
let prepared:{data:ReturnType<typeof mapIntentData>;digest:string}|undefined;
export async function prepareAdmissionMap(world:Pick<WorldRead,'worldLayer'>){
 const data=mapIntentData(world);if(prepared&&equalData(prepared.data,data))return prepared.digest;
 const owned=structuredClone(data),value=await digest(owned);prepared={data:owned,digest:value};return value;
}
export function admissionMapDigest(world:Pick<WorldRead,'worldLayer'>){return prepared&&equalData(prepared.data,mapIntentData(world))?prepared.digest:undefined;}
