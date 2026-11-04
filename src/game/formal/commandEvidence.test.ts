import {commandId} from './ids';
import {expect,it} from 'vitest';
import {validateFormalWorld} from './schema';
import {createFormalFixture} from './fixture';
import {commandEffectCount,ensureCommandFacts,observeCommandEvidence,pruneCommandEvidence} from './commandEvidence';
import {canonicalJSON} from './canonical';
import type {CommandReceipt} from './model';
it('effect accounting uses applied effects consistently before and after evidence is first initialized',()=>{
 const w=createFormalFixture(),receipt=(id:string,disposition:'applied'|'rolled-back'):CommandReceipt=>({commandId:commandId(id),issuerId:w.playerFactionId,committedRevision:0,disposition,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'city.rename',cityId:w.cities[0].id,name:'領域計數'}})});
 w.commandReceipts=Array.from({length:1000},(_,i)=>receipt('retired-'+i,'rolled-back'));const before=commandEffectCount(w);expect(before).toBe(0);observeCommandEvidence(w,receipt('new','applied'));expect(commandEffectCount(w)-before).toBe(1);pruneCommandEvidence(w);expect(commandEffectCount(w)).toBe(1);
});
it('domain provenance stores only whitelisted rule evidence and keeps governance ABA after unused history is retired',()=>{
 const w=createFormalFixture(),facts=ensureCommandFacts(w),id=commandId('governance-write'),r:CommandReceipt={commandId:id,issuerId:w.playerFactionId,committedRevision:0,disposition:'applied',fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:w.playerFactionId,payload:{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'economy',budget:2400,reserve:180}})};
 observeCommandEvidence(w,r);pruneCommandEvidence(w);expect(facts.governance[w.cities[0].id]).toEqual([id,0]);expect(facts.evidence[id].payload).toEqual({type:'governance.set',cityId:w.cities[0].id});expect(facts.evidence[id]).not.toHaveProperty('fingerprint');expect(facts.evidence[id]).not.toHaveProperty('ack');
});
it('domain schema rejects a forged ABA stamp or evacuation issuer even if the JSON remains structurally valid',()=>{
 const w=createFormalFixture();ensureCommandFacts(w);w.commandFacts!.governance[w.cities[0].id]=[commandId('missing'),0];expect(()=>validateFormalWorld(w)).toThrow('Governance ABA');delete w.commandFacts!.governance[w.cities[0].id];w.commandFacts!.origins[w.playerFactionId]=commandId('missing');expect(()=>validateFormalWorld(w)).toThrow('Evacuation source');
});
