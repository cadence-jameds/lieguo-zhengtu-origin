"""Exact elite recruitment and siege-copy successor; original records remain unchanged."""
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c8b3554ff9643b74b624e4e77f381653afcccc20'
RESULTS = {'scripts/verify-projection-boundaries.mjs': 'bb8a31e75227dec94e16f4380049f57723ef55e44d29657765602775c1a19a60',
 'src/game/formal/autonomy.ts': 'f43541035f7c1902cb0a0bd3e1be0059bff56f09a28e072a39856926ad11a53d',
 'src/game/formal/techCatalog.ts': 'aa550e3843d5648a0ef9048edd84a2c71c14536e1ec62d5b38bc402fed375e42'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def original(path):
    return subprocess.check_output(['git', '-C', str(ROOT), 'show', BASE + ':' + path])

@lru_cache(maxsize=1)
def predecessors():
    values = {p: {sha(original(p))} for p in RESULTS}
    paths = subprocess.check_output(['git', '-C', str(ROOT), 'ls-tree', '-r', '--name-only', BASE, '--', 'docs/validation', 'docs/art-unification'], text=True)
    for path in paths.splitlines():
        if not path.endswith('.json'):
            continue
        data = json.loads(original(path))
        if not isinstance(data, dict):
            continue
        for section in ('sourceFiles', 'sources', 'files', 'invariants', 'changes', 'grants', 'updates'):
            items = data.get(section)
            if not isinstance(items, dict):
                continue
            for source, permitted in values.items():
                item = items.get(source)
                if isinstance(item, str):
                    permitted.add(item)
                elif isinstance(item, list):
                    permitted.update(item)
                elif isinstance(item, dict):
                    for key in ('before', 'after', 'baseSha256', 'uiSha256', 'currentSha256'):
                        if isinstance(item.get(key), str):
                            permitted.add(item[key])
    return {source: frozenset(permitted) for source, permitted in values.items()}

def accepts(path, predecessor, root=ROOT):
    if path not in RESULTS or predecessor not in predecessors()[path]:
        return False
    source = root / path
    return source.is_file() and sha(source.read_bytes()) == RESULTS[path]


if __name__ == '__main__':
    assert sys.argv[1:] == ['--boundary-admissions']
    formal = [p for p in RESULTS if p.startswith('src/game/formal/')]
    for p in RESULTS:
        assert accepts(p, sha(original(p))), ('Candidate exceeded exact successor', p)
    print(json.dumps(formal))
