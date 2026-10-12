import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
if (!repository || process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Set GITHUB_ACTIONS=true and GITHUB_REPOSITORY before checking a Pages build.');
}
const base = repository.endsWith('.github.io') ? '/' : `/${repository}/`;
const html = readFileSync('dist/index.html', 'utf8');
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1]).filter(url => url.startsWith('/'));
if (!assets.length) throw new Error('Built HTML has no local assets to verify.');
const output = resolve('dist');
for (const url of assets) {
  if (!url.startsWith(base)) throw new Error(`Incorrect Pages asset base: ${url}`);
  const file = resolve(output, url.slice(base.length).split(/[?#]/)[0]);
  if (!file.startsWith(output + sep) || !existsSync(file)) {
    throw new Error(`Missing or unsafe Pages asset: ${url}`);
  }
}
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
if (manifest.start_url !== '.' || manifest.scope !== '.') {
  throw new Error('The PWA must keep relative start_url and scope on project Pages.');
}
const worker = readFileSync('dist/sw.js', 'utf8');
const fallback = worker.match(/createHandlerBoundToURL\(["']([^"']+)["']\)/)?.[1];
// Workbox resolves relative URLs against sw.js, which lives inside the Pages base.
if (fallback !== 'index.html' && fallback !== `${base}index.html`) {
  throw new Error('Service Worker navigation fallback has the wrong Pages base.');
}
console.log(`Pages assets, PWA scope and Service Worker fallback verified: ${base}`);
