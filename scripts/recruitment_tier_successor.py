"""Exact recruitment tiers successor; original records remain unchanged."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '1c8b0bb851d651a54cf1418ab7416e4279ce4448'
RESULTS = {'scripts/b10_r3_05_successor.py': 'c3c3eb052d82aeddd5c75a0dc2df0e63a81bea224e4452a8ed9ac99e404b9734',
 'scripts/recruit_input_successor.py': 'f2b171773aff7d8e464e4e4e1e143a5ffb5b484745a5930ea24d569267aa1e0a',
 'src/game/presentation/recruitmentInput.test.tsx': '4ba65592a16dfd009595173078026b6ed3f1ec2530794fbf43cb2c97e9daa779',
 'src/game/presentation/DevelopmentViews.tsx': '6900dde573b457ac9bfe7d6c1435652d7f3d80ac871f00ee682e7e5b4d3fbe89',
 'src/game/presentation/RecruitmentForm.tsx': '411be03818eabbc46703fa5bd6e87fb4c4a7cecd83faa59fc7af0828feb6bd1e',
 'src/game/presentation/cityActions.ts': '92acddcbc8aae20af7c0d79d3092fa99b494d2fa968f3a78dc48e8132ba64096'}

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
    # R3-02's exact pinned adaptation of the historical recruitment witness.
    values['scripts/recruit_input_successor.py'].add('218c4c4d1767552bbacc7e87a523a64503febba6e2952670d80a34312ba0bffc')
    return {source: frozenset(permitted) for source, permitted in values.items()}

def accepts(path, predecessor, root=ROOT):
    if path not in RESULTS or predecessor not in predecessors()[path]:
        return False
    source = root / path
    return source.is_file() and sha(source.read_bytes()) == RESULTS[path]
