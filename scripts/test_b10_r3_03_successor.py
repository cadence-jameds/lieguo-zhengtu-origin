"""R3-03 cannot self-authorize changed bytes, identities, rules or history."""
import json,shutil,tempfile,unittest
from pathlib import Path
import b10_r3_03_successor as gate
class LedgerSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='r303-gate-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   f=self.root/p;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,f)
 def test_exact_commit_and_predecessors(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/scheduler.ts','src/game/formal/constructionRules.ts','src/game/formal/military.ts','src/game/formal/economy.ts']:
   self.assertFalse(gate.accepts(p,r['invariants'][p],self.root))
 def test_refreshed_manifest_cannot_approve_tampering(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes();r=json.loads(original)
  for section,p in [('changes','src/game/persistence.ts'),('changes','src/game/formal/commandLedger.ts'),('changes','src/game/formal/reducer.ts'),('changes','src/game/formal/growthTaskIntegration.test.ts'),('invariants','src/game/formal/scheduler.ts'),('invariants','src/game/formal/constructionRules.ts'),('historical','docs/validation/b10-r3-03/REPORT.md'),('historical','docs/validation/b10-r3-02/compatibility.json'),('adapters','scripts/b10_r3_02_successor.py'),('adapters','.github/workflows/ci.yml')]:
   with self.subTest(path=p):
    file=self.root/p;before=file.read_bytes();file.write_bytes(before+b'\n');m=json.loads(original)
    if section in ['changes','adapters']:m[section][p]['after']=gate.sha(file.read_bytes())
    else:m[section][p]=gate.sha(file.read_bytes())
    manifest.write_text(json.dumps(m))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    file.write_bytes(before);manifest.write_bytes(original)
 def test_manifest_cannot_change_commit_add_grant_or_delete_history(self):
  f=self.root/gate.RECORD;original=f.read_bytes()
  for case in ['commit','grant','history']:
   m=json.loads(original)
   if case=='commit':m['implementationCommit']=gate.BASE
   elif case=='grant':m['grants']['src/game/formal/scheduler.ts']=['0'*64]
   else:m['historical'].pop(next(iter(m['historical'])))
   f.write_text(json.dumps(m))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   f.write_bytes(original)
 def test_finite_adapters_cannot_change_predecessor_or_bytes(self):
  for p,b in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root));f=self.root/p;f.write_bytes(b+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));f.write_bytes(b)
if __name__=='__main__':unittest.main()
