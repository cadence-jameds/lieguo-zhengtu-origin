"""User-authorized transport: verify exact original history before a normal Git push."""
from pathlib import Path
import json,hashlib,subprocess,tempfile,os,argparse,base64
ap=argparse.ArgumentParser();ap.add_argument('--manifest',required=True);ap.add_argument('--local-base');ap.add_argument('--publish',action='store_true');args=ap.parse_args();root=Path(args.manifest).resolve().parent;m=json.loads(Path(args.manifest).read_text());assert m['repository']=='cadence-jameds/lieguo-zhengtu-origin';assert m['targetBranch']=='feat/art-player-feedback-20261029';assert m['head']=='4c835fdd62d16afa1f1236c75792e7d7764ab4f8';assert not(args.publish and args.local_base)
job=Path(tempfile.mkdtemp(prefix='verified-art-transport-',dir=os.environ.get('RUNNER_TEMP','/workspace')));bundle=job/'original.bundle';digest=hashlib.sha256()
with bundle.open('wb') as out:
 for r in m['parts']:
  p=root/r['path'];assert p.is_relative_to(root/'parts');data=p.read_bytes();data=base64.b64decode(data,validate=True) if r.get('encoding')=='base64' else data;assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'];out.write(data);digest.update(data)
assert digest.hexdigest()==m['bundleSHA256'] and bundle.stat().st_size==m['bundleBytes']
repo=job/'repo';repo.mkdir()
def git(*a,check=True):
 result=subprocess.run(['git','--no-optional-locks','-C',str(repo),'-c','core.hooksPath=/dev/null',*a],capture_output=True,text=False)
 if check and result.returncode:
  detail=(result.stdout+result.stderr).decode(errors='replace');token=os.environ.get('GH_TOKEN')
  if token:detail=detail.replace(token,'[REDACTED]')
  print(detail,flush=True);raise subprocess.CalledProcessError(result.returncode,result.args)
 return result
git('init','-q');url='https://github.com/'+m['repository']+'.git';git('remote','add','origin',url)
if not args.local_base:
 r=git('ls-remote','origin','refs/heads/'+m['baseBranch']).stdout.decode().strip();assert r.split()[0]==m['base'],'Original PR44 branch moved; stop'
git('fetch','--no-tags','--no-write-fetch-head',args.local_base or 'origin',m['base']+':refs/remotes/source/base');git('bundle','verify',str(bundle));advertised=git('bundle','list-heads',str(bundle)).stdout.decode().strip();assert advertised==m['head']+' refs/heads/'+m['targetBranch'];git('fetch','--no-tags','--no-write-fetch-head',str(bundle),'refs/heads/'+m['targetBranch']+':refs/heads/'+m['targetBranch']);git('switch',m['targetBranch'])
assert git('rev-parse','HEAD').stdout.decode().strip()==m['head'];assert git('merge-base',m['base'],m['head']).stdout.decode().strip()==m['base'];previous=m['base']
for c in m['commits']:
 data=git('cat-file','commit',c['sha']).stdout;assert hashlib.sha1(b'commit '+str(len(data)).encode()+b'\0'+data).hexdigest()==c['sha'];assert data.split(b'\n\n',1)[0].decode()==c['headers'];assert b'parent '+previous.encode()+b'\n' in data;previous=c['sha']
assert previous==m['head'] and len(m['commits'])==4
changed=[n.decode() for n in git('diff','--name-only','-z',m['base'],m['head']).stdout.split(b'\0') if n];assert changed==[r['path'] for r in m['files']] and len(changed)==367
for r in m['files']:
 data=(repo/r['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==r['sha256'];assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==r['blob']
git('fsck','--full','--strict','--no-reflogs');assert not git('status','--porcelain').stdout.strip();print('PASS exact bundle SHA,4 original commits/metadata,367 file blobs,base ancestry,fsck',flush=True)
published=False
if args.publish:
 remote=git('ls-remote','origin','refs/heads/'+m['targetBranch']).stdout.decode().strip()
 if remote:assert remote.split()[0]==m['head'],'Target branch exists at different SHA; no update allowed'
 else:
  pushed=git('push','origin',m['head']+':refs/heads/'+m['targetBranch'],check=False)
  if pushed.returncode:
   error=pushed.stderr.decode(errors='replace');token=os.environ.get('GH_TOKEN')
   if token:error=error.replace(token,'[REDACTED]')
   print(error,flush=True)
   if 'workflow' not in error.lower():raise RuntimeError('Normal push failed; no force or ref override attempted')
   from api_objects import store_original_objects
   store_original_objects(repo,m)
 remote_after=git('ls-remote','origin','refs/heads/'+m['targetBranch']).stdout.decode().strip()
 if remote_after:assert remote_after.split()[0]==m['head'];published=True;print('PUBLISHED exact original HEAD',flush=True)
 else:print('Target ref pending authorized connector creation; original objects verified on GitHub.',flush=True)
 assert git('ls-remote','origin','refs/heads/'+m['baseBranch']).stdout.decode().split()[0]==m['base'];print('PR44 base unchanged',flush=True)
print(json.dumps({'workspace':str(repo),'head':m['head'],'bundle':str(bundle),'published':published,'targetRefPending':bool(args.publish and not published)}))
