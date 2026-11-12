import json,shutil,tempfile,unittest
from pathlib import Path
import preview_scene_successor as gate
class PreviewSceneSuccessorTests(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory(prefix='preview-scene-proof-');self.addCleanup(t.cleanup);self.root=Path(t.name);r=gate.read_record()
  for p in {gate.RECORD,*r['changes'],*r['invariants'],*r['historical'],*gate.ADAPTERS}:
   out=self.root/p;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(gate.ROOT/p,out)
 def test_exact_sources_and_predecessors(self):
  r=gate.validate(self.root)
  for p,v in r['changes'].items():
   if v['before']:self.assertTrue(gate.accepts(p,v['before'],self.root))
   self.assertFalse(gate.accepts(p,'0'*64,self.root))
  for p in ['src/game/useGame.ts','vite.config.ts','src/game/formal/constructionRules.ts']:
   self.assertFalse(gate.accepts(p,gate.sha(gate.previous(gate.BASE,p)),self.root))
 def test_local_record_cannot_bless_source_scope_or_rule_tampering(self):
  original=(self.root/gate.RECORD).read_bytes()
  for section,p in [('changes','src/game/presentation/useConstructionPreviews.tsx'),('changes','src/game/constructionPreviewCompute.ts'),('changes','src/game/constructionPreviewController.ts'),('changes','src/game/constructionPreviewProtocol.ts'),('invariants','vite.config.ts'),('invariants','src/game/useGame.ts'),('invariants','src/game/persistence.ts'),('invariants','src/game/replayFence.ts'),('invariants','src/game/durableCommands.ts'),('invariants','src/game/formal/protection.ts'),('invariants','src/game/formal/constructionRules.ts'),('invariants','src/game/LocalCampaignManager.tsx'),('historical','docs/validation/home-art-ui/compatibility.json')]:
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
