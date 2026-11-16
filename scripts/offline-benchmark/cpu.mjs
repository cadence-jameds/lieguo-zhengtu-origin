// Aggregate sampled leaf CPU only. Never serialize raw profiles or call arguments.
export function summarizeCPU(profile) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), times = new Map();
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const f = nodes.get(profile.samples[i]).callFrame;
    const label = (f.functionName || '(anonymous)') + ' @ ' + f.url.split('/').at(-1).split('?')[0];
    times.set(label, (times.get(label) ?? 0) + profile.timeDeltas[i] / 1000);
  }
  const durationMs = (profile.endTime - profile.startTime) / 1000;
  return {durationMs, intervalUs: 1000, sampleCount: profile.samples?.length ?? 0,
    topLeafSamples: [...times].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([operation, sampleMs]) => ({operation, sampleMs, percent: sampleMs / durationMs * 100})),
    note: 'Statistical leaf samples, includes idle/GC; not inclusive operation spans. Profiler perturbs timing.'};
}
