"""Produce documentation candidates; --apply-frank installs only the specified one-handed portrait."""
from pathlib import Path
from PIL import Image
import json,hashlib,copy,sys
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/elite-review-20261029';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();rows=json.loads((D/'generation.json').read_text())
for r in rows:
 raw=D/'raw'/(r['id']+'.png');im=Image.open(raw).convert('RGB');size=im.size;im=im.resize((512,512),Image.Resampling.LANCZOS);im.thumbnail((480,480),Image.Resampling.LANCZOS);out=Image.new('RGB',(512,512),(20,21,19));out.paste(im,((512-im.width)//2,(512-im.height)//2));p=D/'candidates'/(r['id']+'.webp');out.save(p,'WEBP',quality=88,method=4,exact=True)
 r.update({'raw':str(raw.relative_to(R)),'rawSHA256':sha(raw),'rawDimensions':list(size),'output':str(p.relative_to(R)),'outputSHA256':sha(p),'outputDimensions':[512,512],'bytes':p.stat().st_size,'alphaPolicy':'dark-opaque','normalization':'Complete square1254 ->512 ->480 inset on512; no cropping, repainting or color adjustment.','generationTool':'image_gen.imagegen','generationModel':'not exposed','createdDate':'2026-10-29','status':'PLAYER_CHOICE_PENDING' if r['civ']!='frankia' else 'SELF_REVIEW_REQUIRED','referenceImages':[{'path':f,'sha256':sha(R/f)} for f in r['references']],'promptSHA256':sha(R/r['prompt'])})
 if r['id']=='china-C-imperial':r.update({'prompt':'docs/art-unification/elite-review-20261029/prompts/china-C-imperial-v2.txt','references':['docs/art-unification/elite-review-20261029/raw/china-C-imperial-v1.png',*r['references']]});r['referenceImages']=[{'path':f,'sha256':sha(R/f)} for f in r['references']];r['promptSHA256']=sha(R/r['prompt'])
if (D/'art-gate.json').exists():
 gates=json.loads((D/'art-gate.json').read_text())
 for r in rows:
  if r['id'] in gates and gates[r['id']]['reviewedSHA256']==r['outputSHA256']:r['status']=gates[r['id']]['status']
(D/'outputs.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
if '--apply-frank' in sys.argv:
 r=next(x for x in rows if x['civ']=='frankia');key='elite.guard.civ_frankia';target='public/art/unified/units/'+key+'.webp';gate=json.loads((D/'art-gate.json').read_text())[r['id']];assert gate['hardGate']=='PASS_SELF_REVIEW' and gate['reviewedSHA256']==r['outputSHA256'] and gate['total']>=17
 P=R/'docs/art-source/unification';assets=json.loads((P/'assets.json').read_text());batches=json.loads((P/'batches.json').read_text());bid='elite-review-20261029-frankia-single-hand';old=next(a for a in assets if a['group']=='units' and a['key']==key)
 if old['batch']==bid:old=old['supersedes']
 assert old['sha256']==sha(D/'before'/Path(target).name)
 for b in batches:
  if b['id']==old['batch']:
   for c in b['cells']:
    if c.get('key')==key:c['supersededBy']=bid
 batches=[b for b in batches if b['id']!=bid];assets=[a for a in assets if not(a['group']=='units' and a['key']==key)];cell={'key':key,'group':'units','subject':'Anatomical right hand single short-haft double-bitted axe; left hand holds blue/gold fleur-de-lis shield. Exactly two arms/hands.','path':target,'artGate':gate}
 batches.append({'id':bid,'group':'units','role':'ARMY-PORTRAIT','transparent':False,'single':True,'source':r['raw'],'sourcePath':r['raw'],'sourceDimensions':r['rawDimensions'],'sourceSha256':r['rawSHA256'],'references':r['referenceImages'],'prompt':(R/r['prompt']).read_text(),'promptPath':r['prompt'],'generationTool':r['generationTool'],'generationModel':r['generationModel'],'createdDate':r['createdDate'],'cells':[cell]})
 previous=copy.deepcopy(old);previous.update({'revision':'8736bad811a7c372c59881b143e4c75bd659c5af','preservedOutput':str((D/'before'/Path(target).name).relative_to(R))});assets.append({**cell,'role':'ARMY-PORTRAIT','batch':bid,'cropRect':[0,0,*r['rawDimensions']],'dimensions':[512,512],'sha256':r['outputSHA256'],'bytes':r['bytes'],'atlasExtraction':None,'alphaPolicy':'dark-opaque','approver':None,'supersedes':previous})
 (R/target).write_bytes((R/r['output']).read_bytes());(P/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n');(P/'batches.json').write_text(json.dumps(batches,ensure_ascii=False,indent=2)+'\n');(D/'runtime.json').write_text(json.dumps({'key':key,'path':target,'base':'8736bad811a7c372c59881b143e4c75bd659c5af','previousSHA256':old['sha256'],'sha256':r['outputSHA256'],'source':r['raw'],'sourceSha256':r['rawSHA256'],'review':gate,'batch':bid},ensure_ascii=False,indent=2)+'\n');print('Installed only Frankish single-hand portrait; Chinese/Japanese registry unchanged.')
print('Prepared',len(rows),'512px documentation candidates.')
