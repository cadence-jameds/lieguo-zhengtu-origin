import {prepare, measure, cleanup} from './lab.mjs';

let finishTiming;
self.onmessage = async ({data}) => {
  if (data.action === 'timingAck') {finishTiming?.(); return;}
  try {
    if (data.action === 'ping') {postMessage({type: 'pong', sentAt: data.sentAt}); return;}
    if (data.action === 'prepare') postMessage({type: 'result', value: await prepare(data.options, data.text)});
    else if (data.action === 'cleanup') {await cleanup(data.prepared); postMessage({type: 'result', value: true});}
    else if (data.action === 'measure') {
      const cpu = {start: async () => postMessage({type: 'timing-start'}), stop: async () => {
        postMessage({type: 'timing-stop'});
        if (data.waitForTimingAck) await new Promise(resolve => {finishTiming = resolve;});
      }};
      let lastEvents = 0;
      const value = await measure(data.prepared, data.options, events => {
        if (Number.isInteger(events) && events - lastEvents >= 10000) {lastEvents = events; postMessage({type: 'progress', events});}
      }, cpu);
      if (value.source === 'private-local-backup') {
        if (data.requestPrivateProof) value.privateProof = {eventOrderChecksum: value.statistics.eventOrderChecksum, fingerprints: value.equivalence.fingerprints};
        delete value.snapshotChecksum; delete value.equivalence.fingerprints;
        value.worldAgeDaysAtStart = Math.round(value.worldStart / 864000) / 100; delete value.worldStart;
        delete value.statistics.eventOrderChecksum;
        for (const checkpoint of Object.values(value.checkpoints)) delete checkpoint.eventOrderChecksum;
        value.scenario = 'private-local-backup'; delete value.aiRequested;
        delete value.requestedCities; delete value.requestedLedger;
      }
      postMessage({type: 'result', value});
    }
  } catch (error) {postMessage({type: 'error', code: error?.message === 'Profiler spans overlap' ? 'PROFILER_SPAN_OVERLAP' : 'BENCHMARK_FAILED_SOURCE_UNCHANGED'});}
};
postMessage({type: 'ready'});
