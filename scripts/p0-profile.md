# P0 replay profiling

The benchmark compiles a temporary JavaScript copy of the current source. Production source and the supplied save are read only. Install the lockfile dependencies with Node 22.13 or newer before running it.

## Private real-save run

Keep the save and output directory private. The default output is under ignored `artifacts/p0`; generated worlds, database snapshots and raw CPU profiles must never be committed or published as CI artifacts.

```sh
P0_SHA=<recorded-source-commit> node scripts/p0-profile-prepare.mjs
P0_SAVE_PATH=<absolute-private-save-path> P0_HOURS=6 P0_SPEED=10 \
  P0_LABEL=before-6h-10x node scripts/p0-profile-run.mjs
```

`P0_HOURS=0`, `6`, and `24` measure pure loading/saving and complete offline replay. Speeds 1/10/50 are supported. The controlled `savedAt` is 1700000000000 and `now` adds the requested real duration. The 24h run changes only the decoded private test copy's legal offline cap. The original file is never modified. `P0_HOURS=0.1`, `0.25`, and `1` are available for short diagnostic profiles.

Use `P0_SOURCE_DIR` to point the runner at a prepared copy and `P0_RESULTS_DIR` to override the private output directory. The preparation script accepts source and compiled-output paths as its first and second positional arguments, which allows an immutable baseline checkout or archive to be used while production changes proceed.

## Public synthetic run

No private fixture is bundled. This option constructs a deterministic native world with 99 AI, using seed 90217 by default:

```sh
P0_SHA=<recorded-source-commit> node scripts/p0-profile-prepare.mjs
P0_SYNTHETIC=1 P0_SYNTHETIC_HISTORY=14000 P0_HOURS=0 P0_SPEED=10 \
  P0_LABEL=synthetic-history-0h node scripts/p0-profile-run.mjs
```

`P0_SYNTHETIC_HISTORY` defaults to 0 and creates valid synthetic command receipts without replaying historical rename commands. `P0_SYNTHETIC_SEED` chooses a different deterministic seed. Synthetic results cannot replace independent private-save or Android measurements.

## Elapsed reference and instrumentation

Prepare a separate copy without function/global wrappers and disable CPU sampling for the elapsed reference:

```sh
P0_INSTRUMENT=0 P0_SHA=<recorded-source-commit> \
  node scripts/p0-profile-prepare.mjs . artifacts/p0/clean
P0_SOURCE_DIR=artifacts/p0/clean P0_CPU_PROFILE=0 \
  P0_SAVE_PATH=<absolute-private-save-path> P0_HOURS=6 P0_SPEED=10 \
  P0_LABEL=before-clean-6h-10x node scripts/p0-profile-run.mjs
```

The clean run still records phase wall times and production progress event counts. The instrumented run records the SHA-256 ordering digest of every `(EventId,type,at)` and each event type's count, total, average and maximum elapsed time. Compare output-world and report-history hashes between modes. Run before and after measurements with matching source preparation, input, speed, clock and CPU contention. Record shared CPU work with `P0_CONTENTION` instead of presenting it as an uncontended result.

Use a distinct `P0_LABEL` for each repeated run and retain every result when reporting variance; reusing a label overwrites that run's output files.

Consistency checks can prepare `P0_INSTRUMENT=0 P0_RECORD_EVENTS=1` to record only true reducer events and their order, without function/global timers. Event timing fields are null in this mode. Ordinary clean elapsed references leave this optional hook disabled.

```sh
P0_INSTRUMENT=0 P0_RECORD_EVENTS=1 P0_SHA=<recorded-source-commit> \
  node scripts/p0-profile-prepare.mjs . artifacts/p0/event-only
P0_SOURCE_DIR=artifacts/p0/event-only P0_SAVE_PATH=<absolute-private-save-path> \
  P0_HOURS=6 P0_SPEED=10 P0_LABEL=private-6h-consistency \
  node scripts/p0-profile-consistency.mjs
```

The consistency driver compares synchronous, cooperative, six-segment and two-segment save/load runs from the same input. It requires exact reports and processed event identities/order. Single-commit worlds must match exactly. Segmented gameplay comparisons normalize only `world.revision` and `commandReceipts[].committedRevision`; separate checks require exact CAS progression, receipt identity/fingerprint/disposition preservation, unchanged prior receipt revisions and valid checkpoints. A natural zero-hour reducer no-op is recorded separately from the new revision required by a durable clock save. Repeat with hours 0 and 24 for those boundaries.

Compare two detailed aggregate files with `node scripts/p0-profile-compare.mjs <before-metrics> <after-metrics>`. It exits nonzero for a world/report/count/order mismatch. Ordering and type counts are marked SKIP when either run has no event hook. Instrumentation or contention differences remain visible and must be considered before interpreting an improvement ratio.

V8 CPU samples use a 1ms interval. The top 10 grouped functions are mapped back to TypeScript when source maps are available. Function timers report inclusive and exclusive active costs, with raw and excluded pause time retained. Structured-clone measurements distinguish native worlds containing terrain, dynamic world-shaped drafts without terrain, city drafts, events, receipts/orders and other objects. A dynamic draft is not counted as a full-world copy. Object JSON.stringify calls and receipt-array find/some operations are timed. The harness records process peak RSS, sampled heap memory, cgroup CPU quota and memory limit. `pipelineCPU` reports user and system CPU time during loading/replay/saving; CPU samples also cover input decoding and benchmark initialization.

The initial fake IndexedDB current, authority, report and Recovery rows retain the input save's receipt order. Import is not used for initialization because it sorts history. The actual `loadWithOffline` path performs schema/checksum/migration checks, complete cooperative replay and durable commit. Golden private state supports later exact world/report/order comparisons.

IndexedDB timings use fake-indexeddb. Node MessageChannel measures structured-clone transfer; it does not measure Chromium rendering or Android storage. Those require separate browser and device evidence.

Compare exact world/report digests within the same JavaScript runtime and version. Browser parity requires its own native Chromium before/after control; the benchmark does not apply numeric tolerances to world state.

## Cooperative pause coordination

The instrumented copy can pause between completed cooperative events with `P0_PAUSE_FILE=<private-marker-path>`. Create the marker to request a pause and wait for the `pause: started` message before starting competing work. Remove the marker to resume. The result reports raw wall, paused time and active elapsed time separately. Per-event timing and ordering remain intact. A paused run must not be described as a continuous wall-clock measurement.

## Artifacts

Standard output contains only aggregate timings, counts, hardware details and hashes. The private output directory holds detailed aggregate metrics, interim/progress aggregates, a raw CPU profile, the golden world and durable database rows. Only reviewed aggregate data may be copied into public evidence; raw saves, worlds, traces and database snapshots must remain private.

`aiCommandReceipts` counts issuers whose faction role is AI. `autonomousCommandIdPrefixReceipts` separately counts the historical autonomous CommandId prefix; player governors can use that prefix, so it is not an AI-owner classification. Historical receipts, currently pending events and processed replay events are reported separately.
