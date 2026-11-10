"""A refreshed local hash cannot authorize gameplay, T2 or display tampering."""
import json,shutil,tempfile,unittest
from pathlib import Path
import b10_r3_04_successor as gate
class ProjectionSuccessorTests(unittest.TestCase):
 def test_batched_immutable_reader_matches_git_show(self):
  import subprocess
  for p in ['src/game/formal/reducer.ts','src/game/runtime.worker.ts','docs/b6-v97/河谷戰役_vNext_平衡重構討論_v97.md','scripts/b10_r3_03_successor.py']:
   self.assertEqual(gate.previous(gate.BASE,p),subprocess.check_output(['git','-C',str(gate.ROOT),'show',gate.BASE+':'+p]))
  with self.assertRaises(subprocess.CalledProcessError):gate.previous(gate.BASE,'missing-r304-source')
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='r304-gate-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*r['adapters']}:
   f=self.root/p;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,f)
 def test_exact_source_and_finite_predecessors(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/reducer.ts','src/game/formal/scheduler.ts','src/game/persistence.ts','src/game/formal/commandLedger.ts','src/game/formal/saveCodec.ts']:
   self.assertFalse(gate.accepts(p,r['invariants'][p],self.root))
 def test_refreshed_manifest_cannot_approve_tampering(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes()
  for section,p in [('changes','src/game/runtime.worker.ts'),('changes','src/game/presentationStore.ts'),('changes','src/game/governanceAdmission.ts'),('invariants','src/game/persistence.ts'),('invariants','src/game/formal/reducer.ts'),('invariants','src/game/formal/commandLedger.ts'),('historical','docs/validation/b10-r3-03/formal-v1/REPORT.md'),('historical','docs/validation/b10-r3-02/compatibility.json'),('adapters','scripts/b10_r3_03_successor.py'),('adapters','.github/workflows/ci.yml')]:
   with self.subTest(path=p):
    f=self.root/p;before=f.read_bytes();f.write_bytes(before+b'\n');record=json.loads(original)
    if section in ['changes','adapters']:record[section][p]['after']=gate.sha(f.read_bytes())
    else:record[section][p]=gate.sha(f.read_bytes())
    manifest.write_text(json.dumps(record))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    f.write_bytes(before);manifest.write_bytes(original)
 def test_commit_grants_and_history_cannot_be_rewritten(self):
  f=self.root/gate.RECORD;original=f.read_bytes()
  for case in ['commit','grant','history','support']:
   record=json.loads(original)
   if case=='commit':record['implementationCommit']=gate.BASE
   elif case=='grant':record['grants']['src/game/formal/scheduler.ts']=['0'*64]
   elif case=='history':record['historical'].pop(next(iter(record['historical'])))
   else:record['implementationSupport'].append('src/game/formal/reducer.ts')
   f.write_text(json.dumps(record))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   f.write_bytes(original)
 def test_adapters_reject_forged_bytes_and_predecessors(self):
  for p,b in gate.adapters().items():
   self.assertTrue(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));self.assertFalse(gate.accepts_adapter(p,b'forged',self.root));f=self.root/p;f.write_bytes(b+b'\n');self.assertFalse(gate.accepts_adapter(p,gate.previous(gate.BASE,p),self.root));f.write_bytes(b)
if __name__=='__main__':unittest.main()
