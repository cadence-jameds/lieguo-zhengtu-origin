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
class ReminderScopeTests(unittest.TestCase):
 def test_exact_successor_and_negative_controls(self):
  try:import command_notice_successor as notice
  except ImportError:self.fail('Missing command reminder successor')
  with tempfile.TemporaryDirectory(prefix='command-notice-proof-') as directory:
   root=Path(directory)
   after,grants=notice.records()
   for path in after:
    output=root/path;output.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/path,output)
   notice.validate(root)
   for path in notice.SOURCES:
    predecessor=notice.sha(notice.original(notice.BASE,path));self.assertIn(predecessor,grants[path])
    self.assertTrue(gate.accepts(path,predecessor,root));self.assertFalse(gate.accepts(path,'0'*64,root))
    output=root/path;original=output.read_bytes()
    try:
     output.write_bytes(original+b'\n')
     self.assertFalse(gate.accepts(path,predecessor,root))
     with self.assertRaises(AssertionError):notice.validate(root)
    finally:output.write_bytes(original)
   unrelated='src/game/persistence.ts'
   self.assertFalse(notice.accepts(unrelated,notice.sha(notice.original(notice.BASE,unrelated)),root))
if __name__=='__main__':unittest.main()
