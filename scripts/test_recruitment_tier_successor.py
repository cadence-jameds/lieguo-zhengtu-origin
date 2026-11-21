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


if __name__ == '__main__':
    unittest.main()
