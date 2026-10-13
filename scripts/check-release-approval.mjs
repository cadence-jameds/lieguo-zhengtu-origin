import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const approval = JSON.parse(readFileSync('.github/RELEASE_APPROVAL.json', 'utf8'));
if (process.env.GITHUB_REF !== 'refs/heads/release') {
  throw new Error('Production deployment is restricted to the release branch.');
}
const acceptedRelease = approval.status === 'approved' && approval.astraGate === 'PASS' &&
    approval.b5E1 === 'PASS' && approval.physicalPhone === 'PASS';
const previewFile = '.github/PAGES_PREVIEW_APPROVAL.json';
const preview = existsSync(previewFile) ? JSON.parse(readFileSync(previewFile, 'utf8')) : null;
const approvedPreview = preview?.status === 'approved-for-preview' &&
    preview?.scope === 'public GitHub Pages trial' &&
    preview?.formalAcceptancePending === true;
const publication = acceptedRelease ? approval : approvedPreview ? preview : null;
if (!publication ||
    typeof publication.approvedBy !== 'string' || !publication.approvedBy.trim() ||
    typeof publication.evidence !== 'string' || !publication.evidence.trim() ||
    !/^[a-f0-9]{40}$/.test(publication.sourceCommit ?? '')) {
  throw new Error('Publication requires recorded formal acceptance or explicit public-preview approval.');
}
execFileSync('git', ['merge-base', '--is-ancestor', publication.sourceCommit, 'HEAD']);
execFileSync('git', ['diff', '--quiet', publication.sourceCommit, 'HEAD', '--',
  'src', 'public', 'package.json', 'package-lock.json', 'index.html',
  'vite.config.ts', 'tsconfig.json']);
console.log(`${acceptedRelease ? 'Formal release acceptance' : 'Explicit public-preview approval'} covers unchanged game source ${publication.sourceCommit}.`);
if (!acceptedRelease) console.log(`Formal acceptance remains pending: Astra ${approval.astraGate}; B5 E1 ${approval.b5E1}; physical phone ${approval.physicalPhone}.`);
