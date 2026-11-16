import fs from 'node:fs/promises';
import {resolve, sep} from 'node:path';

export async function protectPrivateInput(input, outputs = []) {
  if (!input) return;
  let source, stat;
  try {source = await fs.realpath(input); stat = await fs.stat(source);}
  catch {throw Error('PRIVATE_INPUT_PATH_UNAVAILABLE');}
  const buildDir = resolve('work/b10p0');
  if (source.startsWith(buildDir + sep)) throw Error('Keep the private input outside generated benchmark build directories');
  for (const output of outputs.filter(Boolean)) {
    const target = resolve(output), existing = await fs.stat(target).catch(() => undefined);
    if (target === source || existing && stat.dev === existing.dev && stat.ino === existing.ino)
      throw Error('Benchmark output must not overwrite its private input');
  }
}
