# Lieguo Origin

This repository contains the verified R3 v0.30.49 recovery history. Preserve existing commit SHAs and historical evidence. Do not force-push, mirror, reset, rewrite history, change game rules, or advance R3/R4 unless the human explicitly authorizes that work.

Use Node 22.13 or newer and npm ci. Run npm run typecheck and npm run build for source changes. Run tests with node scripts/verify-in-isolation.mjs full: older tests generate files under docs, so never run the full suite directly in the verified working tree. r3 mode excludes two legacy art files and is diagnostic, not a full-suite or Gate PASS. smoke is a limited non-Gate check.

The baseline has three known legacy art failures; B5 E1 is HOLD, Astra Gate is not PASS, and physical-phone testing is pending. Preserve these facts. Never change tests or acceptance records merely to obtain green CI.

Push development to a development branch. The current deploy-pages.yml automatically deploys tested main as an authorized public preview; ordinary PRs only validate. Formal release acceptance remains separate. Never merge or deploy without task authorization.

For read-only Cloud validation, report branch/HEAD, run typecheck, build and isolated smoke checks, and verify git status --porcelain stays empty. Do not commit, push, open a PR, edit tracked files, or declare release acceptance. Dependencies and temporary build/test outputs are allowed.

Do not commit credentials, private user saves, node_modules, dist, artifacts, raw browser traces, or ZIP/bundle archives. Existing synthetic scenario evidence remains historical provenance; ignore rules do not remove it from history.

For playable changes, add exactly one new releases/notes/<slug>.json (Traditional Chinese title and 1–10 completed player-visible notes). Copy the same JSON into the PR template release-notes markers; CI validates it from the pull_request event without new permissions. Do not edit merged notes, manually bump the baseline package version, claim spec-only work is finished, or write generated .release/dist files to Git. See docs/RELEASE_METADATA.md.
