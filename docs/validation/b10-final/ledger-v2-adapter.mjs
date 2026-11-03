// Preserve the historical harness and all assertions, case counts, deadlines
// and measurements. Adapt its one v1 state.world read to the actual v2 store.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
let source=await fs.readFile('scripts/verify-formal-ledger-browser.mjs','utf8');
const needle="const w=messages.filter(m=>m.type==='state').at(-1).world,o=";
assert.equal(source.split(needle).length,2,'Expected exactly one obsolete read');
const hash=createHash('sha256').update(source).digest('hex');
assert.equal(hash,'e126cc49fe4c0abdcd2297c135966e585b91c927c596763290541b2f277a070a');
source=source.replace(needle,"const {PresentationStore}=await import('/src/game/presentationStore.ts'),store=new PresentationStore();for(const message of messages)if(message.projection&&!store.receive(message.projection).accepted)throw Error('Invalid v2 projection');const w=store.getWorld(),o=");
await fs.mkdir('artifacts/b10-r3-05',{recursive:true});
await fs.mkdir('artifacts/b10-final',{recursive:true});
try{await fs.copyFile('artifacts/b10-r3-03/formal/native-formal.json','artifacts/b10-final/attempt1-ledger-native.json',1);}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
await fs.writeFile('artifacts/b10-final/ledger-adapter.json',JSON.stringify({historicalHarnessSHA256:hash,adaptation:'Exactly one state.world read replaced with strict PresentationStore consumption; original assertions/counts/timeouts unchanged'},null,2));
await fs.writeFile('artifacts/b10-final-ledger.mjs',source);
await import('../../../artifacts/b10-final-ledger.mjs');
