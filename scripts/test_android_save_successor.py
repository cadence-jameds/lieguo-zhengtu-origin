import json,shutil,tempfile,unittest
from pathlib import Path
import android_save_successor as gate
class AndroidSaveSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='android-save-proof-');self.addCleanup(t.cleanup);self.root=Path(t.name);r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*gate.ADAPTERS}:
   out=self.root/p;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,out)
 def test_exact_pins_and_predecessors(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/saveCodec.ts','src/game/formal/schema.ts','src/game/formal/reducer.ts','src/game/formal/autonomy.ts','src/game/presentation/ProtectionStatus.tsx','vite.config.ts']:
   self.assertFalse(gate.accepts(p,gate.sha(gate.previous(gate.BASE,p)),self.root))
 def test_local_record_cannot_bless_unsafe_source_or_invariant_edits(self):
  original=(self.root/gate.RECORD).read_bytes()
  samples=[('changes','src/game/persistence.ts'),('changes','src/game/persistenceTime.ts'),('changes','src/game/runtime.worker.ts'),('changes','src/game/saveStatus.ts'),('changes','src/game/presentation/GameNotices.tsx'),('invariants','src/game/formal/saveCodec.ts'),('invariants','src/game/formal/schema.ts'),('invariants','src/game/replayFence.ts'),('invariants','src/game/formal/autonomy.ts'),('invariants','src/game/presentation/ProtectionStatus.tsx'),('invariants','vite.config.ts'),('historical','docs/validation/global-protection/compatibility.json')]
  for section,p in samples:
   with self.subTest(path=p):
    f=self.root/p;before=f.read_bytes();f.write_bytes(before+b'\n');r=json.loads(original)
    if section=='changes':r[section][p]['after']=gate.sha(f.read_bytes())
    else:r[section][p]=gate.sha(f.read_bytes())
    (self.root/gate.RECORD).write_text(json.dumps(r))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    f.write_bytes(before);(self.root/gate.RECORD).write_bytes(original)
 def test_exact_adapters_and_unknown_predecessors(self):
  for p in gate.ADAPTERS:
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root));f=self.root/p;f.write_bytes(f.read_bytes()+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root))
if __name__=='__main__':unittest.main()
