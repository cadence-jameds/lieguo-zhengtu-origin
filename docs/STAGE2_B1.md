# Stage 2 B1 — v0.30.3

B1 implements the formal schema/scheduler/save skeleton against v84. This is an engineering fixture, not a release of the complete v84 game. No Sites publication or DEMO migration has occurred.

## Active authority

`main.tsx → App.tsx → game/GameApp.tsx → game/useGame.ts → game/runtime.worker.ts → game/engine.ts`

- `game/types.ts` exports only formal types/IDs/version contracts.
- `game/world.ts` constructs a fixture directly (32×32 coordinates, two Factions, three test cities).
- `game/persistence.ts` is the only active persistence entry.
- `game/WorldMap.tsx` remains the map renderer. `formal/mapView.ts` creates an ephemeral read-only legacy-shaped renderer view. It is never serialized or sent back to the authority. Its compatibility `schema`/focus-city fields do not exist in the formal save.
- `legacy*.ts(x)` preserve previously active DEMO modules and UI for asset regression/future adapters. They do not enter the formal Worker import graph. `src/simulation/*`, `src/persistence/*`, `src/worker/world.worker.ts`, `src/hooks/useWorldEngine.ts`, and `src/map/WorldMapCanvas.tsx` remain prototypes.

## Versions and storage

Initial B1 values (final freeze is B11): appVersion 0.30.3; schemaVersion 1; contentVersion `lieguo-formal-b1.1`; rulesetVersion `v84-b1-skeleton.1`; worldGeneratorVersion `minimal-fixture-b1.1`; terrainVersion 1.

Save format: `lieguo-formal-save`. DB: `lieguo-formal-stage2-schema1`. Writer lock: `lieguo-formal-stage2-schema1-writer`. Dexie version 1 defines `saves`, `backups`, and `BattleReports`.

Every IO shape is strict. Validators contain no coercion/defaults/normalization/repairs/upgrades. SHA-256 validates snapshot/report integrity. Imports and Recovery reject DEMO envelopes before writes. Formal reset clears only formal tables; it never deletes or opens a DEMO database.

`saves.current` contains the world envelope. `saves.authority` durably retains monotonic committed revision, per-campaign command receipts and event/report/project sequence high-water marks. These are updated together with reports and two Recovery snapshots in one transaction.

## Revision and replay

Pure reducers return drafts. Worker exposes a draft only after persistence resolves. Normal save CAS checks expected revision and increments once. Failed transactions leave every store and the displayed world unchanged.

Command fingerprints cover campaign, issuer and logical payload. Same ID/same payload returns the original receipt without executing or saving again. Different payload for an existing ID is rejected. New stale commands are rejected. There is no 256-ID eviction; B1 retains all per-campaign receipts.

Recovery/import is an explicit branch switch. Revision never decreases. Receipts present in the selected snapshot remain applied. Locally committed IDs missing from that snapshot are preserved as `rolled-back`; replay returns that disposition and never re-applies them. A new user intention needs a new ID and the current revision. Prior event/report/project sequence high-water marks are retained. Existing scheduled events keep their original IDs, while newly scheduled events cannot reuse a rolled-back ID.

Completion receipts belong to world state. A repeated event in a completed branch cannot grant technology/reports twice. Explicit Recovery rolls completion effects back with the world, allowing the original pending event to complete once in the recovered branch.

## Projects

Research is Faction-owned. The schema records payment mode, technology scope, requirements/contributions, source Faction/City and CommandId, qualification/duration snapshots, funding transition command, stable completion event and phase.

`funding` has no start/ETA. Full four-resource funding transitions once to `researching`; completion transitions once to `completed`. The fixture reducer exercises that contract without a complete research catalog or modern gameplay. `fixture.modern-research` costs/time are synthetic test data, not v84 balance changes.

Direct research accepts only actually controlled same-Faction cities. Single-city research accepts only its initiating city. Snapshot qualifications/duration are never recomputed after city loss/downgrade.

Large projects have a different physical-shipment contract: Faction/Empire owner scope, legal contributor scope, dispatch authorization snapshot, in-transit shipment, arrival event and project pool. Only arrived resources count toward the pool. Technology transfer is Faction-only. No shipment simulation or endgame construction is implemented in B1.

## Verification commands

```
npm ci --ignore-scripts
npm run typecheck
npm run test:b1
npm run test:legacy-active
npm run test:prototype
npm run build
```

`test:b1` is the formal gate. It covers schema, IDs, scheduler, source import graph, command/revision/replay, actual Dexie transactions over fake-indexeddb, rollback/failure/retry, Recovery/import, DEMO isolation and the formal writer lock. Typecheck includes compile-time negative ID-assignment checks.

`test:legacy-active` retains the formerly active engine/UI/storage regression assets. It does not certify v84 rules. Its externally supplied late-game case remains conditional on `REALM_REGRESSION_SAVE`; skipped is not passed.

`test:prototype` is retained for maintenance only. `simulate:48h` remains a prototype; `simulate:8h` exercises the retained DEMO active-engine assets. Neither is a B1 long-run formal gate.

## Limits and B2 handoff

The scaffold UI supports initialization, rename, save/load/import/export, Recovery and map preview; mature city/research/politics UI remains preserved for later adapters. There is no full world generation, economy, logistics, combat, AI or modern army in B1.

B2 must supply the 384 world generator, 100 deterministic starting Factions, 432 wild sites, terrain/mask/spatial/path contracts, renderer geometry adaptation and a new generator/content version. Keep the typed IDs, scheduler, authority, transactions and DEMO isolation invariants intact. Future event kinds need explicit priority and schema entries.

All receipts/campaign authorities are retained in B1. Long-run storage sizing/compaction needs measured validation before introducing any eviction. Tests over fake-indexeddb prove transaction semantics, not browser quota/disk IO or phone performance. Browser binaries could not be downloaded in the current verification environment; physical browser/device checks remain unverified.
