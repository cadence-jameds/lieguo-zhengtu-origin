// Keep this order: pure fixture/schema/codec imports must not capture a missing
// IndexedDB implementation before the environment installs it.
import {createFormalFixture} from './fixture';
import 'fake-indexeddb/auto';
import {FormalPersistence} from '../persistence';
import {expect,it} from 'vitest';
it('pure ledger dependencies preserve storage initialization order and normal durable continuation',async()=>{
 const p=new FormalPersistence({suffix:'r305-import-order-'+crypto.randomUUID()});try{const w=await p.start(createFormalFixture()),loaded=await p.loadSave();expect(loaded.recovered).toBe(false);expect(loaded.game!.ledger!.anchor.root).toBe(w.ledger!.anchor.root);expect(loaded.game!.cities).toEqual(w.cities);}finally{await p.db.delete();}
});
