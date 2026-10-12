# Stage 2 B2 — v84 formal world

Native newGame uses formal generator directly: 384×384, 32×32 regions, 100 factions and 432 wild slots. All 100 initial cities use D7 with no integration penalty, capital, starting army or AI bonuses. B1 fixture remains explicitly fixture=true for unchanged regression tests; native schemaVersion=2 is distinct. No DEMO migration.

Seed, generator version and terrain version define geometry. Campaign IDs identify saves only. Terrain stored as row-major L/F/R/W/M string; rivers traverse but never build, mountains never traverse/build, water never builds. Cities and sites select legal positions before insertion. Wild region quota is three, with adjacent-region spill interface. Day1 levels follow v84 weights; rewards/guards/respawn are deferred.

SpatialIndex is derived in memory: coordinate, region, owner, nearby and viewport queries. No renderer/cache/index data is persisted. Formal Canvas reads the adapter's native terrain and index; complete artwork/projection/LOD belongs to B10. Formal worker imports no legacy authority. DB/atomic commit and R1 unchanged; codec accepts explicitly distinct B1-fixture and native contracts.

Run npm ci --ignore-scripts; npm run test:b2; npm run test:b1; npx vitest run src/game/formal/recoveryR1.test.ts; npm run typecheck; npm run build. Metrics: CORE_METRICS_FILE=/absolute/metrics.json npm run test:metrics.
