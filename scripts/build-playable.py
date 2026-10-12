#!/usr/bin/env python3
"""Create a self-contained file-openable Playable from an already validated Vite dist."""
from pathlib import Path
import sys,base64,mimetypes,json,re
root=Path(__file__).resolve().parents[1];dist=root/'dist';version=json.loads((root/'public/version.json').read_text())['version'];dest=Path(sys.argv[1] if len(sys.argv)>1 else root/f'Playable1_v{version}.html')
index=next(dist.glob('assets/index-*.js'));css=next(dist.glob('assets/index-*.css'));worker=next(dist.glob('assets/runtime.worker-*.js'));mapworker=next(dist.glob('assets/mapRaster.worker-*.js'))
js=index.read_text();pattern=r'new URL\([`\"]/?assets/'+re.escape(worker.name)+r'[`\"],(?:``\+)?import\.meta\.url\)'
js,count=re.subn(pattern,'window.__FORMAL_EMBEDDED_WORKER',js)
if count!=1:raise RuntimeError(f'Expected one formal Worker binding, got {count}')
map_pattern=r'new URL\([`\"]/?assets/'+re.escape(mapworker.name)+r'[`\"],(?:``\+)?import\.meta\.url\)'
js,mapcount=re.subn(map_pattern,'window.__FORMAL_EMBEDDED_MAP_WORKER',js)
if mapcount!=1:raise RuntimeError(f'Expected one map pixel Worker binding, got {mapcount}')
assets={}
for base in ['art','icons']:
 for p in (root/'public'/base).rglob('*'):
  if p.is_file() and p.suffix in ['.webp','.png','.svg','.jpg','.jpeg']:
   mime=mimetypes.guess_type(p)[0] or 'application/octet-stream';assets[str(p.relative_to(root/'public'))]=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
worker64=base64.b64encode(worker.read_bytes()).decode();mapworker64=base64.b64encode(mapworker.read_bytes()).decode();style=css.read_text()
for path,data in assets.items():style=style.replace('url(/'+path+')','url('+data+')')
boot='window.__FORMAL_EMBEDDED_ASSETS='+json.dumps(assets,separators=(',',':'))+';window.__FORMAL_EMBEDDED_WORKER=URL.createObjectURL(new Blob([Uint8Array.from(atob("'+worker64+'"),c=>c.charCodeAt(0))],{type:"text/javascript"}));'
boot+='window.__FORMAL_EMBEDDED_MAP_WORKER=URL.createObjectURL(new Blob([Uint8Array.from(atob("'+mapworker64+'"),c=>c.charCodeAt(0))],{type:"text/javascript"}));'
html='<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>列國征途：始源 v'+version+' Playable #1</title><style>'+style+'</style></head><body><div id="root"></div><script>'+boot.replace('</script','<\\/script')+'</script><script type="module">'+js.replace('</script','<\\/script')+'</script></body></html>'
dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(html)
print(json.dumps({'file':str(dest),'bytes':dest.stat().st_size,'embedded_assets':len(assets),'worker':worker.name,'map_pixel_worker':mapworker.name,'runtime_worker_bindings_rewritten':count,'map_worker_bindings_rewritten':mapcount,'browser_validation':'PENDING','network_requests_observed':None},ensure_ascii=False))
