// Supplement the original arrival-window sample with an actual battle-round
// window. The historical benchmark remains untouched; no timeout/assertion is
// weakened. The longer target is world time, not a larger test deadline.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
let source=await fs.readFile('scripts/benchmark-runtime-browser.mjs','utf8');
const needle="scenario==='lag'||scenario==='offline'?12*3600000/25:12000";
assert.equal(source.split(needle).length,2);
source=source.replace(needle,"scenario==='lag'||scenario==='offline'?12*3600000/25:3*3600000/25");
source=source.replace("new URL('./fixtures/r306/'","new URL('../scripts/fixtures/r306/'");
process.env.B10_LABEL='final-battle-rounds';process.env.B10_CASES='battle';process.env.B10_COUNTS='1';process.env.B10_SAMPLES='20';
await fs.writeFile('artifacts/b10-final-battle.mjs',source);
await import('../../../artifacts/b10-final-battle.mjs');
const file='artifacts/b10-r3-06/native-final-battle-rounds.json',report=JSON.parse(await fs.readFile(file,'utf8'));
for(const row of report.cases)assert.ok(row.phases['reducer.ts:advanceOneEvent:combat.round']?.calls>0,'Actual combat rounds required');
report.methodNote='Original battle fixture, 3 world hours at 25X; every sample contains actual combat.round events. Synthetic clock, real elapsed latency, original 30000ms wait and assertions retained. Earlier battle samples cover arrival only and are not presented as large-battle measurements.';
await fs.writeFile(file,JSON.stringify(report,null,2));
