"""P0-C-10 grants must not admit refreshed hashes, broader scopes or history/rules edits."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import p0c10_successor as gate

class ProtectionSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='p0c10-successor-');self.addCleanup(t.cleanup);self.root=Path(t.name)
  r=json.loads((gate.ROOT/gate.RECORD).read_text())
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical']}:
   dest=self.root/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,dest)
 def test_exact_sources_and_predecessors_only(self):
  r=gate.validate(self.root)
  for p in gate.SOURCES:
   for old in r['grants'][p]:self.assertTrue(gate.accepts(p,old,self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/formal/military.ts','src/game/formal/techCatalog.ts','public/art/report-defeat.webp']:
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
 def test_refreshed_hash_cannot_admit_code_history_or_balance_tampering(self):
  manifest=self.root/gate.RECORD;original=manifest.read_bytes();r=json.loads(original)
  for section in ['changes','invariants','historical']:
   for p in r[section]:
    with self.subTest(path=p):
     source=self.root/p;data=source.read_bytes();source.write_bytes(data+b'\n');altered=json.loads(original)
     if section=='changes':altered[section][p]['after']=gate.sha(source.read_bytes())
     else:altered[section][p]=gate.sha(source.read_bytes())
     manifest.write_text(json.dumps(altered))
     with self.assertRaises(AssertionError):gate.validate(self.root)
     source.write_bytes(data);manifest.write_bytes(original)
 def test_changed_commit_scope_and_omitted_invariant_fail(self):
  manifest=self.root/gate.RECORD;data=manifest.read_bytes()
  for kind in ['commit','scope','omit','predecessor']:
   r=json.loads(data)
   if kind=='commit':r['implementationCommit']=gate.BASE
   elif kind=='scope':r['grants']['src/game/formal/military.ts']=['0'*64]
   elif kind=='omit':r['invariants'].pop(next(iter(r['invariants'])))
   else:r['grants']['src/game/formal/reducer.ts'].append('0'*64)
   manifest.write_text(json.dumps(r))
   with self.assertRaises(AssertionError):gate.validate(self.root)
   manifest.write_bytes(data)

if __name__=='__main__':unittest.main()
