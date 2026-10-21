import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {expect,it,vi} from 'vitest';
vi.mock('./formal/versions',async original=>({...await original<typeof import('./formal/versions')>(),FORMAL_DB_NAME:'unapproved-future-namespace'}));
import {inspectCampaignStorage} from './campaignStorage';
it('a different but unapproved namespace is not sufficient evidence of a read-only archive boundary',async()=>{const db=new Dexie('lieguo-formal-stage2-schema1');db.version(1).stores({backups:'++id'});try{await db.table('backups').put({data:{historic:true}});expect(await inspectCampaignStorage()).toBe('stored');expect(await db.table('backups').count()).toBe(1);}finally{await db.delete();}});
