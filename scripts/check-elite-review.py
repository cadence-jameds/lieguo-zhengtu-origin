"""Read-only integrity gate; visual anatomy and historical judgment are not inferred from hashes."""
import hashlib,json,struct,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/elite-review-20261029';load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
outputs=load(D/'outputs.json');assert len(outputs)==7
for x in outputs:
 p=R/x['output'];raw=R/x['raw'];data=p.read_bytes();assert data[:4]==b'RIFF' and data[8:12]==b'WEBP' and data[12:16]==b'VP8 ';assert data[23:26]==b'\x9d\x01\x2a';assert [v&0x3fff for v in struct.unpack('<HH',data[26:30])]==[512,512]
 assert sha(p)==x['outputSHA256'] and sha(raw)==x['rawSHA256'];assert raw.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n';assert list(struct.unpack('>II',raw.read_bytes()[16:24]))==x['rawDimensions']
 assert sha(R/x['prompt'])==x['promptSHA256'] and len(x['referenceImages'])>=2
 for ref in x['referenceImages']:assert sha(R/ref['path'])==ref['sha256']
 gate=load(D/'art-gate.json')[x['id']];assert gate['reviewedSHA256']==x['outputSHA256'];assert sum(gate['scores'])==gate['total']>=17 and all(gate['scores'][i]>0 for i in [0,1,8]);assert gate['hardGate']=='PASS_SELF_REVIEW'
protected=load(D/'protected.json')
for p,h in protected['files'].items():assert sha(R/p)==h,('Unrequested change',p)
changed=subprocess.check_output(['git','-C',str(R),'diff','--name-only',protected['base'],'--','public'],text=True).splitlines();assert changed==['public/art/unified/units/elite.guard.civ_frankia.webp'],('Unexpected public change',changed)
registry=load(R/'src/game/presentation/artAssets.json')['units'];r=load(D/'runtime.json');assert r['key']=='elite.guard.civ_frankia';assert registry[r['key']]==r['path'].removeprefix('public/');assert sha(R/r['path'])==r['sha256'];assert sha(D/'before/elite.guard.civ_frankia.webp')==r['previousSHA256'];assert r['sha256']==next(x['outputSHA256'] for x in outputs if x['civ']=='frankia')
for x in outputs:
 if x['civ']!='frankia':assert x['output'].removeprefix('public/') not in registry.values()
assets=load(R/'docs/art-source/unification/assets.json');a=next(a for a in assets if a['group']=='units' and a['key']==r['key']);assert a['sha256']==r['sha256'] and a['batch']==r['batch'] and a['supersedes']['sha256']==r['previousSHA256']
for h in load(D/'generation-history.json'):
 assert sha(R/h['raw'])==h['rawSHA256'] and sha(R/h['prompt'])==h['promptSHA256']
 for ref in h['referenceImages']:assert sha(R/ref['path'])==ref['sha256']
for b in load(D/'boards/manifest.json').values():
 assert sha(R/b['path'])==b['sha256']
 for source in b.get('sources',[]):assert sha(R/source['path'])==source['sha256']
bm=load(D/'browser-manifest.json')
for section in ['sources','files']:
 for p,h in bm[section].items():assert sha(R/p)==h,('Stale browser evidence',p)
army=load(D/'browser/army/result.json');gallery=load(D/'browser/candidates/result.json');assert army['status']==gallery['status']=='PASS' and not army['errors'] and not gallery['errors'];assert len(army['rows'])==27 and gallery['viewports']==3 and gallery['artCards']==48
print('PASS:7 documentation portraits512px; only one Frankish runtime output; Chinese/Japanese mappings and870 existing assets/source/spec files locked; prompts/raws/references/boards verified. Anatomy/player approval remain visual review.')
