// Generates synthetic combat evidence only; never reads a player's campaign.
// Usage: node scripts/prepare-mobile-navigation-fixture.mjs /tmp/mobile-navigation.realm-save
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const output=process.argv[2];if(!output)throw Error('Provide a temporary output path.');
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {battlefield,dispatch,arrive}=await server.ssrLoadModule('/src/game/formal/combatTestSupport.ts');
 const {FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts');
 const store=new FormalPersistence({suffix:'mobile-ui-synthetic'}),draft=battlefield();draft.cities[0].military.units={militia:20};
 let world=await store.start(draft),transition=dispatch(world,'raid',{militia:20});
 world=await store.save(transition.world,transition.reports,world.revision);transition=arrive(world);
 world=await store.save(transition.world,transition.reports,world.revision);
 await writeFile(output,await store.exportStoredSave('full'));
 console.log(JSON.stringify(await store.reportStatus(world)));await store.db.delete();
}finally{await server.close();}
