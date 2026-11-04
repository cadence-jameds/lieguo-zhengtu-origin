import json,shutil,tempfile,unittest
from pathlib import Path
import b10_release_unblock_successor as gate
class BoundedSaveSuccessorTests(unittest.TestCase):
 def setUp(self):
  temp=tempfile.TemporaryDirectory(prefix='bounded-save-gate-');self.addCleanup(temp.cleanup);self.root=Path(temp.name);r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   target=self.root/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,target)
 def test_exact_finite_sources_and_adapters(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p,b in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root))
 def test_critical_gameplay_and_original_deadlines_remain_exact(self):
  for p in ['src/game/formal/scheduler.ts','src/game/formal/autonomy.ts','src/game/formal/aiActions.ts','src/game/formal/endgameAI.ts','src/game/formal/victory.ts','src/game/formal/offline.ts','src/game/formal/constructionRules.ts','src/game/worldStream.ts','src/game/formal/runtime.test.ts','scripts/verify-in-isolation.mjs']:
   self.assertEqual((self.root/p).read_bytes(),gate.previous(gate.BASE,p))
 def test_editing_a_local_hash_cannot_bless_tampering(self):
  file=self.root/gate.RECORD;original=file.read_bytes()
  for section,p in [('changes','src/game/persistence.ts'),('changes','src/game/replayFence.ts'),('changes','src/game/formal/commandEvidence.ts'),('changes','src/game/formal/reducer.ts'),('changes','src/game/formal/saveCodec.ts'),('changes','src/game/formal/commandLedger.ts'),('changes','src/game/useAppUpdate.ts'),('changes','src/game/formal/persistence.test.ts'),('invariants','src/game/formal/scheduler.ts'),('historical','docs/validation/b10-final/REPORT.md'),('adapters','scripts/b10_r3_06_successor.py')]:
   with self.subTest(path=p):
    f=self.root/p;before=f.read_bytes();f.write_bytes(before+b'\n');r=json.loads(original)
    if section in ['changes','adapters']:r[section][p]['after']=gate.sha(f.read_bytes())
    else:r[section][p]=gate.sha(f.read_bytes())
    file.write_text(json.dumps(r))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    file.write_bytes(original);f.write_bytes(before)
 def test_no_extra_scope_or_predecessor_grants(self):
  f=self.root/gate.RECORD;original=f.read_bytes()
  for key in ['implementationCommit','grants','historical','changes']:
   r=json.loads(original)
   if key=='implementationCommit':r[key]=gate.BASE
   elif key=='grants':r[key]['src/game/formal/scheduler.ts']=['0'*64]
   else:r[key].pop(next(iter(r[key])))
   f.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   f.write_bytes(original)
if __name__=='__main__':unittest.main()
