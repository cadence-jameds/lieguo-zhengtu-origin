#!/usr/bin/env bash
# Synthetic only: never needs the private backup.
set -euo pipefail
npm run typecheck
node node_modules/vitest/vitest.mjs run --maxWorkers=1 \
  src/game/formal/{offlinePendingMembershipRecovery,offlineCommandEvidence,replayP0,boundedPersistence,offlineCompletedResearch,durableRuntime}.test.ts
npm run build
