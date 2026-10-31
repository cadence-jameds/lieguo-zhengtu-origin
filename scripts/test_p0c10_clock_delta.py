"""Delta authorization stays byte exact without changing any historical predecessor record."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import p0c10_clock_delta as gate
class ClockDeltaTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='p0c10-clock-gate-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=json.loads((gate.ROOT/gate.RECORD).read_text())
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   dest=self.root/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,dest)
 def test_only_four_exact_source_changes_and_original_predecessors(self):
  r=gate.validate(self.root);self.assertEqual(len(gate.SOURCES),4)
  for p in gate.SOURCES:self.assertTrue(gate.accepts(p,r['changes'][p]['before'],self.root));self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in gate.INVARIANTS|gate.TESTS|gate.history_paths():self.assertFalse(gate.accepts(p,'0'*64,self.root))
 def test_refreshed_source_schema_worker_history_and_adapter_hashes_fail(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes();r=json.loads(original)
  for section in ['changes','invariants','historical','adapters']:
   for p in r[section]:
    with self.subTest(path=p):
     src=self.root/p;data=src.read_bytes();src.write_bytes(data+b'\n');altered=json.loads(original)
     if section in ['changes','adapters']:altered[section][p]['after']=gate.sha(src.read_bytes())
     else:altered[section][p]=gate.sha(src.read_bytes())
     manifest.write_text(json.dumps(altered))
     with self.assertRaises(AssertionError):gate.validate(self.root)
     src.write_bytes(data);manifest.write_bytes(original)
 def test_changed_commit_added_source_and_omitted_history_fail(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes()
  for case in ['commit','source','history']:
   r=json.loads(original)
   if case=='commit':r['implementationCommit']=gate.BASE
   elif case=='source':r['changes']['src/game/runtime.worker.ts']=next(iter(r['changes'].values()))
   else:r['historical'].pop(next(iter(r['historical'])))
   manifest.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   manifest.write_bytes(original)
if __name__=='__main__':unittest.main()
