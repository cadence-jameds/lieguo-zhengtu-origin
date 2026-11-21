import tempfile
import unittest
from pathlib import Path

import traditional_incoming_intelligence_successor as proof


class IncomingIntelligenceProof(unittest.TestCase):
    def test_exact_files_and_per_path_predecessor(self):
        with tempfile.TemporaryDirectory(prefix='intel-proof-') as directory:
            root = Path(directory)
            for path in proof.SOURCES:
                dest = root / path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes((proof.ROOT / path).read_bytes())
            proof.validate(root)
            world = 'src/game/worldProjection.ts'
            other = 'src/game/presentationStore.ts'
            digest = proof.sha(proof.previous(proof.BASE, world))
            self.assertTrue(proof.accepts(world, digest, root))
            self.assertFalse(proof.accepts(other, digest, root))
            self.assertFalse(proof.accepts('src/game/formal/aiKnowledge.ts', digest, root))
            for path in [world, *proof.ADDITIONS]:
                target = root / path
                old = target.read_bytes()
                target.write_bytes(old + b'\n')
                with self.subTest(path=path), self.assertRaises(AssertionError):
                    proof.validate(root)
                self.assertFalse(proof.accepts(path, digest, root))
                target.write_bytes(old)


if __name__ == '__main__':
    unittest.main()
