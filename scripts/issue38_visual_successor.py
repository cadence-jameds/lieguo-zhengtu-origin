"""Finite visual/carry successor for issue #38; never refresh historical evidence."""
import hashlib
import json
import re
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '771e5729bbb850b606bc1f9299f39f1927deeb41'
LEGACY_BASE = '0bd1a33bbfe173fc1e8b67a17eab66b5f4c3407f'
IMPLEMENTATION = 'c8813aa2f755bedd49bb912532254a1574f1c981'
SOURCES = frozenset({
    'src/game/FormalWorldMap.tsx',
    'src/game/presentation/DevelopmentViews.tsx',
    'src/game/presentation/Garrison.tsx',
    'src/game/presentation/RecruitmentForm.tsx',
    'src/game/presentation/cityVisuals.test.tsx',
    'src/game/presentation/cityVisuals.ts',
    'src/game/presentation/mapViewRules.ts',
})
NEW = frozenset({
    'src/game/presentation/issue38Presentation.test.tsx',
    'releases/notes/imperial-map-unit-carry.json',
})

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])

def sha(data):
    return hashlib.sha256(data).hexdigest()

@lru_cache(maxsize=1)
def exact_scope():
    assert git('rev-parse', IMPLEMENTATION + '^').decode().strip() == BASE, 'Wrong issue #38 predecessor'
    paths = set(git('diff', '--name-only', BASE, IMPLEMENTATION).decode().splitlines())
    assert paths == SOURCES | NEW, ('Unreviewed issue #38 source scope', paths ^ (SOURCES | NEW))
    targets = {path: sha(git('show', IMPLEMENTATION + ':' + path)) for path in paths}
    grants = {path: {sha(git('show', parent + ':' + path)) for parent in (BASE, LEGACY_BASE)} for path in SOURCES}
    def visit(entry):
        if isinstance(entry, dict):
            for key, value in entry.items():
                if key in SOURCES:
                    grants[key].update(re.findall(r'(?<![a-f0-9])[a-f0-9]{64}(?![a-f0-9])', json.dumps(value)))
                elif isinstance(value, (dict, list)):
                    visit(value)
        elif isinstance(entry, list):
            for value in entry:
                visit(value)
    for path in git('ls-tree', '-r', '--name-only', BASE, '--', 'docs/validation', 'docs/art-unification').decode().splitlines():
        if path.rsplit('/', 1)[-1] in {'compatibility.json', 'protected.json', 'measurements.json', 'browser-manifest.json'}:
            visit(json.loads(git('show', BASE + ':' + path)))
    return targets, grants

CITY_GATE = 'scripts/city_ui_successor.py'
CITY_ADAPTERS = (
    (
        "    if recorded != sha((root / path).read_bytes()):\n",
        "    if recorded != sha((root / path).read_bytes()):\n"
        "        from issue38_visual_successor import accepts as issue38_accepts\n"
        "        if issue38_accepts(path, recorded, root):return\n"
    ),
    (
        "def accepts_ui_successor(path, predecessor_sha, root=ROOT):\n",
        "def accepts_ui_successor(path, predecessor_sha, root=ROOT):\n"
        "    from issue38_visual_successor import accepts as issue38_accepts\n"
        "    if issue38_accepts(path, predecessor_sha, root):return True\n"
    ),
)

@lru_cache(maxsize=1)
def expected_city_adapter():
    original = git('show', BASE + ':' + CITY_GATE)
    candidate = original.decode()
    for before, after in CITY_ADAPTERS:
        assert candidate.count(before) == 1, 'Unexpected city gate adapter predecessor'
        candidate = candidate.replace(before, after)
    return original, candidate.encode()

def accepts_city_adapter(path, predecessor, root=ROOT):
    if path != CITY_GATE:
        return False
    before, after = expected_city_adapter()
    target = root / path
    return predecessor == sha(before) and target.is_file() and target.read_bytes() == after

def accepts(path, predecessor, root=ROOT):
    from recruitment_tier_successor import accepts as tier
    if path not in SOURCES:
        return tier(path, predecessor, root)
    targets, grants = exact_scope()
    target = root / path
    return predecessor in grants[path] and target.is_file() and (sha(target.read_bytes()) == targets[path] or tier(path, targets[path], root))

def validate(root=ROOT):
    from recruitment_tier_successor import accepts as tier, validate as tier_validate
    if root == ROOT: tier_validate(root)
    targets, _ = exact_scope()
    assert (root / CITY_GATE).read_bytes() == expected_city_adapter()[1], 'Changed finite issue #38 city gate adapter'
    for path, expected in targets.items():
        assert sha((root / path).read_bytes()) == expected or tier(path, expected, root), ('Unpinned issue #38 source', path)
