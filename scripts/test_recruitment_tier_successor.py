"""For snapshots of the tier release, mutations cannot widen predecessor or target scope."""
from pathlib import Path
import tempfile
import unittest
import recruitment_tier_successor as gate

class ExactRecruitmentTier(unittest.TestCase):
    def test_exact_sources_and_adapters_only(self):
        gate.validate()
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for path in gate.EXISTING:
                f = root / path
                f.parent.mkdir(parents=True, exist_ok=True)
                approved = (gate.ROOT / path).read_bytes()
                f.write_bytes(approved)
                predecessor = gate.sha(gate.original(path))
                self.assertTrue(gate.accepts(path, predecessor, root))
                self.assertFalse(gate.accepts(path, '0' * 64, root))
                f.write_bytes(approved + b'\n')
                self.assertFalse(gate.accepts(path, predecessor, root))
            self.assertFalse(gate.accepts('src/game/formal/military.ts', '0' * 64, root))

    def test_original_recruitment_adapter_still_accepted_but_not_byte_changes(self):
        import b10_r3_02_successor as preview
        import b10_r3_05_successor as persistence
        path = 'scripts/recruit_input_successor.py'
        original = preview.adapters()[path]
        self.assertTrue(persistence.accepts_adapter(path, original))
        self.assertFalse(persistence.accepts_adapter(path, original + b' '))
        import android_save_successor as android
        import b10_r3_06_successor as runtime
        path = 'scripts/b10_r3_05_successor.py'
        original = runtime.adapters()[path]
        self.assertTrue(android.accepts_adapter(path, original))
        self.assertFalse(android.accepts_adapter(path, original + b' '))

if __name__ == '__main__':
    unittest.main()
