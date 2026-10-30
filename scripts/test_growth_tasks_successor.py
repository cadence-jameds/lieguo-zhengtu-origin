"""Verify finite authorization and reject changed source/history even with refreshed hashes."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import growth_tasks_successor as gate


class GrowthSuccessorTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='growth-successor-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        record = json.loads((gate.ROOT / gate.RECORD).read_text())
        for path in {gate.RECORD, *record['changes'], *record['historical'], *record['evidence']}:
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(gate.ROOT / path, target)
        (self.root / '.git').symlink_to(gate.ROOT / '.git', target_is_directory=True)

    def test_exact_sources_and_predecessors_only(self):
        record = gate.validate(self.root)
        for path in gate.SOURCES:
            self.assertTrue(gate.accepts(path, record['changes'][path]['before'], self.root))
            self.assertFalse(gate.accepts(path, '0' * 64, self.root))
        for path in ['src/game/formal/runtime.ts', 'public/art/unified/units/elite.guard.civ_frankia.webp']:
            self.assertFalse(gate.accepts(path, '0' * 64, self.root))

    def test_refreshing_hashes_cannot_admit_modified_sources_or_proofs(self):
        manifest = self.root / gate.RECORD
        original = manifest.read_bytes()
        record = json.loads(original)
        cases = [('changes', path) for path in gate.SOURCES]
        cases += [('historical', gate.PROTECTED)]
        cases += [('evidence', path) for path in record['evidence'] if path.endswith(('legacy-v1.json', 'browser-result.json', 'growthTaskRewardsV1.ts', '390-ready.jpg'))]
        for section, path in cases:
            with self.subTest(path=path):
                source = self.root / path
                data = source.read_bytes()
                source.write_bytes(data + b'\n')
                altered = json.loads(original)
                if section == 'changes':
                    altered[section][path]['after'] = gate.sha(source.read_bytes())
                else:
                    altered[section][path] = gate.sha(source.read_bytes())
                manifest.write_text(json.dumps(altered))
                with self.assertRaises(AssertionError):
                    gate.validate(self.root)
                source.write_bytes(data)
                manifest.write_bytes(original)

    def test_scope_commit_and_witness_omission_are_rejected(self):
        path = self.root / gate.RECORD
        original = path.read_text()
        for mutation in ['scope', 'commit', 'omit']:
            record = json.loads(original)
            if mutation == 'scope':
                record['changes']['src/game/formal/runtime.ts'] = next(iter(record['changes'].values()))
            elif mutation == 'commit':
                record['uiCommit'] = gate.BASE
            else:
                record['evidence'].pop(next(iter(record['evidence'])))
            path.write_text(json.dumps(record))
            with self.assertRaises(AssertionError):
                gate.validate(self.root)


if __name__ == '__main__':
    unittest.main()
