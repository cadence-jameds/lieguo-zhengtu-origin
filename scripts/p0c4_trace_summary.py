"""Derive bounded C4 tables without dropping slow, failed or missing samples."""
import json, pathlib, sys, math, statistics, collections
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
def read(p): return json.loads(p.read_text())
def quantile(a,p): return sorted(a)[math.ceil(len(a)*p)-1] if a else None
def union(spans):
    points=sorted((s['start'],s['end']) for s in spans if s.get('end') is not None); total=0; end=-float('inf')
    for a,b in points:
        total+=max(0,b-max(a,end)); end=max(end,b)
    return total
def samples(d): return [s for c in d['cases'] for s in c['samples']]
groups=collections.defaultdict(list); invalid=[]; identities=[]
for run in read(root/'final-abba/runs.json'):
    p=root/'final-abba'/run['name']/'result.json'; d=read(p); key=(run['hours'],run['mobile'],run['speed'],run['variant'])
    groups[key]+=samples(d); invalid +=[{'run':run['name'],**x} for c in d['cases'] for x in c['invalid']]
    identities.append({'run':run['name'],'testedRelease':{k:d['testedRelease'][k] for k in ['commitSha','contentSha','dirty','version']},'inputs':d['inputs'],'errors':d['errors']})
stats=[]
for (h,m,s,v),rows in sorted(groups.items()):
    a=[max(r['ackMs'],r['renderMs']) for r in rows]; stats.append({'hours':h,'mobile':m,'speed':s,'variant':v,'valid':len(a),'p50':quantile(a,.5),'p95':quantile(a,.95),'max':max(a),'over1000':sum(x>1000 for x in a),'over1000Ratio':sum(x>1000 for x in a)/len(a),'allCommittedReceipts':all(r['durableReceipt'] and r['status']=='committed' for r in rows)})
summary={'method':'Bounded ABBA: 5 attempts/pass; two passes per variant/group => 10 valid if no failure. Nearest-rank ceil(n*p)-1. NOT the >=30/group full Gate. Real pointer -> durable ACK -> committed DOM assertion + 2 RAF; DB receipt checked afterward. All slow values retained.','groups':stats,'valid':sum(g['valid'] for g in stats),'invalid':invalid,'identities':identities}
(out/'bounded-statistics.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
lines=['# C4 有界未插樁 ABBA','',summary['method'],'','|世界／畫面／倍率|版本|有效|p50 ms|p95 ms|max ms|>1s|比例|','|---|---|---:|---:|---:|---:|---:|---:|']
for g in stats: lines.append(f"|{g['hours']}h／{'手機' if g['mobile'] else '桌面'}／{g['speed']}X|{g['variant']}|{g['valid']}|{g['p50']:.1f}|{g['p95']:.1f}|{g['max']:.1f}|{g['over1000']}|{100*g['over1000Ratio']:.1f}%|")
(out/'TABLE.md').write_text('\n'.join(lines)+'\n')

# First five predeclared command families in each scenario; the extra original
# diagnostic repetitions are retained but not selected by speed for comparison.
phase_names={
 'admission':lambda s:s['name'].startswith(('orderAdmission.ts.','governanceAdmission.ts.')),
 'advance':lambda s:s['name'] in ['formal/reducer.ts.advanceFormal','formal/reducer.ts.advanceFormalCooperative'],
 'resolver':lambda s:s['name']=='formal/reducer.ts.advanceOneEvent',
 'AIEntry':lambda s:s['name']=='formal/autonomy.ts.handleAutonomy',
 'order':lambda s:s['name']=='formal/reducer.ts.submitFormalOrder',
 'nativeClone':lambda s:s['name']=='structuredClone',
 'ownedClone':lambda s:s['name']=='formal/worldDraft.ts.cloneWorldDraft',
 'history':lambda s:s['name']=='receipt.history',
 'schema':lambda s:s['name']=='formal/schema.ts.validateFormalWorld',
 'encode':lambda s:s['name']=='formal/saveCodec.ts.encodeSave',
 'json':lambda s:s['name']=='canonical.JSON',
 'utf8':lambda s:s['name']=='canonical.UTF8',
 'checksum':lambda s:s['name']=='checksum.crypto',
 'transaction':lambda s:s['name']=='idb.transaction.lifetime',
 'readRequests':lambda s:s['name'].startswith('idb.') and '.get.request' in s['name'],
 'writeSubmit':lambda s:s['name'].startswith('idb.') and any(x in s['name'] for x in ['.put.submit','.add.submit']),
 'writeRequests':lambda s:s['name'].startswith('idb.') and any(x in s['name'] for x in ['.put.request','.add.request']),
 'patch':lambda s:s['name']=='worldStream.ts.worldPatch',
 'postMessage':lambda s:s['name']=='worker.postMessage.state',
 'save':lambda s:s['name']=='persistence.ts.commit',
}
def phases(row):
    ws=row['trace']['worker']; origin=row['origin']+row['start']; mine=[s for s in ws if s['job']==row['id']]
    receive=next((s for s in ws if s['name']=='worker.received.command' and s.get('meta',{}).get('commandId')==row['id']),None)
    run=next((s for s in mine if s['name']=='worker.runRequest'),None); result={k:{'unionMs':union([s for s in mine if f(s)]),'count':sum(f(s) for s in mine),'segments':[s for s in mine if f(s)]} for k,f in phase_names.items()}
    result['queueWaitMs']=run['start']-receive['start'] if run and receive else None
    result['workerReceiveMs']=receive['start']-origin if receive else None
    result['postMessageMainMs']=row.get('postMessageMs')
    result['ackMs']=row['ackMs']; result['observedMs']=row['renderMs']; result['nativeReads']=row.get('nativeReads')
    result['mainTimeline']=row['trace']['main']; return result
trace=[]; matched=[]
for p in sorted((root/'final-trace').glob('*/result.json')):
    d=read(p); h,m,s=d['hours'],d['mobile'],d['cases'][0]['speed']; baseline=read(root/'before'/f"{h}h-{'mobile' if m else 'desktop'}-{s}x"/'result.json')
    for v,data in [('before',samples(baseline)[:5]),('after',samples(d))]:
        for row in data: trace.append({'scenario':f"{h}h-{'mobile' if m else 'desktop'}-{s}x",'variant':v,'commandId':row['id'],'family':row['family'],'origin':row['origin'],'pointer':row['start'],'phases':phases(row)})
    pair={'hours':h,'mobile':m,'speed':s}
    for v,rows in [('before',samples(baseline)[:5]),('after',samples(d))]:
        ps=[phases(r) for r in rows]; pair[v]={'n':len(rows),'p50':quantile([r['renderMs'] for r in rows],.5),'p95':quantile([r['renderMs'] for r in rows],.95),'phaseMedian':{k:statistics.median(p[k]['unionMs'] for p in ps) for k in phase_names}}
    matched.append(pair)
(out/'phase-timelines.json').write_text(json.dumps({'method':'Absolute epoch-ms via performance.timeOrigin+now. Inclusive parent spans; each category uses interval union, but categories overlap and MUST NOT be summed. Native result getter/CPU/clock GC exist only in native-detail supplement. Main heap is not Worker heap; DOM observation may include diagnostic transport.','commands':trace,'matchedFirstFive':matched},ensure_ascii=False,indent=2))

details=[]
for p in sorted((root/'native-detail').glob('*/result.json')):
    d=read(p); gc=read(p.parent/'gc-events.json'); anchor=next((a for a in gc.get('clockAnchors',[]) if isinstance(a.get('offsetMs'),(int,float))),None)
    labels={(x['pid'],x['tid']):x.get('label') for x in gc.get('threadNames',[]) if x['name']=='thread_name'}
    for row in samples(d):
        entry={'run':p.parent.name,'commandId':row['id'],'family':row['family'],'phases':phases(row),'clockAnchor':anchor,'gcByThread':[]}
        if anchor:
            start=row['origin']+row['start'];end=row['origin']+row['renderAt']; buckets=collections.defaultdict(list)
            for e in gc['events']:
                a=e['start']+anchor['offsetMs'];b=a+e['ms']
                if b>start and a<end:buckets[(e['pid'],e['tid'])].append({'start':max(a,start),'end':min(b,end),'name':e['name'],'ms':e['ms']})
            for (pid,tid),spans in buckets.items(): entry['gcByThread'].append({'pid':pid,'tid':tid,'label':labels.get((pid,tid)),'unionMs':union(spans),'nestedCount':len(spans),'largest':sorted(spans,key=lambda s:s['end']-s['start'],reverse=True)[:5]})
        details.append(entry)
(out/'native-stage-details.json').write_text(json.dumps({'method':'IDB native getter spans collected inside isolated diagnostic Worker only. GC aligned by CDP Performance.Timestamp with epoch bracket uncertainty; intervals unioned per thread, never sum nested/parallel GC. Coincidence does not prove exclusive cause. Process CPU deltas include setup and all pages, not command CPU.','commands':details},ensure_ascii=False,indent=2))
print(json.dumps({'valid':summary['valid'],'invalid':len(invalid),'groups':stats,'traceCommands':len(trace),'nativeDetailedCommands':len(details)},ensure_ascii=False))
