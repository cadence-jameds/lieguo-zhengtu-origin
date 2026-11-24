"""Exact single-source AI settlement escort successor; historical evidence stays immutable."""
from functools import lru_cache
from pathlib import Path
import hashlib
import json
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
BASE = 'c8b3554ff9643b74b624e4e77f381653afcccc20'
IMPLEMENTATION = 'a69a0700a3f6aa199ac9af72f7c6852504d26458'
SOURCE = 'src/game/formal/aiActions.ts'
BOUNDARY = 'scripts/verify-projection-boundaries.mjs'
BOUNDARY_SHA = 'd55e9177aa79fad7009f34db9139225433ebcc1d0487394c4d6ac3229ff7c6b3'
SCOPE = {SOURCE, 'src/game/formal/aiExpansionEscort.test.ts', 'releases/notes/ai-settlement-escort-rounding.json'}
def git(*args):
    return subprocess.check_output(['git','-C',str(ROOT),*args])
def sha(data):
    return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=1)
def record():
    assert git('rev-list','--parents','-n','1',IMPLEMENTATION).decode().split() == [IMPLEMENTATION, BASE]
    assert set(git('diff','--name-only','--no-renames',BASE,IMPLEMENTATION).decode().splitlines()) == SCOPE
    original=sha(git('show',BASE+':'+SOURCE))
    allowed={original}
    for entry in git('ls-tree','-r','--name-only',BASE,'docs/validation','docs/art-unification').decode().splitlines():
        if not entry.endswith(('/compatibility.json', '/protected.json', '/source-manifest.json')):
            continue
        data=json.loads(git('show',BASE+':'+entry))
        if not isinstance(data,dict):
            continue
        for section in ('changes','grants','invariants','sources','sourceFiles','files'):
            index=data.get(section)
            if not isinstance(index,dict):
                continue
            item=index.get(SOURCE)
            values=([item] if isinstance(item,str) else item if isinstance(item,list) else
                    [item.get(key) for key in ('before','after','baseSha256','uiSha256')] if isinstance(item,dict) else [])
            allowed.update(value for value in values if isinstance(value,str) and len(value)==64)
    return {path:sha(git('show',IMPLEMENTATION+':'+path)) for path in SCOPE}, frozenset(allowed)
def accepts(path,predecessor,root=ROOT):
    if path != SOURCE:
        return False
    after,allowed=record()
    return predecessor in allowed and (root/path).is_file() and sha((root/path).read_bytes())==after[path]
def validate(root=ROOT):
    after,_=record()
    for path,digest in after.items():
        assert (root/path).is_file() and sha((root/path).read_bytes())==digest, ('Changed exact AI escort source/test/note',path)

def accepts_boundary(path,before,root=ROOT):
    return (path==BOUNDARY and before==git('show',BASE+':'+BOUNDARY)
            and (root/path).is_file() and sha((root/path).read_bytes())==BOUNDARY_SHA)

if __name__=='__main__':
    assert sys.argv[1:]==['--boundary-admissions']
    validate()
    assert accepts_boundary(BOUNDARY,git('show',BASE+':'+BOUNDARY)), 'Changed exact projection boundary adapter'
    print(json.dumps([SOURCE]))
