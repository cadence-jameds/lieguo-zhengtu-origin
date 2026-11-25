import tempfile
import unittest
from pathlib import Path
import elite_recruit_successor as gate


class ExactEliteSuccessor(unittest.TestCase):
    def test_only_the_exact_two_changed_sources_are_admitted(self):
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


    def test_combined_boundary_has_only_the_exact_escort_continuation(self):
        import ai_settlement_escort_successor as escort
        predecessor=escort.git('show',escort.BASE+':'+escort.BOUNDARY)
        self.assertTrue(escort.accepts_boundary(escort.BOUNDARY,predecessor))
        self.assertFalse(escort.accepts_boundary(escort.BOUNDARY,predecessor+b'\n'))
        self.assertFalse(gate.accepts_bounded_escort_boundary(gate.BOUNDARY,'0'*64))
        self.assertFalse(gate.accepts_bounded_escort_boundary(escort.SOURCE,escort.BOUNDARY_SHA))
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            file=root/gate.BOUNDARY
            file.parent.mkdir(parents=True)
            payload=(gate.ROOT/gate.BOUNDARY).read_bytes()
            for candidate in (payload+b'\n// unreviewed',gate.original(gate.BOUNDARY)):
                file.write_bytes(candidate)
                self.assertFalse(escort.accepts_boundary(escort.BOUNDARY,predecessor,root))
                self.assertFalse(gate.accepts(gate.BOUNDARY,gate.sha(predecessor),root))
            # The two standalone grants remain exact and cannot impersonate the combined one.
            elite_head='31d9afe6cbf606f9a41d761b53e67a66b9608576'
            file.write_bytes(escort.git('show',elite_head+':'+gate.BOUNDARY))
            self.assertTrue(gate.accepts(gate.BOUNDARY,gate.sha(predecessor),root))
            self.assertFalse(escort.accepts_boundary(gate.BOUNDARY,predecessor,root))
            escort_main='d73fd553f60b09036ac3454bc66da5c66de1439d'
            file.write_bytes(escort.git('show',escort_main+':'+gate.BOUNDARY))
            self.assertTrue(escort.accepts_boundary(gate.BOUNDARY,predecessor,root))
            self.assertFalse(gate.accepts(gate.BOUNDARY,gate.sha(predecessor),root))


if __name__ == '__main__':
    unittest.main()
