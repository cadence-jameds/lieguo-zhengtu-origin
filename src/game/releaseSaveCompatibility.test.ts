import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {createFormalWorld} from './formal/generator';
import {encodeSave,decodeSave} from './formal/saveCodec';
import {advanceFormal} from './formal/reducer';
import {FormalPersistence} from './persistence';
import {RELEASE} from './release';
it('an old appVersion remains legal through SaveLoad and Recovery without changing Formal compatibility versions',async()=>{
 const original=createFormalWorld({campaign:'release-compat-'+crypto.randomUUID(),seed:90217});original.metadata.appVersion='0.30.50';
 const metadata={...original.metadata};expect(RELEASE.version).not.toBe('0.30.50');
 const w=(await decodeSave(await encodeSave(original))).world;expect(w.metadata).toEqual(metadata);
 const db=new FormalPersistence({suffix:'release-compat-'+crypto.randomUUID()});
 try{const start=await db.start(w),backup=(await db.backupList())[0],next=advanceFormal(start,start.time+1000);const saved=await db.save(next.world,next.reports,start.revision);expect((await db.loadSave()).game!.metadata).toEqual(metadata);const restored=await db.restore(backup.id);expect(restored.metadata).toEqual(metadata);expect(restored.revision).toBeGreaterThan(saved.revision);expect(restored.sequences).toEqual(saved.sequences);}finally{await db.db.delete();}
});
