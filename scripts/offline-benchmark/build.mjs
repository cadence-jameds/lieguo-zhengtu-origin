import {build} from 'vite';
import {resolve} from 'node:path';
import {offlineInstrumentation} from './instrument.mjs';
import {loadMetadata} from '../release-metadata.mjs';

export async function buildLab(detailed = true, cloneSites = false, buildRoot = 'work/b10p0') {
  const outDir = resolve(buildRoot, detailed ? cloneSites ? 'sites' : 'detailed' : 'count');
  await build({configFile: false, publicDir: false, logLevel: 'error', define: {__APP_RELEASE_METADATA__: JSON.stringify(loadMetadata())}, plugins: [offlineInstrumentation(detailed, cloneSites)],
    build: {outDir, emptyOutDir: true, target: 'es2022', minify: false, sourcemap: true,
      lib: {entry: resolve('scripts/offline-benchmark/lab.mjs'), formats: ['es'], fileName: () => 'lab.mjs'}}});
  return resolve(outDir, 'lab.mjs');
}
