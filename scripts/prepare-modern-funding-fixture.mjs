// Synthetic A/B/C test save only; never loads private player saves.
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
const out=process.argv[2];if(!out)throw Error('Provide a temporary directory.');await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {modernFundingFixture}=await server.ssrLoadModule('/src/game/formal/modernFundingTestSupport.ts');
 const {FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts');
 const x=modernFundingFixture('modern-funding-browser'),store=new FormalPersistence({suffix:'modern-funding-browser'});
 try{await store.start(x.world);await fs.writeFile(path.join(out,'abc.realm-save'),await store.exportStoredSave('full'));await fs.writeFile(path.join(out,'plan.json'),JSON.stringify({cityIds:x.cityIds,cost:x.cost,parts:x.parts,techId:x.techId},null,2));}finally{await store.db.delete();}
}finally{await server.close();}
