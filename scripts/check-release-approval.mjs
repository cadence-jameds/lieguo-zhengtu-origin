import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const approval = JSON.parse(readFileSync('.github/RELEASE_APPROVAL.json', 'utf8'));
if (process.env.GITHUB_REF !== 'refs/heads/release') {
  throw new Error('Production deployment is restricted to the release branch.');
}
if (approval.status !== 'approved' || approval.astraGate !== 'PASS' ||
    approval.b5E1 !== 'PASS' || approval.physicalPhone !== 'PASS' ||
    typeof approval.approvedBy !== 'string' || !approval.approvedBy.trim() ||
    typeof approval.evidence !== 'string' || !approval.evidence.trim() ||
    !/^[a-f0-9]{40}$/.test(approval.sourceCommit ?? '')) {
  throw new Error('Release acceptance is pending. R3 is not approved for publication.');
}
execFileSync('git', ['merge-base', '--is-ancestor', approval.sourceCommit, 'HEAD']);
execFileSync('git', ['diff', '--quiet', approval.sourceCommit, 'HEAD', '--',
  'src', 'public', 'package.json', 'package-lock.json', 'index.html',
  'vite.config.ts', 'tsconfig.json']);
console.log(`Recorded acceptance covers unchanged game source ${approval.sourceCommit}.`);
