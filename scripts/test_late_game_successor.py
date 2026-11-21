import tempfile
import unittest
from pathlib import Path

import late_game_successor as gate


class LateGameSuccessorTests(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory(prefix='late-game-proof-')
        self.addCleanup(td.cleanup)
        self.root = Path(td.name)
        for path in {*gate.SOURCES, *gate.CHILD_SOURCES, *gate.RESEARCH_SOURCES, gate.BOUNDARY}:
            dest = self.root / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes((gate.ROOT / path).read_bytes())

    def test_exact_files_and_known_path_specific_predecessors(self):
        record = gate.validate(self.root)
        self.assertEqual(set(record['changes']), gate.SOURCES | gate.CHILD_SOURCES | gate.RESEARCH_SOURCES)
        for path, entry in record['changes'].items():
            if entry['before']:
                self.assertTrue(gate.accepts(path, entry['before'], self.root))
            self.assertFalse(gate.accepts(path, '0' * 64, self.root))
        reducer = 'src/game/formal/reducer.ts'
        order = 'src/game/orderAdmission.ts'
        self.assertFalse(gate.accepts(order, record['changes'][reducer]['before'], self.root))
        self.assertFalse(gate.accepts('src/game/formal/schema.ts', record['changes'][reducer]['before'], self.root))

    def test_cooperation_child_accepts_only_exact_bytes_and_order_predecessors(self):
        order = 'src/game/orderAdmission.ts'
        previous = gate.previous(gate.CHILD_BASE, order)
        target = self.root / order
        self.assertTrue(gate.accepts(order, gate.sha(previous), self.root))
        self.assertFalse(gate.accepts(order, gate.sha(gate.previous(gate.CHILD_BASE, 'src/game/formal/reducer.ts')), self.root))
        target.write_bytes(previous)
        self.assertFalse(gate.accepts(order, gate.sha(previous), self.root))
        with self.assertRaisesRegex(AssertionError, order):
            gate.validate(self.root)

    def test_completed_research_requires_exact_reducer_and_path_specific_predecessor(self):
        path = gate.RESEARCH_REDUCER
        before = gate.previous(gate.RESEARCH_BASE, path)
        outgoing = gate.sha(before)
        self.assertTrue(gate.accepts(path, outgoing, self.root))
        self.assertFalse(gate.accepts(path, gate.sha(gate.previous(gate.RESEARCH_BASE, 'src/game/orderAdmission.ts')), self.root))
        for added in gate.RESEARCH_ADDITIONS:
            self.assertFalse(gate.accepts(added, outgoing, self.root))
        (self.root / path).write_bytes(before)
        self.assertFalse(gate.accepts(path, outgoing, self.root))
        with self.assertRaisesRegex(AssertionError, path):
            gate.validate(self.root)

    def test_tampering_fails_even_when_new_source_has_no_predecessor(self):
        for path in sorted({'src/game/formal/economy.ts', 'src/game/formal/logisticsRoute.ts'} | gate.CHILD_SOURCES | gate.RESEARCH_SOURCES):
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
