// Real reducer paths; Node timings are diagnosis, not device latency/SLA.
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {PerformanceObserver} from 'node:perf_hooks';
import {runtimeProfilePlugin} from './runtime-profile-plugin.mjs';
const phases={},gc=[];globalThis.__runtimeProfileRecord=(key,ms)=>{const s=phases[key]??={calls:0,ms:0,max:0,samples:[]};s.calls++;s.ms+=ms;s.max=Math.max(s.max,ms);if(s.samples.length<20000)s.samples.push(ms);};
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({ms:e.duration,kind:e.detail.kind});});observer.observe({entryTypes:['gc']});
const server=await createServer({plugins:[runtimeProfilePlugin()],server:{middlewareMode:true,hmr:false}}),rows=[];
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts'),{enableAutonomy}=await server.ssrLoadModule('/src/game/formal/autonomy.ts'),{advanceFormalCooperative}=await server.ssrLoadModule('/src/game/formal/reducer.ts'),{encodeScenario}=await server.ssrLoadModule('/src/game/formal/ledgerTestSupport.ts'),{decodeSave}=await server.ssrLoadModule('/src/game/formal/saveCodec.ts');
 for(const scenario of (process.env.B10_PROFILE_SCENARIOS??'first-decision,simultaneous-99,legacy-30-day').split(',')){
  let w=createFormalWorld({campaign:'r306-profile-'+scenario,seed:90217,speed:25});enableAutonomy(w);
  if(scenario==='legacy-30-day'){for(const f of w.factions)f.protectionUntil=0;for(const a of w.autonomy.agents){a.nextAt+=30*86400000;const e=w.events.find(e=>e.id===a.eventId);if(e)e.at=a.nextAt;}}
  if(scenario==='simultaneous-99'){for(const a of w.autonomy.agents)a.nextAt=200000;for(const e of w.events)if(e.type==='ai.decide')e.at=200000;}
  w=(await decodeSave(await encodeScenario(w))).world;
  const target=scenario!=='simultaneous-99'?Math.ceil(Math.min(...w.events.filter(e=>e.type==='ai.decide').map(e=>e.at))/25)*25+25:200000;
  for(const k of Object.keys(phases))delete phases[k];const before=process.memoryUsage(),g=gc.length,at=performance.now();let yields=0,processed=0;
  const result=await advanceFormalCooperative(w,target,(_t,_end,n)=>{yields++;processed=n;},{yieldIntervalMs:8});
  const row={scenario,target,ms:performance.now()-at,processed,yields,phases:structuredClone(phases),before,after:process.memoryUsage(),gc:gc.slice(g),accepted:result.world.autonomy.accepted,rejected:result.world.autonomy.rejected,decisions:result.world.autonomy.agents.reduce((n,a)=>n+a.decisions,0)};rows.push(row);console.log(scenario,row.ms.toFixed(1),'events',processed,'decisions',row.decisions);
 }
 await fs.mkdir('artifacts/b10-r3-06',{recursive:true});await fs.writeFile(process.env.B10_PROFILE_OUT??'artifacts/b10-r3-06/profile-before.json',JSON.stringify({environment:'Node '+process.version+' / Vite SSR / CPU2; inclusive instrumented phases, not native latency',rows},null,2));
}finally{observer.disconnect();delete globalThis.__runtimeProfileRecord;await server.close();}
