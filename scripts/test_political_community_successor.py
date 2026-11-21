import tempfile
import unittest
from pathlib import Path

from political_community_successor import RESULTS, ROOT, accepts, original, sha

class PoliticalCommunitySuccessorTest(unittest.TestCase):
    def test_accepts_only_attested_presentational_blobs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for path in RESULTS:
                output = root / path
                output.parent.mkdir(exist_ok=True, parents=True)
                output.write_bytes((ROOT / path).read_bytes())
                old = sha(original(path))
                self.assertTrue(accepts(path, old, root))
                self.assertFalse(accepts(path, '0' * 64, root))
                output.write_bytes(output.read_bytes() + b'\n')
                self.assertFalse(accepts(path, old, root))
            self.assertFalse(accepts('src/game/formal/politics.ts', old, root))

if __name__ == '__main__':
    unittest.main()
