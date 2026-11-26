"""Positive pin and negative scope/SHA tests for the separate issue #38 successor."""
from pathlib import Path
import tempfile
import unittest
import issue38_visual_successor as gate
import settlement_map_picker_successor as picker

class ExactVisualSuccessor(unittest.TestCase):
    def test_immutable_sources_and_existing_predecessors(self):
        gate.validate()
        targets, grants = gate.exact_scope()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for p in gate.SOURCES:
                file = root / p
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(gate.git("show", gate.IMPLEMENTATION + ":" + p))
                for predecessor in grants[p]:
                    self.assertTrue(gate.accepts(p, predecessor, root))
                self.assertFalse(gate.accepts(p, '0' * 64, root))
                file.write_bytes(file.read_bytes() + b'\n// tampered\n')
                self.assertFalse(gate.accepts(p, next(iter(grants[p])), root))
            before, after = gate.expected_city_adapter()
            city_gate = root / gate.CITY_GATE
            city_gate.parent.mkdir(parents=True, exist_ok=True)
            city_gate.write_bytes(after)
            self.assertTrue(gate.accepts_city_adapter(gate.CITY_GATE, gate.sha(before), root))
            self.assertFalse(gate.accepts_city_adapter(gate.CITY_GATE, '0' * 64, root))
            city_gate.write_bytes(after + b'\n# tampered\n')
            self.assertFalse(gate.accepts_city_adapter(gate.CITY_GATE, gate.sha(before), root))
            for p in gate.NEW | {'src/game/formal/reducer.ts', 'src/game/MiniatureCity.tsx', 'src/game/presentation/CityScenes.tsx'}:
                self.assertFalse(gate.accepts(p, next(iter(targets.values())), root))

    def test_map_picker_continues_exact_sources_only(self):
        path = 'src/game/FormalWorldMap.tsx'
        targets, grants = gate.exact_scope()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for p in picker.SOURCES:
                f = root / p
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes((gate.ROOT / p).read_bytes())
            picker.validate_sources(root)
            self.assertEqual(picker.PREDECESSORS[path], targets[path])
            for p, predecessor in picker.PREDECESSORS.items():
                self.assertTrue(picker.continues_file(p, predecessor, root))
                self.assertFalse(picker.continues_file(p, '0' * 64, root))
            for predecessor in grants[path]:
                self.assertTrue(gate.accepts(path, predecessor, root))
            for p in picker.SOURCES:
                f = root / p
                original = f.read_bytes()
                f.unlink()
                with self.assertRaises(AssertionError):
                    picker.validate_sources(root)
                f.write_bytes(original + b'// altered')
                with self.assertRaises(AssertionError):
                    picker.validate_sources(root)
                f.write_bytes(original)
            picker.validate_sources(root)

    def test_sparse_guard_still_requires_exact_target_and_predecessor(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for p, predecessor in picker.PREDECESSORS.items():
                file = root / p
                file.parent.mkdir(parents=True, exist_ok=True)
                self.assertFalse(picker.continues_file(p, predecessor, root))
                exact = (gate.ROOT / p).read_bytes()
                file.write_bytes(exact)
                self.assertTrue(picker.continues_file(p, predecessor, root))
                self.assertFalse(picker.continues_file(p, '0' * 64, root))
                file.write_bytes(exact + b'// altered')
                self.assertFalse(picker.continues_file(p, predecessor, root))
                file.unlink()


if __name__ == '__main__':
    unittest.main()
