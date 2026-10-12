# GitHub / Cloud / Pages integration

Repository: https://github.com/cadence-jameds/lieguo-zhengtu-origin (Public).

## Preserved history

Keep the eight existing commits and SHAs. recovery-b8 remains at 4ed0f1073aafbc675b24bf8351818e76a45a76a9; work/r3-browser-verification remains at d7ceb4df97bdc9ebb58241285132c02ada7081f0. Keep local bundle origin; github is separate. Infrastructure changes are descendant commits, with no game source or baseline evidence changes.

No credentials or concrete private-account data were identified in existing history. The hosting project ID is an identifier, not a secret. Controlled saves and evidence document verification and are already in preserved history. Exclude new local saves, generated output and archives with .gitignore. Historical reference-image usage is recorded in docs/art-source; this integration makes no additional license claim.

## Cloud environment

Name: Lieguo-Origin-Cloud. Repository: the Public repository above. Default development branch: main after infrastructure integration, not release. Node: 22 (at least 22.13). Install script: bash scripts/cloud-setup.sh; maintenance: npm ci --include=dev. No application secrets are needed. Package-manager network access is sufficient for dependency installation.

Read-only validation prompt:

> Validate Lieguo-Origin-Cloud only. Read AGENTS.md. Report actual repository, branch and full HEAD SHA. Do not modify tracked files, commit, push, open a PR or deploy. Run npm run typecheck, node scripts/verify-in-isolation.mjs smoke, and npm run build with GITHUB_ACTIONS=true and GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin, then node scripts/check-pages-build.mjs. Report git status --porcelain before and after. Dependencies and temporary build/test outputs are allowed. Preserve B5 E1 HOLD, Astra Gate not PASS and physical phone MANUAL PENDING. Do not start R3/R4 work.

full regression runs all tests. r3 excludes two legacy-art files and is not full acceptance. Tests run in a disposable directory to avoid overwriting evidence.

## Release safety

Pages source: GitHub Actions (build_type=workflow). github-pages environment: branch release only, owner deployment approval, admin bypass disabled. Protect release before it exists with a ruleset: PR required, conversation resolution, strict required Verify status, no deletion or force-push, no bypass actors. The single owner approves production at the deployment environment; a second collaborator is not required merely to create the infrastructure. Protect main against force-push/deletion; keep development separate.

Production jobs only run for refs/heads/release. They check acceptance before building. Genuine acceptance must identify an ancestor source commit with unchanged src/public/build inputs and provide evidence and approver, followed by full regression/typecheck/build. CI has read-only repository permissions and cannot deploy. Manual dispatch on main/development cannot run production jobs.

Do not create release with unaccepted R3. Astra Gate is not PASS, B5 E1 HOLD, physical phone pending. No independently accepted publishable commit was identified. Pages stays unpublished.

Expected URL after acceptance: https://cadence-jameds.github.io/lieguo-zhengtu-origin/

Vite derives /lieguo-zhengtu-origin/ from GITHUB_ACTIONS and GITHUB_REPOSITORY. Build: npm run build (tsc --noEmit and vite build). Output: dist. check-pages-build validates HTML asset paths, PWA scope and Service Worker fallback.
