import tempfile
import unittest
from pathlib import Path
import recruitment_tier_successor as gate


class ExactRecruitmentSuccessor(unittest.TestCase):
    def test_only_the_exact_recruitment_sources_are_admitted(self):
        for path in gate.RESULTS:
            predecessor = gate.sha(gate.original(path))
            self.assertTrue(gate.accepts(path, predecessor))
            self.assertFalse(gate.accepts(path, '0' * 64))
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                file = root / path
                file.parent.mkdir(parents=True)
                file.write_bytes((gate.ROOT / path).read_bytes() + b'\n// unreviewed')
                self.assertFalse(gate.accepts(path, predecessor, root))
        self.assertFalse(gate.accepts('src/game/formal/combatModifiers.ts', '0' * 64))

    def test_r302_retains_the_original_adapter_digest(self):
        import b10_r3_02_successor as predecessor
        import b10_r3_05_successor as persistence
        path = 'scripts/recruit_input_successor.py'
        original = predecessor.adapters()[path]
        self.assertEqual(gate.sha(original), '218c4c4d1767552bbacc7e87a523a64503febba6e2952670d80a34312ba0bffc')
        self.assertTrue(persistence.accepts_adapter(path, original))
        self.assertFalse(persistence.accepts_adapter(path, original + b' '))


if __name__ == '__main__':
    unittest.main()
