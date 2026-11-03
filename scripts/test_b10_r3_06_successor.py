import json,shutil,tempfile,unittest
from pathlib import Path
import b10_r3_06_successor as gate
class RuntimeSuccessorTests(unittest.TestCase):
 def setUp(self):
  temp=tempfile.TemporaryDirectory(prefix='r306-proof-');self.addCleanup(temp.cleanup);self.root=Path(temp.name);r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   f=self.root/p;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,f)
 def test_exact_reference_and_finite_runtime_source(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/model.ts','src/game/formal/schema.ts','src/game/formal/scheduler.ts','src/game/formal/autonomy.ts','src/game/formal/aiActions.ts','src/game/formal/endgameAI.ts','src/game/formal/economy.ts','src/game/persistence.ts','src/game/ledgerStore.ts','src/game/formal/saveCodec.ts','src/game/useGame.ts','src/game/worldStream.ts']:
   self.assertNotIn(p,gate.CHANGES)
  for n in ['reducer','victory']:self.assertEqual((self.root/f'scripts/fixtures/r306/{n}-r305.txt').read_bytes(),gate.previous(gate.BASE,f'src/game/formal/{n}.ts'))
 def test_refreshed_local_hash_never_approves_rule_ledger_ui_or_reference_tampering(self):
  file=self.root/gate.RECORD;original=file.read_bytes()
  for section,p in [('changes','src/game/formal/reducer.ts'),('changes','src/game/formal/victory.ts'),('changes','src/game/runtime.worker.ts'),('changes','src/game/runtimeWorkBudget.ts'),('changes','scripts/fixtures/r306/reducer-r305.txt'),('invariants','src/game/formal/scheduler.ts'),('invariants','src/game/persistence.ts'),('invariants','src/game/formal/commandLedger.ts'),('invariants','src/game/useGame.ts'),('historical','docs/validation/b10-r3-05/REPORT.md'),('adapters','.github/workflows/ci.yml')]:
   with self.subTest(path=p):
    f=self.root/p;before=f.read_bytes();f.write_bytes(before+b'\n');r=json.loads(original)
    if section in ['changes','adapters']:r[section][p]['after']=gate.sha(f.read_bytes())
    else:r[section][p]=gate.sha(f.read_bytes())
    file.write_text(json.dumps(r))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    file.write_bytes(original);f.write_bytes(before)
 def test_no_grant_or_deadline_scope_extension(self):
  file=self.root/gate.RECORD;before=file.read_bytes()
  for key in ['implementationCommit','implementationSupport','grants','references']:
   r=json.loads(before)
   if key=='implementationCommit':r[key]=gate.BASE
   elif key=='implementationSupport':r[key].append('src/game/formal/scheduler.ts')
   elif key=='grants':r[key]['src/game/formal/runtime.test.ts']=['0'*64]
   else:r[key].clear()
   file.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   file.write_bytes(before)
 def test_exact_adapters_reject_unknown_predecessors(self):
  for p,b in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root));f=self.root/p;f.write_bytes(b+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));f.write_bytes(b)
if __name__=='__main__':unittest.main()
