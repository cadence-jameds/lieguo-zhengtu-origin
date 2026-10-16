import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {FormalPersistence} from '../persistence';
import {battlefield} from './combatTestSupport';
import {createExile} from './extinction';
import {advanceFormal} from './reducer';
const stores:FormalPersistence[]=[];afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
it('B7 atomic world fault never partly creates exiles; full import and Recovery retain lifecycle and sequence',async()=>{let failure=false;const db=new FormalPersistence({suffix:'b7-'+crypto.randomUUID(),fault:p=>{if(failure&&p==='world-write')throw Error('B7 injected fault');}});stores.push(db);const before=await db.start(battlefield());let w=structuredClone(before);createExile(w,w.factions[1].id,{militia:7,ram:4},[],w.cities[1]);w.revision++;failure=true;await expect(db.save(w,[],before.revision)).rejects.toThrow('B7 injected fault');expect((await db.loadSave()).game!.extinction).toBeUndefined();failure=false;w=await db.save(w,[],before.revision);const text=await db.exportStoredSave('full'),copy=new FormalPersistence({suffix:'b7copy-'+crypto.randomUUID()});stores.push(copy);const imported=await copy.importSave(text);expect(imported.extinction).toEqual(w.extinction);w=await db.save(advanceFormal(w,w.time+60000).world,[],w.revision);const point=(await db.backupList())[1],restored=await db.restore(point.id);expect(restored.extinction).toEqual(imported.extinction);expect(restored.sequences.project).toBeGreaterThanOrEqual(w.sequences.project);});
