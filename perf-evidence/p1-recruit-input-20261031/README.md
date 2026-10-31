# P1 Army Recruitment Input Lag — Reproduction Evidence (2026-10-31)

**PUBLIC TEST-ONLY BRANCH. NOT FOR MERGE TO MAIN.**

This directory contains a user-provided late-game save and an original Android recruitment screenshot.
The JSON save is split into 20 UTF-8 chunks solely to work around GitHub connector upload limits.
It includes actual gameplay history and should be handled as user-provided test data.
The screenshot shows scout recruitment, the entered value `0500`, and the in-game resource shortage.
It does not itself measure frame duration or prove the lag root cause.

- Original save size: 14,296,328 bytes.
- SHA-256: `16be5971dfec1ca347fef4cbfa898f18f69c59a6c77e0b04517d41c3c2499608`
- World: 100 factions, 102 cities, 34,236 command receipts, 419 pending events, 25x speed (as observed from this save).
- Screenshot: `mobile-recruit-input.jpg`.
- Source branch: `test/p1-army-recruit-lag-evidence-20261031`.

## Use in a Codex Cloud workspace — without modifying main

Start your implementation on a new branch based on the latest `main`. Do NOT use this evidence branch as your development base.

```bash
git fetch origin refs/heads/test/p1-army-recruit-lag-evidence-20261031
mkdir -p /tmp/lieguo-recruit-perf
for i in $(seq -w 0 19); do
  git show "FETCH_HEAD:perf-evidence/p1-recruit-input-20261031/chunks/part-${i}.txt"
done > /tmp/lieguo-recruit-perf/late-game-save.json
echo "16be5971dfec1ca347fef4cbfa898f18f69c59a6c77e0b04517d41c3c2499608  /tmp/lieguo-recruit-perf/late-game-save.json" | sha256sum -c -
git show "FETCH_HEAD:perf-evidence/p1-recruit-input-20261031/mobile-recruit-input.jpg" > /tmp/lieguo-recruit-perf/mobile-recruit-input.jpg
```

Use only the reconstructed local file for before/after performance testing.
The existing save checksum, command receipts and world state must remain unchanged.
Never commit the reconstructed save or screenshot to your implementation PR.
Do not import the save into the user's active browser storage; use a disposable isolated test profile.

Do not accidentally include this evidence branch's files in a PR.
Do not merge this test branch into main or deploy it to GitHub Pages.
After tests the owner can delete this branch; note that public Git objects may remain retrievable from history/caches.

## Performance investigation scope

Main suspects:
- `src/game/presentation/DevelopmentViews.tsx`: `count` state changes rerender `ArmyView` and potentially calculate each unit's detailed preview.
- `src/game/presentation/cityActions.ts`: `recruitmentPreview()` calls `submitFormalOrder()` on the UI thread.
- `src/game/formal/worldDraft.ts` / `reducer.ts`: formal preview may clone/validate a large world.
- `src/game/presentation/liveClock.ts`: live-city updates and derived rerenders.

Measure before changing. Fix both desktop/mobile, keep Worker authoritative for actual recruitment.
Avoid full-world clones/command simulation during keyboard input.
