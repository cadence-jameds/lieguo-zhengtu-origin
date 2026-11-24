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

    def test_combination_does_not_allow_a_stale_wall_only_scene_as_training_successor(self):
        from wall_build_marker_successor import continues_training_scene
        from settlement_training_slots_successor import RESULTS, current
        from wall_build_marker_successor import RESULT
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scene = root / SCENE
            scene.parent.mkdir(parents=True)
            scene.write_bytes((ROOT / SCENE).read_bytes())
            self.assertTrue(continues_training_scene(SCENE, RESULTS[SCENE], root))
            self.assertFalse(continues_training_scene(SCENE, '0' * 64, root))
            self.assertTrue(current(SCENE, root))
            ancestor = original(SCENE)
            lines = scene.read_bytes().splitlines(keepends=True)
            prior = ancestor.splitlines(keepends=True)
            wall_action = next(line for line in lines if b'const wallAction=' in line)
            old_gate = next(line for line in prior if b'className="town-gate"' in line)
            new_gate = next(line for line in lines if b'className="town-gate"' in line)
            anchor = next(line for line in prior if b',governorLabel=' in line)
            old_wall = ancestor.replace(old_gate,new_gate).replace(anchor,anchor+wall_action)
            self.assertEqual(sha(old_wall), RESULT)
            scene.write_bytes(old_wall)
            self.assertFalse(current(SCENE, root))
            scene.write_bytes((ROOT / SCENE).read_bytes() + b'\n')
            self.assertFalse(current(SCENE, root))

if __name__ == '__main__':
    unittest.main()
