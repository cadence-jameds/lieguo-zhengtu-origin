"""GitHub-native fallback: store exact original Git objects, never recreate a different history."""
import base64,datetime,hashlib,json,os,re,subprocess,time,urllib.request,urllib.error

def store_original_objects(repo,m):
 token=os.environ['GH_TOKEN'];endpoint='https://api.github.com/repos/'+m['repository']+'/git/';last=[0.0]
 def git(*a,input=None):return subprocess.check_output(['git','--no-optional-locks','-C',str(repo),*a],input=input)
 def post(kind,payload):
  delay=1.05-(time.monotonic()-last[0])
  if delay>0:time.sleep(delay)
  data=json.dumps(payload,ensure_ascii=False).encode();req=urllib.request.Request(endpoint+kind,data=data,method='POST',headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'verified-original-art-transport'})
  for attempt in range(3):
   last[0]=time.monotonic()
   try:
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
   except urllib.error.HTTPError as e:
    message=e.read().decode(errors='replace').replace(token,'[REDACTED]')
    if attempt<2 and (e.code==429 or e.code==403 and 'rate limit' in message.lower()):time.sleep(min(60,max(5,int(e.headers.get('Retry-After','30')))));continue
    raise RuntimeError('GitHub object API '+kind+' HTTP'+str(e.code)+': '+message[:1200])
 # A rejected ref update may still have stored the original pack. Avoid retransmitting it.
 try:
  existing=True
  for c in m['commits']:
   req=urllib.request.Request(endpoint+'commits/'+c['sha'],headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'verified-original-art-transport'})
   with urllib.request.urlopen(req,timeout=30) as response:obj=json.load(response)
   assert obj['sha']==c['sha']
  print('All original commit objects already present on GitHub; no duplicate object upload.',flush=True)
  return
 except urllib.error.HTTPError as error:
  if error.code!=404:raise
 objects=git('rev-list','--objects','--no-object-names',m['base']+'..'+m['head']).decode().splitlines();types={}
 for row in git('cat-file','--batch-check=%(objectname) %(objecttype)',input=('\n'.join(objects)+'\n').encode()).decode().splitlines():
  oid,kind=row.split();types[oid]=kind
 blobs=[oid for oid in objects if types[oid]=='blob'];print('Storing exact original objects via GitHub API:',len(blobs),'blobs',flush=True)
 for i,oid in enumerate(blobs,1):
  raw=git('cat-file','blob',oid);assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==oid
  result=post('blobs',{'encoding':'base64','content':base64.b64encode(raw).decode()});assert result['sha']==oid,'Blob SHA mismatch'
  if i%25==0 or i==len(blobs):print('Original blobs verified',i,'/',len(blobs),flush=True)
 def entries(tree):
  result={}
  for row in git('ls-tree','-r','-z',tree).split(b'\0'):
   if row:
    info,name=row.split(b'\t',1);mode,kind,oid=info.decode().split();result[name.decode()]=(mode,kind,oid)
  return result
 previous=m['base']
 for c in m['commits']:
  raw=git('cat-file','commit',c['sha']);headers,body=raw.split(b'\n\n',1);assert headers.decode()==c['headers'];h={}
  for line in headers.decode().splitlines():
   key,val=line.split(' ',1);h.setdefault(key,[]).append(val)
  assert set(h)=={'tree','parent','author','committer'} and h['parent']==[previous],'Unsupported original commit headers'
  parent_tree=git('rev-parse',previous+'^{tree}').decode().strip();new_tree=h['tree'][0];files=entries(new_tree);changed=[n.decode() for n in git('diff','--no-renames','--name-only','-z',previous,c['sha']).split(b'\0') if n];elements=[]
  for path in changed:
   if path in files:
    mode,kind,oid=files[path];elements.append({'path':path,'mode':mode,'type':kind,'sha':oid})
   else:elements.append({'path':path,'mode':'100644','type':'blob','sha':None})
  result=post('trees',{'base_tree':parent_tree,'tree':elements});assert result['sha']==new_tree,'Tree SHA mismatch'
  def person(value):
   match=re.fullmatch(r'(.+) <([^>]+)> (\d+) ([+-]\d{4})',value);assert match and match[4]=='+0000','Only exact original UTC commit headers supported';name,email,stamp,_=match.groups();date=datetime.datetime.fromtimestamp(int(stamp),datetime.timezone.utc).isoformat().replace('+00:00','Z');return {'name':name,'email':email,'date':date}
  author=person(h['author'][0]);committer=person(h['committer'][0]);rebuilt=('tree '+new_tree+'\nparent '+previous+'\nauthor '+h['author'][0]+'\ncommitter '+h['committer'][0]+'\n\n').encode()+body;assert rebuilt==raw and hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==c['sha']
  result=post('commits',{'message':body.decode(),'tree':new_tree,'parents':[previous],'author':author,'committer':committer});assert result['sha']==c['sha'],'GitHub did not retain exact original commit SHA; no target ref will be created'
  previous=c['sha'];print('Original commit object verified',previous,flush=True)
 assert previous==m['head'];print('ORIGINAL_OBJECTS_STORED_EXACT_SHA; target ref may be created by authorized GitHub connector',flush=True)
