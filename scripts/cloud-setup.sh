#!/usr/bin/env bash
set -euo pipefail
node --version
npm --version
npm ci --include=dev
npm run typecheck
