"""Convert only five reviewed portrait candidates; preserve all other runtime art.

Use the same square/480px inset normalization as prepare-art-candidates.py.
Historical batch cells remain present with explicit supersession rather than deletion.
"""
import hashlib,json,copy
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1];S=R/'docs/art-source/player-feedback-20261029';P=R/'docs/art-source/unification';D=R/'docs/art-unification/player-feedback-20261029';selected=json.loads((S/'selected.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assets=json.loads((P/'assets.json').read_text());batches=json.loads((P/'batches.json').read_text());registry=json.loads((R/'src/game/presentation/artAssets.json').read_text());keys={r['key'] for r in selected}
old_path=D/'before/asset-records.json'
if not old_path.exists():old_path.write_text(json.dumps([a for a in assets if a['group']=='units' and a['key'] in keys],ensure_ascii=False,indent=2)+'\n')
for batch in batches:
 if batch['id'].startswith('feedback-20261029-'):continue
 for cell in batch['cells']:
  if batch['group']=='units' and cell.get('key') in keys:cell['supersededBy']='feedback-20261029-'+cell['key']
batches=[b for b in batches if not b['id'].startswith('feedback-20261029-')];assets=[a for a in assets if not(a['group']=='units' and a['key'] in keys)]
reviews={r['id']:r for r in json.loads((D/'art-gate.json').read_text())['reviews']} if (D/'art-gate.json').exists() else {}
outputs=[]
for r in selected:
 raw=R/r['candidate'];im=Image.open(raw).convert('RGB');size=im.size;side=max(size);square=Image.new('RGB',(side,side),(20,21,19));square.paste(im,((side-size[0])//2,side-size[1]));square=square.resize((512,512),Image.Resampling.LANCZOS);square.thumbnail((480,480),Image.Resampling.LANCZOS);final=Image.new('RGB',(512,512),(20,21,19));final.paste(square,((512-square.width)//2,(512-square.height)//2));output=R/r['path'];final.save(output,'WEBP',quality=88,method=4,exact=True)
 refs=[{'path':p,'sha256':sha(R/p)} for p in r['references']];cell={'key':r['key'],'group':'units','subject':r['subject'],'path':r['path'],'artGate':{'status':r['status'],'playerApproval':'待驗'}}
 if r['key'] in reviews and reviews[r['key']]['reviewedSHA256']==sha(output):cell['artGate']={k:v for k,v in reviews[r['key']].items() if k!='id'}
 r['status']=cell['artGate']['status']
 batches.append({'id':r['id'],'group':'units','role':'ARMY-PORTRAIT','transparent':False,'single':True,'source':r['candidate'],'sourcePath':r['candidate'],'sourceDimensions':list(size),'sourceSha256':sha(raw),'references':refs,'prompt':(R/r['prompt']).read_text(),'promptPath':r['prompt'],'generationTool':r['generationTool'],'generationModel':r['generationModel'],'createdDate':r['createdDate'],'cells':[cell]})
 asset={**cell,'role':'ARMY-PORTRAIT','batch':r['id'],'cropRect':[0,0,*size],'dimensions':[512,512],'sha256':sha(output),'bytes':output.stat().st_size,'atlasExtraction':None,'alphaPolicy':'dark-opaque','approver':None,'supersedes':next((a for a in json.loads(old_path.read_text()) if a['key']==r['key']),None)}
 if asset['supersedes']:asset['supersedes'].update({'revision':'5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5','preservedOutput':str((D/'before'/(r['key']+'.webp')).relative_to(R))})
 assets.append(asset);registry['units'][r['key']]=str(output.relative_to(R/'public'));outputs.append({**r,'sourceDimensions':list(size),'sourceSha256':sha(raw),'references':refs,'dimensions':[512,512],'sha256':sha(output),'bytes':output.stat().st_size,'artGate':cell['artGate'],'normalization':'Full raw square ->512 ->480 inset on512; same as existing portrait converter; no content crop or color adjustment.'})
(P/'batches.json').write_text(json.dumps(batches,ensure_ascii=False,indent=2)+'\n');(P/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n');(R/'src/game/presentation/artAssets.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n');(S/'outputs.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+'\n');print('Converted only',len(outputs),'portraits:',sum(o['bytes'] for o in outputs),'bytes')
