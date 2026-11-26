"""Exact political navigation UI successor; original records remain unchanged."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c8b3554ff9643b74b624e4e77f381653afcccc20'
RESULTS = {
    'src/game/GameApp.tsx': '8dd59bff17f326711d3bbf20e09f0fc54c343237b7b9f5085e88d80513b9bccd',
    'src/game/MobileNavigationSettings.tsx': 'a3a734be55ece8c2e33032ea6977f80389f40c9f40a7817a97c16d3c6e673171',
    'src/game/presentation/LegionView.tsx': 'f76733faf3ab28ce78f85a3679b34b221a6bc75ff700a1f67a3f79b3e92120bb',
    'src/game/presentation/Shell.tsx': '8b5dcc4991a07c3411584f488732dad284bb540006550d60bb81c1f65b6698ac',
    'src/game/presentation/WonderPanel.tsx': '365f6aabf0370c92d8060bb1374e337968149a7bd70b2c23fad24e2efa6cc74e',
}

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
    if source.is_file() and sha(source.read_bytes()) == RESULTS[path]:
        return True
    from hud_pictogram_successor import accepts as hud
    return hud(path, RESULTS[path], root)
