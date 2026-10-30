"""Reject source/evidence tampering even if a successor record is rehashed."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import mobile_town_successor as gate


class MobileSuccessorTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='mobile-town-gate-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        record = json.loads((gate.ROOT / gate.RECORD).read_text())
        paths = {gate.RECORD, *record['changes'], *record['invariants'], *record['historical'], *record['evidence']}
        for path in paths:
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(gate.ROOT / path, target)
        (self.root / '.git').symlink_to(gate.ROOT / '.git', target_is_directory=True)

    def test_exact_successor_and_unknown_predecessors(self):
        record = gate.validate(self.root)
        for path in gate.SOURCES:
            self.assertTrue(gate.accepts(path, record['changes'][path]['before'], self.root))
            self.assertFalse(gate.accepts(path, '0' * 64, self.root))
        self.assertFalse(gate.accepts('src/game/formal/runtime.ts', '0' * 64, self.root))

    def test_refreshing_source_or_evidence_hash_cannot_admit_tampering(self):
        record_path = self.root / gate.RECORD
        original = record_path.read_bytes()
        cases = [(section, path) for section in ['changes', 'invariants'] for path in json.loads(original)[section]]
        cases += [('historical', 'docs/validation/city-ui-integration/browser-result.json'),
                  ('evidence', gate.DIRECTORY + '/browser-result.json'),
                  ('evidence', gate.DIRECTORY + '/after-390-town.jpg')]
        for section, path in cases:
            with self.subTest(path=path):
                source = self.root / path
                data = source.read_bytes()
                source.write_bytes(data + b'\n')
                record = json.loads(original)
                if section == 'changes':
                    record[section][path]['after'] = gate.sha(source.read_bytes())
                else:
                    record[section][path] = gate.sha(source.read_bytes())
                record_path.write_text(json.dumps(record))
                with self.assertRaises(AssertionError):
                    gate.validate(self.root)
                source.write_bytes(data)
                record_path.write_bytes(original)

    def test_omitted_witness_and_replaced_commit_are_rejected(self):
        record_path = self.root / gate.RECORD
        original = record_path.read_text()
        for change in ['omit', 'commit', 'scope']:
            record = json.loads(original)
            if change == 'omit':
                record['evidence'].pop(next(iter(record['evidence'])))
            elif change == 'commit':
                record['uiCommit'] = gate.BASE
            else:
                record['changes']['src/game/formal/runtime.ts'] = next(iter(record['changes'].values()))
            record_path.write_text(json.dumps(record))
            with self.assertRaises(AssertionError):
                gate.validate(self.root)


if __name__ == '__main__':
    unittest.main()
