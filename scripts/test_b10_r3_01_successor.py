"""No source, rule, history, predecessor or adapter may be self-authorized."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import b10_r3_01_successor as gate
class DurableSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='b10-gate-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   dest=self.root/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,dest)
 def test_only_exact_implementation_and_original_predecessors(self):
  r=gate.validate(self.root)
  for p in gate.CHANGES:
   for old in r['grants'].get(p,[]):self.assertTrue(gate.accepts(p,old,self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/reducer.ts','src/game/formal/scheduler.ts','src/game/formal/schema.ts','src/game/formal/autonomy.ts']:
   self.assertFalse(gate.accepts(p,r['invariants'][p],self.root))
 def test_current_bytes_and_refreshed_manifest_cannot_authorize_tampering(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes();r=json.loads(original)
  for section,p in [('changes','src/game/runtime.worker.ts'),('invariants','src/game/formal/reducer.ts'),('invariants','src/game/formal/scheduler.ts'),('historical',next(iter(r['historical']))),('adapters','scripts/p0c10_successor.py')]:
   with self.subTest(section=section,path=p):
    file=self.root/p;before=file.read_bytes();file.write_bytes(before+b'\n');modified=json.loads(original)
    if section in ['changes','adapters']:modified[section][p]['after']=gate.sha(file.read_bytes())
    else:modified[section][p]=gate.sha(file.read_bytes())
    manifest.write_text(json.dumps(modified))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    file.write_bytes(before);manifest.write_bytes(original)
 def test_added_grant_changed_commit_and_deleted_history_fail(self):
  file=self.root/gate.RECORD;original=file.read_bytes()
  for case in ['grant','commit','history']:
   r=json.loads(original)
   if case=='grant':r['grants']['src/game/formal/reducer.ts']=['0'*64]
   elif case=='commit':r['implementationCommit']=gate.BASE
   else:r['historical'].pop(next(iter(r['historical'])))
   file.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   file.write_bytes(original)
 def test_legacy_adapter_must_preserve_every_original_check(self):
  for p,data in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root))
   self.assertFalse(gate.accepts_adapter(p,b'forged predecessor',self.root))
   file=self.root/p;file.write_bytes(data+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));file.write_bytes(data)
if __name__=='__main__':unittest.main()
