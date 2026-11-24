# Native offline horizon smoke (synthetic only)

Replay options on the CLI are **not** the persisted campaign settings. A source
stored at 3× / 1 h can advance only 3 world hours even if an external label says
25× / 12 h. This smoke starts an isolated generated campaign at **3× / 1 h**,
uses normal `campaign.configure` admission + persistence in its throwaway
copy, reopens the database and checks **25× / 12 h**, then asks for one real
hour. It requires an exact **25 world hours** of engine advancement and a fresh
post-commit readback with existing authority-field comparisons. It never
executes a 300-world-hour timing, never accepts private input in synthetic
settings smoke mode, and is not a performance/release gate.

On the project checkout after locked `npm ci`, the synthetic Node logical test
(uses fake IndexedDB, not Chromium) is:

```sh
node scripts/benchmark-offline.mjs --mode count --hours 1 --ai 0 \
  --synthetic-settings-smoke --configure-25x-copy --require-25x-horizon \
  --out /tmp/offline-settings-logical.json
```

Negative control: repeat without `--configure-25x-copy`. It must fail with
`OFFLINE_STORED_SETTINGS_MISMATCH` rather than emit a valid result. Guarded
runs can return `replayExtent.kind: terminal-player-defeat` only for a real
engine defeat state with a matching world-time delta; that is not a full horizon.
Use no `--private` in these examples.

On a compatible unprivileged host with regular Chromium sandbox support, set
`CHROMIUM_PATH` to the Chromium executable and `PLAYWRIGHT_MODULE` to an
installed Playwright JS entry point if the defaults do not apply. Use ordinary
approved installation tooling, and do not change OS security settings:

```sh
node scripts/benchmark-offline-browser.mjs --mode count --hours 1 --ai 0 \
  --synthetic-settings-smoke --configure-25x-copy --require-25x-horizon \
  --port 5197 --out /tmp/offline-settings-native.json
```

Worker-side timings exclude setup, independent persistence readback, and UI.
Separately run the application page on loopback only:

```sh
npm run dev -- --host 127.0.0.1 --strictPort --port 5173
# In a second terminal, same checkout and Playwright/Chromium settings.
# Provide Playwright as a local package or set PLAYWRIGHT_MODULE to its module path.
node scripts/verify-offline-ui-smoke.mjs http://127.0.0.1:5173/ /tmp/offline-ui-smoke.json
```

This independently seeds two generated cities in a fresh isolated browser
context; no backup or traces are served. It observes the engine-loaded summary,
validates stored settings and a 25–26 world-hour window (the persisted
anchor is backdated one real hour before page startup; small extra elapsed time
is expected), dismisses the report dialog, switches to the second owned city,
and requires the matching city panel heading without issuing a game command.
It reports launch-to-interactive, continue-to-interactive, and city
selection-to-panel times separately. It then closes the app page and opens a
new persistence instance to verify the configured save and advancement.
This app-page smoke measures a desktop native Chromium mobile viewport on a
Vite dev server, not production release build or Android latency. Keeping the
same Chromium process/context is not a process restart or device durability test.

For a separately authorized real native acceptance run (not this smoke), exact
source identity, an isolated consumer-local source and valid app/device are
required. The runner's explicit `--configure-25x-copy --require-25x-horizon`
flags provide configurable copy verification without making a private fixture
a served asset. No one-hour result replaces launch-to-playable or complete
12 h ×25 native on the exact designated save.
