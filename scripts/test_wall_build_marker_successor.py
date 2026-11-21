import tempfile
import unittest
from pathlib import Path

from wall_build_marker_successor import ROOT, SCENE, accepts, original, sha

class WallMarkerSuccessorTest(unittest.TestCase):
    def test_only_exact_level_zero_city_scene_is_accepted(self):
        old = sha(original(SCENE))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / SCENE
            source.parent.mkdir(parents=True)
            source.write_bytes((ROOT / SCENE).read_bytes())
            self.assertTrue(accepts(SCENE, old, root))
            self.assertFalse(accepts(SCENE, '0' * 64, root))
            self.assertFalse(accepts('src/game/FormalCityPanel.tsx', old, root))
            source.write_bytes(source.read_bytes() + b'\n')
            self.assertFalse(accepts(SCENE, old, root))
            source.write_bytes(original(SCENE))
            self.assertFalse(accepts(SCENE, old, root))

if __name__ == '__main__':
    unittest.main()
