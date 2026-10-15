import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
const metrics=new Map(),stack=[];
let peak={rss:0,heapUsed:0,heapTotal:0,external:0,arrayBuffers:0},eventCount=0,eventOrder=createHash('sha256'),pausedMs=0;
function sampleMemory(){const m=process.memoryUsage();for(const k in peak)peak[k]=Math.max(peak[k],m[k]);}
function begin(key){const token={key,start:performance.now(),pausedAtStart:pausedMs,child:0};stack.push(token);return token;}
function end(token){const rawElapsed=performance.now()-token.start,pause=pausedMs-token.pausedAtStart,elapsed=Math.max(0,rawElapsed-pause);
 if(stack.pop()!==token)throw new Error('Profiling stack mismatch at '+token.key);
 if(stack.length)stack[stack.length-1].child+=elapsed;
 let m=metrics.get(token.key);if(!m){m={count:0,totalMs:0,rawTotalMs:0,pausedExcludedMs:0,selfMs:0,maxMs:0};metrics.set(token.key,m);}
 m.count++;m.totalMs+=elapsed;m.rawTotalMs+=rawElapsed;m.pausedExcludedMs+=pause;m.selfMs+=Math.max(0,elapsed-token.child);m.maxMs=Math.max(m.maxMs,elapsed);return elapsed;
}
function endEvent(token){const duration=end(token);eventCount++;if(eventCount%32===0)sampleMemory();return duration;}
function eventBegin(event){eventOrder.update(event.id+'\0'+event.type+'\0'+event.at+'\n');return begin('event.'+event.type);}
function recordEvent(event){eventOrder.update(event.id+'\0'+event.type+'\0'+event.at+'\n');eventCount++;const key='event.'+event.type;let m=metrics.get(key);if(!m){m={count:0,totalMs:null,selfMs:null,maxMs:null};metrics.set(key,m);}m.count++;if(eventCount%32===0)sampleMemory();}
async function pauseIfRequested(){const marker=process.env.P0_PAUSE_FILE;if(!marker||!fs.existsSync(marker))return;const start=performance.now();console.log(JSON.stringify({pause:'started',events:eventCount}));while(fs.existsSync(marker))await new Promise(resolve=>setTimeout(resolve,100));const duration=performance.now()-start;pausedMs+=duration;console.log(JSON.stringify({pause:'resumed',pausedMs:duration,events:eventCount}));}
function receiptLookup(array,method,predicate){const t=begin('receiptLookup.'+method);try{return array[method](predicate);}finally{end(t);}}
const clone=globalThis.structuredClone.bind(globalThis),stringify=JSON.stringify.bind(JSON);
function installGlobals(){
 globalThis.structuredClone=function(value,options){const kind=value?.kind==='formal'?(value?.worldLayer?.terrain!==undefined||value?.fixture===true?'worldFull':'worldDraft'):value?.city?.id&&value?.sequences?'cityDraft':value?.type&&value?.at!==undefined?'event':value?.commandId?'receiptOrOrder':'other';const t=begin('structuredClone.'+kind);try{return clone(value,options);}finally{end(t);}};
 JSON.stringify=function(value,...args){if(value===null||typeof value!=='object')return stringify(value,...args);const t=begin('JSON.stringify.object');try{return stringify(value,...args);}finally{end(t);}};
}
function snapshot(){sampleMemory();return {metrics:Object.fromEntries([...metrics].map(([k,m])=>[k,{...m,avgMs:m.totalMs===null?null:m.totalMs/m.count}])),eventCount,eventOrderHash:eventOrder.copy().digest('hex'),pausedMs,peakMemoryBytes:{...peak}};}
function reset(){if(stack.length)throw new Error('Cannot reset active profile');metrics.clear();eventCount=0;pausedMs=0;eventOrder=createHash('sha256');peak={rss:0,heapUsed:0,heapTotal:0,external:0,arrayBuffers:0};sampleMemory();}
export const profiler={begin,end,eventBegin,endEvent,recordEvent,pauseIfRequested,receiptLookup,sampleMemory,snapshot,reset,installGlobals};
globalThis.__p0=profiler;
