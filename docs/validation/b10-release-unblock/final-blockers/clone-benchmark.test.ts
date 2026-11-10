import {it,expect} from 'vitest';
import fs from 'node:fs';
import {fundWonder,wonderWorld} from '../../../../src/game/formal/wonderTestSupport';
import {scenarioBinding} from '../../../../src/game/formal/ledgerTestSupport';
import {hotWorld} from '../../../../src/game/formal/commandLedger';
import {canonicalJSON} from '../../../../src/game/formal/canonical';
import {plainCloneCandidate} from './plain-clone-candidate';
it('compares actual 800-trip parsed engineering state without replacing the original B9 workload',async()=>{
 const w=await scenarioBinding(fundWonder(wonderWorld())),body=hotWorld(w),expected=canonicalJSON(body),rows=[];
 for(let i=0;i<20;i++)for(const which of i%2?['candidate','native']:['native','candidate']){const at=performance.now(),copy=which==='native'?structuredClone(body):plainCloneCandidate(body);const ms=performance.now()-at;expect(canonicalJSON(copy)).toBe(expected);rows.push({which,ms});}
 const stats=(name:string)=>{const a=rows.filter(x=>x.which===name).map(x=>x.ms).sort((a,b)=>a-b);return{n:a.length,p50:a[9],p95:a[18]};};
 fs.mkdirSync('artifacts/b10-final-blockers',{recursive:true});fs.writeFileSync('artifacts/b10-final-blockers/clone-candidate.json',JSON.stringify({status:'diagnostic only',note:'Actual 800 paid wonder trips for clone shape comparison; original B9 2000-trip and 240s test untouched. Not proof of replacing structuredClone on arbitrary input graphs.',shipments:w.largeProjects[0].shipments.length,facts:Object.keys(w.commandFacts!.evidence).length,bytes:expected.length,native:stats('native'),candidate:stats('candidate'),rows},null,2));
},30000);
it('exposes the unsupported Proxy rejection contract instead of silently approving a faster clone',()=>{
 const value=new Proxy({nested:{x:1}},{});expect(()=>structuredClone(value)).toThrow();expect(plainCloneCandidate(value)).toEqual({nested:{x:1}});
});
