"""Verify the finite UI grant rejects history/rule/evidence tampering."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import recruit_input_successor as gate

class RecruitSuccessorTests(unittest.TestCase):
 def setUp(self):
  temporary=tempfile.TemporaryDirectory(prefix='recruit-successor-');self.addCleanup(temporary.cleanup);self.root=Path(temporary.name)
  record=json.loads((gate.ROOT/gate.RECORD).read_text())
  for path in {gate.RECORD,*record['changes'],*record['invariants'],*record['historical'],*record['evidence']}:
   target=self.root/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/path,target)
  (self.root/'.git').symlink_to(gate.ROOT/'.git',target_is_directory=True)
 def test_exact_predecessors_and_only_two_authorized_sources(self):
  record=gate.validate(self.root)
  for path in gate.SOURCES:
   self.assertTrue(gate.accepts(path,record['changes'][path]['before'],self.root));self.assertFalse(gate.accepts(path,'0'*64,self.root))
  for path in ['src/game/formal/military.ts','src/game/formal/worldDraft.ts','perf-evidence/p1-recruit-input-20261031/chunks/part-00.txt']:
   self.assertFalse(gate.accepts(path,'0'*64,self.root))
 def test_refreshed_hashes_cannot_admit_source_rules_history_or_performance_edits(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes();record=json.loads(original)
  cases=[(section,path) for section in ['changes','invariants'] for path in record[section]]
  cases+=[('historical',gate.PROTECTED),('evidence','docs/validation/recruit-input-p1/metrics.json'),('evidence','src/game/presentation/RecruitmentForm.tsx')]
  for section,path in cases:
   with self.subTest(path=path):
    source=self.root/path;data=source.read_bytes();source.write_bytes(data+b'\n');altered=json.loads(original)
    if section=='changes':altered[section][path]['after']=gate.sha(source.read_bytes())
    else:altered[section][path]=gate.sha(source.read_bytes())
    manifest.write_text(json.dumps(altered))
    with self.assertRaises(AssertionError):gate.validate(self.root)
    source.write_bytes(data);manifest.write_bytes(original)
 def test_commit_scope_and_omitted_witness_are_rejected(self):
  manifest=self.root/gate.RECORD;original=manifest.read_text()
  for mutation in ['commit','scope','omit']:
   record=json.loads(original)
   if mutation=='commit':record['uiCommit']=gate.BASE
   elif mutation=='scope':record['changes']['src/game/formal/military.ts']=next(iter(record['changes'].values()))
   else:record['evidence'].pop(next(iter(record['evidence'])))
   manifest.write_text(json.dumps(record))
   with self.assertRaises(AssertionError):gate.validate(self.root)

if __name__=='__main__':unittest.main()
