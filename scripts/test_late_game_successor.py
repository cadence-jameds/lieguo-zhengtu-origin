import tempfile
import unittest
from pathlib import Path

import late_game_successor as gate


class LateGameSuccessorTests(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory(prefix='late-game-proof-')
        self.addCleanup(td.cleanup)
        self.root = Path(td.name)
        for path in {*gate.SOURCES, gate.BOUNDARY}:
            dest = self.root / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes((gate.ROOT / path).read_bytes())

    def test_exact_files_and_known_path_specific_predecessors(self):
        record = gate.validate(self.root)
        self.assertEqual(set(record['changes']), gate.SOURCES)
        for path, entry in record['changes'].items():
            if entry['before']:
                self.assertTrue(gate.accepts(path, entry['before'], self.root))
            self.assertFalse(gate.accepts(path, '0' * 64, self.root))
        reducer = 'src/game/formal/reducer.ts'
        order = 'src/game/orderAdmission.ts'
        self.assertFalse(gate.accepts(order, record['changes'][reducer]['before'], self.root))
        self.assertFalse(gate.accepts('src/game/formal/schema.ts', record['changes'][reducer]['before'], self.root))

    def test_tampering_fails_even_when_new_source_has_no_predecessor(self):
        for path in ['src/game/formal/economy.ts', 'src/game/formal/logisticsRoute.ts', 'src/game/orderAdmission.ts']:
            target = self.root / path
            original = target.read_bytes()
            target.write_bytes(original + b'\n')
            with self.subTest(path=path), self.assertRaises(AssertionError):
                gate.validate(self.root)
            target.write_bytes(original)

    def test_projection_adapter_only_accepts_the_exact_historical_predecessor_and_edit(self):
        path = gate.BOUNDARY
        before = gate.previous(gate.BASE, path)
        target = self.root / path
        self.assertTrue(gate.accepts_adapter(path, before, self.root))
        self.assertFalse(gate.accepts_adapter(path, before + b'\n', self.root))
        self.assertFalse(gate.accepts_adapter('.github/workflows/ci.yml', before, self.root))
        target.write_bytes(target.read_bytes() + b'\n')
        self.assertFalse(gate.accepts_adapter(path, before, self.root))
        with self.assertRaises(AssertionError):
            gate.validate(self.root)


if __name__ == '__main__':
    unittest.main()
