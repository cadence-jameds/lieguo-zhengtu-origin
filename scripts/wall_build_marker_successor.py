"""Exact level-zero Wall affordance successor; original records remain unchanged."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c8b3554ff9643b74b624e4e77f381653afcccc20'
SCENE = 'src/game/presentation/CityScenes.tsx'
RESULT = '92f79cc4c0137aa03e9065f05f8882c2e3496744dc4441aa98bc14f0bbc20ee2'

TRAINING_RESULT = '9cc44538f65220cd889194bb2d218af775549040234b94c5c743b3d8de056626'
COMBINED_RESULT = '6a08268930ece51aa9d045b2dd27fd7ed8658c56787ab7639b6046925cdc4235'

def continues_training_scene(path, predecessor, root=ROOT):
    return (path == SCENE and predecessor == TRAINING_RESULT
            and (root/path).is_file() and sha((root/path).read_bytes()) == COMBINED_RESULT)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def original(path):
    return subprocess.check_output(['git', '-C', str(ROOT), 'show', BASE + ':' + path])

@lru_cache(maxsize=1)
def predecessors():
    values = {sha(original(SCENE))}
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
            item = items.get(SCENE)
            if isinstance(item, str):
                values.add(item)
            elif isinstance(item, list):
                values.update(item)
            elif isinstance(item, dict):
                for key in ('before', 'after', 'baseSha256', 'uiSha256', 'currentSha256'):
                    if isinstance(item.get(key), str):
                        values.add(item[key])
    return frozenset(values)

def accepts(path, predecessor, root=ROOT):
    if path != SCENE or predecessor not in predecessors():
        return False
    source = root / path
    return source.is_file() and (sha(source.read_bytes()) == RESULT or continues_training_scene(path, TRAINING_RESULT, root))
