import tempfile
import unittest
from pathlib import Path
import settlement_training_slots_successor as gate


class ExactSettlementTrainingSlots(unittest.TestCase):
 def test_only_exact_reviewed_paths_and_predecessors(self):
  for name,digest in gate.RESULTS.items():
   with self.subTest(name=name),tempfile.TemporaryDirectory() as tmp:
    fake=Path(tmp);path=fake/name;path.parent.mkdir(parents=True)
    actual=(gate.ROOT/name).read_bytes()
    path.write_bytes(actual)
    self.assertTrue(gate.current(name,fake))
    self.assertFalse(gate.accepts(name,'0'*64,fake))
    if gate.predecessors()[name]:
     before=gate.sha(gate.git('show',gate.BASE+':'+name))
     self.assertTrue(gate.accepts(name,before,fake))
     self.assertTrue(gate.continues(name,before,fake))
     self.assertFalse(gate.continues(name,'0'*64,fake))
    path.write_bytes(actual+b'\n')
    self.assertFalse(gate.current(name,fake))
    for before in gate.predecessors()[name]:self.assertFalse(gate.accepts(name,before,fake))
    unrelated='src/game/runtime.worker.ts'
    self.assertFalse(gate.accepts(unrelated,digest,fake))


if __name__=='__main__':
 unittest.main()
