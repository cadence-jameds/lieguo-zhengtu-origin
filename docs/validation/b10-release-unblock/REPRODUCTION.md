# 隔離驗證重現

僅使用合成戰役與 localhost，不連正式 Pages，不載私人存檔。工具需 Node 22.13+、`npm ci`、原生 Chromium 及 Playwright。此環境實際使用 Node 22.23.4、Chromium 154、Linux、2 CPU quota、8 GiB cgroup；沒有 Android。可用 PLAYWRIGHT_MODULE／CHROMIUM_EXECUTABLE 指定環境的 Playwright 模組及 Chromium 執行檔，不能藉此改 AI、歷史量、原測試期限或 worker 數。

## 不可變正式產物

```sh
B10_SW_BEFORE_REF=aaaee9d3b9e16f2bad6ee8a96d1ef2902d0c4607 \
B10_SW_AFTER_REF=1f44074d1d55186dd5210b159401c1dbc580bfd2 \
node docs/validation/b10-release-unblock/prepare-production-refs.mjs /tmp/b10-capacity-pair
B10_PRODUCTION_PORT=4227 node docs/validation/b10-final/production-server.mjs /tmp/b10-capacity-pair
```

前者是完整 PR #60 graph，後者是包含 expired portable Inbox 修正及 raw replay 無用掃描移除的最後程式 source。每組有自身實際 Release Metadata、Production Build、獨立 validation Worker；`__validation` 不進正式 dist，不提交產物。修改量測 helper 後用 `bundle-validation-worker.mjs <pair>` 重編 validation Worker，不修改被比較的正式 source。

```sh
B10_PRODUCTION_URL=http://127.0.0.1:4227/lieguo-zhengtu-origin/ \
B10_NATIVE_VARIANTS=after B10_NATIVE_OUT=artifacts/b10-release-unblock/native-corrected-persistence.json \
node docs/validation/b10-release-unblock/persistence-native.mjs /tmp/b10-capacity-pair
```

預設 0／1k／10k／60k／150k，20 次 T1/T2/query/rejected T2，5 次 reopen、Recovery、Quick/Full 匯出及匯入，另 5 個全新 Worker 冷載入。after 另跑 14 原子故障、50 快速接受／writer fencing、1,025 次實際 T1/T2 的退休身份測試、真正 Worker terminate 後恢復與 Ack 遺失查詢。before 以 `B10_NATIVE_VARIANTS=before B10_NATIVE_BENCH_ONLY=1` 執行同量測工作；不可把 before 的 renderer crash 改成 PASS。

Fixture 為相同合法 100 勢力、99 個已排程 AI、25X 世界；累積歷史使用等價最終世界的合成 rolled-back 改名收據。不是聲稱 150k 次真實 T2 吞吐。每筆資料仍經正式 Schema／Persistence；活躍 99 AI 的競爭另以 GameApp soak 測試。

百分位為 nearest-rank；n=5 的 p95 是樣本最大值，不代表穩定母體 p95。配對環境相同但測試依序執行，保留 OS／GC 雜訊，不拿歷史不同版本的絕對時間計算精確改善率。IndexedDB JSON bytes 為全部表的精確 UTF-8 JSON 表示量；以 512-row 分頁避免統計額外配置整庫物件／字串，0／1k 再與完整 array JSON 實際比對。`navigator.storage.estimate()` 是 origin 的瀏覽器估計，不是索引／磁碟精確占用，兩者分開報告。

## GameApp、SW 與記憶體

`production-cold.mjs <pair>` 每組 5 次 fresh Chromium／Runtime，seed 不計入載入時間；保留真實離線補算與首屏渲染，不改時鐘。`B10_NATIVE_VARIANT=before B10_COUNTS=60000` 可重跑相同的舊版 UI 冷載入對照。Worker 冷載入與主畫面可操作分開。

`production-soak.mjs` 用真實 600,000ms wall clock、6 次 DOM 改名、99 AI／25X、雙分頁、正式 Worker／IDB，最後在原 Runtime 的 away barrier 後、原頁仍持有排他 writer Web Lock 時讀取全部 6 筆結果與單次效果，不導航 inspector 或再取得第二個 writer。無時間偏移、強制 GC 或 Scheduler 替換。headless 的 tab visibility 如未變 hidden，必須照實記錄，不能當 Android 背景驗證。

`native-diagnostics.mjs <pair>` 是**獨立**的 2 warm／1 heavy 診斷，並非正式 n=20／5 資料替代。250ms Worker heap、1 秒 browser process tree RSS 抽樣；有重疊 GC phase，不能加總成互斥停頓。RSS tree 有 shared-page 重複計數，不是 PSS；抽樣最大值不是瞬時峰值上界。沒有觀察到匹配 GC event 不等於完全沒有 GC。

SW 同格式測試需 before=`29ade31` bounded 版本、after=最終 source，分別建置並組成另一個 pair。`production-sw-successor.mjs <pair>` 跑全部五情境；原 `docs/validation/b10-final/production-sw.mjs` 也保留獨立執行結果，差異見 `SERVICE-WORKER.md`。`legacy-upgrade.mjs <old/new pair>` 使用 PR #60 舊 DB 與舊 SW，同 origin 保留資料、雙 client 更新、明確不相容提示、真正新戰役表單及重載。

## 本機與 CI

```sh
npm run typecheck
node scripts/verify-in-isolation.mjs full
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin node scripts/check-pages-build.mjs
node scripts/check-release-build.mjs
```

全部 successor／反竄改、31 世界對照、Preview／Projection boundary 依 `.github/workflows/ci.yml` 的原清單執行。完整回歸只用原隔離 runner，仍 2 workers、預設 30 秒、150k 的原 120 秒；舊長專案 hook 也保持 240 秒。不在 verified worktree 直接跑 full，避免歷史測試寫回 docs。

原始 trace、DB、備份、ZIP、dist、node_modules、完整 runner artifact 不提交；主報告提交數字、方法、狀態、SHA 及原始摘要檔的 checksum。CI 的可下載 runner artifact 另有持久連結。
