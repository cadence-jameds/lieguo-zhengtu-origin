import fs from 'node:fs';

const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath)throw new Error('Usage: node scripts/p0-profile-compare.mjs <before-metrics> <after-metrics>');
const before=JSON.parse(fs.readFileSync(beforePath,'utf8')),after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clockKeys=['hours','speed','savedAt','now','offlineCapHours'];
const configurationMatches=clockKeys.every(k=>before.configuration[k]===after.configuration[k]);
const instrumentedOrdering=(before.environment.instrumentation||before.source.recordEvents)&&(after.environment.instrumentation||after.source.recordEvents);
const checks={
 configuration:configurationMatches?'PASS':'FAIL',
 inputWorld:before.consistency.inputHash===after.consistency.inputHash?'PASS':'FAIL',
 outputWorld:before.consistency.worldHash===after.consistency.worldHash?'PASS':'FAIL',
 reportHistory:before.consistency.reportHistoryHash===after.consistency.reportHistoryHash?'PASS':'FAIL',
 processedEventCount:before.processedEvents===after.processedEvents?'PASS':'FAIL',
 eventOrdering:instrumentedOrdering?(before.consistency.eventOrderHash===after.consistency.eventOrderHash?'PASS':'FAIL'):'SKIP',
 eventTypeCounts:instrumentedOrdering?(equal(counts(before.eventMetrics),counts(after.eventMetrics))?'PASS':'FAIL'):'SKIP',
 outputAggregates:equal(before.output,after.output)?'PASS':'FAIL',
 reload:after.consistency.reloadMatches?'PASS':'FAIL',
 patch:after.consistency.patchMatches?'PASS':'FAIL'
};
const beforeLoad=before.activeLoadElapsedMs??before.stagesMs.loadWithOffline,afterLoad=after.activeLoadElapsedMs??after.stagesMs.loadWithOffline;
const beforeOffline=before.activeOfflineElapsedMs??before.stagesMs['loadWithOffline.offline'],afterOffline=after.activeOfflineElapsedMs??after.stagesMs['loadWithOffline.offline'];
console.log(JSON.stringify({before:before.label,after:after.label,checks,performance:{beforeLoadMs:beforeLoad,afterLoadMs:afterLoad,loadImprovement:beforeLoad/afterLoad,beforeOfflineMs:beforeOffline,afterOfflineMs:afterOffline,offlineImprovement:beforeOffline/afterOffline,beforePeakRSSBytes:before.peakRSSResourceBytes,afterPeakRSSBytes:after.peakRSSResourceBytes,beforePausedMs:before.pausedMs??0,afterPausedMs:after.pausedMs??0},environmentsMatch:equal(before.environment,after.environment),contention:{before:before.environment.contentionNote??'not recorded',after:after.environment.contentionNote??'not recorded'}},null,2));
if(Object.values(checks).includes('FAIL'))process.exitCode=1;

function counts(events){return Object.fromEntries(Object.entries(events).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([type,value])=>[type,value.count]));}
