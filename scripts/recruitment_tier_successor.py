"""Exact recruitment tiers successor; original records remain unchanged."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '283e10f537d1451cddfd9fbaa5c04c003042c5be'
LEGACY_BASE = '1c8b0bb851d651a54cf1418ab7416e4279ce4448'
IMPLEMENTATION = '185aa9a60d875bc4bcfce70a1db1537cac6a1977'
SCOPE = ['releases/notes/recruitment-tier-cards.json', 'src/game/presentation/DevelopmentViews.tsx', 'src/game/presentation/RecruitmentForm.tsx', 'src/game/presentation/cityActions.ts', 'src/game/presentation/recruitmentInput.test.tsx', 'src/game/presentation/recruitmentLines.test.tsx', 'src/game/presentation/recruitmentLines.ts']
EXISTING = ['src/game/presentation/DevelopmentViews.tsx', 'src/game/presentation/RecruitmentForm.tsx', 'src/game/presentation/cityActions.ts', 'src/game/presentation/recruitmentInput.test.tsx', 'scripts/recruit_input_successor.py', 'scripts/b10_r3_05_successor.py']
ADAPTERS = ['scripts/recruit_input_successor.py', 'scripts/b10_r3_05_successor.py']

def sha(data):
    return hashlib.sha256(data).hexdigest()

def original(path, revision=BASE):
    return subprocess.check_output(['git', '-C', str(ROOT), 'show', revision + ':' + path], stderr=subprocess.DEVNULL)

@lru_cache(maxsize=1)
def targets():
    git=['git','-C',str(ROOT)]
    assert subprocess.check_output([*git,'rev-parse',IMPLEMENTATION+'^'],text=True).strip()==BASE
    changed=subprocess.check_output([*git,'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines()
    assert sorted(changed)==SCOPE
    return {p:sha(original(p, IMPLEMENTATION)) for p in SCOPE}

@lru_cache(maxsize=1)
def adapter_digests():
    committed = {'scripts/recruit_input_successor.py':'7284503d21de33beead421266697b42e2140e056f3705b8806aabe242c703d95','scripts/b10_r3_05_successor.py':'5990e3c1f37f089e78f47c08bdc8ca04a7d207de90ba3e4083c3a68c57aa7bc2'}
    return committed


@lru_cache(maxsize=1)
def predecessors():
    values = {p: {sha(original(p))} for p in EXISTING}
    for p in values:
        values[p].add(sha(original(p, LEGACY_BASE)))
    from settlement_training_slots_successor import RESULTS as shared_slots
    for p in ('src/game/presentation/DevelopmentViews.tsx','src/game/presentation/cityActions.ts'):
        values[p].add(shared_slots[p])
    paths = subprocess.check_output(['git', '-C', str(ROOT), 'ls-tree', '-r', '--name-only', LEGACY_BASE, '--', 'docs/validation', 'docs/art-unification'], text=True)
    for path in paths.splitlines():
        if not path.endswith('.json'):
            continue
        data = json.loads(original(path, LEGACY_BASE))
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
    if path not in EXISTING or predecessor not in predecessors()[path]:
        return False
    source = root / path
    return source.is_file() and sha(source.read_bytes()) == (targets() | adapter_digests())[path]

def validate(root=ROOT):
    for p, want in (targets() | adapter_digests()).items():
        assert sha((root/p).read_bytes()) == want, ('Unpinned recruitment tier change',p)
