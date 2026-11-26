"""Finite late-game implementation pin. Historical rules, tests and records are not changed."""
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '20cabc920d370e7e8230a8ebfc19917c3edeff93'
IMPLEMENTATION = 'bca6c054fcbb7dee447400ce0f395413dcbf624d'
CHILD_BASE = IMPLEMENTATION
CHILD_IMPLEMENTATION = '6aa370bfdd74fcad03c9abb001940ff8c46cc2aa'
CHILD_SOURCES = {
    'src/game/orderAdmission.ts',
    'src/game/formal/politicalAdmissionRuntime.test.ts',
    'src/game/formal/routing.ts',
}
RESEARCH_BASE = '96a264576794b701f33a0f38fbb33a34c6fec457'
RESEARCH_IMPLEMENTATION = 'be9220837061ad55a0058839677bf5c153b3b69e'
RESEARCH_REDUCER = 'src/game/formal/reducer.ts'
RESEARCH_ADDITIONS = {
    'src/game/formal/offlineCompletedResearch.test.ts',
    'releases/notes/offline-completed-research.json',
}
RESEARCH_SOURCES = {RESEARCH_REDUCER, *RESEARCH_ADDITIONS}
# This compiled source port preserves the measured drafts and current recruitment.
# Pin its exact complete scope, but issue historical grants only on runtime paths.
REPLAY_BASE = '1bcf7bb3156f044088341f92f06ef574fe3ba3cc'
REPLAY_IMPLEMENTATION = '20914d171f72381f64585ad00e32706f48649e3a'
REPLAY_RUNTIME = {
    'src/game/formal/autonomy.ts',
    'src/game/formal/commandLedger.ts',
    RESEARCH_REDUCER,
}
REPLAY_SOURCES = {
    *REPLAY_RUNTIME,
    'releases/notes/offline-command-shipment-drafts.json',
    'src/game/formal/offlineBreakthroughShippingDraft.test.ts',
    'src/game/formal/offlinePendingMembershipRecovery.test.ts',
    'src/game/formal/offlineShippingDraftRecovery.test.ts',
}
REPLAY_ART_WITNESSES = {
    'docs/art-unification/city-fit/measurements.json',
    'docs/art-unification/elite-review-20261029/protected.json',
    'docs/art-unification/elite-review-20261029/browser-manifest.json',
    'docs/art-unification/elite-final-20261030/browser-manifest.json',
    'docs/art-unification/japan-approved-20261030/browser-manifest.json',
    'docs/art-unification/player-feedback-20261029/protected.json',
    'docs/art-unification/player-feedback-20261029/compatibility.json',
}
BOUNDARY = 'scripts/verify-projection-boundaries.mjs'
SOURCES = {
    'docs/b10-p0-offline/LATE-LOGISTICS.md',
    'releases/notes/late-game-reliability.json',
    'src/game/formal/economy.ts',
    'src/game/formal/logisticsAllocation.ts',
    'src/game/formal/logisticsPerformance.test.ts',
    'src/game/formal/logisticsRoute.ts',
    'src/game/formal/offlineCommandScheduler.test.ts',
    'src/game/formal/politicalAdmissionRuntime.test.ts',
    'src/game/formal/reducer.ts',
    'src/game/formal/reportScope.ts',
    'src/game/orderAdmission.ts',
    'src/game/presentation/BattleReportBody.tsx',
    'src/game/presentation/FormalReportsView.tsx',
    'src/game/presentation/formalReportCorrections.test.tsx',
}


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], stderr=subprocess.DEVNULL)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def previous(ref, path):
    return git('show', f'{ref}:{path}')


def replace_once(text, before, after):
    assert text.count(before) == 1, ('Unexpected projection-boundary predecessor', before)
    return text.replace(before, after)


@lru_cache(maxsize=1)
def boundary_bytes():
    source = previous(BASE, BOUNDARY).decode()
    before, = (line for line in source.splitlines() if line.startswith('const admitted=p=>'))
    assert before.endswith('bounded(p)||Object.hasOwn(successor.changes,p)||Object.hasOwn(runtimeSuccessor.changes,p);')
    source = replace_once(source, before, (
        "const lateSuccessor=JSON.parse(execFileSync('python3',['scripts/late_game_successor.py','--boundary-record'],"
        "{encoding:'utf8',stdio:['ignore','pipe','pipe']}));\n"
        "const late=p=>Object.hasOwn(lateSuccessor.changes,p);\n"
        + before.replace('const admitted=p=>', 'const admitted=p=>late(p)||', 1)
    ))
    old_comment = (
        '// The only intentional economy runtime addition is a formal-only guard; the\n'
        '// authoritative branch is byte-identical after removing that guard.\n'
    )
    source = replace_once(source, old_comment, (
        '// Without the pinned late-game logistics successor, economy must retain\n'
        '// the exact historic implementation after removing its formal-only guard.\n'
        "if(!late('src/game/formal/economy.ts'))"
    ))
    source = replace_once(source, 'formalEconomyEquivalent:true', (
        "formalEconomySource:late('src/game/formal/economy.ts')?'finite late-game logistics successor plus parity':'historical guard equivalent'"
    ))
    return source.encode()


@lru_cache(maxsize=1)
def exact_scope():
    assert git('rev-list', '--parents', '-n', '1', IMPLEMENTATION).decode().split() == [IMPLEMENTATION, BASE], 'Incorrect late-game predecessor'
    actual = set(git('diff', '--name-only', BASE, IMPLEMENTATION).decode().splitlines())
    assert actual == SOURCES, ('Unexpected late-game source scope', actual ^ SOURCES)
    changes, grants = {}, {}
    for path in sorted(SOURCES):
        try:
            before = sha(previous(BASE, path))
        except subprocess.CalledProcessError:
            before = None
        changes[path] = {'before': before, 'after': sha(previous(IMPLEMENTATION, path))}
        grants[path] = {before} if before else set()
    assert git('rev-list', '--parents', '-n', '1', CHILD_IMPLEMENTATION).decode().split() == [CHILD_IMPLEMENTATION, CHILD_BASE], 'Incorrect cooperation predecessor'
    actual = set(git('diff', '--name-only', CHILD_BASE, CHILD_IMPLEMENTATION).decode().splitlines())
    assert actual == CHILD_SOURCES, ('Unexpected cooperation source scope', actual ^ CHILD_SOURCES)
    # The child must directly follow the exact staged implementation, before adding projection proofs.
    for path, change in changes.items():
        assert sha(previous(CHILD_BASE, path)) == change['after'], ('Incorrect cooperation baseline', path)
    assert previous(CHILD_BASE, BOUNDARY) == previous(BASE, BOUNDARY), 'Incorrect cooperation projection baseline'
    for path in sorted(CHILD_SOURCES):
        if path in changes:
            grants[path].add(changes[path]['after'])
        else:
            before = sha(previous(BASE, path))
            assert sha(previous(CHILD_BASE, path)) == before, ('Incorrect cooperation baseline', path)
            changes[path] = {'before': before}
            grants[path] = {before}
        changes[path]['after'] = sha(previous(CHILD_IMPLEMENTATION, path))
    # Historical predecessors are sourced from the fixed baseline commit,
    # never from the live checkout, a submitted local hash, or another path.
    records = git('ls-tree', '-r', '--name-only', BASE, 'docs/validation').decode().splitlines()
    for filename in records:
        if not filename.endswith('/compatibility.json'):
            continue
        proof = json.loads(previous(BASE, filename))
        for path, allowed in grants.items():
            changed = proof.get('changes', {}).get(path, {})
            for h in [proof.get('invariants', {}).get(path), changed.get('before'), changed.get('after'), *proof.get('grants', {}).get(path, [])]:
                if isinstance(h, str) and len(h) == 64:
                    allowed.add(h)

    # This successor only changes the reducer and adds two previously absent files.
    assert git('rev-list', '--parents', '-n', '1', RESEARCH_IMPLEMENTATION).decode().split() == [RESEARCH_IMPLEMENTATION, RESEARCH_BASE], 'Incorrect completed-research predecessor'
    actual = set(git('diff', '--name-only', '--no-renames', RESEARCH_BASE, RESEARCH_IMPLEMENTATION).decode().splitlines())
    assert actual == RESEARCH_SOURCES, ('Unexpected completed-research source scope', actual ^ RESEARCH_SOURCES)
    for path, change in changes.items():
        assert sha(previous(RESEARCH_BASE, path)) == change['after'], ('Incorrect completed-research baseline', path)
    assert previous(RESEARCH_BASE, BOUNDARY) == boundary_bytes(), 'Incorrect completed-research projection baseline'
    grants[RESEARCH_REDUCER].add(changes[RESEARCH_REDUCER]['after'])
    changes[RESEARCH_REDUCER]['after'] = sha(previous(RESEARCH_IMPLEMENTATION, RESEARCH_REDUCER))
    for path in sorted(RESEARCH_ADDITIONS):
        assert not git('ls-tree', '-r', '--name-only', RESEARCH_BASE, '--', path), ('Expected new completed-research file', path)
        changes[path] = {'before': None, 'after': sha(previous(RESEARCH_IMPLEMENTATION, path))}
        grants[path] = set()
    # Compose only after independently verifying the complete predecessor stack.
    assert git('rev-list', '--parents', '-n', '1', REPLAY_IMPLEMENTATION).decode().split() == [REPLAY_IMPLEMENTATION, REPLAY_BASE], 'Incorrect replay work predecessor'
    actual = set(git('diff', '--name-only', '--no-renames', REPLAY_BASE, REPLAY_IMPLEMENTATION).decode().splitlines())
    assert actual == REPLAY_SOURCES, ('Unexpected replay work scope', actual ^ REPLAY_SOURCES)
    for path, change in changes.items():
        assert sha(previous(REPLAY_BASE, path)) == change['after'], ('Incorrect replay work baseline', path)
    assert previous(REPLAY_BASE, BOUNDARY) == boundary_bytes(), 'Incorrect replay projection baseline'
    for path in sorted(REPLAY_SOURCES):
        if path not in changes:
            try:
                before = sha(previous(REPLAY_BASE, path))
            except subprocess.CalledProcessError:
                before = None
            changes[path] = {'before': before}
            grants[path] = {before} if before and path in REPLAY_RUNTIME else set()
        else:
            assert path in REPLAY_RUNTIME, ('Unexpected overlap with earlier gate', path)
            grants[path].add(changes[path]['after'])
        changes[path]['after'] = sha(previous(REPLAY_IMPLEMENTATION, path))
    # These witnesses are historical Git objects, not live/editable manifests.
    for record in git('ls-tree', '-r', '--name-only', REPLAY_BASE, 'docs/validation').decode().splitlines():
        if not record.endswith('/compatibility.json'):
            continue
        proof = json.loads(previous(REPLAY_BASE, record))
        for path in REPLAY_RUNTIME:
            item = proof.get('changes', {}).get(path, {})
            values = [proof.get('invariants', {}).get(path), item.get('before'), item.get('after'), *proof.get('grants', {}).get(path, [])]
            grants[path].update(h for h in values if isinstance(h, str) and len(h) == 64)
    for record in sorted(REPLAY_ART_WITNESSES):
        proof = json.loads(previous(REPLAY_BASE, record))
        for path in REPLAY_RUNTIME:
            update = proof.get('updates', {}).get(path, {})
            for h in [*(proof.get(section, {}).get(path) for section in ('files', 'sources', 'sourceFiles', 'renderFiles')), update.get('baselineSha256'), update.get('currentSha256')]:
                if isinstance(h, str) and len(h) == 64:
                    grants[path].add(h)
    return changes, {path: frozenset(values) for path, values in grants.items()}


def accepts_adapter(path, before, root=ROOT):
    target = root / path
    return path == BOUNDARY and before == previous(BASE, BOUNDARY) and target.is_file() and target.read_bytes() == boundary_bytes()


def accepts(path, predecessor, root=ROOT):
    if path == BOUNDARY:
        base_bytes = previous(BASE, BOUNDARY)
        return predecessor == sha(base_bytes) and accepts_adapter(path, base_bytes, root)
    if path not in SOURCES | CHILD_SOURCES | RESEARCH_SOURCES | REPLAY_RUNTIME:
        from special_unit_portraits_successor import accepts as portraits
        return portraits(path, predecessor, root)
    changes, grants = exact_scope()
    target = root / path
    return predecessor in grants[path] and target.is_file() and sha(target.read_bytes()) == changes[path]['after']


def validate(root=ROOT):
    from special_unit_portraits_successor import validate as validate_portraits
    if root == ROOT:
        validate_portraits(root)
    changes, _ = exact_scope()
    for path, change in changes.items():
        target = root / path
        assert target.is_file() and sha(target.read_bytes()) == change['after'], ('Unpinned late-game implementation', path)
    assert accepts_adapter(BOUNDARY, previous(BASE, BOUNDARY), root), 'Unpinned late-game projection adapter'
    return {'changes': changes}


if __name__ == '__main__':
    record = validate()
    print(json.dumps(record) if '--boundary-record' in sys.argv else
          f'PASS: exact late-game implementation at {IMPLEMENTATION} and cooperation child {CHILD_IMPLEMENTATION} and completed-research successor {RESEARCH_IMPLEMENTATION} with historical gates unchanged.')
