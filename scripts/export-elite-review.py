"""Export downloadable review files and a complete two-round Git bundle outside Git."""
from pathlib import Path
import subprocess,json,hashlib,zipfile,shutil,sys,html
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/elite-review-20261029';O=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/shared/downloads');O.mkdir(parents=True,exist_ok=True)
head=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip();assert subprocess.run(['git','-C',str(R),'merge-base','--is-ancestor','8736bad811a7c372c59881b143e4c75bd659c5af',head],check=True).returncode==0
bundle=O/'pr44-elite-review.bundle';subprocess.run(['git','-C',str(R),'bundle','create',str(bundle),'refs/heads/feat/art-unification-20261028','^5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5'],check=True);subprocess.run(['git','-C',str(R),'bundle','verify',str(bundle)],check=True,stdout=subprocess.DEVNULL)
assert head in subprocess.check_output(['git','-C',str(R),'bundle','list-heads',str(bundle)],text=True)
zip_path=O/'pr44-elite-candidates.zip';files=[p for p in D.rglob('*') if p.is_file()]+list((R/'docs/art').glob('列國征途_美術聖經_v1.*.md'))+[R/'releases/notes/art-unification-20261028.json',R/'public/art/unified/units/elite.guard.civ_frankia.webp']
body='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PR44 精銳候選審圖</title><style>body{background:#18211b;color:#e5d9bd;font:16px system-ui;max-width:1400px;margin:auto;padding:16px}img{width:100%;height:auto}a{color:#d4bb79}</style><h1>中國／日本候選；法蘭克正式修正版</h1><p>雲端HEAD '+head+'</p><p>中國、日本尚未定稿；正式圖保持8736bad。GitHub推送與CI狀態見REPORT及validation.json；自評不代表玩家核准。</p><p><a href="docs/art-unification/elite-review-20261029/REPORT.md">完整報告</a> / <a href="docs/art-unification/elite-review-20261029/validation.json">驗證結果</a></p>'
for name,label in [('中國-ABCs','中國：普通／A／B／C'),('日本-ABCs','日本：普通／A／B／C'),('frankia-before-after','法蘭克：普通／8736bad／新單手版'),('frankia-anatomy','法蘭克手部與盾牌特寫')]:body+='<h2>'+label+'</h2><img src="docs/art-unification/elite-review-20261029/boards/'+html.escape(name)+'.webp">'
body+='</html>'
readme='PR #44 雲端施工成果\nHEAD: '+head+'\n基準: 8736bad811a7c372c59881b143e4c75bd659c5af\n遠端前提: 5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5\n\n解壓本ZIP後開啟 index.html 審圖；REPORT.md 內含128/64px、320/390/桌面、來源與限制。\n中國／日本等玩家選定才替換；法蘭克正式輸出已修正。\n完整歷史和兩輪全部原稿在另外的 pr44-elite-review.bundle，包含8736bad與其後繼提交；不是重新從遠端舊HEAD施工。\n可在已有遠端前提commit的倉庫執行 git bundle verify <已下載bundle檔案>，再fetch其中原功能分支；不需reset或force-push。\nGitHub推送與新版CI若BLOCKED，不可用舊CI結果代替。\n'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,p.relative_to(R))
 z.writestr('index.html',body);z.writestr('README.txt',readme)
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None;assert 'index.html' in z.namelist()
for src,target in [('中國-ABCs.webp','china-ABCs.webp'),('日本-ABCs.webp','japan-ABCs.webp'),('frankia-before-after.webp','frankia-single-hand.webp'),('frankia-anatomy.webp','frankia-anatomy.webp')]:shutil.copy2(D/'boards'/src,O/target)
(O/'pr44-elite-README.txt').write_text(readme)
manifest={'head':head,'base':'8736bad811a7c372c59881b143e4c75bd659c5af','remotePrerequisite':'5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5','bundleVerified':True,'zipCRCVerified':True,'files':[{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [bundle,zip_path,O/'china-ABCs.webp',O/'japan-ABCs.webp',O/'frankia-single-hand.webp',O/'frankia-anatomy.webp',O/'pr44-elite-README.txt']]};(O/'pr44-elite-downloads.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,ensure_ascii=False))
