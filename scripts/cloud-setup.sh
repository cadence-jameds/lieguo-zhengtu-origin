#!/usr/bin/env bash
set -euo pipefail
node --version
npm --version
npm ci --include=dev --cache "${TMPDIR:-/tmp}/lieguo-origin-npm-cache" --registry=https://registry.npmjs.org --no-audit --no-fund
npm run typecheck
