"""R3-02 authority is exact immutable bytes, never a path-prefix or history waiver."""
import json,shutil,tempfile,unittest
from pathlib import Path
import b10_r3_02_successor as gate
class PreviewSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='r302-gate-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   target=self.root/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,target)
 def test_exact_sources_and_predecessors(self):
  r=gate.validate(self.root)
  for p in gate.CHANGES:
   for before in r['grants'].get(p,[]):self.assertTrue(gate.accepts(p,before,self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/runtime.worker.ts','src/game/persistence.ts','src/game/formal/reducer.ts','src/game/formal/scheduler.ts']:
   self.assertFalse(gate.accepts(p,r['invariants'][p],self.root))
 def test_refreshed_manifest_cannot_approve_source_rule_history_or_adapter_tampering(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes();r=json.loads(original)
  for section,p in [('changes','src/game/formal/economy.ts'),('changes','src/game/constructionPreviewController.ts'),('invariants','src/game/persistence.ts'),('invariants','src/game/formal/reducer.ts'),('historical','docs/validation/b10-r3-01/compatibility.json'),('adapters','scripts/b10_r3_01_successor.py')]:
   with self.subTest(path=p):
    file=self.root/p;before=file.read_bytes();file.write_bytes(before+b'\n');modified=json.loads(original)
    if section in ['changes','adapters']:modified[section][p]['after']=gate.sha(file.read_bytes())
    else:modified[section][p]=gate.sha(file.read_bytes())
    manifest.write_text(json.dumps(modified))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    file.write_bytes(before);manifest.write_bytes(original)
 def test_branch_commit_grant_and_deleted_history_cannot_be_self_authorized(self):
  file=self.root/gate.RECORD;original=file.read_bytes()
  for case in ['commit','grant','history']:
   r=json.loads(original)
   if case=='commit':r['implementationCommit']=gate.BASE
   elif case=='grant':r['grants']['src/game/runtime.worker.ts']=['0'*64]
   else:r['historical'].pop(next(iter(r['historical'])))
   file.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   file.write_bytes(original)
 def test_finite_adapters_keep_original_predecessor(self):
  for p,data in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root))
   file=self.root/p;file.write_bytes(data+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));file.write_bytes(data)
if __name__=='__main__':unittest.main()
