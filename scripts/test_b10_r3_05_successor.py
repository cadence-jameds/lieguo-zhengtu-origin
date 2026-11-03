import json,shutil,tempfile,unittest
from pathlib import Path
import b10_r3_05_successor as gate
class PersistenceSuccessorTests(unittest.TestCase):
 def setUp(self):
  temp=tempfile.TemporaryDirectory(prefix='r305-gate-');self.addCleanup(temp.cleanup);self.root=Path(temp.name);r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   f=self.root/p;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,f)
 def test_exact_finite_source_and_original_ui_grants(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/reducer.ts','src/game/formal/scheduler.ts','src/game/formal/schema.ts','src/game/formal/versions.ts','src/game/presentationStore.ts','src/game/worldStream.ts','src/game/orderAdmission.ts']:
   self.assertFalse(p in gate.CHANGES)
 def test_refreshing_local_hash_cannot_approve_tampering(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes()
  for section,p in [('changes','src/game/persistence.ts'),('changes','src/game/ledgerStore.ts'),('changes','src/game/formal/commandLedger.ts'),('changes','src/game/formal/canonical.ts'),('invariants','src/game/formal/reducer.ts'),('invariants','src/game/formal/versions.ts'),('invariants','src/game/worldStream.ts'),('historical','docs/validation/b10-r3-04/REPORT.md'),('adapters','scripts/b10_r3_04_successor.py')]:
   with self.subTest(path=p):
    f=self.root/p;before=f.read_bytes();f.write_bytes(before+b'\n');r=json.loads(original)
    if section in ['changes','adapters']:r[section][p]['after']=gate.sha(f.read_bytes())
    else:r[section][p]=gate.sha(f.read_bytes())
    manifest.write_text(json.dumps(r))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    f.write_bytes(before);manifest.write_bytes(original)
 def test_every_changed_byte_requires_pinned_commit(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes()
  for case in ['commit','grant','history']:
   r=json.loads(original)
   if case=='commit':r['implementationCommit']=gate.BASE
   elif case=='grant':r['grants']['src/game/formal/scheduler.ts']=['0'*64]
   else:r['historical'].pop(next(iter(r['historical'])))
   manifest.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   manifest.write_bytes(original)
 def test_adapters_reject_arbitrary_source_or_predecessor(self):
  for p,b in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root));f=self.root/p;f.write_bytes(b+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));f.write_bytes(b)
if __name__=='__main__':unittest.main()
