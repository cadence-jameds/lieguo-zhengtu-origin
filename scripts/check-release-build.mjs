import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),metadata=read('.release/metadata.json'),version=read('dist/version.json'),pkg=read('dist/package.json');
assert.deepEqual(version,metadata);assert.equal(pkg.version,metadata.version);assert.equal(pkg.commitSha,metadata.commitSha);
assert.ok(metadata.history[0].notes.length);assert.match(metadata.commitSha,/^[a-f0-9]{40}$/);
console.log(JSON.stringify({version:metadata.version,date:metadata.date,commitSha:metadata.commitSha,dirty:metadata.dirty,artifactsConsistent:true}));
