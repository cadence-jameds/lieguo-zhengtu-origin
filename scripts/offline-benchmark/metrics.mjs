// Bounded, deterministic sampling. This module is never imported by the app.
export class Metrics {
  constructor({capacity = 2048, clock = () => performance.now(), observe} = {}) {
    this.capacity = capacity; this.clock = clock; this.observe = observe;
    this.rows = new Map(); this.stack = []; this.events = 0; this.trace = 2166136261;
    this.aiByPending = new Map(); this.pendingReceipts = 0;
    this.dimensions = {cities: 0, armies: 0, pendingReceipts: 0, queue: 0};
  }
  enter(label) { const span = {label, at: this.clock(), child: 0, pendingReceipts: this.pendingReceipts}; this.stack.push(span); return span; }
  leave(span) {
    const ms = this.clock() - span.at;
    if (this.stack.pop() !== span) throw Error('Profiler spans overlap');
    if (this.stack.length) this.stack.at(-1).child += ms;
    this.record(span.label, ms, Math.max(0, ms - span.child));
    if (span.label === 'event:ai.decide') {
      const floor = span.pendingReceipts < 1024 ? 0 : 2 ** Math.floor(Math.log2(span.pendingReceipts));
      const row = this.aiByPending.get(floor) ?? {calls: 0, ms: 0}; row.calls++; row.ms += ms; this.aiByPending.set(floor, row);
    }
  }
  record(label, ms, self = ms) {
    let row = this.rows.get(label);
    if (!row) this.rows.set(label, row = {calls: 0, inclusiveMs: 0, selfMs: 0, maxMs: 0, samples: [], rng: 0x6d2b79f5});
    row.calls++; row.inclusiveMs += ms; row.selfMs += self; row.maxMs = Math.max(row.maxMs, ms);
    if (row.samples.length < this.capacity) row.samples.push(ms);
    else { // Algorithm R; PRNG belongs only to the profiler, never game RNG.
      let x = row.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; row.rng = x >>> 0;
      const i = Math.floor(row.rng / 4294967296 * row.calls);
      if (i < this.capacity) row.samples[i] = ms;
    }
  }
  event(e, w, scheduler) {
    this.events++;
    this.pendingReceipts = w.ledger?.pending.length ?? w.commandReceipts.length;
    for (const ch of e.id + ':' + e.at + ':' + e.type) this.trace = Math.imul(this.trace ^ ch.charCodeAt(0), 16777619) >>> 0;
    this.dimensions.cities = Math.max(this.dimensions.cities, w.cities.length);
    this.dimensions.armies = Math.max(this.dimensions.armies, w.armies.length);
    this.dimensions.pendingReceipts = Math.max(this.dimensions.pendingReceipts, w.ledger?.pending.length ?? w.commandReceipts.length);
    this.dimensions.queue = Math.max(this.dimensions.queue, scheduler.size);
    if (this.events % 256 === 0) this.observe?.(this.events);
  }
  result() {
    return {events: this.events, eventOrderChecksum: this.trace.toString(16).padStart(8, '0'), maximumObservedDimensions: this.dimensions,
      aiCostByPendingReceipts: [...this.aiByPending].map(([floor, r]) => ({minimumPendingReceipts: floor, maximumPendingReceipts: floor ? floor * 2 - 1 : 1023,
        calls: r.calls, inclusiveMs: r.ms, meanMs: r.ms / r.calls})),
      sampling: {method: 'deterministic Algorithm R reservoir; inclusive durations; percentiles are sampled estimates', capacityPerLabel: this.capacity,
        p50Minimum: 20, p95Minimum: 100, p99Minimum: 1000},
      operations: Object.fromEntries([...this.rows].map(([key, r]) => {
        const s = [...r.samples].sort((a, b) => a - b), q = p => s[Math.ceil(s.length * p) - 1];
        return [key, {calls: r.calls, inclusiveMs: r.inclusiveMs, selfMs: r.selfMs, meanMs: r.inclusiveMs / r.calls, maxMs: r.maxMs,
          sampleCount: s.length, p50Ms: r.calls >= 20 ? q(.5) : null, p95Ms: r.calls >= 100 ? q(.95) : null, p99Ms: r.calls >= 1000 ? q(.99) : null}];
      }))};
  }
}
