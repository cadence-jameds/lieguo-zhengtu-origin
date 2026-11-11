import json,shutil,tempfile,unittest
from pathlib import Path
import android_startup_successor as gate
class StartupSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='startup-gate-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*gate.ADAPTERS}:
   out=self.root/p;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,out)
 def test_exact_source_and_unknown_predecessors(self):
  for p,v in gate.read_record()['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  self.assertFalse(gate.accepts('src/game/persistence.ts','0'*64,self.root))
 def test_editable_hash_cannot_bless_source_or_scope_tampering(self):
  p='src/game/storageRecovery.ts';f=self.root/p;f.write_bytes(f.read_bytes()+b'\n');record=self.root/gate.RECORD;r=json.loads(record.read_text());r['changes'][p]['after']=gate.sha(f.read_bytes());record.write_text(json.dumps(r))
  with self.assertRaises(AssertionError):gate.read_record(self.root)
 def test_exact_adapter_and_unknown_predecessor(self):
  for p in gate.ADAPTERS:
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root));f=self.root/p;f.write_bytes(f.read_bytes()+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root))
if __name__=='__main__':unittest.main()
