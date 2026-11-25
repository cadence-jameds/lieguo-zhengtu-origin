# Issue #38 — Imperial map and per-unit carrying capacity

The issue's original queue copy was shipped in PR #42 (844a904); current
regression coverage still checks the actual Gold Mine 17 dialog and all queue
occupancies across fields, buildings and walls.

The two later feedback items are implemented in the separate source commit:
imperial detailed-world center art is 130%, with pick and edge-culling geometry
derived from the drawn square. Earlier ages, overview markers, draw order and
town/miniature scaling are unchanged. Recruitment and garrison displays read
each actual unit's **base** carrying capacity (including zero), not the
technology-adjusted value. No balance, save, worker or rules changes.

- The original #71 draft passed 116 tests across seven focused files.
- On the 771e5729 source port, Typecheck, production/PWA build and 21 tests across
  five focused suites passed. These include the Gold Mine 17 dialog, shared
  construction-capacity copy, current training-slot UI, display geometry and carry.
- The geometry suite covers all six civilizations, all four ages, overview plus
  detailed zooms, and widths 320, 390 and 1440. It is not FPS, native Canvas or
  physical touch evidence.
- The new finite successor pins the exact implementation and predecessor SHA
  chain, validates all selected bytes and rejects unknown, out-of-scope and
  altered files. Historical 110% browser artifacts remain historical; no data
  was rewritten. Native-browser screenshots/FPS/physical Android not run here.
