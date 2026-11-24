#!/usr/bin/env bash
# Synthetic only: run after locked npm ci. No private backup is referenced.
set -euo pipefail
npm run typecheck
node node_modules/vitest/vitest.mjs run --maxWorkers=1 \
  src/game/formal/{offlineShippingDraftRecovery,offlinePendingMembershipRecovery,replayP0,wonderAutoSupply,logisticsOwnership,durableRuntime}.test.ts
npm run build
