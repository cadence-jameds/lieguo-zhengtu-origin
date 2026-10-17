import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import {loadMetadata} from './release-metadata.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

// Historical tests write evidence into docs. Run them in a disposable copy.
const root = process.cwd();
const release=loadMetadata(root);
const mode = process.argv[2] ?? 'full';
if (!['full', 'r3', 'smoke'].includes(mode)) throw new Error('Expected full, r3 or smoke.');
if (!existsSync(join(root, 'node_modules/vitest/vitest.mjs'))) throw new Error('Run npm ci first.');
const temporary = mkdtempSync(join(tmpdir(), 'lieguo-verification-'));
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of tracked) {
  if (file.startsWith('.git') || file.startsWith('.openai/')) continue;
  const target = resolve(temporary, file);
  if (!target.startsWith(temporary + sep)) throw new Error('Unsafe tracked path.');
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, file), target);
}
mkdirSync(join(temporary,'.release'),{recursive:true});
writeFileSync(join(temporary,'.release/metadata.json'),JSON.stringify(release));
symlinkSync(join(root, 'node_modules'), join(temporary, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const resultDir = join(root, 'artifacts/integration');
mkdirSync(resultDir, { recursive: true });
const report = join(resultDir, `regression-${mode}.json`);
const args = ['run', '--maxWorkers=2', '--testTimeout=30000', '--reporter=json', `--outputFile=${report}`];
if (mode === 'r3') args.push('--exclude', 'src/game/batch220.test.tsx', '--exclude', 'src/game/constructionArt.test.tsx');
if (mode === 'smoke') args.push('src/game/governanceAdmission.test.ts', 'src/game/formal/runtime.test.ts', 'src/game/presentation/worldDynamicsR3.test.ts');
const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), ...args], {
  cwd: temporary,
  env: { ...process.env, BUILDING_DETAIL_EVIDENCE: join(temporary, 'generated-ui') },
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024
});
console.log(`Isolated ${mode} regression workspace: ${temporary}`);
// Isolated experiment only: surface fixed-seed research data from the Vitest stdout.
// The original main CI behavior and default gate thresholds remain unchanged.
if (process.env.GITHUB_REF?.includes('experiment/p0-c-9-main-')) {
  const begin='P0C9_MAIN_ENGINE_RESULTS_BEGIN';
  const end='P0C9_MAIN_ENGINE_RESULTS_END';
  const start=result.stdout.indexOf(begin);
  const finish=start>=0?result.stdout.indexOf(end,start+begin.length):-1;
  if(start>=0&&finish>=0)console.log(result.stdout.slice(start,finish+end.length));
  else console.log('P0C9_MAIN_ENGINE_DATA_MISSING: no bounded experiment output in Vitest stdout');
}

if (result.error) throw result.error;
if (existsSync(report)) {
  const summary = JSON.parse(readFileSync(report, 'utf8'));
  console.log(JSON.stringify({ success: summary.success, passed: summary.numPassedTests,
    failed: summary.numFailedTests, skipped: summary.numPendingTests, report }));
  for (const suite of summary.testResults ?? []) for (const test of suite.assertionResults ?? []) {
    if (test.status === 'failed') console.log(`FAIL: ${test.fullName}`);
  }
} else {
  writeFileSync(join(resultDir, `regression-${mode}-error.txt`), `${result.stdout}\n${result.stderr}`);
  console.error(result.stderr.slice(-4000));
}
process.exitCode = result.status ?? 1;
