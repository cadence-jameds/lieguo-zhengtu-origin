"""Exercise exact successor admission and tamper rejection in disposable copies."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path

import city_ui_successor as gate


class SuccessorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='city-ui-gate-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        record = json.loads((gate.ROOT / gate.RECORD).read_text())
        paths = {gate.RECORD, *gate.SOURCES, *gate.HISTORICAL, *gate.VISUAL_INVARIANTS, *record['evidenceFiles']}
        for path in paths:
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(gate.ROOT / path, target)
        (self.root / '.git').symlink_to(gate.ROOT / '.git', target_is_directory=True)

    def record(self):
        return json.loads((self.root / gate.RECORD).read_text())

    def write_record(self, record):
        (self.root / gate.RECORD).write_text(json.dumps(record))

    def test_exact_successor_and_every_recorded_predecessor(self):
        record = gate.validate_ui_successor(self.root)
        for path, entry in record['changes'].items():
            for digest in entry['acceptedPredecessorSha256']:
                self.assertTrue(gate.accepts_ui_successor(path, digest, self.root))

    def test_unknown_predecessor_or_unprotected_file_is_not_admitted(self):
        self.assertFalse(gate.accepts_ui_successor('src/game/game.css', '0' * 64, self.root))
        for path in ['public/art/unified/cities-imperial.webp', 'src/game/formal/runtime.ts', '../other']:
            self.assertFalse(gate.accepts_ui_successor(path, '0' * 64, self.root))

    def test_source_edit_cannot_be_admitted_by_refreshing_its_hash(self):
        for path in gate.SOURCES:
            with self.subTest(path=path):
                source = self.root / path
                original, record = source.read_bytes(), self.record()
                source.write_bytes(original + b'\n/* unreviewed */\n')
                modified = self.record()
                modified['changes'][path]['uiSha256'] = gate.sha(source.read_bytes())
                self.write_record(modified)
                with self.assertRaises(AssertionError):
                    gate.validate_ui_successor(self.root)
                source.write_bytes(original)
                self.write_record(record)

    def test_historical_manifests_cannot_be_refreshed(self):
        for path in gate.HISTORICAL:
            with self.subTest(path=path):
                source = self.root / path
                original, record = source.read_bytes(), self.record()
                source.write_bytes(original + b'\n')
                modified = self.record()
                modified['historicalEvidence'][path] = gate.sha(source.read_bytes())
                self.write_record(modified)
                with self.assertRaises(AssertionError):
                    gate.validate_ui_successor(self.root)
                source.write_bytes(original)
                self.write_record(record)

    def test_browser_results_cannot_be_forged_by_refreshing_hash(self):
        path = gate.EVIDENCE + '/browser-result.json'
        browser = json.loads((self.root / path).read_text())
        browser['results'][0]['status'] = 'FAIL'
        (self.root / path).write_text(json.dumps(browser))
        record = self.record()
        record['evidenceFiles'][path] = gate.sha((self.root / path).read_bytes())
        self.write_record(record)
        with self.assertRaises(AssertionError):
            gate.validate_ui_successor(self.root)

    def test_screenshot_bytes_cannot_be_replaced(self):
        path = gate.EVIDENCE + '/after-320x568-imperial.jpg'
        (self.root / path).write_bytes(b'replacement screenshot')
        record = self.record()
        record['evidenceFiles'][path] = gate.sha((self.root / path).read_bytes())
        self.write_record(record)
        with self.assertRaises(AssertionError):
            gate.validate_ui_successor(self.root)

    def test_omitting_a_witness_is_rejected(self):
        record = self.record()
        del record['evidenceFiles'][gate.EVIDENCE + '/checks.json']
        self.write_record(record)
        with self.assertRaises(AssertionError):
            gate.validate_ui_successor(self.root)

    def test_replacing_commit_identity_is_rejected(self):
        record = self.record()
        record['uiCommit'] = gate.BASE
        self.write_record(record)
        with self.assertRaises(AssertionError):
            gate.validate_ui_successor(self.root)

    def test_adding_another_eligible_source_is_rejected(self):
        record = self.record()
        record['changes']['src/game/formal/runtime.ts'] = record['changes']['src/game/game.css']
        self.write_record(record)
        with self.assertRaises(AssertionError):
            gate.validate_ui_successor(self.root)

    def test_calibration_and_asset_mapping_changes_are_rejected(self):
        for path in gate.VISUAL_INVARIANTS:
            with self.subTest(path=path):
                source, record = self.root / path, self.record()
                original = source.read_bytes()
                source.write_bytes(original + b'\n')
                modified = self.record()
                modified['visualInvariants'][path] = gate.sha(source.read_bytes())
                self.write_record(modified)
                with self.assertRaises(AssertionError):
                    gate.validate_ui_successor(self.root)
                source.write_bytes(original)
                self.write_record(record)


if __name__ == '__main__':
    unittest.main()
